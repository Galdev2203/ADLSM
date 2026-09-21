const READER_BASE = 'https://r.jina.ai/';

export const RESULTS_PRESETS = {
  aragon: {
    id: 'aragon',
    label: 'Aragón · Competiciones FEB y FAB',
    url: 'https://competiciones.feb.es/autonomicas/?a=3&c=23460&med=0'
  },
  zaragoza: {
    id: 'zaragoza',
    label: 'Zaragoza · Competiciones escolares',
    url: 'https://competiciones.feb.es/autonomicas/?a=32&c=23063&med=0'
  }
};

async function fetchReader(url) {
  const response = await fetch(`${READER_BASE}${url}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} al consultar FEB mediante Reader.`);
  const text = await response.text();
  if (!text.trim()) throw new Error('FEB devolvió un documento vacío.');
  return text;
}

function clean(value) {
  return String(value || '')
    .replace(/\u00a0/g, ' ')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function stripMarkdown(value) {
  return clean(String(value || '')
    .replace(/^\s*[>*#-]+\s*/, '')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1'));
}

function parseHeader(lines) {
  const lineIndex = lines.findIndex(line => /^20\d{2}\/20\d{2}\s+/i.test(line));
  if (lineIndex < 0) return { season: '', category: '' };
  const match = lines[lineIndex].match(/^(20\d{2}\/20\d{2})\s+(.+)$/);
  return { season: match?.[1] || '', category: clean(match?.[2] || '') };
}

function parseScoreDate(line) {
  const scored = line.match(/^(\d+)\s*-\s*(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
  if (scored) return { homeScore: Number(scored[1]), awayScore: Number(scored[2]), date: scored[3], time: scored[4], played: true };
  const pending = line.match(/^[-–]\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
  if (pending) return { homeScore: null, awayScore: null, date: pending[1], time: pending[2], played: false };
  return null;
}

function parseTeamsLine(line) {
  const match = line.match(/^(.+?)\s+-\s+(.+)$/);
  if (!match || /^(?:Campo|Jornada|Clasificación)/i.test(line)) return null;
  return { home: clean(match[1]), away: clean(match[2]) };
}

function parseCombinedMatchLine(line, jornada) {
  const scored = line.match(/^(.+?)\s+-\s+(.+?)\s+(\d+)\s*-\s*(\d+)\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
  if (scored) return { home: clean(scored[1]), away: clean(scored[2]), homeScore: Number(scored[3]), awayScore: Number(scored[4]), date: scored[5], time: scored[6], jornada, played: true };
  const pending = line.match(/^(.+?)\s+-\s+(.+?)\s+[-–]\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
  if (pending) return { home: clean(pending[1]), away: clean(pending[2]), homeScore: null, awayScore: null, date: pending[3], time: pending[4], jornada, played: false };
  return null;
}

function parseClassification(lines) {
  const start = lines.findIndex(line => /clasificaci[oó]n\s+jornada/i.test(line));
  if (start < 0) return [];
  const rows = [];
  for (let i = start + 1; i < lines.length; i += 1) {
    const line = stripMarkdown(lines[i]);
    if (!line) continue;
    const match = line.match(/^(\d+)\s+(.+?)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+([+-]?\d+)$/);
    if (!match) {
      if (rows.length && /^\d+\s+/.test(line) === false && !/^Equipo\b/i.test(line)) break;
      continue;
    }
    rows.push({ position: Number(match[1]), team: clean(match[2]), played: Number(match[3]), wins: Number(match[4]), losses: Number(match[5]), pointsFor: Number(match[6]), pointsAgainst: Number(match[7]), points: Number(match[8]), form: match[9] });
  }
  return rows;
}

function parseResults(text) {
  const lines = String(text || '').split(/\r?\n/).map(clean).filter(Boolean).map(stripMarkdown);
  const { season, category } = parseHeader(lines);
  const matches = [];
  let jornada = '';
  let pendingTeams = null;

  for (let i = 0; i < lines.length; i += 1) {
    const line = lines[i];
    const jornadaMatch = line.match(/^Jornada\s+(\d+)\s+(\d{2}\/\d{2}\/\d{4})$/i);
    if (jornadaMatch) {
      jornada = jornadaMatch[1];
      pendingTeams = null;
      continue;
    }

    const combined = parseCombinedMatchLine(line, jornada);
    if (combined) {
      matches.push({ ...combined, venue: '' });
      pendingTeams = null;
      continue;
    }

    if (pendingTeams) {
      const scoreDate = parseScoreDate(line);
      if (scoreDate) {
        matches.push({ ...pendingTeams, ...scoreDate, jornada, venue: '' });
        pendingTeams = null;
        continue;
      }
      const field = line.match(/^Campo:\s*(.+?)\s+-\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,2}:\d{2})$/i);
      if (field) {
        matches.push({ ...pendingTeams, homeScore: null, awayScore: null, date: field[2], time: field[3], jornada, venue: clean(field[1]), played: false });
        pendingTeams = null;
        continue;
      }
      pendingTeams = null;
    }

    const teamLine = parseTeamsLine(line);
    if (teamLine) {
      pendingTeams = teamLine;
      continue;
    }
  }

  return { season, category, matches, classification: parseClassification(lines), rawLines: lines };
}

export async function fetchCompetition(url) {
  let parsed;
  try { parsed = new URL(url); } catch { throw new Error('La URL de FEB no es válida.'); }
  if (!/competiciones\.feb\.es$/i.test(parsed.hostname)) throw new Error('La consulta debe apuntar a competiciones.feb.es.');
  const text = await fetchReader(parsed.href);
  const data = parseResults(text);
  if (!data.matches.length && !data.classification.length) throw new Error('No se han encontrado resultados en la competición. Comprueba que la URL corresponde a una categoría de FEB/FAB.');
  return { ...data, url: parsed.href };
}

export function analyzeTeam(data, teamQuery = '') {
  const query = clean(teamQuery).toLocaleLowerCase('es');
  const matches = query ? data.matches.filter(match => `${match.home} ${match.away}`.toLocaleLowerCase('es').includes(query)) : data.matches;
  const played = matches.filter(match => match.played && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore));
  let wins = 0, losses = 0, pointsFor = 0, pointsAgainst = 0, homeGames = 0, awayGames = 0, homeWins = 0, awayWins = 0;
  for (const match of played) {
    const isHome = query ? match.home.toLocaleLowerCase('es').includes(query) : true;
    if (isHome) {
      homeGames += 1; pointsFor += match.homeScore; pointsAgainst += match.awayScore;
      if (match.homeScore > match.awayScore) { wins += 1; homeWins += 1; } else losses += 1;
    } else {
      awayGames += 1; pointsFor += match.awayScore; pointsAgainst += match.homeScore;
      if (match.awayScore > match.homeScore) { wins += 1; awayWins += 1; } else losses += 1;
    }
  }
  return { matches, played: played.length, scheduled: matches.length - played.length, wins, losses, winRate: played.length ? (wins / played.length) * 100 : 0, pointsFor, pointsAgainst, averageFor: played.length ? pointsFor / played.length : 0, averageAgainst: played.length ? pointsAgainst / played.length : 0, differential: pointsFor - pointsAgainst, homeGames, awayGames, homeWins, awayWins };
}

export function parseCompetitionText(text) { return parseResults(text); }
