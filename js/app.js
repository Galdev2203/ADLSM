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
  team: document.querySelector('#teamFilter'),
  clearTeam: document.querySelector('#clearTeam')
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

function populateTeams(matches) {
  const teams = [...new Map(
    matches
      .flatMap(match => [match.homeTeam, match.awayTeam])
      .filter(Boolean)
      .map(team => [normalizeTeamName(team), team])
  ).values()].sort((a, b) => a.localeCompare(b, 'es'));

  els.team.innerHTML = '<option value="">Todos los equipos</option>';
  for (const team of teams) {
    const option = document.createElement('option');
    option.value = normalizeTeamName(team);
    option.textContent = team;
    els.team.appendChild(option);
  }

  els.team.disabled = teams.length === 0;
  els.clearTeam.disabled = teams.length === 0;
}

function filterByTeam() {
  const selected = els.team.value;
  if (!selected) {
    updateResults(allMatches);
    return;
  }

  const filtered = allMatches.filter(match =>
    normalizeTeamName(match.homeTeam) === selected ||
    normalizeTeamName(match.awayTeam) === selected
  );

  updateResults(filtered);
}

function setMatches(matches) {
  allMatches = matches;
  populateTeams(matches);
  filterByTeam();
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
    setMessage(`Documento cargado correctamente. Se han extraído ${matches.length} partidos. Selecciona un equipo para filtrar sus partidos.`, true);
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
    setMessage(`PDF procesado correctamente. Se han extraído ${matches.length} partidos. Selecciona un equipo para filtrar sus partidos.`, true);
  } catch (error) {
    console.error(error);
    setMessage(`No se ha podido leer el PDF: ${error.message}`, true);
  }
}

els.refresh.addEventListener('click', loadFromFab);
els.pdf.addEventListener('change', event => loadLocalPdf(event.target.files?.[0]));
els.team.addEventListener('change', filterByTeam);
els.clearTeam.addEventListener('click', () => {
  els.team.value = '';
  filterByTeam();
});

updateResults([]);
