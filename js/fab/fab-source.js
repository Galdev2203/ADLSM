const FAB_SCHEDULES_URL = 'https://fabasket.com/horarios/';

// GitHub Pages no puede leer fabasket.com directamente porque FAB no expone
// CORS. Usamos Jina Reader como puente de lectura para la página y el PDF.
const READER_BASE = 'https://r.jina.ai/';

function dateParts(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return { year, month, day };
}

function normalizeDateText(value) {
  return String(value || '').replace(/[–—]/g, '-').replace(/\s+/g, ' ').trim();
}

function getDateVariants(isoDate) {
  const { year, month, day } = dateParts(isoDate);
  const shortYear = year.slice(2);
  return [
    `${day}/${month}/${shortYear}`, `${day}/${month}/${year}`,
    `${day}-${month}-${shortYear}`, `${day}-${month}-${year}`,
    `${day}${month}${shortYear}`, `${day}${month}${year}`
  ];
}

async function fetchReader(url) {
  const response = await fetch(`${READER_BASE}${url}`, { method: 'GET', cache: 'no-store' });
  if (!response.ok) throw new Error(`${response.status} al consultar FAB mediante Reader.`);
  const text = await response.text();
  if (!text.trim()) throw new Error('FAB devolvió un documento vacío.');
  return text;
}

function findScheduleLink(source, isoDate) {
  const variants = getDateVariants(isoDate).map(normalizeDateText).map(value => value.toLowerCase());
  const links = [];

  for (const match of source.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi)) {
    links.push({ text: normalizeDateText(match[1]), href: match[2] });
  }

  const document = new DOMParser().parseFromString(source, 'text/html');
  for (const anchor of document.querySelectorAll('a[href]')) {
    links.push({ text: normalizeDateText(anchor.textContent), href: anchor.getAttribute('href') || '' });
  }

  const match = links.find(item => {
    const haystack = `${item.text} ${item.href}`.toLowerCase();
    return variants.some(variant => haystack.includes(variant))
      && /horarios/i.test(haystack)
      && /\.pdf(?:$|[?#])/i.test(item.href);
  });

  if (!match) return null;
  return { url: new URL(match.href, FAB_SCHEDULES_URL).href, label: match.text || match.href };
}

export async function findFabDocuments(isoDate) {
  const { day, month, year } = dateParts(isoDate);
  const page = await fetchReader(FAB_SCHEDULES_URL);
  const schedule = findScheduleLink(page, isoDate);

  if (!schedule) {
    throw new Error(`La página oficial de FAB no contiene un PDF para la jornada ${day}/${month}/${year}.`);
  }

  // El parser detecta que bytes es texto y usa el parser de tablas de Reader.
  const documentText = await fetchReader(schedule.url);
  return {
    url: schedule.url,
    label: schedule.label,
    bytes: documentText,
    source: 'fab-horarios-reader'
  };
}

export { FAB_SCHEDULES_URL };
