const READER_BASE = 'https://r.jina.ai/';

export const COMPETITION_SOURCES = {
  aragon: { baseUrl: 'https://competiciones.feb.es/autonomicas/?a=3' },
  zaragoza: { baseUrl: 'https://competiciones.feb.es/autonomicas/?a=32' }
};

async function fetchReader(url, mode = 'markdown') {
  const headers = { 'x-no-cache': 'true' };
  if (mode === 'html') headers['x-respond-with'] = 'html';
  const response = await fetch(`${READER_BASE}${url}`, {
    cache: 'no-store',
    headers
  });
  if (!response.ok) throw new Error(`${response.status}`);
  const text = await response.text();
  if (!text.trim()) throw new Error('Documento vacío.');
  return text;
}

async function fetchCompetitionDocument(url) {
  try {
    // No usamos x-engine=browser: Jina puede responder 401 con esa combinación
    // en la capa HTML aunque la misma URL funcione en modo markdown.
    return { mode: 'html', text: await fetchReader(url, 'html') };
  } catch (htmlError) {
    try {
      return { mode: 'markdown', text: await fetchReader(url, 'markdown') };
    } catch (markdownError) {
      throw new Error(`No se han podido leer los selectores FEB/FAB (${htmlError.message || 'error de HTML'}).`);
    }
  }
}

const clean = value => String(value || '')
  .replace(/\u00a0/g, ' ')
  .replace(/[–—]/g, '-')
  .replace(/\s+/g, ' ')
  .trim();

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

function parseMarkdownLinks(markdown, baseUrl) {
  const options = [];
  const seen = new Set();
  const pattern = /\[([^\]]+)\]\((https?:\/\/competiciones\.feb\.es\/[^)]+)\)/gi;
  let match;
  while ((match = pattern.exec(markdown))) {
    const label = clean(match[1]);
    const url = competitionUrl(baseUrl, match[2]);
    if (!label || !url || seen.has(url)) continue;
    seen.add(url);
    options.push({ label, url, selected: false });
  }
  return options;
}

function identify(selects) {
  const season = selects.find(select => select.options.filter(option => isSeason(option.label)).length >= 2);
  const category = selects.find(select => select !== season && select.options.length >= 4 && select.options.some(option => option.url));
  return { season, category };
}

function identifyMarkdown(markdown) {
  const links = parseMarkdownLinks(markdown, 'https://competiciones.feb.es/autonomicas/');
  const seasons = links.filter(option => isSeason(option.label));
  const categories = links.filter(option => !isSeason(option.label));
  return { seasons, categories };
}

export async function discoverSource(sourceId) {
  const source = COMPETITION_SOURCES[sourceId];
  if (!source) throw new Error('Fuente FEB/FAB no reconocida.');
  const document = await fetchCompetitionDocument(source.baseUrl);

  if (document.mode === 'html') {
    const { category } = identify(parseSelects(document.text, source.baseUrl));
    const categoryOptions = category?.options.filter(option => option.url) || [];
    if (!categoryOptions.length) throw new Error('FEB/FAB no ha expuesto las categorías disponibles en su selector.');
    return {
      sourceId,
      baseUrl: source.baseUrl,
      categoryOptions,
      defaultCategory: category?.selected?.url || categoryOptions[0].url
    };
  }

  const { categories } = identifyMarkdown(document.text);
  if (!categories.length) throw new Error('FEB/FAB no ha expuesto las categorías disponibles en la consulta.');
  return {
    sourceId,
    baseUrl: source.baseUrl,
    categoryOptions: categories,
    defaultCategory: categories[0].url
  };
}

export async function discoverSeasons(categoryUrl) {
  if (!categoryUrl) return { options: [], selected: '' };
  const document = await fetchCompetitionDocument(categoryUrl);

  if (document.mode === 'html') {
    const { season } = identify(parseSelects(document.text, categoryUrl));
    const options = season?.options.filter(option => option.url && isSeason(option.label)) || [];
    return { options, selected: season?.selected?.url || options[0]?.url || '' };
  }

  const { seasons } = identifyMarkdown(document.text);
  return { options: seasons, selected: seasons[0]?.url || '' };
}
