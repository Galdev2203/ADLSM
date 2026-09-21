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
  templatePageLabel: document.querySelector('#templatePageLabel'),
  templatePrev: document.querySelector('#templatePrev'),
  templateNext: document.querySelector('#templateNext'),
  downloadTemplate: document.querySelector('#downloadTemplate'),
  closeTemplate: document.querySelector('#closeTemplate'),
  cancelTemplate: document.querySelector('#cancelTemplate'),
  editorMatches: document.querySelector('#editorMatches'),
  editorMatchCount: document.querySelector('#editorMatchCount'),
  templateMainTitle: document.querySelector('#templateMainTitle'),
  templateSubtitle: document.querySelector('#templateSubtitle')
};

let allMatches = [];
let currentMatches = [];
let currentPage = 1;
let currentView = 'cards';
let editorMatches = [];
let templatePages = [];
let currentTemplatePage = 0;
const selectedIds = new Set();
const templateSettings = {
  title: 'HORARIOS BALONCESTO',
  subtitle: 'FEDERADOS'
};

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
  allMatches = withMatchIds(Array.isArray(matches) ? matches : []);
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

  try {
    editorMatches = selected.map(match => ({ ...match }));
    currentTemplatePage = 0;
    els.templateMainTitle.value = templateSettings.title;
    els.templateSubtitle.value = templateSettings.subtitle;
    renderEditor();
    rebuildTemplatePages(true);
    els.templateModal.classList.remove('hidden');
    document.body.classList.add('modal-open');
  } catch (error) {
    console.error('No se pudo abrir el editor de plantilla.', error);
    setMessage(`No se pudo abrir el editor de plantilla: ${getErrorMessage(error)}`, true);
  }
}

function renderEditor() {
  els.editorMatchCount.textContent = String(editorMatches.length);
  els.editorMatches.replaceChildren();

  if (!editorMatches.length) {
    const empty = document.createElement('div');
    empty.className = 'editor-empty';
    empty.textContent = 'No hay partidos en la plantilla.';
    els.editorMatches.appendChild(empty);
    return;
  }

  editorMatches.forEach((match, index) => {
    const item = document.createElement('article');
    item.className = 'editor-match';
    item.dataset.index = String(index);

    const header = document.createElement('div');
    header.className = 'editor-match-header';

    const number = document.createElement('span');
    number.className = 'editor-number';
    number.textContent = String(index + 1).padStart(2, '0');

    const title = document.createElement('strong');
    title.textContent = `${match.homeTeam || 'Local'} · ${match.awayTeam || 'Visitante'}`;

    const actions = document.createElement('div');
    actions.className = 'editor-order-actions';
    actions.append(
      makeOrderButton('↑', 'Subir partido', () => moveEditorMatch(index, -1), index === 0),
      makeOrderButton('↓', 'Bajar partido', () => moveEditorMatch(index, 1), index === editorMatches.length - 1),
      makeOrderButton('×', 'Quitar partido', () => removeEditorMatch(index), false, 'remove')
    );
    header.append(number, title, actions);

    const grid = document.createElement('div');
    grid.className = 'editor-fields';
    grid.append(
      makeEditorField('Local', 'homeTeam', match.homeTeam, index),
      makeEditorField('Visitante', 'awayTeam', match.awayTeam, index),
      makeEditorField('Hora', 'time', match.time, index),
      makeEditorField('Fecha', 'date', match.date, index),
      makeEditorField('Competición', 'competition', match.competition, index),
      makeEditorField('Pabellón / pista', 'venue', match.venue, index)
    );

    item.append(header, grid);
    els.editorMatches.appendChild(item);
  });
}

function makeOrderButton(label, ariaLabel, onClick, disabled = false, extraClass = '') {
  const button = document.createElement('button');
  button.type = 'button';
  button.className = `editor-order-button ${extraClass}`.trim();
  button.textContent = label;
  button.title = ariaLabel;
  button.setAttribute('aria-label', ariaLabel);
  button.disabled = disabled;
  button.addEventListener('click', onClick);
  return button;
}

function makeEditorField(label, key, value, index) {
  const wrapper = document.createElement('label');
  wrapper.className = 'editor-field';
  const caption = document.createElement('span');
  caption.textContent = label;
  const input = document.createElement('input');
  input.type = 'text';
  input.value = value || '';
  input.dataset.key = key;
  input.addEventListener('input', () => {
    editorMatches[index][key] = input.value;
    updateEditorMatchTitle(index);
    rebuildTemplatePages(false);
  });
  wrapper.append(caption, input);
  return wrapper;
}

function updateEditorMatchTitle(index) {
  const item = els.editorMatches.querySelector(`[data-index="${index}"]`);
  if (!item || !editorMatches[index]) return;
  const title = item.querySelector('.editor-match-header strong');
  if (title) title.textContent = `${editorMatches[index].homeTeam || 'Local'} · ${editorMatches[index].awayTeam || 'Visitante'}`;
}

function moveEditorMatch(index, direction) {
  const target = index + direction;
  if (target < 0 || target >= editorMatches.length) return;
  [editorMatches[index], editorMatches[target]] = [editorMatches[target], editorMatches[index]];
  currentTemplatePage = Math.min(currentTemplatePage, Math.max(0, getTemplatePages(editorMatches).length - 1));
  renderEditor();
  rebuildTemplatePages(false);
}

function removeEditorMatch(index) {
  editorMatches.splice(index, 1);
  currentTemplatePage = Math.min(currentTemplatePage, Math.max(0, getTemplatePages(editorMatches).length - 1));
  renderEditor();
  rebuildTemplatePages(false);
}

function rebuildTemplatePages(resetPage = false) {
  templatePages = getTemplatePages(editorMatches);
  if (resetPage) currentTemplatePage = 0;
  if (currentTemplatePage >= templatePages.length) currentTemplatePage = Math.max(0, templatePages.length - 1);
  renderTemplatePreview();
}

function renderTemplatePreview() {
  const matches = templatePages[currentTemplatePage] || [];
  els.templatePreview.replaceChildren();

  if (matches.length) {
    try {
      els.templatePreview.appendChild(createTemplateCanvas(matches, templateSettings));
    } catch (error) {
      console.error('Error al generar la vista previa.', error);
      const errorBox = document.createElement('div');
      errorBox.className = 'template-preview-error';
      errorBox.innerHTML = `<strong>No se pudo generar la vista previa.</strong><span>${escapeHtml(getErrorMessage(error))}</span>`;
      els.templatePreview.appendChild(errorBox);
    }
  } else {
    const empty = document.createElement('div');
    empty.className = 'template-preview-empty';
    empty.textContent = 'Añade al menos un partido para ver la plantilla.';
    els.templatePreview.appendChild(empty);
  }

  const pageCount = templatePages.length;
  els.templatePageInfo.textContent = pageCount > 1
    ? `${editorMatches.length} partidos · ${pageCount} páginas`
    : `${editorMatches.length} ${editorMatches.length === 1 ? 'partido' : 'partidos'}`;
  els.templatePageLabel.textContent = pageCount
    ? `Página ${currentTemplatePage + 1} de ${pageCount} · Máximo 8 partidos por imagen`
    : 'Sin partidos';
  els.templatePrev.disabled = currentTemplatePage === 0;
  els.templateNext.disabled = currentTemplatePage >= pageCount - 1 || pageCount === 0;
  els.downloadTemplate.disabled = pageCount === 0;
}

function closeTemplateGenerator() {
  els.templateModal.classList.add('hidden');
  document.body.classList.remove('modal-open');
}

function downloadCurrentTemplate() {
  const matches = templatePages[currentTemplatePage] || [];
  if (!matches.length) return;

  try {
    const canvas = createTemplateCanvas(matches, templateSettings);
    canvas.toBlob(blob => {
      if (!blob) {
        setMessage('El navegador no ha podido generar el PNG.', true);
        return;
      }
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `horarios-baloncesto-${currentTemplatePage + 1}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    }, 'image/png');
  } catch (error) {
    console.error('No se pudo descargar la plantilla.', error);
    setMessage(`No se pudo generar el PNG: ${getErrorMessage(error)}`, true);
  }
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || 'Error desconocido.');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
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
els.cancelTemplate.addEventListener('click', closeTemplateGenerator);
els.templateMainTitle.addEventListener('input', () => {
  templateSettings.title = els.templateMainTitle.value;
  renderTemplatePreview();
});
els.templateSubtitle.addEventListener('input', () => {
  templateSettings.subtitle = els.templateSubtitle.value;
  renderTemplatePreview();
});
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
document.addEventListener('template-distribution-change', renderTemplatePreview);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape' && !els.templateModal.classList.contains('hidden')) closeTemplateGenerator();
});
els.viewCards.addEventListener('click', () => setView('cards'));
els.viewTable.addEventListener('click', () => setView('table'));

updateResults([]);
