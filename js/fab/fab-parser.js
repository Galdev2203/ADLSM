import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const DATE_RE = /^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const DATE_IN_TEXT_RE = /\b(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?\b/;
const TIME_IN_TEXT_RE = /\b(\d{1,2}:\d{2})\b/;

function clean(value = '') { return String(value).replace(/\s+/g, ' ').trim(); }
function normaliseDate(day, month, sourceYear = '') { const year = sourceYear ? Number(String(sourceYear).length === 2 ? `20${sourceYear}` : sourceYear) : new Date().getFullYear(); return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`; }
function dateFromMatch(match, sourceYear = '') { return normaliseDate(match[1], match[2], match[3] || sourceYear); }
function isDate(value) { return DATE_RE.test(clean(value)); }
function isTime(value) { return TIME_RE.test(clean(value)); }
function findDateInText(value) { return clean(value).match(DATE_IN_TEXT_RE); }
function findTimeInText(value) { return clean(value).match(TIME_IN_TEXT_RE); }
function dedupeMatches(matches) { const seen = new Set(); return matches.filter(match => { const key = [match.date, match.time, match.homeTeam, match.awayTeam, match.venue].join('|'); if (seen.has(key)) return false; seen.add(key); return true; }); }
function compact(value) { return clean(value).toUpperCase().replace(/\s+/g, ''); }
function isTableHeader(value) { const text = compact(value); return text.includes('LOCALVISITANTEFECHAHORA') || (text.includes('LOCAL') && text.includes('VISITANTE') && text.includes('FECHA') && text.includes('HORA')); }
function isFooter(value) { const text = compact(value); return text.includes('FEDERACIONARAGONESA') || text.includes('PLAZAHERRERADELOSNAVARROS') || text.includes('HORARIOSJORNADA'); }
function extractYear(source, fallback = '') { const match = String(source || '').match(/(?:JORNADA|HORARIOS)[^\d]*(?:\d{1,2}[\/-]\d{1,2}[\/-])(\d{2,4})/i); return match?.[1] || fallback; }

function groupTextItems(items) {
  const positioned = items.filter(item => item.str?.trim()).map(item => ({ text: clean(item.str), x: item.transform[4], y: item.transform[5] })).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const item of positioned) { let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 2.5); if (!row) { row = { y: item.y, items: [] }; rows.push(row); } row.items.push(item); }
  return rows.sort((a, b) => b.y - a.y).map(row => ({ y: row.y, items: row.items.sort((a, b) => a.x - b.x), text: row.items.map(item => item.text).join(' ') }));
}

function parsePdfRows(rows, sourceName, fallbackYear) {
  const matches = [];
  let section = '';
  let header = null;
  for (const row of rows) {
    if (!row.items?.length || isFooter(row.text)) continue;
    if (isTableHeader(row.text)) { header = row.items; continue; }
    const dateItem = row.items.find(item => isDate(item.text));
    const timeItem = row.items.find(item => isTime(item.text));
    if (!dateItem || !timeItem) {
      if (header && row.text.trim()) section = clean(row.text);
      continue;
    }
    const dateMatch = dateItem.text.match(DATE_RE);
    if (!dateMatch) continue;
    let localStart = 0, visitorStart = 0, dateStart = 0, venueStart = 0;
    const upper = header?.map(item => ({ text: compact(item.text), x: item.x })) || [];
    const local = upper.find(item => item.text === 'LOCAL');
    const visitor = upper.find(item => item.text === 'VISITANTE');
    const date = upper.find(item => item.text === 'FECHA');
    const venue = upper.find(item => item.text === 'PISTAJUEGO' || item.text === 'PISTA');
    localStart = local?.x ?? 0; visitorStart = visitor?.x ?? 0; dateStart = date?.x ?? dateItem.x; venueStart = venue?.x ?? timeItem.x + 35;
    const homeTeam = clean(row.items.filter(item => item.x >= localStart && item.x < visitorStart).map(item => item.text).join(' '));
    const awayTeam = clean(row.items.filter(item => item.x >= visitorStart && item.x < dateStart).map(item => item.text).join(' '));
    const venueText = clean(row.items.filter(item => item.x >= venueStart).map(item => item.text).join(' '));
    if (!homeTeam || isTableHeader(homeTeam)) continue;
    matches.push({ competition: section, homeTeam, awayTeam, date: dateFromMatch(dateMatch, fallbackYear), time: clean(timeItem.text), venue: venueText, source: sourceName });
  }
  return dedupeMatches(matches);
}

function parseHtmlTables(source, sourceName, fallbackYear) {
  if (!/<table\b/i.test(source)) return [];
  const doc = new DOMParser().parseFromString(source, 'text/html');
  const matches = [];
  let section = '';
  const detectedYear = extractYear(source, fallbackYear);
  for (const row of doc.querySelectorAll('tr')) {
    const cells = [...row.querySelectorAll('th,td')].map(cell => clean(cell.textContent)).filter(Boolean);
    if (!cells.length) continue;
    const joined = cells.join(' ');
    if (isTableHeader(joined)) continue;
    const dateIndex = cells.findIndex(cell => isDate(cell));
    const timeIndex = cells.findIndex(cell => isTime(cell));
    if (dateIndex < 0 || timeIndex < 0) { if (!isFooter(joined)) section = joined; continue; }
    const dateMatch = cells[dateIndex].match(DATE_RE);
    if (!dateMatch) continue;
    const homeTeam = clean(cells[0] || '');
    const awayTeam = clean(cells[1] || '');
    const venue = clean(cells[timeIndex + 1] || cells[cells.length - 1] || '');
    if (!homeTeam || isTableHeader(homeTeam)) continue;
    matches.push({ competition: section, homeTeam, awayTeam, date: dateFromMatch(dateMatch, detectedYear), time: clean(cells[timeIndex]), venue, source: sourceName });
  }
  return dedupeMatches(matches);
}

function splitTeams(prefix) {
  const value = String(prefix || '').replace(/\u00a0/g, ' ').trim();
  const pipeParts = value.split(/\s*\|\s*/).map(clean).filter(Boolean);
  if (pipeParts.length >= 2) return [pipeParts[0], pipeParts[1]];
  const spaced = value.split(/\s{2,}/).map(clean).filter(Boolean);
  if (spaced.length >= 2) return [spaced[0], spaced[1]];
  return [clean(value), ''];
}

function parseReaderRows(source, sourceName, fallbackYear) {
  const rawLines = String(source || '').replace(/\r/g, '').split('\n').map(line => line.trimEnd()).filter(line => line.trim());
  const detectedYear = extractYear(source, fallbackYear);
  const matches = [];
  let section = '';
  let headerFound = false;

  for (const raw of rawLines) {
    const line = raw.trim();
    if (!headerFound) {
      if (isTableHeader(line)) headerFound = true;
      continue;
    }
    if (isFooter(line)) break;

    const dateMatch = findDateInText(line);
    const timeMatch = findTimeInText(line);

    // This is the key rule for FAB: rows without both date and time are category rows.
    if (!dateMatch || !timeMatch) {
      if (line && !isTableHeader(line)) section = clean(line);
      continue;
    }

    const dateIndex = line.indexOf(dateMatch[0]);
    const timeIndex = line.indexOf(timeMatch[0], dateIndex + dateMatch[0].length);
    if (dateIndex < 0 || timeIndex < 0) continue;

    const prefix = line.slice(0, dateIndex).trim();
    const suffix = line.slice(timeIndex + timeMatch[0].length).trim();
    const [homeTeam, awayTeam] = splitTeams(prefix);
    if (!homeTeam || isTableHeader(homeTeam)) continue;

    matches.push({ competition: section, homeTeam, awayTeam, date: dateFromMatch(dateMatch, detectedYear), time: timeMatch[0], venue: clean(suffix), source: sourceName });
  }

  return dedupeMatches(matches);
}

async function parsePdfBytes(bytes, sourceName) {
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const matches = [];
  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = groupTextItems(content.items);
    const sourceYear = extractYear(rows.map(row => row.text).join('\n'));
    matches.push(...parsePdfRows(rows, sourceName, sourceYear));
  }
  return dedupeMatches(matches);
}

export async function parsePdfFile(input, sourceName = '') {
  if (typeof input === 'string') {
    const source = input;
    const htmlMatches = parseHtmlTables(source, sourceName, '');
    if (htmlMatches.length) return htmlMatches;
    const readerMatches = parseReaderRows(source, sourceName, '');
    if (readerMatches.length) return readerMatches;
    throw new Error('No se encontraron filas de partidos en el documento de FAB.');
  }

  let bytes;
  if (input instanceof ArrayBuffer) bytes = new Uint8Array(input);
  else if (ArrayBuffer.isView(input)) bytes = new Uint8Array(input.buffer, input.byteOffset, input.byteLength);
  else if (input?.arrayBuffer) bytes = new Uint8Array(await input.arrayBuffer());
  else throw new Error('Formato de documento no compatible.');

  const header = new TextDecoder().decode(bytes.slice(0, 8));
  if (!header.startsWith('%PDF')) {
    const text = new TextDecoder().decode(bytes);
    const htmlMatches = parseHtmlTables(text, sourceName, '');
    if (htmlMatches.length) return htmlMatches;
    const readerMatches = parseReaderRows(text, sourceName, '');
    if (readerMatches.length) return readerMatches;
    throw new Error('El documento recibido no es un PDF válido ni contiene una tabla de FAB reconocible.');
  }

  return parsePdfBytes(bytes, sourceName);
}
