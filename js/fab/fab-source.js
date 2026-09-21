const FAB_SCHEDULES_URL = 'https://fabasket.com/horarios/';
const FAB_BASE = 'https://fabasket.com/wp-content/uploads';

// La página de FAB no expone CORS para GitHub Pages. Para localizar el
// enlace oficial de la jornada usamos Reader como proxy de texto. El PDF
// se descarga después mediante proxies CORS que soportan binarios.
const PAGE_PROXIES = [
  'https://r.jina.ai/',
  'https://api.allorigins.win/raw?url='
];

const PDF_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://api.cors.lol/?url='
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
  return proxy.endsWith('url=') || proxy.endsWith('/')
    ? `${proxy}${encodeURIComponent(url)}`
    : `${proxy}${encodeURIComponent(url)}`;
}

async function fetchThroughProxies(url, proxies, responseType = 'text') {
  let lastError = null;

  for (const proxy of proxies) {
    try {
      const target = proxy === 'https://r.jina.ai/'
        ? `${proxy}${url}`
        : proxyUrl(proxy, url);

      const response = await fetch(target, {
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

async function fetchFabPage() {
  return fetchThroughProxies(FAB_SCHEDULES_URL, PAGE_PROXIES, 'text');
}

async function fetchProxyBytes(url) {
  return fetchThroughProxies(url, PDF_PROXIES, 'arrayBuffer');
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
  const variants = getDateVariants(isoDate).map(normalizeDateText);
  const source = String(html || '');

  // Reader devuelve la página en Markdown, donde los enlaces aparecen como
  // [texto](https://...). También soportamos HTML por si el fallback cambia.
  const markdownLinks = [...source.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/gi)]
    .map(match => ({ text: normalizeDateText(match[1]), href: match[2] }));

  const htmlDocument = new DOMParser().parseFromString(source, 'text/html');
  const htmlLinks = [...htmlDocument.querySelectorAll('a[href]')]
    .map(anchor => ({
      text: normalizeDateText(anchor.textContent),
      href: anchor.getAttribute('href')
    }))
    .filter(item => item.href);

  const links = [...markdownLinks, ...htmlLinks];

  const matches = links.filter(item => {
    const haystack = `${item.text} ${item.href}`.toLowerCase();
    return variants.some(variant => haystack.includes(variant.toLowerCase()))
      && /horarios/i.test(`${item.text} ${item.href}`)
      && /\.pdf(?:$|[?#])/i.test(item.href);
  });

  if (!matches.length) return null;

  const selected = matches[0];
  return {
    url: new URL(selected.href, FAB_SCHEDULES_URL).href,
    label: selected.text || selected.href
  };
}

async function findScheduleFromFabPage(isoDate) {
  const page = await fetchFabPage();
  const link = findScheduleLink(page, isoDate);

  if (!link) {
    const { day, month, year } = dateParts(isoDate);
    throw new Error(`La página de horarios de FAB no contiene un enlace PDF para la jornada ${day}/${month}/${year}.`);
  }

  return link;
}

export async function findFabDocuments(isoDate) {
  let lastError = null;

  try {
    // Primero usamos exactamente el enlace publicado por FAB para esa fecha.
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

  // Fallback: si la página o el PDF no responden, mantenemos las variantes
  // históricas conocidas para no romper el flujo existente.
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
