import * as pdfjsLib from 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs';

const DATE_RE = /^(\d{1,2})\/(\d{1,2})(?:\/(\d{2,4}))?$/;
const TIME_RE = /^(\d{1,2}):(\d{2})$/;

function clean(value) {
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
    .map(row => row.items.sort((a, b) => a.x - b.x).map(item => item.text).join(' '));
}

function normaliseDate(day, month, sourceYear) {
  const year = sourceYear ? Number(sourceYear.length === 2 ? `20${sourceYear}` : sourceYear) : new Date().getFullYear();
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

function isDate(value) {
  return DATE_RE.test(value);
}

function isTime(value) {
  return TIME_RE.test(value);
}

function parsePageRows(rows, sourceName) {
  const matches = [];
  let section = '';
  let i = 0;

  while (i < rows.length) {
    const row = rows[i];
    if (!row) { i += 1; continue; }

    // Most FAB PDFs expose a competition/category heading before the match rows.
    if (!isDate(row) && !isTime(row) && row.length > 3 && row.length < 100) {
      if (/COPA|LIGA|ARAGONESA|NACIONAL|JUNIOR|CADETE|INFANTIL|ALEVIN|BENJAMIN|MINIBASKET|SUPERCOPA|LF2|FEB/i.test(row)) {
        section = row;
      }
    }

    const dateMatch = row.match(DATE_RE);
    if (dateMatch) {
      const date = normaliseDate(dateMatch[1], dateMatch[2], dateMatch[3]);
      const previous = rows.slice(Math.max(0, i - 4), i).filter(Boolean);
      const next = rows.slice(i + 1, i + 5).filter(Boolean);
      const timeIndex = next.findIndex(isTime);

      if (timeIndex >= 0) {
        const time = next[timeIndex];
        const teams = previous.slice(-2);
        const venue = next.slice(timeIndex + 1).find(value => !isTime(value) && !isDate(value)) || '';

        if (teams.length >= 2) {
          matches.push({
            competition: section,
            homeTeam: teams[0],
            awayTeam: teams[1],
            date,
            time,
            venue,
            source: sourceName
          });
        }
      }
    }

    i += 1;
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
    allMatches.push(...parsePageRows(rows, sourceName));
  }

  return allMatches;
}
