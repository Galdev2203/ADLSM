import { RESULTS_VIEWS, analyzeTeam, fetchCompetition } from './results-source.js?v=20260922-13';
import { discoverSeasons, discoverSource as discoverCompetitionCatalog } from './competition-discovery.js?v=20260922-13';

const els = {
  form: document.querySelector('#resultsForm'), source: document.querySelector('#resultsSource'), category: document.querySelector('#resultsCategory'),
  season: document.querySelector('#resultsSeason'), view: document.querySelector('#resultsView'), team: document.querySelector('#resultsTeam'),
  status: document.querySelector('#resultsStatus'), summary: document.querySelector('#resultsSummary'), classification: document.querySelector('#resultsClassification'),
  matches: document.querySelector('#resultsMatches'), metadata: document.querySelector('#resultsMetadata'), search: document.querySelector('#resultsSearch'),
  openSource: document.querySelector('#openSource'), exportCsv: document.querySelector('#exportCsv'), matchesTitle: document.querySelector('#resultsMatchesTitle'),
  matchesSubtitle: document.querySelector('#resultsMatchesSubtitle'), classificationTitle: document.querySelector('#resultsClassificationTitle'), classificationSubtitle: document.querySelector('#resultsClassificationSubtitle')
};

let catalog = null;
let dataset = null;
let seasonWasChosen = false;
let loadingCompetition = false;

const text = value => String(value ?? '');
const escapeHtml = value => text(value).replace(/[&<>'"]/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', "'":'&#39;', '"':'&quot;' }[char]));
const formatNumber = value => Number(value || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });
const normalizeKey = value => text(value).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const setStatus = (message, kind = 'info') => { els.status.textContent = message; els.status.className = `results-status ${kind}`; };

function setSelectOptions(select, options, placeholder) {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
  for (const option of options) {
    const node = document.createElement('option'); node.value = option.url; node.textContent = option.label; select.appendChild(node);
  }
  select.disabled = options.length === 0;
}

function setTeamOptions(rows) {
  const previous = els.team.value;
  const names = rows.map(row => row.team || row.name).filter(Boolean);
  els.team.innerHTML = '<option value="">Todos los equipos</option>';
  for (const name of names) { const option = document.createElement('option'); option.value = name; option.textContent = name; els.team.appendChild(option); }
  els.team.disabled = names.length === 0;
  if (names.includes(previous)) els.team.value = previous;
}

function currentCompetitionUrl() { return (seasonWasChosen && els.season.value) || els.season.value || els.category.value || catalog?.fallbackUrl || ''; }
function getSelectedTeam() { return els.team.value.trim(); }

function getTeamMatches(teamQuery = getSelectedTeam()) {
  if (!dataset) return [];
  const query = normalizeKey(teamQuery);
  if (!query) return dataset.matches;
  return dataset.matches.filter(match => normalizeKey(match.home) === query || normalizeKey(match.away) === query);
}

function getFilteredMatches() {
  const query = text(els.search.value).trim().toLocaleLowerCase('es');
  const base = els.view.value === 'team' ? getTeamMatches() : dataset?.matches || [];
  return base.filter(match => !query || `${match.home} ${match.away} ${match.jornada}`.toLocaleLowerCase('es').includes(query));
}

function renderSummary() {
  if (!dataset) return;
  const team = getSelectedTeam();
  if (team) {
    const stats = analyzeTeam({ ...dataset, matches: getTeamMatches(team) }, team);
    const cards = [['Equipo', team], ['Partidos', stats.matches.length], ['Jugados', stats.played], ['Pendientes', stats.scheduled], ['Victorias', stats.wins], ['Derrotas', stats.losses], ['PF / PC', `${formatNumber(stats.pointsFor)} / ${formatNumber(stats.pointsAgainst)}`], ['% victorias', `${formatNumber(stats.winRate)}%`]];
    els.summary.innerHTML = cards.map(([label, value]) => `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join(''); return;
  }
  const matches = dataset.matches || [];
  const played = matches.filter(match => match.played && Number.isFinite(match.homeScore) && Number.isFinite(match.awayScore));
  const totalPoints = played.reduce((sum, match) => sum + match.homeScore + match.awayScore, 0);
  const cards = [['Equipos', dataset.classification.length || dataset.teams.length], ['Partidos', matches.length], ['Jugados', played.length], ['Pendientes', matches.length - played.length], ['Puntos anotados', formatNumber(totalPoints)], ['Media puntos / partido', played.length ? formatNumber(totalPoints / played.length) : '0'], ['Clasificación', dataset.classification.length ? 'Disponible' : 'No disponible'], ['Fuente', dataset.sourceId === 'zaragoza' ? 'Zaragoza' : 'Aragón · FEB/FAB']];
  els.summary.innerHTML = cards.map(([label, value]) => `<article class="stat-card"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></article>`).join('');
}

function renderClassification() {
  const rows = dataset?.classification || [];
  if (!rows.length) { els.classification.innerHTML = dataset?.teams?.length ? `<div class="results-team-grid">${dataset.teams.map(team => `<article class="result-team-card"><strong>${escapeHtml(team.name)}</strong><span>${escapeHtml(team.club)}</span></article>`).join('')}</div>` : '<div class="results-empty-small">La fuente consultada no muestra una clasificación.</div>'; return; }
  els.classification.innerHTML = `<div class="results-table-wrap"><table class="results-table clickable-table"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>PF</th><th>PC</th><th>Pts.</th><th>R.</th></tr></thead><tbody>${rows.map(row => `<tr data-team="${escapeHtml(row.team)}"><td>${row.position}</td><td><strong>${escapeHtml(row.team)}</strong></td><td>${row.played}</td><td>${row.wins}</td><td>${row.losses}</td><td>${row.pointsFor}</td><td>${row.pointsAgainst}</td><td>${row.points}</td><td>${escapeHtml(row.form)}</td></tr>`).join('')}</tbody></table></div>`;
}

function findCrossScore(rowTeam, columnTeam) {
  const rowKey = normalizeKey(rowTeam), colKey = normalizeKey(columnTeam);
  const matches = (dataset?.matches || []).filter(match => { const home = normalizeKey(match.home), away = normalizeKey(match.away); return (home === rowKey && away === colKey) || (home === colKey && away === rowKey); });
  return matches.filter(match => match.played).sort((a, b) => String(a.date).localeCompare(String(b.date))).map(match => { const rowIsHome = normalizeKey(match.home) === rowKey; return `<span class="cross-score" title="${escapeHtml(match.date || '')}">${rowIsHome ? match.homeScore : match.awayScore}-${rowIsHome ? match.awayScore : match.homeScore}</span>`; }).join('<span class="cross-separator">/</span>');
}

function renderCrossResults() {
  const rows = dataset?.classification || [];
  if (!rows.length) { els.classification.innerHTML = '<div class="results-empty-small">No se ha podido construir la tabla de resultados cruzados porque FEB/FAB no ha devuelto la clasificación.</div>'; return; }
  const selected = normalizeKey(getSelectedTeam()), teams = rows.map(row => row.team);
  const head = teams.map(team => `<th class="cross-col ${selected && normalizeKey(team) === selected ? 'selected-team' : ''}" title="${escapeHtml(team)}">${escapeHtml(team)}</th>`).join('');
  const body = teams.map(rowTeam => {
    const rowSelected = selected && normalizeKey(rowTeam) === selected;
    const cells = teams.map(columnTeam => { const same = normalizeKey(rowTeam) === normalizeKey(columnTeam), value = same ? '' : findCrossScore(rowTeam, columnTeam); const columnSelected = selected && normalizeKey(columnTeam) === selected; return `<td class="${rowSelected || columnSelected ? 'selected-team' : ''}">${value || (same ? '—' : '')}</td>`; }).join('');
    return `<tr class="${rowSelected ? 'selected-team' : ''}"><th class="cross-row ${rowSelected ? 'selected-team' : ''}">${escapeHtml(rowTeam)}</th>${cells}</tr>`;
  }).join('');
  els.classification.innerHTML = `<div class="cross-results-wrap"><table class="cross-results-table"><thead><tr><th class="cross-corner">L / V</th>${head}</tr></thead><tbody>${body}</tbody></table></div><p class="cross-results-note">Cada celda muestra el resultado desde la perspectiva del equipo de la fila. Si existen varios enfrentamientos, se muestran en orden cronológico.</p>`;
}

function renderTeamMatches() {
  const team = getSelectedTeam();
  if (!team) { els.matches.innerHTML = '<div class="results-empty-small">Selecciona un equipo para consultar su tabla de partidos.</div>'; return; }
  const matches = getFilteredMatches();
  if (!matches.length) { els.matches.innerHTML = '<div class="results-empty-small">No hay partidos del equipo que coincidan con el filtro.</div>'; return; }
  els.matches.innerHTML = matches.map(match => {
    const score = match.played ? `<strong>${match.homeScore} - ${match.awayScore}</strong>` : '<span class="pending-score">Pendiente</span>';
    const teamIsHome = normalizeKey(match.home) === normalizeKey(team);
    const result = match.played ? (teamIsHome ? (match.homeScore > match.awayScore ? 'Victoria' : 'Derrota') : (match.awayScore > match.homeScore ? 'Victoria' : 'Derrota')) : 'Pendiente';
    return `<article class="result-match team-match"><div class="result-match-main"><div class="result-match-teams"><span class="${teamIsHome ? 'own-team' : ''}">${escapeHtml(match.home)}</span><b>VS</b><span class="${!teamIsHome ? 'own-team' : ''}">${escapeHtml(match.away)}</span></div><div class="result-match-score">${score}<small>${escapeHtml(result)}</small></div></div><div class="result-match-meta"><span>Jornada ${escapeHtml(match.jornada || '—')}</span><span>${escapeHtml(match.date || '—')}</span><span>${escapeHtml(match.time || '—')}</span>${match.venue ? `<span>${escapeHtml(match.venue)}</span>` : ''}</div></article>`;
  }).join('');
}

function renderAllMatches() {
  const matches = getFilteredMatches();
  if (!matches.length) { els.matches.innerHTML = '<div class="results-empty-small">No hay partidos que coincidan con el filtro.</div>'; return; }
  els.matches.innerHTML = matches.map(match => { const score = match.played ? `<strong>${match.homeScore} - ${match.awayScore}</strong>` : '<span class="pending-score">Pendiente</span>'; return `<article class="result-match"><div class="result-match-main"><div class="result-match-teams"><span>${escapeHtml(match.home)}</span><b>VS</b><span>${escapeHtml(match.away)}</span></div><div class="result-match-score">${score}</div></div><div class="result-match-meta"><span>Jornada ${escapeHtml(match.jornada || '—')}</span><span>${escapeHtml(match.date || '—')}</span><span>${escapeHtml(match.time || '—')}</span>${match.venue ? `<span>${escapeHtml(match.venue)}</span>` : ''}</div></article>`; }).join('');
}

function render() {
  if (!dataset) return;
  const team = getSelectedTeam(), view = els.view.value;
  const viewLabel = view === 'classification' ? 'Clasificación · todos los equipos' : view === 'team' ? 'Partidos del equipo' : 'Resultados cruzados';
  els.metadata.innerHTML = `<div><span>Temporada</span><strong>${escapeHtml(dataset.season || els.season.selectedOptions[0]?.textContent || 'No indicada')}</strong></div><div><span>Categoría</span><strong>${escapeHtml(dataset.category || els.category.selectedOptions[0]?.textContent || 'No indicada')}</strong></div><div><span>Equipo</span><strong>${escapeHtml(team || 'Todos')}</strong></div><div><span>Análisis</span><strong>${escapeHtml(viewLabel)}</strong></div>`;
  renderSummary();
  if (view === 'cross') {
    els.matchesTitle.textContent = team ? `Partidos de ${team}` : 'Partidos de la competición'; els.matchesSubtitle.textContent = team ? 'Calendario del equipo seleccionado.' : 'Calendario completo de la competición.'; renderAllMatches();
    els.classificationTitle.textContent = 'Resultados cruzados'; els.classificationSubtitle.textContent = 'Matriz de resultados de todos los equipos de la competición.'; renderCrossResults();
  } else if (view === 'team') {
    els.matchesTitle.textContent = team ? `Rachas y partidos de ${team}` : 'Partidos del equipo'; els.matchesSubtitle.textContent = team ? 'Todos los partidos detectados de la temporada.' : 'Selecciona primero un equipo.'; renderTeamMatches();
    els.classificationTitle.textContent = 'Clasificación'; els.classificationSubtitle.textContent = 'Clasificación completa de la competición.'; renderClassification();
  } else {
    els.matchesTitle.textContent = 'Partidos de la competición'; els.matchesSubtitle.textContent = 'Calendario completo utilizado para el análisis.'; renderAllMatches();
    els.classificationTitle.textContent = 'Clasificación'; els.classificationSubtitle.textContent = 'Haz clic en un equipo para seleccionarlo.'; renderClassification();
  }
  els.exportCsv.disabled = !(dataset.matches || []).length; els.openSource.href = dataset.url;
}

async function loadCompetitionBundle(url) {
  if (!url || loadingCompetition) return;
  loadingCompetition = true; setStatus('Cargando clasificación y calendario completo…', 'loading'); els.form.querySelector('button[type="submit"]').disabled = true;
  try {
    const [resultData, calendarData] = await Promise.all([fetchCompetition(url, 'results'), fetchCompetition(url, 'calendar')]);
    dataset = { ...resultData, sourceId: els.source.value, matches: calendarData.matches.length ? calendarData.matches : resultData.matches, classification: resultData.classification.length ? resultData.classification : calendarData.classification, teams: resultData.teams.length ? resultData.teams : calendarData.teams };
    setTeamOptions(dataset.classification.length ? dataset.classification : dataset.teams.map(team => ({ team: team.name })));
    render(); setStatus(`Competición cargada: ${dataset.classification.length || dataset.teams.length} equipos y ${dataset.matches.length} partidos detectados.`, 'success');
  } catch (error) {
    dataset = null; setTeamOptions([]); els.summary.replaceChildren(); els.classification.replaceChildren(); els.matches.replaceChildren(); els.metadata.replaceChildren(); setStatus(error instanceof Error ? error.message : 'No se ha podido cargar la competición.', 'error');
  } finally { loadingCompetition = false; els.form.querySelector('button[type="submit"]').disabled = false; }
}

async function loadSeasons(categoryUrl, autoSelect = true) {
  if (!categoryUrl) return;
  els.season.disabled = true; setStatus('Cargando temporadas de la categoría…', 'loading');
  try {
    const seasons = await discoverSeasons(categoryUrl); setSelectOptions(els.season, seasons.options, 'Selecciona una temporada');
    if (autoSelect && seasons.selected) els.season.value = seasons.selected;
    seasonWasChosen = Boolean(els.season.value); if (els.season.value) await loadCompetitionBundle(els.season.value); else setStatus('Categoría cargada. Selecciona una temporada.', 'info');
  } catch (error) { setSelectOptions(els.season, [], 'Temporadas no disponibles'); seasonWasChosen = false; setStatus(error instanceof Error ? error.message : 'No se han podido cargar las temporadas.', 'error'); }
}

async function discoverSource(sourceId) {
  setStatus('Cargando categorías de FEB/FAB…', 'loading'); els.form.querySelector('button[type="submit"]').disabled = true; els.category.disabled = true; els.season.disabled = true; els.team.disabled = true; seasonWasChosen = false; dataset = null;
  try { catalog = await discoverCompetitionCatalog(sourceId); setSelectOptions(els.category, catalog.categoryOptions, 'Selecciona una categoría'); els.category.value = catalog.defaultCategory; await loadSeasons(catalog.defaultCategory, true); }
  catch (error) { catalog = null; setSelectOptions(els.category, [], 'No disponible'); setSelectOptions(els.season, [], 'No disponible'); setTeamOptions([]); setStatus(error instanceof Error ? error.message : 'No se han podido cargar las competiciones.', 'error'); }
  finally { els.form.querySelector('button[type="submit"]').disabled = false; }
}

els.source.addEventListener('change', () => discoverSource(els.source.value));
els.category.addEventListener('change', async () => { seasonWasChosen = false; await loadSeasons(els.category.value, true); });
els.season.addEventListener('change', async () => { seasonWasChosen = Boolean(els.season.value); if (els.season.value) await loadCompetitionBundle(els.season.value); });
els.team.addEventListener('change', () => { if (dataset) render(); });
els.view.addEventListener('change', () => { if (dataset) render(); });
els.search.addEventListener('input', () => { if (dataset) render(); });
els.classification.addEventListener('click', event => { const row = event.target.closest('[data-team]'); if (!row) return; const team = row.dataset.team; const option = [...els.team.options].find(item => normalizeKey(item.value) === normalizeKey(team)); if (option) { els.team.value = option.value; els.view.value = 'team'; render(); } });
els.form.addEventListener('submit', async event => { event.preventDefault(); const url = currentCompetitionUrl(); if (!url) { setStatus('Selecciona una categoría y una temporada antes de consultar.', 'error'); return; } if (els.view.value === 'team' && !getSelectedTeam()) { setStatus('Selecciona un equipo para consultar sus partidos.', 'error'); return; } if (!dataset || dataset.url !== url) await loadCompetitionBundle(url); else render(); });
els.exportCsv.addEventListener('click', () => { const matches = getFilteredMatches(); if (!matches.length) return; const header = ['Jornada','Fecha','Hora','Local','Visitante','Puntos local','Puntos visitante','Pabellón']; const rows = matches.map(match => [match.jornada, match.date, match.time, match.home, match.away, match.homeScore ?? '', match.awayScore ?? '', match.venue || '']); const csv = [header, ...rows].map(row => row.map(value => `"${String(value).replace(/"/g, '""')}"`).join(';')).join('\n'); const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8' }); const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = `resultados-${dataset?.season || 'feb'}.csv`; link.click(); setTimeout(() => URL.revokeObjectURL(url), 1000); });

els.source.value = 'zaragoza';
discoverSource('zaragoza');
