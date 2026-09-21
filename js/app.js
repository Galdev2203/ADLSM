import { findFabDocuments } from './fab/fab-source.js';
import { parsePdfFile } from './fab/fab-parser.js';
import { renderMatches } from './ui/renderer.js';

const els = {
  refresh: document.querySelector('#refreshFab'),
  date: document.querySelector('#matchDate'),
  pdf: document.querySelector('#pdfInput'),
  status: document.querySelector('#sourceStatus'),
  message: document.querySelector('#message'),
  matches: document.querySelector('#matches'),
  count: document.querySelector('#matchCount')
};

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
    updateResults(matches);
    els.status.textContent = `Fuente: ${result.url}`;
    setMessage(`Documento cargado correctamente. Se han extraído ${matches.length} bloques de partido.`, true);
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
    updateResults(matches);
    setMessage(`PDF procesado correctamente. Se han extraído ${matches.length} bloques de partido.`, true);
  } catch (error) {
    console.error(error);
    setMessage(`No se ha podido leer el PDF: ${error.message}`, true);
  }
}

els.refresh.addEventListener('click', loadFromFab);
els.pdf.addEventListener('change', event => loadLocalPdf(event.target.files?.[0]));

updateResults([]);
