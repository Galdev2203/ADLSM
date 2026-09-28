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

function renderCalendar(matches, results, status) {
  const unique = new Map();
  matches.forEach(m => unique.set([m.date,m.venue,norm(m.rival)].join('|'), m));
  const all = [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||a.rival.localeCompare(b.rival,'es'));
  const groups = new Map();
  all.forEach(m=>{ if(!groups.has(m.date)) groups.set(m.date,[]); groups.get(m.date).push(m); });
  status.textContent = all.length ? 'Se han encontrado '+all.length+' partidos en '+groups.size+' fechas. Los datos solo permanecen en esta página.' : 'No se han encontrado partidos de La Salle en los documentos seleccionados.';
  results.innerHTML = all.length ? [...groups.entries()].map(([date, games])=>{
    const d = new Date(date+'T12:00:00');
    const label = new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(d);
    const homeCount = games.filter(g=>g.venue==='Casa').length;
    return '<article class="calendar-day"><header><div><h3>'+esc(label)+'</h3><span>'+games.length+' partido(s) · '+homeCount+' en casa</span></div>'+(homeCount>1?'<b class="calendar-conflict">Coincidencia en casa</b>':'')+'</header><div class="calendar-games">'+games.map(g=>'<div class="calendar-game"><div><strong>La Salle Montemolín – '+esc(g.rival)+'</strong><small>Jornada '+esc(g.jornada||'—')+' · '+esc(g.source)+'</small></div><span class="calendar-venue '+(g.venue==='Casa'?'is-home':'is-away')+'">'+g.venue+'</span></div>').join('')+'</div></article>';
  }).join('')+'<button type="button" class="calendar-clear" id="calendarClear">Limpiar resultados</button>' : '';
  document.getElementById('calendarClear')?.addEventListener('click',()=>{results.innerHTML='';status.textContent='Resultados eliminados. Puedes subir otros documentos.';});
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
