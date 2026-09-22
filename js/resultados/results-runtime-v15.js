const READER_BASE = 'https://r.jina.ai/';

export const RESULTS_VIEWS = {
  results: { suffix: 'Resultados.aspx' },
  calendar: { suffix: 'Calendarios.aspx' },
  teams: { suffix: 'Equipos.aspx' },
  upcoming: { suffix: 'Partidos.aspx' }
};

const clean = value => String(value ?? '').replace(/\u00a0/g, ' ').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
const key = value => clean(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es');

async function fetchReader(url) {
  const response = await fetch(`${READER_BASE}${url}`, { cache: 'no-store', headers: { 'x-no-cache': 'true' } });
  if (!response.ok) throw new Error(`${response.status} al consultar FEB mediante Reader.`);
  const text = await response.text();
  if (!text.trim()) throw new Error('FEB devolvió un documento vacío.');
  return text;
}

function parseHeader(text) {
  const lines = String(text).split(/\r?\n/).map(clean);
  const line = lines.find(v => /^20\d{2}\/20\d{2}\s+/.test(v));
  if (!line) return { season: '', category: '' };
  const m = line.match(/^(20\d{2}\/20\d{2})\s+(.+)$/);
  return { season: m?.[1] || '', category: clean(m?.[2] || '') };
}

function splitCells(line) {
  let v = line.trim();
  if (v.startsWith('|')) v = v.slice(1);
  if (v.endsWith('|')) v = v.slice(0, -1);
  return v.split('|').map(cell => clean(cell.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')));
}

function isSeparator(cells) { return cells.length > 0 && cells.every(c => /^:?-{2,}:?$/.test(c)); }

function parseTables(text) {
  const lines = String(text).split(/\r?\n/);
  const tables = [];
  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].includes('|') || !lines[i + 1].includes('|')) continue;
    const headers = splitCells(lines[i]);
    const sep = splitCells(lines[i + 1]);
    if (!isSeparator(sep)) continue;
    const rows = [];
    i += 2;
    while (i < lines.length && lines[i].includes('|')) { const cells = splitCells(lines[i]); if (cells.length && !isSeparator(cells)) rows.push(cells); i += 1; }
    tables.push({ headers, rows });
    i -= 1;
  }
  return tables;
}

function findCol(headers, regexes) { return headers.findIndex(h => regexes.some(r => r.test(key(h)))); }
function scoreValue(v) { const m = clean(v).match(/^(\d+)\s*-\s*(\d+)$/); return m ? [Number(m[1]), Number(m[2])] : null; }
function dateValue(v) { const m = clean(v).match(/^(\d{1,2}\/\d{1,2}\/\d{4})$/); return m ? m[1] : ''; }
function timeValue(v) { const m = clean(v).match(/^(\d{1,2}:\d{2})$/); return m ? m[1] : ''; }
function teamsValue(v) { const m = clean(v).match(/^(.+?)\s+-\s+(.+?)(?:\s+\d+\s*-\s*\d+)?$/); return m ? { home: clean(m[1]), away: clean(m[2]) } : null; }

function parseClassification(tables) {
  let best = [];
  for (const table of tables) {
    const h = table.headers;
    const team = findCol(h, [/equipo/]);
    const pj = findCol(h, [/^pj/, /partidos jugados/]);
    const pg = findCol(h, [/^pg/, /ganados/]);
    const pp = findCol(h, [/^pp/, /perdidos/]);
    const pf = findCol(h, [/^pf/, /favor/]);
    const pc = findCol(h, [/^pc/, /contra/]);
    const pts = findCol(h, [/pto/, /puntos/]);
    if ([team,pj,pg,pp,pf,pc,pts].some(i => i < 0)) continue;
    const rows = table.rows.map((r, i) => {
      const nums = [pj,pg,pp,pf,pc,pts].map(c => Number(clean(r[c]).replace(/[^0-9-]/g, '')));
      if (!r[team] || nums.some(Number.isNaN)) return null;
      return { position: Number(clean(r[0]).replace(/[^0-9]/g,'')) || i + 1, team: clean(r[team]), played: nums[0], wins: nums[1], losses: nums[2], pointsFor: nums[3], pointsAgainst: nums[4], points: nums[5], form: clean(r[findCol(h,[/^r\.?$/, /racha/])] || '') };
    }).filter(Boolean);
    if (rows.length > best.length) best = rows;
  }
  return best;
}

function parseTableMatches(tables) {
  const out = [];
  for (const table of tables) {
    const h = table.headers;
    const match = findCol(h, [/partido/, /encuentro/]);
    const result = findCol(h, [/resultado/, /marcador/]);
    const date = findCol(h, [/fecha/, /día/, /dia/]);
    const time = findCol(h, [/hora/]);
    if (match < 0) continue;
    for (const r of table.rows) {
      const teams = teamsValue(r[match]);
      if (!teams) continue;
      const sc = result >= 0 ? scoreValue(r[result]) : null;
      const d = date >= 0 ? dateValue(r[date]) : '';
      const t = time >= 0 ? timeValue(r[time]) : '';
      if (!sc && !d) continue;
      out.push({ ...teams, homeScore: sc?.[0] ?? null, awayScore: sc?.[1] ?? null, date: d, time: t, jornada: '', played: Boolean(sc), venue: '' });
    }
  }
  return out;
}

function parseInlineMatches(text) {
  const lines = String(text).split(/\r?\n/).map(clean).filter(Boolean);
  const out = [];
  let jornada = '';
  for (let i = 0; i < lines.length; i += 1) {
    const jm = lines[i].match(/^Jornada\s+(\d+)(?:\s+(\d{1,2}\/\d{1,2}\/\d{4}))?/i);
    if (jm) { jornada = jm[1]; continue; }
    const line = lines[i];
    const played = line.match(/^(.+?)\s+-\s+(.+?)\s+(\d+)\s*-\s*(\d+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
    if (played) { out.push({ home: clean(played[1]), away: clean(played[2]), homeScore: Number(played[3]), awayScore: Number(played[4]), date: played[5], time: played[6], jornada, played: true, venue: '' }); continue; }
    const pending = line.match(/^(.+?)\s+-\s+(.+?)\s+(?:-|—)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
    if (pending) { out.push({ home: clean(pending[1]), away: clean(pending[2]), homeScore: null, awayScore: null, date: pending[3], time: pending[4], jornada, played: false, venue: '' }); }
  }
  return out;
}

function parseData(text) {
  const { season, category } = parseHeader(text);
  const tables = parseTables(text);
  const classification = parseClassification(tables);
  const matches = [...parseTableMatches(tables), ...parseInlineMatches(text)];
  const unique = new Map();
  for (const m of matches) unique.set(`${key(m.home)}|${key(m.away)}|${m.date}|${m.homeScore ?? ''}-${m.awayScore ?? ''}`, m);
  return { season, category, matches: [...unique.values()], classification, teams: classification.map(r => ({ name: r.team, club: r.team })), rawText: text };
}

function normalizeCompetitionUrl(url, view = 'results') {
  let u; try { u = new URL(url); } catch { throw new Error('La URL de FEB no es válida.'); }
  if (!/competiciones\.feb\.es$/i.test(u.hostname)) throw new Error('Fuente FEB/FAB no válida.');
  if (!['3','32'].includes(u.searchParams.get('a') || '')) throw new Error('Fuente FEB/FAB no válida.');
  if (!u.searchParams.get('c')) throw new Error('No se ha encontrado el identificador de competición.');
  u.pathname = `/autonomicas/${RESULTS_VIEWS[view]?.suffix || 'Resultados.aspx'}`;
  u.searchParams.set('med', u.searchParams.get('med') || '0');
  return u.href;
}

export async function fetchCompetition(url, view = 'results') {
  const normalized = normalizeCompetitionUrl(url, view);
  const text = await fetchReader(normalized);
  const data = parseData(text);
  if (!data.matches.length && !data.classification.length) throw new Error('FEB/FAB respondió, pero no hemos podido interpretar los resultados de esta competición.');
  return { ...data, url: normalized, view };
}

export function analyzeTeam(data, teamQuery = '') {
  const q = key(teamQuery);
  const matches = q ? data.matches.filter(m => key(m.home) === q || key(m.away) === q) : data.matches;
  const played = matches.filter(m => m.played && Number.isFinite(m.homeScore) && Number.isFinite(m.awayScore));
  let wins=0, losses=0, pointsFor=0, pointsAgainst=0, homeGames=0, awayGames=0, homeWins=0, awayWins=0;
  for (const m of played) { const home=key(m.home)===q; const pf=home?m.homeScore:m.awayScore; const pc=home?m.awayScore:m.homeScore; pointsFor+=pf; pointsAgainst+=pc; if(home){homeGames++;if(pf>pc){wins++;homeWins++;}else losses++;}else{awayGames++;if(pf>pc){wins++;awayWins++;}else losses++;} }
  return { matches: matches.length, played: played.length, scheduled: matches.length-played.length, wins, losses, pointsFor, pointsAgainst, differential: pointsFor-pointsAgainst, winRate: played.length ? wins/played.length*100 : 0, homeGames, awayGames, homeWins, awayWins };
}
