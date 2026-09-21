const FAB_SCHEDULES_URL = 'https://fabasket.com/horarios/';

// GitHub Pages no puede leer fabasket.com directamente porque FAB no expone
// CORS. En lugar de encadenar proxies públicos con límites/rate limits,
// usamos Jina Reader, que devuelve el contenido de la página/PDF como texto
// y sí puede ser consumido desde el navegador.
const READER_BASE = 'https://r.jina.ai/';

function dateParts(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return { year, month, day, ddmmyy: `${day}${month}${year.slice(2)}` };
}

function normalizeDateText(value) {
  return String(value || '')
    .replace(/[–—]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

function getDateVariants(isoDate) {
  const { year, month, day } = dateParts(isoDate);
  const shortYear = year.slice(2);
  return [
    `${day}/${month}/${shortYear}`,
    `${day}/${month}/${year}`,
    `${day}-${month}-${shortYear}`,
    `${day}-${month}-${year}`,
    `${day}${month}${shortYear}`,
    `${day}${month}${year}`
  ];
}

async function fetchReader(url) {
  const response = await fetch(`${READER_BASE}${url}`, {
    method: 'GET',
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`${response.status} al consultar FAB mediante Reader.`);
  }

  const text = await response.text();
  if (!text.trim()) throw new Error('FAB devolvió un documento vacío.');
  return text;
}

function findScheduleLink(source, isoDate) {
  const variants = getDateVariants(isoDate).map(normalizeDateText).map(value => value.toLowerCase());
  const links = [];

  // Reader normalmente devuelve Markdown: [texto](URL).
  for (const match of source.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi)) {
    links.push({ text: normalizeDateText(match[1]), href: match[2] });
  }

  // Fallback por si Reader devuelve HTML.
  const document = new DOMParser().parseFromString(source, 'text/html');
  for (const anchor of document.querySelectorAll('a[href]')) {
    links.push({
      text: normalizeDateText(anchor.textContent),
      href: anchor.getAttribute('href') || ''
    });
  }

  const match = links.find(item => {
    const haystack = `${item.text} ${item.href}`.toLowerCase();
    return variants.some(variant => haystack.includes(variant))
      && /horarios/i.test(haystack)
      && /\.pdf(?:$|[?#])/i.test(item.href);
  });

  if (!match) return null;

  return {
    url: new URL(match.href, FAB_SCHEDULES_URL).href,
    label: match.text || match.href
  };
}

export async function findFabDocuments(isoDate) {
  const { day, month, year } = dateParts(isoDate);

  // 1. Consultamos la página oficial de Horarios de FAB.
  const page = await fetchReader(FAB_SCHEDULES_URL);
  const schedule = findScheduleLink(page, isoDate);

  if (!schedule) {
    throw new Error(`La página oficial de FAB no contiene un PDF para la jornada ${day}/${month}/${year}.`);
  }

  // 2. Consultamos exactamente el PDF enlazado por FAB. Reader extrae su
  // contenido manteniendo la estructura de tablas en Markdown/texto.
  const documentText = await fetchReader(schedule.url);

  return {
    url: schedule.url,
    label: schedule.label,
    readerText: documentText,
    source: 'fab-horarios-reader'
  };
}

export { FAB_SCHEDULES_URL };
