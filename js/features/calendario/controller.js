const esc = (value) => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const norm = value => String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/\s+/g, ' ').trim();

async function loadPdfJs() {
  if (window.pdfjsLib) return window.pdfjsLib;
  await new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.onload = resolve;
    script.onerror = () => reject(new Error('No se ha podido cargar el lector PDF. Comprueba tu conexión.'));
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
    const midpoint = (page.view[0] + page.view[2]) / 2;
    const columns = [new Map(), new Map()];
    for (const item of content.items) {
      if (!item.str?.trim()) continue;
      const x = item.transform[4], y = Math.round(item.transform[5] * 2) / 2;
      const rows = columns[x < midpoint ? 0 : 1];
      if (!rows.has(y)) rows.set(y, []);
      rows.get(y).push({ x, text: item.str.trim() });
    }
    for (const rows of columns) {
      [...rows.entries()].sort((a,b) => b[0]-a[0]).forEach(([,items]) => {
        const line = items.sort((a,b) => a.x-b.x).map(item => item.text).join(' ').replace(/\s+/g,' ').trim();
        if (line) lines.push(line);
      });
    }
  }
  return lines;
}

function parsePdfMatches(lines, filename) {
  const matches = [];
  let date = null, jornada = '';
  for (const line of lines) {
    const header = line.match(/Jornada\s*(\d+)\s*[-–]\s*(\d{2}\/\d{2}\/\d{4})/i);
    if (header) { jornada = header[1]; date = header[2]; continue; }
    if (!date || !line.includes('-')) continue;
    const parts = line.split(/\s+-\s+/);
    if (parts.length < 2) continue;
    const home = parts[0].trim(), away = parts.slice(1).join(' - ').trim();
    const isHome = norm(home).includes('LA SALLE MONTEMOLIN');
    const isAway = norm(away).includes('LA SALLE MONTEMOLIN');
    if (!isHome && !isAway) continue;
    const rival = isHome ? away : home;
    if (!rival || norm(rival) === 'DESCANSA') continue;
    const [dd,mm,yyyy] = date.split('/');
    matches.push({ date: yyyy+'-'+mm+'-'+dd, jornada, rival, venue: isHome ? 'Casa' : 'Fuera', source: filename, competition: '' });
  }
  return matches;
}

async function loadSavedMatches() {
  const response = await fetch('./data/calendarios-2026-27.csv', { cache: 'no-store' });
  if (!response.ok) throw new Error('No se ha podido cargar el calendario guardado en el repositorio.');
  const rows = (await response.text()).replace(/^\uFEFF/, '').trim().split(/\r?\n/);
  return rows.slice(1).map(row => {
    const [date,jornada,team,rival,venue,competition,source] = row.split(',');
    return { date, jornada, team, rival, venue, competition, source };
  }).filter(match => match.date && match.rival);
}

function categoryLabel(match) {
  const source = (match.source || '').toLowerCase();
  if (source.includes('2a-mas')) return '2.ª Aragonesa Masculina';
  if (source.includes('a2-mas')) return '1.ª Aragonesa A2';
  if (source.includes('3a-mas-01')) return 'Tercera Aragonesa Formación';
  if (source.includes('3a-mas-04')) return 'Tercera Aragonesa Veteranos';
  if (source.includes('cojf2a')) return 'Junior Femenino Segunda · Primer Año';
  if (source.includes('jf2a')) return 'Junior Femenino Segunda · Segundo Año';
  if (source.includes('2a-fem')) return '2.ª Aragonesa Femenina';
  return match.competition || '';
}

function getWeekKey(isoDate) {
  const date = new Date(isoDate + 'T12:00:00');
  date.setDate(date.getDate() - ((date.getDay()+6)%7));
  return date.toISOString().slice(0,10);
}
function formatDate(isoDate, options={weekday:'long',day:'numeric',month:'long'}) {
  return new Intl.DateTimeFormat('es-ES',options).format(new Date(isoDate+'T12:00:00'));
}

function renderCalendar(matches, results, status, { saved = false } = {}) {
  const now = new Date();
  const today = [now.getFullYear(), String(now.getMonth()+1).padStart(2,'0'), String(now.getDate()).padStart(2,'0')].join('-');
  const upcoming = matches.filter(match => match.date >= today);
  const unique = new Map();
  upcoming.forEach(m => unique.set([m.date,m.venue,norm(m.rival),m.team].join('|'),m));
  const all = [...unique.values()].sort((a,b)=>a.date.localeCompare(b.date)||((a.venue==='Casa'?0:1)-(b.venue==='Casa'?0:1))||a.rival.localeCompare(b.rival,'es'));
  const weeks = new Map();
  all.forEach(match => {
    const key=getWeekKey(match.date);
    if(!weeks.has(key)) weeks.set(key,new Map());
    const days=weeks.get(key);
    if(!days.has(match.date)) days.set(match.date,[]);
    days.get(match.date).push(match);
  });
  if(!all.length) {
    status.textContent=matches.length ? 'No quedan partidos pendientes a partir de hoy.' : 'No se han encontrado partidos de La Salle en los documentos seleccionados.';
    results.innerHTML='';
    return;
  }
  const homes=all.filter(m=>m.venue==='Casa').length;
  const conflictDays=[...weeks.values()].flatMap(days=>[...days.values()]).filter(games=>games.filter(g=>g.venue==='Casa').length>1).length;
  status.innerHTML='<div class="calendar-summary"><div><strong>'+all.length+'</strong><span>partidos encontrados</span></div><div><strong>'+homes+'</strong><span>partidos como local</span></div><div><strong>'+conflictDays+'</strong><span>fechas con coincidencias en casa</span></div><div class="calendar-summary-range"><strong>Periodo del calendario</strong><span>'+esc(formatDate(all[0].date,{day:'numeric',month:'short',year:'numeric'}))+' — '+esc(formatDate(all[all.length-1].date,{day:'numeric',month:'short',year:'numeric'}))+'</span></div></div><p class="calendar-private-note">'+(saved?'Calendario 2026/27 incluido en la web · Datos estáticos en Git · Sin conexión con Supabase':'PDF procesados localmente · No se guarda ningún dato')+'</p>';
  results.innerHTML=[...weeks.entries()].map(([weekStart,days])=>{
    const weekEnd=new Date(weekStart+'T12:00:00'); weekEnd.setDate(weekEnd.getDate()+6);
    const weekEndIso=weekEnd.toISOString().slice(0,10);
    const games=[...days.values()].flat();
    const homeCount=games.filter(g=>g.venue==='Casa').length;
    const dayCards=[...days.entries()].map(([date,dayGames])=>{
      const dayHome=dayGames.filter(g=>g.venue==='Casa').length;
      return '<section class="calendar-day"><header><div><h4>'+esc(formatDate(date))+'</h4><span>'+dayGames.length+' partido(s) · '+dayHome+' en casa</span></div>'+(dayHome>1?'<b class="calendar-conflict">Coincidencia en casa</b>':'')+'</header><div class="calendar-games">'+dayGames.sort((a,b)=>(a.venue==='Casa'?0:1)-(b.venue==='Casa'?0:1)||a.rival.localeCompare(b.rival,'es')).map(game=>'<div class="calendar-game"><div class="calendar-game-main"><strong>'+(game.venue==='Casa'?esc(game.team||'La Salle Montemolín')+' <span>vs.</span> '+esc(game.rival):esc(game.rival)+' <span>vs.</span> '+esc(game.team||'La Salle Montemolín'))+'</strong><small>'+esc(categoryLabel(game))+' · Jornada '+esc(game.jornada||'—')+'</small></div><span class="calendar-venue '+(game.venue==='Casa'?'is-home':'is-away')+'">'+(game.venue==='Casa'?'LOCAL':'VISITANTE')+'</span></div>').join('')+'</div></section>';
    }).join('');
    return '<article class="calendar-week"><div class="calendar-week-heading"><div><span class="calendar-week-kicker">FIN DE SEMANA</span><h3>'+esc(formatDate(weekStart,{day:'numeric',month:'long'}))+' — '+esc(formatDate(weekEndIso,{day:'numeric',month:'long',year:'numeric'}))+'</h3></div><div class="calendar-week-count"><strong>'+games.length+'</strong><span>partidos</span></div>'+(homeCount>1?'<b class="calendar-conflict">Varios partidos en casa</b>':'')+'</div>'+dayCards+'</article>';
  }).join('')+'<button type="button" class="calendar-clear" id="calendarClear">'+(saved?'Volver al calendario guardado':'Limpiar resultados')+'</button>';
  document.getElementById('calendarClear')?.addEventListener('click',async()=>{
    if(saved){ status.textContent='Cargando calendario guardado…'; try{renderCalendar(await loadSavedMatches(),results,status,{saved:true});}catch(error){status.textContent=error.message;} }
    else {results.innerHTML='';status.textContent='Resultados eliminados. Puedes cargar otros documentos o volver a cargar la sección.';}
  });
}

export function initCalendario() {
  const input=document.getElementById('calendarPdfInput');
  const status=document.getElementById('calendarStatus');
  const results=document.getElementById('calendarResults');
  loadSavedMatches().then(matches=>renderCalendar(matches,results,status,{saved:true})).catch(error=>{status.textContent=error.message;});
  input.addEventListener('change',async()=>{
    const files=[...input.files].filter(f=>f.type==='application/pdf'||f.name.toLowerCase().endsWith('.pdf'));
    if(!files.length){status.textContent='Selecciona al menos un archivo PDF.';return;}
    results.innerHTML='';status.textContent='Analizando '+files.length+' documento(s)…';
    try{
      const pdfjs=await loadPdfJs(), extracted=[];
      for(const file of files){status.textContent='Leyendo '+file.name+'…';extracted.push(...parsePdfMatches(await extractLines(pdfjs,file),file.name));}
      renderCalendar(extracted,results,status);
    }catch(error){status.textContent=error.message||'No se han podido procesar los documentos.';}
    input.value='';
  });
}
