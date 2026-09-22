const READER_BASE = 'https://r.jina.ai/';

export const RESULTS_VIEWS = {
  results: { suffix: 'Resultados.aspx' },
  calendar: { suffix: 'Calendarios.aspx' },
  teams: { suffix: 'Equipos.aspx' },
  upcoming: { suffix: 'Partidos.aspx' }
};

const clean = value => String(value ?? '')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

const key = value => clean(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es');

async function fetchReader(url) {
  const response = await fetch(`${READER_BASE}${url}`, {
    cache: 'no-store',
    headers: {
      'x-no-cache': 'true',
      'x-respond-with': 'markdown',
      Accept: 'text/markdown,text/plain,text/html;q=0.8,*/*;q=0.5'
    }
  });

  if (!response.ok) throw new Error(`${response.status} al consultar FEB mediante Reader.`);

  const text = await response.text();
  if (!text.trim()) throw new Error('FEB devolvió un documento vacío.');
  return text;
}

function decodeHtml(value) {
  const area = document.createElement('textarea');
  area.innerHTML = String(value ?? '');
  return area.value;
}

function htmlToLines(text) {
  if (!/<(?:html|body|table|tr|td|br|div|p)\b/i.test(text)) return [];

  const source = String(text)
    .replace(/<\s*(br|\/p|\/div|\/tr|\/li)\s*\/?>/gi, '\n')
    .replace(/<\s*li\b[^>]*>/gi, '\n');

  const withoutTags = source.replace(/<[^>]+>/g, ' ');
  return decodeHtml(withoutTags)
    .split(/\r?\n/)
    .map(clean)
    .filter(Boolean);
}

function parseHeader(text) {
  const lines = [
    ...String(text).split(/\r?\n/).map(clean),
    ...htmlToLines(text)
  ];
  const line = lines.find(value => /^20\d{2}\/20\d{2}\s+/.test(value));
  if (!line) return { season: '', category: '' };
  const match = line.match(/^(20\d{2}\/20\d{2})\s+(.+)$/);
  return { season: match?.[1] || '', category: clean(match?.[2] || '') };
}

function splitCells(line) {
  let value = line.trim();
  if (value.startsWith('|')) value = value.slice(1);
  if (value.endsWith('|')) value = value.slice(0, -1);
  return value
    .split('|')
    .map(cell => clean(cell.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')));
}

function isSeparator(cells) {
  return cells.length > 0 && cells.every(cell => /^:?-{2,}:?$/.test(cell));
}

function parseMarkdownTables(text) {
  const lines = String(text).split(/\r?\n/);
  const tables = [];

  for (let i = 0; i < lines.length - 1; i += 1) {
    if (!lines[i].includes('|') || !lines[i + 1].includes('|')) continue;

    const headers = splitCells(lines[i]);
    const separator = splitCells(lines[i + 1]);
    if (!isSeparator(separator)) continue;

    const rows = [];
    i += 2;

    while (i < lines.length && lines[i].includes('|')) {
      const cells = splitCells(lines[i]);
      if (cells.length && !isSeparator(cells)) rows.push(cells);
      i += 1;
    }

    tables.push({ headers, rows });
    i -= 1;
  }

  return tables;
}

function parseHtmlTables(text) {
  if (!/<table\b/i.test(text)) return [];

  try {
    const doc = new DOMParser().parseFromString(text, 'text/html');
    return [...doc.querySelectorAll('table')].map(table => {
      const rows = [...table.querySelectorAll('tr')]
        .map(row => [...row.querySelectorAll('th,td')].map(cell => clean(cell.textContent)))
        .filter(row => row.length);

      if (!rows.length) return null;

      const headerIndex = rows.findIndex(row =>
        row.some(cell => /equipo|partido|resultado|fecha|hora/i.test(cell))
      );

      if (headerIndex >= 0) {
        return { headers: rows[headerIndex], rows: rows.slice(headerIndex + 1) };
      }

      return { headers: [], rows };
    }).filter(Boolean);
  } catch {
    return [];
  }
}

function parseTables(text) {
  return [...parseMarkdownTables(text), ...parseHtmlTables(text)];
}

function findCol(headers, regexes) {
  return headers.findIndex(header => regexes.some(regex => regex.test(key(header))));
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

function parseClassification(tables) {
  let best = [];

  for (const table of tables) {
    const headers = table.headers || [];
    let teamCol = findCol(headers, [/equipo/]);
    let numericCols = [
      findCol(headers, [/^pj/, /partidos jugados/]),
      findCol(headers, [/^pg/, /ganados/]),
      findCol(headers, [/^pp/, /perdidos/]),
      findCol(headers, [/^pf/, /favor/]),
      findCol(headers, [/^pc/, /contra/]),
      findCol(headers, [/pto/, /puntos/])
    ];

    const rows = [];

    for (let index = 0; index < table.rows.length; index += 1) {
      const row = table.rows[index];
      if (!row.length) continue;

      if (teamCol < 0) {
        teamCol = row.findIndex(cell => {
          const value = clean(cell);
          return value.length > 2 && /[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]/.test(value) &&
            !scoreValue(value) &&
            !dateValue(value) &&
            !timeValue(value);
        });
      }

      let values;
      if (numericCols.every(column => column >= 0) && numericCols.every(column => row[column] !== undefined)) {
        values = numericCols.map(column => Number(clean(row[column]).replace(/[^0-9-]/g, '')));
      } else {
        const candidates = row
          .map((cell, cellIndex) => ({ cell: clean(cell), cellIndex }))
          .filter(item => /^-?\d+$/.test(item.cell));
        if (candidates.length < 6) continue;
        values = candidates.slice(-6).map(item => Number(item.cell));
      }

      if (teamCol < 0 || !row[teamCol] || values.length !== 6 || values.some(Number.isNaN)) continue;

      const positionMatch = clean(row[0] || '').match(/^\d+$/);
      rows.push({
        position: positionMatch ? Number(row[0]) : index + 1,
        team: clean(row[teamCol]),
        played: values[0],
        wins: values[1],
        losses: values[2],
        pointsFor: values[3],
        pointsAgainst: values[4],
        points: values[5],
        form: headers.length ? clean(row[findCol(headers, [/^r\.?$/, /racha/])] || '') : ''
      });
    }

    if (rows.length > best.length) best = rows;
  }

  return best;
}

function parseTableMatches(tables) {
  const out = [];

  for (const table of tables) {
    const headers = table.headers || [];
    const matchCol = findCol(headers, [/partido/, /encuentro/]);
    const resultCol = findCol(headers, [/resultado/, /marcador/]);
    const dateCol = findCol(headers, [/fecha/, /día/, /dia/]);
    const timeCol = findCol(headers, [/hora/]);

    for (const row of table.rows) {
      let teams = matchCol >= 0 ? teamsValue(row[matchCol]) : null;
      let score = resultCol >= 0 ? scoreValue(row[resultCol]) : null;
      let date = dateCol >= 0 ? dateValue(row[dateCol]) : '';
      let time = timeCol >= 0 ? timeValue(row[timeCol]) : '';

      if (!teams) {
        const teamCell = row.find(cell => /\s+-\s+/.test(clean(cell)));
        teams = teamsValue(teamCell || '');
      }
      if (!score) score = row.map(scoreValue).find(Boolean) || null;
      if (!date) date = row.map(dateValue).find(Boolean) || '';
      if (!time) time = row.map(timeValue).find(Boolean) || '';

      if (!teams || !date) continue;

      out.push({
        ...teams,
        homeScore: score?.[0] ?? null,
        awayScore: score?.[1] ?? null,
        date,
        time,
        jornada: '',
        played: Boolean(score),
        venue: ''
      });
    }
  }

  return out;
}

function parseInlineMatches(text) {
  const sourceLines = [
    ...String(text).split(/\r?\n/).map(clean),
    ...htmlToLines(text)
  ];
  const lines = [...new Set(sourceLines)].filter(Boolean);
  const out = [];
  let jornada = '';

  for (const line of lines) {
    const jornadaMatch = line.match(/^Jornada\s+(\d+)(?:\s+(\d{1,2}\/\d{1,2}\/\d{4}))?/i);
    if (jornadaMatch) {
      jornada = jornadaMatch[1];
      continue;
    }

    const played = line.match(/^(.+?)\s+-\s+(.+?)\s+(\d+)\s*-\s*(\d+)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
    if (played) {
      out.push({
        home: clean(played[1]),
        away: clean(played[2]),
        homeScore: Number(played[3]),
        awayScore: Number(played[4]),
        date: played[5],
        time: played[6],
        jornada,
        played: true,
        venue: ''
      });
      continue;
    }

    const pending = line.match(/^(.+?)\s+-\s+(.+?)\s+(?:-|—)\s+(\d{1,2}\/\d{1,2}\/\d{4})\s+(\d{1,2}:\d{2})$/);
    if (pending) {
      out.push({
        home: clean(pending[1]),
        away: clean(pending[2]),
        homeScore: null,
        awayScore: null,
        date: pending[3],
        time: pending[4],
        jornada,
        played: false,
        venue: ''
      });
    }
  }

  return out;
}

function parseData(text) {
  const { season, category } = parseHeader(text);
  const tables = parseTables(text);
  const classification = parseClassification(tables);
  const matches = [...parseTableMatches(tables), ...parseInlineMatches(text)];
  const unique = new Map();

  for (const match of matches) {
    const id = `${key(match.home)}|${key(match.away)}|${match.date}|${match.homeScore ?? ''}-${match.awayScore ?? ''}`;
    unique.set(id, match);
  }

  return {
    season,
    category,
    matches: [...unique.values()],
    classification,
    teams: classification.map(row => ({ name: row.team, club: row.team })),
    rawText: text
  };
}

function normalizeCompetitionUrl(url, view = 'results') {
  let value;
  try {
    value = new URL(url);
  } catch {
    throw new Error('La URL de FEB no es válida.');
  }

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

  if (!data.matches.length && !data.classification.length) {
    throw new Error('FEB/FAB respondió, pero no hemos podido interpretar los resultados de esta competición.');
  }

  return { ...data, url: normalized, view };
}

export function analyzeTeam(data, teamQuery = '') {
  const query = key(teamQuery);
  const matches = query
    ? data.matches.filter(match => key(match.home) === query || key(match.away) === query)
    : data.matches;
  const played = matches.filter(match => match.played && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore));

  let wins = 0;
  let losses = 0;
  let pointsFor = 0;
  let pointsAgainst = 0;
  let homeGames = 0;
  let awayGames = 0;
  let homeWins = 0;
  let awayWins = 0;

  for (const match of played) {
    const home = key(match.home) === query;
    const pointsForMatch = home ? match.homeScore : match.awayScore;
    const pointsAgainstMatch = home ? match.awayScore : match.homeScore;
    pointsFor += pointsForMatch;
    pointsAgainst += pointsAgainstMatch;

    if (home) {
      homeGames += 1;
      if (pointsForMatch > pointsAgainstMatch) {
        wins += 1;
        homeWins += 1;
      } else {
        losses += 1;
      }
    } else {
      awayGames += 1;
      if (pointsForMatch > pointsAgainstMatch) {
        wins += 1;
        awayWins += 1;
      } else {
        losses += 1;
      }
    }
  }

  return {
    matches: matches.length,
    played: played.length,
    scheduled: matches.length - played.length,
    wins,
    losses,
    pointsFor,
    pointsAgainst,
    differential: pointsFor - pointsAgainst,
    winRate: played.length ? wins / played.length * 100 : 0,
    homeGames,
    awayGames,
    homeWins,
    awayWins
  };
}
