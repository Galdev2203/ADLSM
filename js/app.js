import { findFabDocuments } from './fab/fab-source.js';
import { parsePdfFile } from './fab/fab-parser.js';
import { normalizeTeamName } from './fab/fab-normalizer.js';
import { renderMatches } from './ui/renderer.js';

const els = {
  refresh: document.querySelector('#refreshFab'),
  date: document.querySelector('#matchDate'),
  pdf: document.querySelector('#pdfInput'),
  status: document.querySelector('#sourceStatus'),
  message: document.querySelector('#message'),
  matches: document.querySelector('#matches'),
  count: document.querySelector('#matchCount'),
  teamSearch: document.querySelector('#teamSearch'),
  competitionFilter: document.querySelector('#competitionFilter'),
  dateFilter: document.querySelector('#dateFilter'),
  clearFilter: document.querySelector('#clearTeam'),
  viewCards: document.querySelector('#viewCards'),
  viewTable: document.querySelector('#viewTable')
};

let allMatches = [];
let currentMatches = [];
let currentPage = 1;
let currentView = 'cards';

function setMessage(text = '', visible = Boolean(text)) {
  els.message.textContent = text;
  els.message.classList.toggle('hidden', !visible);
}

function setLoading(loading) {
  els.refresh.disabled = loading;
  els.refresh.textContent = loading ? 'Buscando…' : 'Buscar en FAB';
}

function updateResults(matches, resetPage = false) {
  currentMatches = matches;
  if (resetPage) currentPage = 1;
  els.count.textContent = `${matches.length} ${matches.length === 1 ? 'partido' : 'partidos'}`;
  renderMatches(els.matches, matches, {
    page: currentPage,
    view: currentView,
    onPageChange: page => {
      currentPage = page;
      updateResults(currentMatches);
      els.matches.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

function normalizeSearch(value) {
  return normalizeTeamName(value).replace(/\s+/g, ' ').trim();
}

function populateFilters() {
  const competitions = [...new Set(allMatches.map(m => m.competition).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));
  const dates = [...new Set(allMatches.map(m => m.date).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'));

  els.competitionFilter.innerHTML = '<option value="">Todas las competiciones</option>';
  competitions.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    els.competitionFilter.appendChild(option);
  });

  els.dateFilter.innerHTML = '<option value="">Todas las fechas</option>';
  dates.forEach(value => {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value;
    els.dateFilter.appendChild(option);
  });

  const enabled = allMatches.length > 0;
  els.teamSearch.disabled = !enabled;
  els.competitionFilter.disabled = !enabled;
  els.dateFilter.disabled = !enabled;
  els.clearFilter.disabled = !enabled;
}

function filterMatches() {
  const search = normalizeSearch(els.teamSearch.value);
  const competition = els.competitionFilter.value;
  const date = els.dateFilter.value;

  const filtered = allMatches.filter(match => {
    const home = normalizeSearch(match.homeTeam);
    const away = normalizeSearch(match.awayTeam);
    const teamMatches = !search || home.includes(search) || away.includes(search);
    const competitionMatches = !competition || match.competition === competition;
    const dateMatches = !date || match.date === date;
    return teamMatches && competitionMatches && dateMatches;
  });

  updateResults(filtered, true);
}

function setMatches(matches) {
  allMatches = matches;
  populateFilters();
  filterMatches();
}

async function loadFromFab() {
  const date = els.date.value;
  if (!date) return;
  setLoading(true);
  setMessage('Intentando localizar y descargar el documento de horarios de FAB…', true);
  els.status.textContent = `Buscando jornada del ${date}.`;

  try {
    const result = await findFabDocuments(date);
    if (!result.bytes) throw new Error(result.reason || 'No se pudo descargar el PDF desde el navegador.');
    const matches = await parsePdfFile(result.bytes, result.url);
    setMatches(matches);
    els.status.textContent = `Fuente: ${result.url}`;
    setMessage(`Documento cargado correctamente. Se han extraído ${matches.length} partidos.`, true);
  } catch (error) {
    console.error(error);
    els.status.textContent = 'No se pudo obtener el PDF directamente desde FAB.';
    setMessage(`${error.message} Puedes utilizar el PDF manual como alternativa.`, true);
  } finally {
    setLoading(false);
  }
}

async function loadLocalPdf(file) {
  if (!file) return;
  setMessage('Leyendo PDF local…', true);
  els.status.textContent = `Archivo local: ${file.name}`;
  try {
    const bytes = await file.arrayBuffer();
    const matches = await parsePdfFile(bytes, file.name);
    setMatches(matches);
    setMessage(`PDF procesado correctamente. Se han extraído ${matches.length} partidos.`, true);
  } catch (error) {
    console.error(error);
    setMessage(`No se ha podido leer el PDF: ${error.message}`, true);
  }
}

function setView(view) {
  currentView = view;
  els.viewCards.classList.toggle('active', view === 'cards');
  els.viewTable.classList.toggle('active', view === 'table');
  updateResults(currentMatches, false);
}

els.refresh.addEventListener('click', loadFromFab);
els.pdf.addEventListener('change', event => loadLocalPdf(event.target.files?.[0]));
els.teamSearch.addEventListener('input', filterMatches);
els.competitionFilter.addEventListener('change', filterMatches);
els.dateFilter.addEventListener('change', filterMatches);
els.clearFilter.addEventListener('click', () => {
  els.teamSearch.value = '';
  els.competitionFilter.value = '';
  els.dateFilter.value = '';
  filterMatches();
});
els.viewCards.addEventListener('click', () => setView('cards'));
els.viewTable.addEventListener('click', () => setView('table'));

updateResults([]);
