const READER_BASE = 'https://r.jina.ai/';

export const RESULTS_VIEWS = {
  results: { label: 'Resultados y clasificación', suffix: 'Resultados.aspx' },
  calendar: { label: 'Calendario completo', suffix: 'Calendarios.aspx' },
  teams: { label: 'Equipos', suffix: 'Equipos.aspx' },
  upcoming: { label: 'Próximos partidos', suffix: 'Partidos.aspx' }
};

const clean = value => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

async function fetchReader(url) {
  const response = await fetch(`${READER_BASE}${url}`, {
    cache: 'no-store',
    headers: { 'x-respond-with': 'markdown', 'x-no-cache': 'true' }
  });
  if (!response.ok) throw new Error(`${response.status} al consultar FEB mediante Reader.`);
  const text = await response.text();
  if (!text.trim()) throw new Error('FEB devolvió un documento vacío.');
  return text;
}

function splitTableRow(line) {
  if (!line.includes('|')) return [];
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map(cell => clean(cell.replace(/^\[([^\]]+)\]\([^)]*\)$/, '$1')));
}

function isSeparatorRow(cells) {
  return cells.length > 0 && cells.every(cell => /^:?-{2,}:?$/.test(cell));
}

function parseTables(text) {
  const lines = String(text || '').split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length; i += 1) {
    if (!lines[i].includes('|') || i + 1 >= lines.length || !lines[i + 1].includes('|')) continue;
    const headers = splitTableRow(lines[i]);
    const separator = splitTableRow(lines[i + 1]);
    if (!headers.length || !isSeparatorRow(separator)) continue;
    const rows = [];
    i += 2;
    while (i < lines.length && lines[i].includes('|')) {
      const cells = splitTableRow(lines[i]);
      if (cells.length) rows.push(cells);
      i += 1;
    }
    tables.push({ headers, rows });
    i -= 1;
  }
  return tables;
}

function parseHeader(text) {
  const lines = String(text || '').split(/\r?\n/).map(clean);
  const line = lines.find(value => /^20\d{2}\/20\d{2}\s+/.test(value));
  if (!line) return { season: '', category: '' };
  const match = line.match(/^(20\d{2}\/20\d{2})\s+(.+)$/);
  return { season: match?.[1] || '', category: clean(match?.[2] || '') };
}

function parseScore(value) {
  const match = clean(value).match(/^(\d+)\s*-\s*(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function parseMatchText(value) {
  const text = clean(value);
  const match = text.match(/^(.+?)\s+-\s+(.+)$/);
  return match ? { home: clean(match[1]), away: clean(match[2]) } : null;
}

function dateValue(value) {
  const match = clean(value).match(/^(\d{1,2}\/\d{1,2}\/\d{4})$/);
  return match ? match[1] : '';
}

function timeValue(value) {
  const match = clean(value).match(/^(\d{1,2}:\d{2})$/);
  return match ? match[1] : '';
}

function findColumn(headers, patterns) {
  const index = headers.findIndex(header => patterns.some(pattern => pattern.test(key(header))));
  return index;
}

function parseMatchTable(table, inheritedJornada = '') {
  const headers = table.headers.map(clean);
  const matchIndex = findColumn(headers, [/partido/, /encuentro/, /equipo/]);
  const scoreIndex = findColumn(headers, [/resultado/, /marcador/]);
  const dateIndex = findColumn(headers, [/fecha/, /dia/]);
  const timeIndex = findColumn(headers, [/hora/]);
  const jornadaIndex = findColumn(headers, [/jornada/]);
  if (matchIndex < 0) return [];
  const matches = [];
  for (const row of table.rows) {
    const matchTeams = parseMatchText(row[matchIndex] || '');
    if (!matchTeams) continue;
    const score = scoreIndex >= 0 ? parseScore(row[scoreIndex]) : null;
    const date = dateIndex >= 0 ? dateValue(row[dateIndex]) : '';
    const time = timeIndex >= 0 ? timeValue(row[timeIndex]) : '';
    if (!date && !score) continue;
    matches.push({
      ...matchTeams,
      homeScore: score ? score[0] : null,
      awayScore: score ? score[1] : null,
      date,
      time,
      jornada: jornadaIndex >= 0 ? clean(row[jornadaIndex]) : inheritedJornada,
      played: Boolean(score),
      venue: ''
    });
  }
  return matches;
}

function parseClassificationTable(table) {
  const headers = table.headers.map(clean);
  const teamIndex = findColumn(headers, [/equipo/]);
  const pj = findColumn(headers, [/^pj/, /partidos jugados/]);
  const pg = findColumn(headers, [/^pg/, /ganados/]);
  const pp = findColumn(headers, [/^pp/, /perdidos/]);
  const pf = findColumn(headers, [/^pf/, /favor/]);
  const pc = findColumn(headers, [/^pc/, /contra/]);
  const pts = findColumn(headers, [/pto/, /puntos/]);
  const form = findColumn(headers, [/^r\.?$/, /racha/]);
  if (teamIndex < 0 || pj < 0 || pg < 0 || pp < 0 || pf < 0 || pc < 0 || pts < 0) return [];
  return table.rows.map((row, index) => {
    const numeric = [pj, pg, pp, pf, pc, pts].map(i => Number(String(row[i] || '').replace(/[^0-9-]/g, '')));
    if (!row[teamIndex] || numeric.some(Number.isNaN)) return null;
    return {
      position: Number(String(row[0] || '').replace(/[^0-9]/g, '')) || index + 1,
      team: clean(row[teamIndex]), played: numeric[0], wins: numeric[1], losses: numeric[2],
      pointsFor: numeric[3], pointsAgainst: numeric[4], points: numeric[5], form: clean(row[form] || '')
    };
  }).filter(Boolean);
}

function parseData(text) {
  const { season, category } = parseHeader(text);
  const tables = parseTables(text);
  let classification = [];
  let matches = [];
  for (const table of tables) {
    const classRows = parseClassificationTable(table);
    if (classRows.length > classification.length) classification = classRows;
    const tableMatches = parseMatchTable(table);
    if (tableMatches.length) matches.push(...tableMatches);
  }

  const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean);
  let jornada = '';
  for (let i = 0; i < lines.length; i += 1) {
    const jm = lines[i].match(/^Jornada\s+(\d+)(?:\s+(\d{1,2}\/\d{1,2}\/\d{4}))?/i);
    if (jm) { jornada = jm[1]; continue; }
    const teamLine = parseMatchText(lines[i]);
    if (!teamLine || /^(resultados|clasificaci[oó]n|temporada|categor[ií]a|campo|jornada)/i.test(lines[i])) continue;
    const next = clean(lines[i + 1] || '');
    const score = parseScore(next);
    const date = dateValue(lines[i + 2] || '') || dateValue(next.split(/\s+/).at(-1) || '');
    const time = timeValue(lines[i + 3] || '') || timeValue(next.split(/\s+/).at(-1) || '');
    if (score && (date || lines[i + 2])) matches.push({ ...teamLine, homeScore: score[0], awayScore: score[1], date, time, jornada, played: true, venue: '' });
  }

  const unique = new Map();
  for (const match of matches) {
    const id = `${key(match.home)}|${key(match.away)}|${match.date}|${match.homeScore ?? ''}-${match.awayScore ?? ''}`;
    unique.set(id, match);
  }
  return { season, category, matches: [...unique.values()], classification, teams: classification.map(row => ({ name: row.team, club: row.team })), rawText: text };
}

function normalizeCompetitionUrl(url, view = 'results') {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('La URL de FEB no es válida.'); }
  if (!/competiciones\.feb\.es$/i.test(parsed.hostname)) throw new Error('La consulta debe apuntar a competiciones.feb.es.');
  if (!['3', '32'].includes(parsed.searchParams.get('a') || '')) throw new Error('Fuente FEB/FAB no válida.');
  if (!parsed.searchParams.get('c')) throw new Error('No se ha encontrado el identificador de competición.');
  parsed.pathname = `/autonomicas/${RESULTS_VIEWS[view]?.suffix || 'Resultados.aspx'}`;
  parsed.searchParams.set('med', parsed.searchParams.get('med') || '0');
  return parsed.href;
}

export async function fetchCompetition(url, view = 'results') {
  const normalized = normalizeCompetitionUrl(url, view);
  const text = await fetchReader(normalized);
  const data = parseData(text);
  if (!data.matches.length && !data.classification.length) throw new Error('FEB no ha devuelto datos reconocibles para esta competición.');
  return { ...data, url: normalized, view };
}

export function analyzeTeam(data, teamQuery = '') {
  const query = key(teamQuery);
  const matches = query ? data.matches.filter(match => key(match.home) === query || key(match.away) === query) : data.matches;
  const played = matches.filter(match => match.played && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore));
  let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0, homeGames = 0, awayGames = 0, homeWins = 0, awayWins = 0;
  for (const match of played) {
    const home = key(match.home) === query;
    const pf = home ? match.homeScore : match.awayScore;
    const pc = home ? match.awayScore : match.homeScore;
    pointsFor += pf; pointsAgainst += pc;
    if (home) { homeGames += 1; if (pf > pc) { wins += 1; homeWins += 1; } else losses += 1; }
    else { awayGames += 1; if (pf > pc) { wins += 1; awayWins += 1; } else losses += 1; }
  }
  return { matches: matches.length, played: played.length, scheduled: matches.length - played.length, wins, losses, pointsFor, pointsAgainst, differential: pointsFor - pointsAgainst, winRate: played.length ? (wins / played.length) * 100 : 0, homeGames, awayGames, homeWins, awayWins };
}
