import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const DATE_RE = /^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const COMPETITION_RE = /COPA|LIGA|ARAGONESA|NACIONAL|JUNIOR|CADETE|INFANTIL|ALEVIN|BENJAMIN|MINIBASKET|SUPERCOPA|FEB|SOCIAL|PREINFANTIL|PREMINI/i;

function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }
function normaliseDate(day, month, sourceYear) { const year = sourceYear ? Number(sourceYear.length === 2 ? `20${sourceYear}` : sourceYear) : new Date().getFullYear(); return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function isDate(value) { return DATE_RE.test(clean(value)); }
function isTime(value) { return TIME_RE.test(clean(value)); }
function findDateInText(value) { return clean(value).match(/\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/); }
function findTimeInText(value) { return clean(value).match(/\b(\d{1,2}):(\d{2})\b/); }
function dateFromMatch(match, sourceYear = '') { return normaliseDate(match[1], match[2], match[3] || sourceYear); }
function dedupeMatches(matches) { const seen = new Set(); return matches.filter(match => { const key = [match.date, match.time, match.homeTeam, match.awayTeam, match.venue].join('|'); if (seen.has(key)) return false; seen.add(key); return true; }); }

function groupTextItems(items) {
  const positioned = items.filter(item => item.str?.trim()).map(item => ({ text: clean(item.str), x: item.transform[4], y: item.transform[5] })).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const item of positioned) { let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 2.5); if (!row) { row = { y: item.y, items: [] }; rows.push(row); } row.items.push(item); }
  return rows.sort((a, b) => b.y - a.y).map(row => ({ y: row.y, items: row.items.sort((a, b) => a.x - b.x), text: row.items.map(item => item.text).join(' ') }));
}

function joinColumn(items, minX, maxX) { return clean(items.filter(item => item.x >= minX && item.x < maxX).map(item => item.text).join(' ')); }
function findCell(items, predicate) { return items.find(item => predicate(item.text)); }
function extractSourceYear(rows) { const text = rows.map(row => row.text).join(' '); const match = text.match(/JORNADA\s*:?\s*\d{1,2}[\/-]\d{1,2}[\/-](\d{2,4})/i); return match?.[1] || ''; }
function isHeaderOrNoise(row) { const text = row.text.toUpperCase(); return text.includes('LOCAL VISITANTE') || text.includes('FEDERACIÓN ARAGONESA') || text.includes('HORARIOS - JORNADA'); }

function parsePageRows(rows, sourceName, sourceYear) {
  const matches = [];
  let section = '';
  for (const row of rows) {
    if (!row?.items?.length || isHeaderOrNoise(row)) continue;
    const dateItem = findCell(row.items, isDate);
    const timeItem = findCell(row.items, isTime);
    if (!dateItem && !timeItem && COMPETITION_RE.test(row.text) && row.text.length < 150) { section = clean(row.text); continue; }
    if (!dateItem || !timeItem) continue;
    const dateMatch = dateItem.text.match(DATE_RE); if (!dateMatch) continue;
    const homeTeam = joinColumn(row.items, 30, 198); const awayTeam = joinColumn(row.items, 198, 355); const venue = joinColumn(row.items, 435, 650);
    if (!homeTeam || !awayTeam || /^(LOCAL|VISITANTE|FECHA|HORA|PISTA|JUEGO)$/i.test(homeTeam)) continue;
    matches.push({ competition: section, homeTeam, awayTeam, date: dateFromMatch(dateMatch, sourceYear), time: timeItem.text, venue, source: sourceName });
  }
  return matches;
}

function cellsFromHtml(source) {
  if (!/<table\b/i.test(source)) return [];
  const doc = new DOMParser().parseFromString(source, 'text/html');
  return [...doc.querySelectorAll('tr')].map(row => [...row.querySelectorAll('th,td')].map(cell => clean(cell.textContent)).filter(Boolean)).filter(cells => cells.length >= 4);
}

function cellsFromMarkdown(source) {
  return source.split('\n').map(line => line.trim()).filter(Boolean).map(line => {
    if (!line.includes('|')) return [];
    return line.replace(/^\|\s*/, '').replace(/\s*\|$/, '').split('|').map(clean).filter(Boolean);
  }).filter(cells => cells.length >= 4 && !cells.every(cell => /^:?-{2,}:?$/.test(cell)));
}

function parseReaderCells(rows, sourceName, fallbackYear) {
  const matches = [];
  let section = '';
  let detectedYear = fallbackYear;
  const joined = rows.flat().join(' ');
  const yearMatch = joined.match(/(?:JORNADA|HORARIOS)[^\n\d]*(?:\d{1,2}[\/-]\d{1,2}[\/-])(\d{2,4})/i);
  if (yearMatch) detectedYear = yearMatch[1];

  for (const cells of rows) {
    const plain = cells.map(clean);
    if (!plain.length) continue;
    const upper = plain.join(' ').toUpperCase();
    if (upper.includes('LOCAL') && upper.includes('VISITANTE') && upper.includes('FECHA')) continue;
    const dateIndex = plain.findIndex(isDate);
    const timeIndex = plain.findIndex(isTime);
    if (dateIndex < 0 || timeIndex < 0) {
      const text = plain.join(' ');
      if (COMPETITION_RE.test(text) && text.length < 180) section = clean(text.replace(/^#+\s*/, ''));
      continue;
    }
    const dateMatch = plain[dateIndex].match(DATE_RE);
    if (!dateMatch) continue;
    const homeTeam = clean(plain[0]);
    const awayTeam = clean(plain[1]);
    if (!homeTeam || !awayTeam || /^(LOCAL|VISITANTE|FECHA|HORA|PISTA|JUEGO)$/i.test(homeTeam)) continue;
    const venue = clean(plain[timeIndex + 1] || plain[plain.length - 1] || '');
    matches.push({ competition: clean(section), homeTeam, awayTeam, date: dateFromMatch(dateMatch, detectedYear), time: clean(plain[timeIndex]), venue, source: sourceName });
  }
  return matches;
}

// Jina Reader sometimes returns the PDF as plain text instead of a Markdown table.
// In that format the column headers and match rows preserve their visual positions.
// Use those header positions to split LOCAL / VISITANTE / FECHA / HORA / PISTA
// instead of guessing teams from the previous lines (which caused rows to shift).
function parseFixedWidthReaderText(source, sourceName, fallbackYear) {
  const rawLines = String(source || '').replace(/\r/g, '').split('\n');
  const headerIndex = rawLines.findIndex(line => {
    const text = line.toUpperCase();
    return text.includes('LOCAL') && text.includes('VISITANTE') && text.includes('FECHA') && text.includes('HORA') && text.includes('PISTA');
  });
  if (headerIndex < 0) return [];

  const header = rawLines[headerIndex];
  const positions = {
    local: header.toUpperCase().indexOf('LOCAL'),
    visitor: header.toUpperCase().indexOf('VISITANTE'),
    date: header.toUpperCase().indexOf('FECHA'),
    time: header.toUpperCase().indexOf('HORA'),
    venue: header.toUpperCase().indexOf('PISTA')
  };
  if (positions.local < 0 || positions.visitor < 0 || positions.date < 0 || positions.time < 0 || positions.venue < 0) return [];

  let detectedYear = fallbackYear;
  const yearMatch = source.match(/(?:JORNADA|HORARIOS)[^\n\d]*(?:\d{1,2}[\/-]\d{1,2}[\/-])(\d{2,4})/i);
  if (yearMatch) detectedYear = yearMatch[1];

  const matches = [];
  let section = '';
  for (let index = headerIndex + 1; index < rawLines.length; index += 1) {
    const raw = rawLines[index];
    if (!raw.trim()) continue;
    const dateMatch = findDateInText(raw);
    const timeMatch = findTimeInText(raw);

    // Competition separator rows have no date/time. Keep them as the current section.
    if (!dateMatch || !timeMatch) {
      const compact = clean(raw);
      if (compact && COMPETITION_RE.test(compact) && compact.length < 180) section = compact;
      continue;
    }

    const dateStart = raw.indexOf(dateMatch[0]);
    const timeStart = raw.indexOf(timeMatch[0], dateStart + dateMatch[0].length);
    if (dateStart < 0 || timeStart < 0) continue;

    // Prefer visual column boundaries. If Jina collapsed spaces, fall back to the
    // date/time anchors while still using the header to split the two teams.
    let homeTeam = raw.slice(positions.local, positions.visitor).trim();
    let awayTeam = raw.slice(positions.visitor, positions.date).trim();
    let venue = raw.slice(timeStart + timeMatch[0].length).trim();

    if (!homeTeam || !awayTeam || homeTeam.toUpperCase().includes('LOCAL VISITANTE')) {
      const prefix = raw.slice(0, dateStart).trim();
      const parts = prefix.split(/\s{2,}/).map(clean).filter(Boolean);
      if (parts.length >= 2) { homeTeam = parts[0]; awayTeam = parts[1]; }
    }

    if (!venue) venue = clean(raw.slice(positions.venue));
    if (!homeTeam || !awayTeam) continue;
    if (/^(LOCAL|VISITANTE|FECHA|HORA|PISTA|JUEGO)$/i.test(homeTeam)) continue;
    if (/^\d/.test(homeTeam) || /^\d/.test(awayTeam)) continue;

    matches.push({ competition: section, homeTeam: clean(homeTeam), awayTeam: clean(awayTeam), date: dateFromMatch(dateMatch, detectedYear), time: timeMatch[0], venue: clean(venue), source: sourceName });
  }
  return dedupeMatches(matches);
}

function parseLooseReaderText(source, sourceName, fallbackYear) {
  const lines = source.split('\n').map(clean).filter(Boolean);
  const matches = [];
  let section = '';
  let detectedYear = fallbackYear;
  const yearMatch = source.match(/(?:JORNADA|HORARIOS)[^\n\d]*(?:\d{1,2}[\/-]\d{1,2}[\/-])(\d{2,4})/i);
  if (yearMatch) detectedYear = yearMatch[1];

  for (let i = 0; i < lines.length; i += 1) {
    const dateMatch = findDateInText(lines[i]);
    const timeMatch = findTimeInText(lines[i]);
    if (!dateMatch || !timeMatch) continue;
    const date = dateFromMatch(dateMatch, detectedYear);
    const time = timeMatch[0];
    const before = lines.slice(Math.max(0, i - 5), i);
    const candidates = before.filter(line => !findDateInText(line) && !findTimeInText(line) && !/^LOCAL|^VISITANTE|^FECHA|^HORA|^PISTA|^JUEGO/i.test(line));
    if (candidates.length < 2) continue;
    const homeTeam = candidates[candidates.length - 2];
    const awayTeam = candidates[candidates.length - 1];
    if (!homeTeam || !awayTeam || homeTeam.length < 2 || awayTeam.length < 2) continue;
    const venue = lines[i + 1] && !findDateInText(lines[i + 1]) && !findTimeInText(lines[i + 1]) ? lines[i + 1] : '';
    if (COMPETITION_RE.test(homeTeam) && !COMPETITION_RE.test(awayTeam)) { section = homeTeam; continue; }
    matches.push({ competition: section, homeTeam, awayTeam, date, time, venue, source: sourceName });
  }
  return matches;
}

export function parseFabReaderText(input, sourceName = 'FAB Reader', fallbackYear = '') {
  const source = String(input || '').replace(/\r/g, '');
  const htmlRows = cellsFromHtml(source);
  const markdownRows = cellsFromMarkdown(source);
  const tableMatches = parseReaderCells([...htmlRows, ...markdownRows], sourceName, fallbackYear);
  if (tableMatches.length) return dedupeMatches(tableMatches);

  const fixedMatches = parseFixedWidthReaderText(source, sourceName, fallbackYear);
  if (fixedMatches.length) return fixedMatches;

  return dedupeMatches(parseLooseReaderText(source, sourceName, fallbackYear));
}

export async function parsePdfFile(input, sourceName = 'PDF') {
  if (typeof input === 'string') return parseFabReaderText(input, sourceName);
  const loadingTask = pdfjsLib.getDocument({ data: input }); const pdf = await loadingTask.promise; const allMatches = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) { const page = await pdf.getPage(pageNumber); const content = await page.getTextContent(); const rows = groupTextItems(content.items); const sourceYear = extractSourceYear(rows); allMatches.push(...parsePageRows(rows, sourceName, sourceYear)); }
  return dedupeMatches(allMatches);
}
