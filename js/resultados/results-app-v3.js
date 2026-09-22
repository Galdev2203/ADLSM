import { analyzeTeam, fetchCompetition } from './results-runtime-v15.js?v=20260922-17';
import { discoverSeasons, discoverSource as discoverCompetitionCatalog } from './competition-discovery.js?v=20260922-17';

const $ = (id) => document.getElementById(id);
const els = {
  form: $('resultsForm'), source: $('resultsSource'), category: $('resultsCategory'), season: $('resultsSeason'),
  team: $('resultsTeam'), view: $('resultsView'), status: $('resultsStatus'), summary: $('resultsSummary'),
  classification: $('resultsClassification'), matches: $('resultsMatches'), metadata: $('resultsMetadata'),
  search: $('resultsSearch'), openSource: $('openSource'), exportCsv: $('exportCsv'),
  matchesTitle: $('resultsMatchesTitle'), matchesSubtitle: $('resultsMatchesSubtitle'),
  classificationTitle: $('resultsClassificationTitle'), classificationSubtitle: $('resultsClassificationSubtitle')
};

let catalog = null;
let dataset = null;
let loading = false;

const text = (v) => String(v ?? '');
const norm = (v) => text(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').replace(/\s+/g, ' ').trim();
const esc = (v) => text(v).replace(/[&<>"']/g, c => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]));
const num = (v) => Number(v || 0).toLocaleString('es-ES', { maximumFractionDigits: 1 });

function status(message, kind = 'info') {
  els.status.textContent = message;
  els.status.className = `results-status ${kind}`;
}

function setOptions(select, options, placeholder) {
  select.innerHTML = '';
  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);
  for (const option of options || []) {
    const node = document.createElement('option');
    node.value = option.url;
    node.textContent = option.label;
    select.appendChild(node);
  }
  select.disabled = !(options && options.length);
}

function setTeams(rows) {
  const previous = els.team.value;
  els.team.innerHTML = '<option value="">Todos los equipos</option>';
  const names = [...new Set((rows || []).map(r => r.team || r.name).filter(Boolean))];
  for (const name of names) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    els.team.appendChild(option);
  }
  els.team.disabled = !names.length;
  if (names.includes(previous)) els.team.value = previous;
}

function selectedTeam() { return text(els.team.value).trim(); }

function teamMatches() {
  const team = norm(selectedTeam());
  if (!team) return dataset?.matches || [];
  return (dataset?.matches || []).filter(m => norm(m.home) === team || norm(m.away) === team);
}

function renderSummary() {
  const team = selectedTeam();
  if (team) {
    const s = analyzeTeam(dataset, team);
    const cards = [
      ['Equipo', team], ['Partidos', s.matches], ['Jugados', s.played], ['Pendientes', s.scheduled],
      ['Victorias', s.wins], ['Derrotas', s.losses], ['PF / PC', `${num(s.pointsFor)} / ${num(s.pointsAgainst)}`],
      ['% victorias', `${num(s.winRate)}%`]
    ];
    els.summary.innerHTML = cards.map(([a,b]) => `<article class="stat-card"><span>${esc(a)}</span><strong>${esc(b)}</strong></article>`).join('');
    return;
  }

  const played = (dataset.matches || []).filter(m => m.played);
  const points = played.reduce((sum, m) => sum + Number(m.homeScore || 0) + Number(m.awayScore || 0), 0);
  const cards = [
    ['Equipos', dataset.classification.length || dataset.teams.length], ['Partidos', dataset.matches.length],
    ['Jugados', played.length], ['Pendientes', dataset.matches.length - played.length],
    ['Puntos anotados', num(points)], ['Media / partido', played.length ? num(points / played.length) : '0'],
    ['Clasificación', dataset.classification.length ? 'Disponible' : 'No disponible'],
    ['Fuente', dataset.sourceId === 'zaragoza' ? 'Zaragoza' : 'Aragón · FEB/FAB']
  ];
  els.summary.innerHTML = cards.map(([a,b]) => `<article class="stat-card"><span>${esc(a)}</span><strong>${esc(b)}</strong></article>`).join('');
}

function renderClassification() {
  const rows = dataset.classification || [];
  if (!rows.length) {
    els.classification.innerHTML = '<div class="results-empty-small">La fuente no muestra una clasificación interpretable.</div>';
    return;
  }
  els.classification.innerHTML = `<div class="results-table-wrap"><table class="results-table clickable-table"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>PF</th><th>PC</th><th>Pts.</th><th>R.</th></tr></thead><tbody>${rows.map(r => `<tr data-team="${esc(r.team)}"><td>${esc(r.position)}</td><td><strong>${esc(r.team)}</strong></td><td>${esc(r.played)}</td><td>${esc(r.wins)}</td><td>${esc(r.losses)}</td><td>${esc(r.pointsFor)}</td><td>${esc(r.pointsAgainst)}</td><td>${esc(r.points)}</td><td>${esc(r.form)}</td></tr>`).join('')}</tbody></table></div>`;
  els.classification.querySelectorAll('tbody tr').forEach(row => row.addEventListener('click', () => {
    els.team.value = row.dataset.team || '';
    render();
  }));
}

function crossScore(a, b) {
  const ak = norm(a), bk = norm(b);
  return (dataset.matches || []).filter(m => {
    const h = norm(m.home), v = norm(m.away);
    return ((h === ak && v === bk) || (h === bk && v === ak)) && m.played;
  }).sort((x,y) => String(x.date).localeCompare(String(y.date))).map(m => norm(m.home) === ak ? `${m.homeScore}-${m.awayScore}` : `${m.awayScore}-${m.homeScore}`).join(' / ');
}

function renderCross() {
  const teams = (dataset.classification || []).map(r => r.team).filter(Boolean);
  if (!teams.length) {
    els.classification.innerHTML = '<div class="results-empty-small">No se puede construir la tabla cruzada sin equipos.</div>';
    return;
  }
  const selected = norm(selectedTeam());
  const head = teams.map(t => `<th class="cross-col ${selected === norm(t) ? 'selected-team' : ''}">${esc(t)}</th>`).join('');
  const body = teams.map(rowTeam => `<tr class="${selected === norm(rowTeam) ? 'selected-team' : ''}"><th class="cross-row">${esc(rowTeam)}</th>${teams.map(colTeam => {
    const same = norm(rowTeam) === norm(colTeam);
    const hi = selected && (selected === norm(rowTeam) || selected === norm(colTeam));
    return `<td class="${hi ? 'selected-team' : ''}">${same ? '—' : esc(crossScore(rowTeam, colTeam))}</td>`;
  }).join('')}</tr>`).join('');
  els.classification.innerHTML = `<div class="cross-results-wrap"><table class="cross-results-table"><thead><tr><th class="cross-corner">L / V</th>${head}</tr></thead><tbody>${body}</tbody></table></div><p class="cross-results-note">Cada celda muestra el resultado desde la perspectiva del equipo de la fila.</p>`;
}

function renderMatches() {
  const team = selectedTeam();
  const query = text(els.search.value).trim().toLocaleLowerCase('es');
  const base = els.view.value === 'team' ? teamMatches() : (dataset.matches || []);
  const rows = base.filter(m => !query || `${m.home} ${m.away} ${m.jornada}`.toLocaleLowerCase('es').includes(query));
  if (!rows.length) {
    els.matches.innerHTML = '<div class="results-empty-small">No hay partidos que coincidan con el filtro.</div>';
    return;
  }
  const teamKey = norm(team);
  els.matches.innerHTML = rows.map(m => {
    const ownHome = teamKey && norm(m.home) === teamKey;
    const ownAway = teamKey && norm(m.away) === teamKey;
    const score = m.played ? `<strong>${esc(m.homeScore)} - ${esc(m.awayScore)}</strong>` : '<span class="pending-score">Pendiente</span>';
    return `<article class="result-match ${ownHome || ownAway ? 'team-match' : ''}"><div class="result-match-main"><div class="result-match-teams"><span class="${ownHome ? 'own-team' : ''}">${esc(m.home)}</span><b>VS</b><span class="${ownAway ? 'own-team' : ''}">${esc(m.away)}</span></div><div class="result-match-score">${score}</div></div><div class="result-match-meta"><span>Jornada ${esc(m.jornada || '—')}</span><span>${esc(m.date || '—')}</span><span>${esc(m.time || '—')}</span></div></article>`;
  }).join('');
}

function render() {
  if (!dataset) return;
  const team = selectedTeam();
  const view = els.view.value;
  els.metadata.innerHTML = `<div><span>Temporada</span><strong>${esc(dataset.season || els.season.selectedOptions[0]?.textContent || '—')}</strong></div><div><span>Categoría</span><strong>${esc(dataset.category || els.category.selectedOptions[0]?.textContent || '—')}</strong></div><div><span>Equipo</span><strong>${esc(team || 'Todos')}</strong></div><div><span>Análisis</span><strong>${esc(view === 'team' ? 'Partidos del equipo' : view === 'cross' ? 'Resultados cruzados' : 'Clasificación · todos los equipos')}</strong></div>`;
  renderSummary();
  els.matchesTitle.textContent = view === 'team' && team ? `Partidos de ${team}` : 'Partidos de la competición';
  els.matchesSubtitle.textContent = view === 'team' ? 'Todos los partidos detectados de la temporada.' : 'Calendario completo utilizado para el análisis.';
  renderMatches();
  els.classificationTitle.textContent = view === 'cross' ? 'Resultados cruzados' : 'Clasificación';
  els.classificationSubtitle.textContent = view === 'cross' ? 'Matriz de resultados de todos los equipos.' : 'Clasificación completa de la competición.';
  view === 'cross' ? renderCross() : renderClassification();
  els.exportCsv.disabled = !(dataset.matches?.length);
  els.openSource.href = dataset.url || '#';
}

async function loadCompetition(url) {
  if (!url || loading) return;
  loading = true;
  status('Cargando resultados y calendario…', 'loading');
  try {
    const [results, calendar] = await Promise.all([fetchCompetition(url, 'results'), fetchCompetition(url, 'calendar')]);
    dataset = {
      ...results,
      sourceId: els.source.value,
      matches: calendar.matches?.length ? calendar.matches : results.matches,
      classification: results.classification?.length ? results.classification : calendar.classification,
      teams: results.teams?.length ? results.teams : calendar.teams
    };
    setTeams(dataset.classification.length ? dataset.classification : dataset.teams);
    render();
    status(`Competición cargada: ${dataset.classification.length} equipos y ${dataset.matches.length} partidos detectados.`, 'success');
  } catch (error) {
    dataset = null;
    setTeams([]);
    els.summary.replaceChildren(); els.classification.replaceChildren(); els.matches.replaceChildren(); els.metadata.replaceChildren();
    status(error instanceof Error ? error.message : 'No se ha podido cargar la competición.', 'error');
  } finally {
    loading = false;
  }
}

async function loadSeasons(url) {
  if (!url) return;
  status('Cargando temporadas de la categoría…', 'loading');
  try {
    const data = await discoverSeasons(url);
    setOptions(els.season, data.options, 'Selecciona una temporada…');
    if (data.options?.length) {
      const preferred = data.options.find(o => /2025\/2026/.test(o.label)) || data.options[0];
      els.season.value = preferred.url;
      status('Temporada lista.', 'info');
    } else status('No se han encontrado temporadas.', 'error');
  } catch (error) {
    setOptions(els.season, [], 'No disponible');
    status(error instanceof Error ? error.message : 'No se han podido cargar las temporadas.', 'error');
  }
}

async function loadCatalog() {
  setOptions(els.category, [], 'Cargando…');
  setOptions(els.season, [], 'Cargando…');
  setTeams([]);
  status('Cargando categorías FEB/FAB…', 'loading');
  try {
    catalog = await discoverCompetitionCatalog(els.source.value);
    setOptions(els.category, catalog.categories, 'Selecciona una categoría…');
    if (catalog.categories?.length) {
      els.category.value = catalog.categories[0].url;
      await loadSeasons(els.category.value);
    } else {
      status('No se han encontrado categorías.', 'error');
    }
  } catch (error) {
    setOptions(els.category, [], 'No disponible');
    setOptions(els.season, [], 'No disponible');
    status(error instanceof Error ? error.message : 'No se han podido cargar las categorías.', 'error');
  }
}

function exportCsv() {
  if (!dataset?.matches?.length) return;
  const rows = [['Jornada','Local','Visitante','Local','Visitante','Fecha','Hora']];
  for (const m of dataset.matches) rows.push([m.jornada || '', m.home, m.away, m.homeScore ?? '', m.awayScore ?? '', m.date || '', m.time || '']);
  const csv = rows.map(r => r.map(v => `"${text(v).replace(/"/g, '""')}"`).join(';')).join('\n');
  const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'adlsm-resultados.csv';
  a.click();
  URL.revokeObjectURL(a.href);
}

els.source.addEventListener('change', loadCatalog);
els.category.addEventListener('change', () => loadSeasons(els.category.value));
els.team.addEventListener('change', render);
els.view.addEventListener('change', render);
els.search.addEventListener('input', renderMatches);
els.exportCsv.addEventListener('click', exportCsv);
els.form.addEventListener('submit', event => {
  event.preventDefault();
  loadCompetition(els.season.value);
});

loadCatalog();
