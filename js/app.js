import { findFabDocuments } from './fab/fab-source.js';
import { parsePdfFile } from './fab/fab-parser.js';
import { normalizeTeamName } from './fab/fab-normalizer.js';
import { renderMatches } from './ui/renderer.js';
import { createTemplateCanvas, getTemplatePages } from './ui/instagram-template.js';

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
  viewTable: document.querySelector('#viewTable'),
  selectionBar: document.querySelector('#selectionBar'),
  selectedCount: document.querySelector('#selectedCount'),
  clearSelection: document.querySelector('#clearSelection'),
  generateTemplate: document.querySelector('#generateTemplate'),
  templateModal: document.querySelector('#templateModal'),
  templatePreview: document.querySelector('#templatePreview'),
  templatePageInfo: document.querySelector('#templatePageInfo'),
  templatePrev: document.querySelector('#templatePrev'),
  templateNext: document.querySelector('#templateNext'),
  downloadTemplate: document.querySelector('#downloadTemplate'),
  closeTemplate: document.querySelector('#closeTemplate')
};

let allMatches = [];
let currentMatches = [];
let currentPage = 1;
let currentView = 'cards';
let templatePages = [];
let currentTemplatePage = 0;
const selectedIds = new Set();

function setMessage(text = '', visible = Boolean(text)) {
  els.message.textContent = text;
  els.message.classList.toggle('hidden', !visible);
}

function setLoading(loading) {
  els.refresh.disabled = loading;
  els.refresh.textContent = loading ? 'Buscando…' : 'Buscar en FAB';
}

function updateSelectionUI() {
  const count = selectedIds.size;
  els.selectedCount.textContent = String(count);
  els.selectionBar.classList.toggle('hidden', count === 0);
  els.generateTemplate.disabled = count === 0;
}

function updateResults(matches, resetPage = false) {
  currentMatches = matches;
  if (resetPage) currentPage = 1;
  els.count.textContent = `${matches.length} ${matches.length === 1 ? 'partido' : 'partidos'}`;
  renderMatches(els.matches, matches, {
    page: currentPage,
    view: currentView,
    selectedIds,
    onPageChange: page => {
      currentPage = page;
      updateResults(currentMatches);
      els.matches.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },
    onToggleSelection: toggleSelection
  });
  updateSelectionUI();
}

function normalizeSearch(value) {
  return normalizeTeamName(value).replace(/\s+/g, ' ').trim();
}

function createMatchId(match) {
  return [
    match.date,
    match.time,
    match.homeTeam,
    match.awayTeam,
    match.venue,
    match.competition
  ].map(value => normalizeSearch(value)).join('|');
}

function withMatchIds(matches) {
  return matches.map(match => ({ ...match, id: createMatchId(match) }));
}

function toggleSelection(id) {
  if (!id) return;
  if (selectedIds.has(id)) selectedIds.delete(id);
  else selectedIds.add(id);
  updateResults(currentMatches);
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
  allMatches = withMatchIds(matches);
  selectedIds.clear();
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

function getSelectedMatches() {
  return allMatches.filter(match => selectedIds.has(match.id));
}

function openTemplateGenerator() {
  const selected = getSelectedMatches();
  if (!selected.length) return;

  templatePages = getTemplatePages(selected);
  currentTemplatePage = 0;
  renderTemplatePreview();
  els.templateModal.classList.remove('hidden');
  document.body.classList.add('modal-open');
}

function renderTemplatePreview() {
  const matches = templatePages[currentTemplatePage] || [];
  els.templatePreview.replaceChildren(createTemplateCanvas(matches));
  els.templatePageInfo.textContent = templatePages.length > 1
    ? `Página ${currentTemplatePage + 1} de ${templatePages.length} · ${getSelectedMatches().length} partidos seleccionados`
    : `${matches.length} partidos seleccionados`;
  els.templatePrev.disabled = currentTemplatePage === 0;
  els.templateNext.disabled = currentTemplatePage >= templatePages.length - 1;
}

function closeTemplateGenerator() {
  els.templateModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function downloadCurrentTemplate() {
  const matches = templatePages[currentTemplatePage] || [];
  if (!matches.length) return;

  const canvas = createTemplateCanvas(matches);
  canvas.toBlob(blob => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `horarios-baloncesto-${currentTemplatePage + 1}.png`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }, 'image/png');
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
els.clearSelection.addEventListener('click', () => {
  selectedIds.clear();
  updateResults(currentMatches);
});
els.generateTemplate.addEventListener('click', openTemplateGenerator);
els.closeTemplate.addEventListener('click', closeTemplateGenerator);
els.templateModal.addEventListener('click', event => {
  if (event.target === els.templateModal) closeTemplateGenerator();
});
els.templatePrev.addEventListener('click', () => {
  if (currentTemplatePage <= 0) return;
  currentTemplatePage -= 1;
  renderTemplatePreview();
});
els.templateNext.addEventListener('click', () => {
  if (currentTemplatePage >= templatePages.length - 1) return;
  currentTemplatePage += 1;
  renderTemplatePreview();
});
els.downloadTemplate.addEventListener('click', downloadCurrentTemplate);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !els.templateModal.classList.contains('hidden')) closeTemplateGenerator();
});
els.viewCards.addEventListener('click', () => setView('cards'));
els.viewTable.addEventListener('click', () => setView('table'));

updateResults([]);
