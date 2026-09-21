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
function isNonCompetitionRow(value) { const text = compact(value); return text.includes('APLAZADO') || text.includes('SUSPENDIDO') || text.startsWith('DESCANSA'); }
function extractYear(source, fallback = '') { const match = String(source || '').match(/(?:JORNADA|HORARIOS)[^\d]*(?:\d{1,2}[\/-]\d{1,2}[\/-])(\d{2,4})/i); return match?.[1] || fallback; }
function isMarkdownSeparator(cells) { return cells.length > 0 && cells.every(cell => /^:?-{2,}:?$/.test(clean(cell))); }

function groupTextItems(items) {
  const positioned = items.filter(item => item.str?.trim()).map(item => ({ text: clean(item.str), x: item.transform[4], y: item.transform[5] })).sort((a, b) => b.y - a.y || a.x - b.x);
  const rows = [];
  for (const item of positioned) { let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 2.5); if (!row) { row = { y: item.y, items: [] }; rows.push(row); } row.items.push(item); }
  return rows.sort((a, b) => b.y - a.y).map(row => ({ y: row.y, items: row.items.sort((a, b) => a.x - b.x), text: row.items.map(item => item.text).join(' ') }));
}

function clusterHeaderItems(items) {
  const sorted = [...(items || [])].sort((a, b) => a.x - b.x);
  const clusters = [];
  for (const item of sorted) {
    const last = clusters[clusters.length - 1];
    if (!last || item.x - last.lastX > 18) {
      clusters.push({ items: [item], lastX: item.x });
    } else {
      last.items.push(item);
      last.lastX = item.x;
    }
  }
  return clusters.map(cluster => {
    const xs = cluster.items.map(item => item.x);
    return { text: compact(cluster.items.map(item => item.text).join('')), center: (Math.min(...xs) + Math.max(...xs)) / 2 };
  });
}

function inferPdfLayout(rows) {
  const headerRow = rows.find(row => isTableHeader(row.text));
  if (headerRow) {
    const clusters = clusterHeaderItems(headerRow.items);
    const byName = name => clusters.find(cluster => cluster.text.includes(name));
    const local = byName('LOCAL');
    const visitor = byName('VISITANTE');
    const date = byName('FECHA');
    const time = byName('HORA');
    const venue = clusters.find(cluster => cluster.text.includes('PISTAJUEGO') || cluster.text === 'PISTA' || cluster.text === 'JUEGO');
    if (local && visitor && date && time && venue) {
      const midpoint = (a, b) => (a.center + b.center) / 2;
      return {
        localVisitor: midpoint(local, visitor),
        visitorDate: midpoint(visitor, date),
        dateTime: midpoint(date, time),
        timeVenue: midpoint(time, venue)
      };
    }
  }

  const firstMatch = rows.find(row => row.items?.some(item => isDate(item.text)) && row.items?.some(item => isTime(item.text)));
  const dateItem = firstMatch?.items?.find(item => isDate(item.text));
  const timeItem = firstMatch?.items?.find(item => isTime(item.text));
  if (dateItem && timeItem) {
    return {
      localVisitor: dateItem.x - 170,
      visitorDate: dateItem.x - 42,
      dateTime: (dateItem.x + timeItem.x) / 2,
      timeVenue: timeItem.x + 30
    };
  }

  return { localVisitor: 190, visitorDate: 320, dateTime: 383, timeVenue: 430 };
}

function parsePdfRows(rows, sourceName, fallbackYear, layout) {
  const matches = [];
  let section = '';
  const columnLayout = layout || inferPdfLayout(rows);

  for (const row of rows) {
    if (!row.items?.length || isFooter(row.text) || isTableHeader(row.text)) continue;

    const dateItem = row.items.find(item => isDate(item.text));
    const timeItem = row.items.find(item => isTime(item.text));

    // FAB's reliable rule: a row is a match only when it has BOTH date and time.
    // Rows without both values are category/competition headers (or statuses).
    if (!dateItem || !timeItem) {
      if (row.text.trim() && !isNonCompetitionRow(row.text)) section = clean(row.text);
      continue;
    }

    const dateMatch = dateItem.text.match(DATE_RE);
    if (!dateMatch) continue;

    const homeTeam = clean(row.items.filter(item => item.x < columnLayout.localVisitor).map(item => item.text).join(' '));
    const awayTeam = clean(row.items.filter(item => item.x >= columnLayout.localVisitor && item.x < columnLayout.visitorDate).map(item => item.text).join(' '));
    const venue = clean(row.items.filter(item => item.x >= columnLayout.timeVenue).map(item => item.text).join(' '));

    if (!homeTeam || isTableHeader(homeTeam)) continue;

    matches.push({
      competition: section,
      homeTeam,
      awayTeam,
      date: dateFromMatch(dateMatch, fallbackYear),
      time: clean(timeItem.text),
      venue,
      source: sourceName
    });
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
    if (!cells.length || isMarkdownSeparator(cells)) continue;
    const joined = cells.join(' ');
    if (isTableHeader(joined)) continue;
    const dateIndex = cells.findIndex(cell => isDate(cell));
    const timeIndex = cells.findIndex(cell => isTime(cell));
    if (dateIndex < 0 || timeIndex < 0) { if (!isFooter(joined) && !isNonCompetitionRow(joined)) section = clean(joined); continue; }
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

function parseMarkdownTables(source, sourceName, fallbackYear) {
  const lines = String(source || '').replace(/\r/g, '').split('\n');
  const tableLines = lines.filter(line => /^\s*\|/.test(line));
  if (!tableLines.length) return [];

  const matches = [];
  let section = '';
  let headerSeen = false;
  const detectedYear = extractYear(source, fallbackYear);

  for (const rawLine of tableLines) {
    const cells = rawLine.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(clean);
    if (!cells.length || isMarkdownSeparator(cells)) continue;

    const joined = cells.join(' ');
    if (!headerSeen) {
      if (isTableHeader(joined)) headerSeen = true;
      continue;
    }
    if (isFooter(joined)) break;

    const dateIndex = cells.findIndex(cell => isDate(cell));
    const timeIndex = cells.findIndex(cell => isTime(cell));
    if (dateIndex < 0 || timeIndex < 0) {
      if (joined && !isNonCompetitionRow(joined)) section = clean(joined);
      continue;
    }

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
    if (!dateMatch || !timeMatch) {
      if (line && !isTableHeader(line) && !isNonCompetitionRow(line)) section = clean(line.replace(/^\|\s*|\s*\|$/g, ''));
      continue;
    }

    const dateIndex = line.indexOf(dateMatch[0]);
    const timeIndex = line.indexOf(timeMatch[0], dateIndex + dateMatch[0].length);
    if (dateIndex < 0 || timeIndex < 0) continue;

    const prefix = line.slice(0, dateIndex).trim();
    const suffix = line.slice(timeIndex + timeMatch[0].length).trim();
    const [homeTeam, awayTeam] = splitTeams(prefix);
    if (!homeTeam || isTableHeader(homeTeam)) continue;

    matches.push({ competition: section, homeTeam, awayTeam, date: dateFromMatch(dateMatch, detectedYear), time: timeMatch[0], venue: clean(suffix.replace(/^\|\s*|\s*\|$/g, '')), source: sourceName });
  }

  return dedupeMatches(matches);
}

async function parsePdfBytes(bytes, sourceName) {
  const pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
  const matches = [];
  let layout = null;
  let documentYear = '';

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = groupTextItems(content.items);
    if (!layout) layout = inferPdfLayout(rows);
    const pageText = rows.map(row => row.text).join('\n');
    documentYear = documentYear || extractYear(pageText, '');
    matches.push(...parsePdfRows(rows, sourceName, documentYear, layout));
  }

  return dedupeMatches(matches);
}

export async function parsePdfFile(input, sourceName = '') {
  if (typeof input === 'string') {
    const source = input;
    const htmlMatches = parseHtmlTables(source, sourceName, '');
    if (htmlMatches.length) return htmlMatches;
    const markdownMatches = parseMarkdownTables(source, sourceName, '');
    if (markdownMatches.length) return markdownMatches;
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
    const markdownMatches = parseMarkdownTables(text, sourceName, '');
    if (markdownMatches.length) return markdownMatches;
    const readerMatches = parseReaderRows(text, sourceName, '');
    if (readerMatches.length) return readerMatches;
    throw new Error('El documento recibido no es un PDF válido ni contiene una tabla de FAB reconocible.');
  }

  return parsePdfBytes(bytes, sourceName);
}
