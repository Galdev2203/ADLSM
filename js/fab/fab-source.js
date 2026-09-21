const FAB_SCHEDULES_URL = 'https://fabasket.com/horarios/';
const FAB_BASE = 'https://fabasket.com/wp-content/uploads';

// FAB no expone CORS para GitHub Pages. Usamos primero un proxy público
// que actualmente devuelve los encabezados CORS correctamente y dejamos
// AllOrigins como respaldo por compatibilidad.
const CORS_PROXIES = [
  'https://api.cors.lol/?url=',
  'https://api.allorigins.win/raw?url='
];

function dateParts(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return { year, month, day, ddmmyy: `${day}${month}${year.slice(2)}` };
}

function candidateUrls(isoDate) {
  const { year, month, ddmmyy } = dateParts(isoDate);
  const folder = `${year}/${month}`;
  const base = `${FAB_BASE}/${folder}/HORARIOS-FAB-${ddmmyy}`;
  return [
    `${base}.pdf`,
    `${base}J.pdf`,
    `${base}X.pdf`,
    `${base}M.pdf`,
    `${base}A.pdf`
  ];
}

function proxyUrl(proxy, url) {
  return `${proxy}${encodeURIComponent(url)}`;
}

async function fetchThroughProxies(url, responseType = 'text') {
  let lastError = null;

  for (const proxy of CORS_PROXIES) {
    try {
      const response = await fetch(proxyUrl(proxy, url), {
        method: 'GET',
        cache: 'no-store'
      });

      if (!response.ok) {
        throw new Error(`${response.status} al consultar ${url} mediante ${new URL(proxy).hostname}`);
      }

      if (responseType === 'arrayBuffer') {
        const bytes = await response.arrayBuffer();
        if (bytes.byteLength < 1000) {
          throw new Error(`El documento descargado desde ${url} está vacío o incompleto.`);
        }
        return bytes;
      }

      return response.text();
    } catch (error) {
      lastError = error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error(`No se pudo acceder a ${url}.`);
}

async function fetchProxyText(url) {
  return fetchThroughProxies(url, 'text');
}

async function fetchProxyBytes(url) {
  return fetchThroughProxies(url, 'arrayBuffer');
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

function findScheduleLink(html, isoDate) {
  const document = new DOMParser().parseFromString(html, 'text/html');
  const variants = getDateVariants(isoDate);
  const anchors = [...document.querySelectorAll('a[href]')];

  const matches = anchors
    .map(anchor => ({
      href: anchor.getAttribute('href'),
      text: normalizeDateText(anchor.textContent),
      label: normalizeDateText(anchor.textContent)
    }))
    .filter(item => item.href)
    .filter(item => {
      const haystack = `${item.text} ${item.href}`.toLowerCase();
      return variants.some(variant => haystack.includes(variant.toLowerCase()));
    })
    .filter(item => /horarios/i.test(`${item.text} ${item.href}`));

  if (!matches.length) return null;

  const selected = matches[0];
  return {
    url: new URL(selected.href, FAB_SCHEDULES_URL).href,
    label: selected.label || selected.href
  };
}

async function findScheduleFromFabPage(isoDate) {
  const html = await fetchProxyText(FAB_SCHEDULES_URL);
  const link = findScheduleLink(html, isoDate);
  if (!link) {
    const { day, month, year } = dateParts(isoDate);
    throw new Error(`La página de horarios de FAB no contiene un enlace para la jornada ${day}/${month}/${year}.`);
  }
  return link;
}

export async function findFabDocuments(isoDate) {
  let lastError = null;

  try {
    const schedule = await findScheduleFromFabPage(isoDate);
    const bytes = await fetchProxyBytes(schedule.url);
    return {
      url: schedule.url,
      label: schedule.label,
      bytes,
      source: 'fab-horarios'
    };
  } catch (error) {
    lastError = error;
  }

  // Fallback: si la página de horarios no responde o FAB cambia su estructura,
  // mantenemos las variantes históricas conocidas.
  for (const url of candidateUrls(isoDate)) {
    try {
      const bytes = await fetchProxyBytes(url);
      return { url, bytes, source: 'fab-fallback' };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error(
    lastError instanceof Error
      ? `No se pudo localizar la jornada en FAB. ${lastError.message}`
      : 'No se pudo localizar la jornada en FAB.'
  );
}

export { candidateUrls, FAB_SCHEDULES_URL };
