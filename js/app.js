import { findFabDocuments } from './fab/fab-source.js';
import { parsePdfFile } from './fab/fab-parser.js';
import { normalizeTeamName, normalizeTeamFamily } from './fab/fab-normalizer.js';
import { renderMatches } from './ui/renderer.js';

const els = {
  refresh: document.querySelector('#refreshFab'),
  date: document.querySelector('#matchDate'),
  pdf: document.querySelector('#pdfInput'),
  status: document.querySelector('#sourceStatus'),
  message: document.querySelector('#message'),
  matches: document.querySelector('#matches'),
  count: document.querySelector('#matchCount'),
  filterType: document.querySelector('#filterType'),
  filterValue: document.querySelector('#filterValue'),
  clearFilter: document.querySelector('#clearTeam')
};

let allMatches = [];

function setMessage(text = '', visible = Boolean(text)) {
  els.message.textContent = text;
  els.message.classList.toggle('hidden', !visible);
}

function setLoading(loading) {
  els.refresh.disabled = loading;
  els.refresh.textContent = loading ? 'Buscando…' : 'Buscar en FAB';
}

function updateResults(matches) {
  els.count.textContent = `${matches.length} ${matches.length === 1 ? 'partido' : 'partidos'}`;
  renderMatches(els.matches, matches);
}

function uniqueSorted(values) {
  return [...new Set(values.filter(Boolean))].sort((a, b) => a.localeCompare(b, 'es'));
}

function buildOptions() {
  const type = els.filterType.value;
  let values;

  if (type === 'family') {
    // Group A/B/C/D variants under the same club/family.
    const families = new Map();
    for (const match of allMatches) {
      for (const team of [match.homeTeam, match.awayTeam]) {
        const family = normalizeTeamFamily(team);
        if (!family) continue;
        if (!families.has(family)) families.set(family, new Set());
        families.get(family).add(team);
      }
    }

    values = [...families.entries()]
      .sort(([a], [b]) => a.localeCompare(b, 'es'))
      .map(([family, variants]) => ({
        value: family,
        label: variants.size > 1
          ? `${family} (${[...variants].sort((a, b) => a.localeCompare(b, 'es')).join(', ')})`
          : [...variants][0]
      }));
  } else if (type === 'team') {
    values = uniqueSorted(allMatches.flatMap(match => [match.homeTeam, match.awayTeam]))
      .map(team => ({ value: normalizeTeamName(team), label: team }));
  } else {
    values = uniqueSorted(allMatches.map(match => match.competition))
      .map(category => ({ value: category, label: category }));
  }

  els.filterValue.innerHTML = '';
  const placeholder = document.createElement('option');
  placeholder.value = '';
  placeholder.textContent = type === 'family'
    ? 'Selecciona un club / grupo'
    : type === 'team'
      ? 'Selecciona un equipo'
      : 'Selecciona una categoría';
  els.filterValue.appendChild(placeholder);

  for (const item of values) {
    const option = document.createElement('option');
    option.value = item.value;
    option.textContent = item.label;
    els.filterValue.appendChild(option);
  }

  els.filterValue.disabled = values.length === 0;
  els.filterType.disabled = allMatches.length === 0;
  els.clearFilter.disabled = allMatches.length === 0;
}

function filterMatches() {
  const type = els.filterType.value;
  const selected = els.filterValue.value;

  if (!selected) {
    updateResults(allMatches);
    return;
  }

  const filtered = allMatches.filter(match => {
    if (type === 'family') {
      return normalizeTeamFamily(match.homeTeam) === selected ||
        normalizeTeamFamily(match.awayTeam) === selected;
    }

    if (type === 'team') {
      return normalizeTeamName(match.homeTeam) === selected ||
        normalizeTeamName(match.awayTeam) === selected;
    }

    return match.competition === selected;
  });

  updateResults(filtered);
}

function setMatches(matches) {
  allMatches = matches;
  buildOptions();
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
    if (!result.bytes) {
      throw new Error(result.reason || 'No se pudo descargar el PDF desde el navegador.');
    }

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

els.refresh.addEventListener('click', loadFromFab);
els.pdf.addEventListener('change', event => loadLocalPdf(event.target.files?.[0]));
els.filterType.addEventListener('change', () => {
  buildOptions();
  filterMatches();
});
els.filterValue.addEventListener('change', filterMatches);
els.clearFilter.addEventListener('click', () => {
  els.filterValue.value = '';
  filterMatches();
});

updateResults([]);
