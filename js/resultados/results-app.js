import { RESULTS_PRESETS, RESULTS_VIEWS, analyzeTeam, discoverCompetition, fetchCompetition } from './results-source.js';

const els = {
  form: document.querySelector('#resultsForm'),
  source: document.querySelector('#resultsSource'),
  category: document.querySelector('#resultsCategory'),
  season: document.querySelector('#resultsSeason'),
  group: document.querySelector('#resultsGroup'),
  view: document.querySelector('#resultsView'),
  team: document.querySelector('#resultsTeam'),
  status: document.querySelector('#resultsStatus'),
  summary: document.querySelector('#resultsSummary'),
  classification: document.querySelector('#resultsClassification'),
  matches: document.querySelector('#resultsMatches'),
  metadata: document.querySelector('#resultsMetadata'),
  search: document.querySelector('#resultsSearch'),
  openSource: document.querySelector('#openSource'),
  exportCsv: document.querySelector('#exportCsv')
};

let catalog = null;
let dataset = null;
let analysis = null;
let seasonWasChosen = false;

const text = value => String(value ?? '');
const escapeHtml = value => text(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const formatNumber = value => Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const setStatus = (message, kind = 'info') => { els.status.textContent = message; els.status.className = `results-status ${kind}`; };

function setSelectOptions(select, options, placeholder) {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
  for (const option of options) {
    const node = document.createElement('option');
    node.value = option.url;
    node.textContent = option.label;
    select.appendChild(node);
  }
  select.disabled = options.length === 0;
}

function currentCompetitionUrl() {
  return (seasonWasChosen && els.season.value) || els.category.value || els.season.value || catalog?.fallbackUrl || '';
}

function getFilteredMatches() {
  const query = text(els.search.value).trim().toLocaleLowerCase('es');
  if (!analysis) return [];
  return analysis.matches.filter(match => !query || `${match.home} ${match.away} ${match.jornada}`.toLocaleLowerCase('es').includes(query));
}

function renderSummary() {
  const stats = analysis;
  const hasTeam = Boolean(els.team.value.trim());
  const totalPoints = stats.matches.reduce((sum, match) => sum + (Number.isFinite(match.homeScore) ? match.homeScore : 0) + (Number.isFinite(match.awayScore) ? match.awayScore : 0), 0);
  const cards = hasTeam
    ? [['Partidos', stats.matches.length], ['Jugados', stats.played], ['Pendientes', stats.scheduled], ['Victorias', stats.wins], ['Derrotas', stats.losses], ['Puntos a favor', formatNumber(stats.pointsFor)], ['Puntos en contra', formatNumber(stats.pointsAgainst)], ['% victorias', `${formatNumber(stats.winRate)}%`]]
    : [['Partidos', stats.matches.length], ['Jugados', stats.played], ['Pendientes', stats.scheduled], ['Equipos', dataset.classification.length || dataset.teams.length], ['Puntos totales', formatNumber(totalPoints)], ['Media por partido', stats.played ? formatNumber(totalPoints / stats.played) : '0'], ['Clasificación', dataset.classification.length ? 'Disponible' : 'No disponible'], ['Consulta', RESULTS_VIEWS[dataset.view]?.label || 'Resultados']];
  els.summary.innerHTML = cards.map(([label, value]) => `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
}

function renderClassification() {
  const rows = dataset.classification;
  if (!rows.length) {
    els.classification.innerHTML = dataset.teams.length
      ? `<div class="results-team-grid">${dataset.teams.map(team => `<article class="result-team-card"><strong>${escapeHtml(team.name)}</strong><span>${escapeHtml(team.club)}</span></article>`).join('')}</div>`
      : '<div class="results-empty-small">La fuente consultada no muestra una clasificación en esta vista.</div>';
    return;
  }
  els.classification.innerHTML = `<div class="results-table-wrap"><table class="results-table"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>PF</th><th>PC</th><th>Pts.</th><th>R.</th></tr></thead><tbody>${rows.map(row => `<tr><td>${row.position}</td><td><strong>${escapeHtml(row.team)}</strong></td><td>${row.played}</td><td>${row.wins}</td><td>${row.losses}</td><td>${row.pointsFor}</td><td>${row.pointsAgainst}</td><td>${row.points}</td><td>${escapeHtml(row.form)}</td></tr>`).join('')}</tbody></table></div>`;
}

function renderMatches() {
  const matches = getFilteredMatches();
  if (!matches.length) { els.matches.innerHTML = '<div class="results-empty-small">No hay partidos que coincidan con el filtro.</div>'; return; }
  els.matches.innerHTML = matches.map(match => {
    const score = match.played ? `<strong>${match.homeScore} - ${match.awayScore}</strong>` : '<span class="pending-score">Pendiente</span>';
    return `<article class="result-match"><div class="result-match-main"><div class="result-match-teams"><span>${escapeHtml(match.home)}</span><b>VS</b><span>${escapeHtml(match.away)}</span></div><div class="result-match-score">${score}</div></div><div class="result-match-meta"><span>Jornada ${escapeHtml(match.jornada || '—')}</span><span>${escapeHtml(match.date || '—')}</span><span>${escapeHtml(match.time || '—')}</span>${match.venue ? `<span>${escapeHtml(match.venue)}</span>` : ''}</div></article>`;
  }).join('');
}

function render() {
  if (!dataset || !analysis) return;
  els.metadata.innerHTML = `<div><span>Temporada</span><strong>${escapeHtml(dataset.season || els.season.selectedOptions[0]?.textContent || 'No indicada')}</strong></div><div><span>Categoría</span><strong>${escapeHtml(dataset.category || els.category.selectedOptions[0]?.textContent || 'No indicada')}</strong></div><div><span>Vista</span><strong>${escapeHtml(RESULTS_VIEWS[dataset.view]?.label || dataset.view)}</strong></div><div><span>Fuente</span><strong>FEB / FAB</strong></div>`;
  renderSummary();
  renderClassification();
  renderMatches();
  els.exportCsv.disabled = analysis.matches.length === 0;
  els.openSource.href = dataset.url;
}

async function load(url, teamQuery = '', view = 'results') {
  if (!url) return;
  setStatus('Consultando FEB/FAB…', 'loading');
  els.form.querySelector('button[type="submit"]').disabled = true;
  try {
    dataset = await fetchCompetition(url, view);
    analysis = analyzeTeam(dataset, teamQuery);
    render();
    const total = dataset.matches.length;
    const extra = dataset.classification.length ? `, ${dataset.classification.length} equipos en clasificación` : dataset.teams.length ? `, ${dataset.teams.length} equipos` : '';
    setStatus(`Consulta completada: ${total} partidos${extra}.`, 'success');
  } catch (error) {
    dataset = null; analysis = null;
    els.summary.replaceChildren(); els.classification.replaceChildren(); els.matches.replaceChildren(); els.metadata.replaceChildren();
    setStatus(error instanceof Error ? error.message : 'No se ha podido consultar FEB/FAB.', 'error');
  } finally {
    els.form.querySelector('button[type="submit"]').disabled = false;
  }
}

async function discoverSource(sourceId) {
  setStatus('Cargando categorías y temporadas de FEB/FAB…', 'loading');
  els.form.querySelector('button[type="submit"]').disabled = true;
  els.category.disabled = true;
  els.season.disabled = true;
  els.group.disabled = true;
  seasonWasChosen = false;
  try {
    catalog = await discoverCompetition(sourceId);
    setSelectOptions(els.category, catalog.categoryOptions, 'Selecciona una categoría');
    setSelectOptions(els.season, catalog.seasonOptions, 'Selecciona una temporada');
    setSelectOptions(els.group, catalog.groupOptions, catalog.groupOptions.length ? 'Todos los grupos' : 'Grupos no disponibles');

    const categoryTarget = catalog.defaultCategory || catalog.categoryOptions[0]?.url || catalog.fallbackUrl;
    if (categoryTarget) {
      const categoryOption = [...els.category.options].find(option => option.value === categoryTarget);
      if (categoryOption) categoryOption.selected = true;
    }

    const seasonTarget = catalog.defaultSeason || catalog.seasonOptions[0]?.url || '';
    if (seasonTarget) {
      const seasonOption = [...els.season.options].find(option => option.value === seasonTarget);
      if (seasonOption) seasonOption.selected = true;
    }

    setStatus('Competición lista. Elige categoría y temporada y pulsa Consultar.', 'info');
  } catch (error) {
    catalog = null;
    setSelectOptions(els.category, [], 'No disponible');
    setSelectOptions(els.season, [], 'No disponible');
    setSelectOptions(els.group, [], 'No disponible');
    setStatus(error instanceof Error ? error.message : 'No se han podido cargar las competiciones.', 'error');
  } finally {
    els.form.querySelector('button[type="submit"]').disabled = false;
  }
}

els.source.addEventListener('change', () => discoverSource(els.source.value));
els.category.addEventListener('change', () => {
  seasonWasChosen = false;
  setStatus('Categoría seleccionada. Puedes mantener la temporada actual o elegir otra.', 'info');
});
els.season.addEventListener('change', () => {
  seasonWasChosen = Boolean(els.season.value);
});
els.form.addEventListener('submit', event => {
  event.preventDefault();
  const url = currentCompetitionUrl();
  if (!url) { setStatus('Selecciona una categoría o temporada antes de consultar.', 'error'); return; }
  load(url, els.team.value.trim(), els.view.value);
});
els.team.addEventListener('input', () => { if (!dataset) return; analysis = analyzeTeam(dataset, els.team.value.trim()); render(); });
els.search.addEventListener('input', renderMatches);
els.exportCsv.addEventListener('click', () => {
  const matches = getFilteredMatches();
  if (!matches.length) return;
  const header = ['Jornada','Fecha','Hora','Local','Visitante','Puntos local','Puntos visitante','Pabellón'];
  const rows = matches.map(match => [match.jornada, match.date, match.time, match.home, match.away, match.homeScore ?? '', match.awayScore ?? '', match.venue || '']);
  const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `resultados-${dataset?.season || 'feb'}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
});

els.source.value = 'zaragoza';
discoverSource('zaragoza');
