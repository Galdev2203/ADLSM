const READER_BASE = 'https://r.jina.ai/';

export const COMPETITION_SOURCES = {
  aragon: { baseUrl: 'https://competiciones.feb.es/autonomicas/?a=3' },
  zaragoza: { baseUrl: 'https://competiciones.feb.es/autonomicas/?a=32' }
};

async function fetchHtml(url) {
  const response = await fetch(`${READER_BASE}${url}`, {
    cache: 'no-store',
    headers: { 'x-respond-with': 'html', 'x-engine': 'browser', 'x-no-cache': 'true' }
  });
  if (!response.ok) throw new Error(`No se han podido leer los selectores FEB/FAB (${response.status}).`);
  const html = await response.text();
  if (!html.trim()) throw new Error('FEB/FAB ha devuelto un documento vacío al cargar las competiciones.');
  return html;
}

const clean = value => String(value || '').replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim();
const isSeason = value => /^20\d{2}\/20\d{2}$/.test(clean(value));

function competitionUrl(baseUrl, rawValue) {
  const raw = clean(rawValue);
  if (!raw) return '';
  try {
    const candidate = new URL(raw, baseUrl);
    const c = candidate.searchParams.get('c');
    if (c) {
      candidate.searchParams.set('med', candidate.searchParams.get('med') || '0');
      return candidate.href;
    }
  } catch { /* fallback below */ }
  if (/^\d+$/.test(raw)) {
    const url = new URL(baseUrl);
    url.searchParams.set('c', raw);
    url.searchParams.set('med', '0');
    return url.href;
  }
  return '';
}

function parseSelects(html, baseUrl) {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  return [...doc.querySelectorAll('select')].map(select => {
    const options = [...select.querySelectorAll('option')].map(option => ({
      label: clean(option.textContent),
      url: competitionUrl(baseUrl, option.value),
      selected: option.selected
    })).filter(option => option.label);
    return { options, selected: options.find(option => option.selected) || options[0] || null };
  }).filter(select => select.options.length);
}

function identify(selects) {
  const season = selects.find(select => select.options.filter(option => isSeason(option.label)).length >= 2);
  const category = selects.find(select => select !== season && select.options.length >= 4 && select.options.some(option => option.url));
  return { season, category };
}

export async function discoverSource(sourceId) {
  const source = COMPETITION_SOURCES[sourceId];
  if (!source) throw new Error('Fuente FEB/FAB no reconocida.');
  const html = await fetchHtml(source.baseUrl);
  const { season, category } = identify(parseSelects(html, source.baseUrl));
  const categoryOptions = category?.options.filter(option => option.url) || [];
  if (!categoryOptions.length) throw new Error('FEB/FAB no ha expuesto las categorías disponibles en su selector.');
  return {
    sourceId,
    baseUrl: source.baseUrl,
    categoryOptions,
    defaultCategory: category?.selected?.url || categoryOptions[0].url
  };
}

export async function discoverSeasons(categoryUrl) {
  if (!categoryUrl) return { options: [], selected: '' };
  const html = await fetchHtml(categoryUrl);
  const { season } = identify(parseSelects(html, categoryUrl));
  const options = season?.options.filter(option => option.url && isSeason(option.label)) || [];
  return { options, selected: season?.selected?.url || options[0]?.url || '' };
}
