const READER_BASE = 'https://r.jina.ai/';

export const RESULTS_VIEWS = {
  results: { suffix: 'Resultados.aspx' },
  calendar: { suffix: 'Calendarios.aspx' },
  teams: { suffix: 'Equipos.aspx' },
  upcoming: { suffix: 'Partidos.aspx' }
};

const clean = (value) => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\s+/g, ' ')
  .trim();

const key = (value) => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

async function fetchReader(url) {
  const response = await fetch(`${READER_BASE}${url}`, {
    cache: 'no-store',
    headers: { 'x-no-cache': 'true', 'x-respond-with': 'markdown', Accept: 'text/plain,text/markdown,*/*;q=0.8' }
  });
  if (!response.ok) throw new Error(`${response.status} al consultar FEB mediante Reader.`);
  const text = await response.text();
  if (!text.trim()) throw new Error('FEB devolvió un documento vacío.');
  return text;
}

function scoreValue(value) {
  const match = clean(value).match(/^(\d+)\s*-\s*(\d+)$/);
  return match ? [Number(match[1]), Number(match[2])] : null;
}

function dateValue(value) {
  const match = clean(value).match(/^(\d{1,2}\/\d{1,2}\/\d{4})$/);
  return match ? match[1] : '';
}

function timeValue(value) {
  const match = clean(value).match(/^(\d{1,2}:\d{2})$/);
  return match ? match[1] : '';
}

function teamsValue(value) {
  const match = clean(value).match(/^(.+?)\s+-\s+(.+)$/);
  return match ? { home: clean(match[1]), away: clean(match[2]) } : null;
}

function parseHeader(text) {
  const line = String(text).split(/\r?\n/).map(clean).find((v) => /^20\d{2}\/20\d{2}\s+/.test(v));
  if (!line) return { season: '', category: '' };
  const match = line.match(/^(20\d{2}\/20\d{2})\s+(.+)$/);
  return { season: match?.[1] || '', category: clean(match?.[2] || '') };
}

function splitCells(line) {
  let value = String(line).trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value.split('|').map(clean).filter(Boolean);
}

function parseMarkdownTables(text) {
  const lines = String(text).split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].includes('|') || !lines[i + 1].includes('|')) continue;
    const headers = splitCells(lines[i]);
    const separator = splitCells(lines[i + 1]);
    if (!separator.length || !separator.every((c) => /^:?-{2,}:?$/.test(c))) continue;
    const rows = [];
    i += 2;
    while (i < lines.length && lines[i].includes('|')) {
      const cells = splitCells(lines[i]);
      if (cells.length) rows.push(cells);
      i += 1;
    }
    tables.push({ headers, rows });
    i -= 1;
  }
  return tables;
}

function parseClassificationLines(text) {
  const rows = [];
  for (const raw of String(text).split(/\r?\n/)) {
    const line = clean(raw);
    if (!line || !/^\d+\s+/.test(line)) continue;
    const tokens = line.split(' ');
    if (tokens.length < 8) continue;
    const position = Number(tokens[0]);
    if (!Number.isInteger(position)) continue;

    // FEB publishes: posición + equipo + PJ PG PP PF PC PTO R.
    // The last 7 tokens are numeric except R, which may be +5/-3.
    const tail = tokens.slice(-7);
    if (!tail.every((v, i) => i === 6 ? /^[+-]?\d+$/.test(v) : /^\d+$/.test(v))) continue;
    const nums = tail.slice(0, 6).map(Number);
    const team = tokens.slice(1, -7).join(' ').trim();
    if (!team) continue;
    rows.push({ position, team, played: nums[0], wins: nums[1], losses: nums[2], pointsFor: nums[3], pointsAgainst: nums[4], points: nums[5], form: tail[6] });
  }
  return dedupeClassification(rows);
}

function parseClassificationTables(tables) {
  const rows = [];
  for (const table of tables) {
    for (const raw of table.rows || []) {
      const line = raw.map(clean).join(' ');
      rows.push(...parseClassificationLines(line));
    }
  }
  return dedupeClassification(rows);
}

function dedupeClassification(rows) {
  const map = new Map();
  for (const row of rows) map.set(key(row.team), row);
  return [...map.values()].sort((a, b) => a.position - b.position);
}

function parseMatchLine(line, jornada = '') {
  const value = clean(line);
  const combined = value.match(/^(.+?)\s+-\s+(.+?)\s+(\d+)\s*-\s*(\d+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
  if (combined) return { home: clean(combined[1]), away: clean(combined[2]), homeScore: Number(combined[3]), awayScore: Number(combined[4]), date: combined[5], time: combined[6], jornada, played: true, venue: '' };
  const pending = value.match(/^(.+?)\s+-\s+(.+?)\s+(?:-|—)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
  if (pending) return { home: clean(pending[1]), away: clean(pending[2]), homeScore: null, awayScore: null, date: pending[3], time: pending[4], jornada, played: false, venue: '' };
  return null;
}

function parseMatches(text, tables = []) {
  const out = [];
  let jornada = '';
  let pendingTeams = null;
  const lines = String(text).split(/\r?\n/).map(clean).filter(Boolean);

  for (const line of lines) {
    const jornadaMatch = line.match(/^Jornada\s+(\d+)(?:\s+(\d{1,2}\/\d{1,2}\/\d{4}))?/i);
    if (jornadaMatch) { jornada = jornadaMatch[1]; pendingTeams = null; continue; }

    const combined = parseMatchLine(line, jornada);
    if (combined) { out.push(combined); pendingTeams = null; continue; }

    const cells = line.includes('|') ? splitCells(line) : [];
    if (cells.length) {
      const teamCell = cells.find((cell) => teamsValue(cell));
      const score = cells.map(scoreValue).find(Boolean);
      const date = cells.map(dateValue).find(Boolean) || '';
      const time = cells.map(timeValue).find(Boolean) || '';
      const teams = teamsValue(teamCell || '');
      if (teams && date) {
        out.push({ ...teams, homeScore: score?.[0] ?? null, awayScore: score?.[1] ?? null, date, time, jornada, played: Boolean(score), venue: '' });
        pendingTeams = null;
        continue;
      }
    }

    if (!pendingTeams) {
      const teams = teamsValue(line);
      if (teams) { pendingTeams = teams; continue; }
    }

    if (pendingTeams) {
      const score = scoreValue(line);
      const date = dateValue(line);
      const time = timeValue(line);
      const dateMatch = line.match(/^(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
      const scoreDate = line.match(/^(\d+)\s*-\s*(\d+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
      if (scoreDate) {
        out.push({ home: pendingTeams.home, away: pendingTeams.away, homeScore: Number(scoreDate[1]), awayScore: Number(scoreDate[2]), date: scoreDate[3], time: scoreDate[4], jornada, played: true, venue: '' });
        pendingTeams = null;
      } else if (score && date) {
        out.push({ home: pendingTeams.home, away: pendingTeams.away, homeScore: score[0], awayScore: score[1], date, time, jornada, played: true, venue: '' });
        pendingTeams = null;
      } else if (dateMatch) {
        out.push({ home: pendingTeams.home, away: pendingTeams.away, homeScore: null, awayScore: null, date: dateMatch[1], time: dateMatch[2], jornada, played: false, venue: '' });
        pendingTeams = null;
      }
    }
  }

  // Markdown tables can contain the whole match in one row.
  for (const table of tables) {
    for (const row of table.rows || []) {
      const teamsCell = row.find((cell) => teamsValue(cell));
      const teams = teamsValue(teamsCell || '');
      if (!teams) continue;
      const score = row.map(scoreValue).find(Boolean);
      const date = row.map(dateValue).find(Boolean) || '';
      const time = row.map(timeValue).find(Boolean) || '';
      if (!date) continue;
      out.push({ ...teams, homeScore: score?.[0] ?? null, awayScore: score?.[1] ?? null, date, time, jornada: '', played: Boolean(score), venue: '' });
    }
  }

  return dedupeMatches(out);
}

function dedupeMatches(matches) {
  const map = new Map();
  for (const match of matches) {
    if (!match.home || !match.away || !match.date) continue;
    const id = `${key(match.home)}|${key(match.away)}|${match.date}|${match.homeScore ?? ''}-${match.awayScore ?? ''}`;
    map.set(id, match);
  }
  return [...map.values()];
}

function parseData(text) {
  const tables = parseMarkdownTables(text);
  let classification = parseClassificationLines(text);
  if (classification.length < 2) classification = parseClassificationTables(tables);
  const matches = parseMatches(text, tables);
  const { season, category } = parseHeader(text);
  return { season, category, matches, classification, teams: classification.map((r) => ({ name: r.team, club: r.team })), rawText: text };
}

function normalizeCompetitionUrl(url, view = 'results') {
  let value;
  try { value = new URL(url); } catch { throw new Error('La URL de FEB no es válida.'); }
  if (!/competiciones\.feb\.es$/i.test(value.hostname)) throw new Error('Fuente FEB/FAB no válida.');
  if (!['3', '32'].includes(value.searchParams.get('a') || '')) throw new Error('Fuente FEB/FAB no válida.');
  if (!value.searchParams.get('c')) throw new Error('No se ha encontrado el identificador de competición.');
  value.pathname = `/autonomicas/${RESULTS_VIEWS[view]?.suffix || 'Resultados.aspx'}`;
  value.searchParams.set('med', value.searchParams.get('med') || '0');
  return value.href;
}

export async function fetchCompetition(url, view = 'results') {
  const normalized = normalizeCompetitionUrl(url, view);
  const text = await fetchReader(normalized);
  const data = parseData(text);
  if (!data.matches.length && !data.classification.length) throw new Error('FEB/FAB respondió, pero no hemos podido interpretar los resultados de esta competición.');
  return { ...data, url: normalized, view };
}

export function analyzeTeam(data, teamQuery = '') {
  const query = key(teamQuery);
  const matches = query ? data.matches.filter((m) => key(m.home) === query || key(m.away) === query) : data.matches;
  const played = matches.filter((m) => m.played && Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore));
  let wins = 0; let losses = 0; let pointsFor = 0; let pointsAgainst = 0; let homeGames = 0; let awayGames = 0; let homeWins = 0; let awayWins = 0;
  for (const match of played) {
    const home = key(match.home) === query;
    const pf = home ? match.homeScore : match.awayScore;
    const pc = home ? match.awayScore : match.homeScore;
    pointsFor += pf; pointsAgainst += pc;
    if (home) { homeGames += 1; if (pf > pc) { wins += 1; homeWins += 1; } else losses += 1; }
    else { awayGames += 1; if (pf > pc) { wins += 1; awayWins += 1; } else losses += 1; }
  }
  return { matches: matches.length, played: played.length, scheduled: matches.length - played.length, wins, losses, winRate: played.length ? (wins / played.length) * 100 : 0, pointsFor, pointsAgainst, differential: pointsFor - pointsAgainst, homeGames, awayGames, homeWins, awayWins };
}
