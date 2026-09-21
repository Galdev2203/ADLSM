import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;
const COMPETITION_RE = /COPA|LIGA|ARAGONESA|NACIONAL|JUNIOR|CADETE|INFANTIL|ALEVIN|BENJAMIN|MINIBASKET|SUPERCOPA|FEB|SOCIAL|PREINFANTIL|PREMINI/i;

function clean(value = '') {
  return value.replace(/\s+/g, ' ').trim();
}

function groupTextItems(items) {
  const positioned = items
    .filter(item => item.str?.trim())
    .map(item => ({
      text: clean(item.str),
      x: item.transform[4],
      y: item.transform[5]
    }))
    .sort((a, b) => b.y - a.y || a.x - b.x);

  const rows = [];
  for (const item of positioned) {
    let row = rows.find(candidate => Math.abs(candidate.y - item.y) <= 2.5);
    if (!row) {
      row = { y: item.y, items: [] };
      rows.push(row);
    }
    row.items.push(item);
  }

  return rows
    .sort((a, b) => b.y - a.y)
    .map(row => ({
      y: row.y,
      items: row.items.sort((a, b) => a.x - b.x),
      text: row.items.map(item => item.text).join(' ')
    }));
}

function normaliseDate(day, month, sourceYear) {
  const year = sourceYear
    ? Number(sourceYear.length === 2 ? `20${sourceYear}` : sourceYear)
    : new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isDate(value) {
  return DATE_RE.test(value);
}

function isTime(value) {
  return TIME_RE.test(value);
}

function joinColumn(items, minX, maxX) {
  return clean(
    items
      .filter(item => item.x >= minX && item.x < maxX)
      .map(item => item.text)
      .join(' ')
  );
}

function findCell(items, predicate) {
  return items.find(item => predicate(item.text));
}

function extractSourceYear(rows) {
  const text = rows.map(row => row.text).join(' ');
  const match = text.match(/JORNADA\s*:?\s*\d{1,2}\/\d{1,2}\/(\d{2,4})/i);
  return match?.[1] || '';
}

function isHeaderOrNoise(row) {
  const text = row.text.toUpperCase();
  return text.includes('LOCAL VISITANTE') || text.includes('FEDERACIÓN ARAGONESA') || text.includes('HORARIOS - JORNADA');
}

function parsePageRows(rows, sourceName, sourceYear) {
  const matches = [];
  let section = '';

  for (const row of rows) {
    if (!row?.items?.length || isHeaderOrNoise(row)) continue;

    const dateItem = findCell(row.items, isDate);
    const timeItem = findCell(row.items, isTime);

    // Competition/category rows have no date/time and appear immediately before matches.
    if (!dateItem && !timeItem && COMPETITION_RE.test(row.text) && row.text.length < 150) {
      section = clean(row.text);
      continue;
    }

    // FAB's PDF is a real table. The columns are stable across pages:
    // LOCAL | VISITANTE | FECHA | HORA | PISTA JUEGO.
    if (!dateItem || !timeItem) continue;

    const dateMatch = dateItem.text.match(DATE_RE);
    if (!dateMatch) continue;

    const homeTeam = joinColumn(row.items, 30, 198);
    const awayTeam = joinColumn(row.items, 198, 355);
    const venue = joinColumn(row.items, 435, 650);

    // Rows such as "FINAL" are not actual team-vs-team games. Keep only rows
    // where both team columns contain meaningful values.
    if (!homeTeam || !awayTeam) continue;
    if (/^(LOCAL|VISITANTE|FECHA|HORA|PISTA|JUEGO)$/i.test(homeTeam)) continue;

    matches.push({
      competition: section,
      homeTeam,
      awayTeam,
      date: normaliseDate(dateMatch[1], dateMatch[2], dateMatch[3] || sourceYear),
      time: timeItem.text,
      venue,
      source: sourceName
    });
  }

  return matches;
}

export async function parsePdfFile(input, sourceName = 'PDF') {
  const loadingTask = pdfjsLib.getDocument({ data: input });
  const pdf = await loadingTask.promise;
  const allMatches = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    const rows = groupTextItems(content.items);
    const sourceYear = extractSourceYear(rows);
    allMatches.push(...parsePageRows(rows, sourceName, sourceYear));
  }

  // Avoid duplicate rows caused by PDF text-layer quirks.
  const seen = new Set();
  return allMatches.filter(match => {
    const key = [match.date, match.time, match.homeTeam, match.awayTeam, match.venue].join('|');
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
