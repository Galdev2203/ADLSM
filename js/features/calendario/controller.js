const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm = (s) => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se ha podido cargar el lector de PDF. Comprueba tu conexión a internet.'));
    document.head.appendChild(script);
  });
  window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
  return window.pdfjsLib;
}

async function extractLines(pdfjs, file) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
  const lines = [];
  for (let pageNo = 1; pageNo <= pdf.numPages; pageNo++) {
    const page = await pdf.getPage(pageNo);
    const content = await page.getTextContent();
    const rows = new Map();
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const y = Math.round(item.transform[5] * 2) / 2;
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x: item.transform[4], text: item.str.trim() });
    }
    [...rows.entries()].sort((a,b) => b[0]-a[0]).forEach(([, items]) => {
      const line = items.sort((a,b)=>a.x-b.x).map(x=>x.text).join(' ').replace(/\s+/g,' ').trim();
      if (line) lines.push(line);
    });
  }
  return lines;
}

function parseMatches(lines, filename) {
  const matches = [];
  let date = null, jornada = '';
  for (const line of lines) {
    const header = line.match(/Jornada\s*(\d+)\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (header) { jornada = header[1]; date = header[2]; continue; }
    if (!date || !line.includes('-')) continue;
    const parts = line.split(/\s+-\s+/);
    if (parts.length < 2) continue;
    const home = parts[0].trim(), away = parts.slice(1).join(' - ').trim();
    const homeNorm = norm(home), awayNorm = norm(away);
    const isHome = homeNorm.includes('LA SALLE MONTEMOLIN');
    const isAway = awayNorm.includes('LA SALLE MONTEMOLIN');
    if (!isHome && !isAway) continue;
    const rival = isHome ? away : home;
    if (!rival || norm(rival) === 'DESCANSA') continue;
    const [dd, mm, yyyy] = date.split('/');
    matches.push({ date: yyyy+'-'+mm+'-'+dd, dateLabel: date, jornada, rival, venue: isHome ? 'Casa' : 'Fuera', source: filename, competition: '' });
  }
  return matches;
}

function getWeekKey(isoDate) {
  const date = new Date(isoDate + 'T12:00:00');
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);
  return date.toISOString().slice(0, 10);
}

function formatDate(isoDate, options = { weekday: 'long', day: 'numeric', month: 'long' }) {
  return new Intl.DateTimeFormat('es-ES', options).format(new Date(isoDate + 'T12:00:00'));
}

function renderCalendar(matches, results, status) {
  const unique = new Map();
  matches.forEach(m => unique.set([m.date, m.venue, norm(m.rival)].join('|'), m));
  const all = [...unique.values()].sort((a, b) => a.date.localeCompare(b.date) || a.rival.localeCompare(b.rival, 'es'));
  const weekends = new Map();
  all.forEach(match => {
    const key = getWeekKey(match.date);
    if (!weekends.has(key)) weekends.set(key, new Map());
    const days = weekends.get(key);
    if (!days.has(match.date)) days.set(match.date, []);
    days.get(match.date).push(match);
  });

  if (!all.length) {
    status.textContent = 'No se han encontrado partidos de La Salle en los documentos seleccionados.';
    results.innerHTML = '';
    return;
  }

  const firstDate = all[0].date;
  const lastDate = all[all.length - 1].date;
  status.innerHTML = '<div class="calendar-summary"><div><strong>' + all.length + '</strong><span>partidos encontrados</span></div><div><strong>' + weekends.size + '</strong><span>fines de semana</span></div><div class="calendar-summary-range"><strong>Periodo detectado</strong><span>' + esc(formatDate(firstDate, { day: 'numeric', month: 'short', year: 'numeric' })) + ' — ' + esc(formatDate(lastDate, { day: 'numeric', month: 'short', year: 'numeric' })) + '</span></div></div><p class="calendar-private-note">Procesado localmente · No se guarda ningún dato</p>';

  results.innerHTML = [...weekends.entries()].map(([weekStart, days]) => {
    const weekEnd = new Date(weekStart + 'T12:00:00');
    weekEnd.setDate(weekEnd.getDate() + 6);
    const weekEndIso = weekEnd.toISOString().slice(0, 10);
    const games = [...days.values()].flat();
    const homeCount = games.filter(game => game.venue === 'Casa').length;
    const dayCards = [...days.entries()].map(([date, dayGames]) => {
      const dayHomeCount = dayGames.filter(game => game.venue === 'Casa').length;
      return '<section class="calendar-day"><header><div><h4>' + esc(formatDate(date)) + '</h4><span>' + dayGames.length + ' partido(s) · ' + dayHomeCount + ' en casa</span></div>' + (dayHomeCount > 1 ? '<b class="calendar-conflict">Coincidencia en casa</b>' : '') + '</header><div class="calendar-games">' + dayGames.map(game => '<div class="calendar-game"><div class="calendar-game-main"><strong>La Salle Montemolín <span>vs.</span> ' + esc(game.rival) + '</strong><small>Jornada ' + esc(game.jornada || '—') + ' · ' + esc(game.source) + '</small></div><span class="calendar-venue ' + (game.venue === 'Casa' ? 'is-home' : 'is-away') + '">' + (game.venue === 'Casa' ? 'LOCAL' : 'VISITANTE') + '</span></div>').join('') + '</div></section>';
    }).join('');
    return '<article class="calendar-week"><div class="calendar-week-heading"><div><span class="calendar-week-kicker">FIN DE SEMANA</span><h3>' + esc(formatDate(weekStart, { day: 'numeric', month: 'long' })) + ' — ' + esc(formatDate(weekEndIso, { day: 'numeric', month: 'long', year: 'numeric' })) + '</h3></div><div class="calendar-week-count"><strong>' + games.length + '</strong><span>partidos</span></div>' + (homeCount > 1 ? '<b class="calendar-conflict">Varios partidos en casa</b>' : '') + '</div>' + dayCards + '</article>';
  }).join('') + '<button type="button" class="calendar-clear" id="calendarClear">Limpiar resultados</button>';

  document.getElementById('calendarClear')?.addEventListener('click', () => {
    results.innerHTML = '';
    status.textContent = 'Resultados eliminados. Puedes subir otros documentos.';
  });
}

export function initCalendario() {
  const input = document.getElementById('calendarPdfInput');
  const status = document.getElementById('calendarStatus');
  const results = document.getElementById('calendarResults');
  input.addEventListener('change', async () => {
    const files = [...input.files].filter(f=>f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'));
    if (!files.length) { status.textContent='Selecciona al menos un archivo PDF.'; return; }
    results.innerHTML=''; status.textContent='Analizando '+files.length+' documento(s)…';
    try {
      const pdfjs = await loadPdfJs();
      const extracted = [];
      for (const file of files) {
        status.textContent='Leyendo '+file.name+'…';
        const lines = await extractLines(pdfjs,file);
        extracted.push(...parseMatches(lines,file.name));
      }
      renderCalendar(extracted,results,status);
    } catch (error) { status.textContent=error.message||'No se han podido procesar los documentos.'; }
    input.value='';
  });
}
