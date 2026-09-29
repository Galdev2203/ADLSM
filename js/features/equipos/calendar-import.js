import { supabase } from '../../core/supabase.js';
import { parseFabCalendarPdf } from '../horarios/fab/fab-parser.js?v=20260929-6';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const norm = value => String(value ?? '').normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const isClub = value => norm(value).includes('lasallemontemolin');
const sunday = iso => {
  const d = new Date(String(iso).slice(0,10) + 'T12:00:00');
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + (7 - d.getDay()) % 7);
  return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');
};
const displayDate = value => {
  if (!value) return '—';
  const parts=String(value).slice(0,10).split('-');
  return parts.length===3 ? parts[2]+'/'+parts[1]+'/'+parts[0] : value;
};
const jornadaLabel = value => Number(value)===0 ? 'Amistoso' : value ? 'Jornada '+value : '—';
const parseJornada = value => String(value??'').trim().toLowerCase()==='amistoso' ? 0 : (String(value??'').trim() ? Number(value) : null);
const sortByDate = rows => rows.sort((a,b) => String(a.match_date || a.date).localeCompare(String(b.match_date || b.date)) || Number(a.jornada||0)-Number(b.jornada||0));

function parseCsv(text) {
  const lines=text.replace(/^\uFEFF/,'').split(/\r?\n/).filter(line=>line.trim());
  if(lines.length<2) throw new Error('El CSV no contiene filas de partidos.');
  const delim=(lines[0].match(/;/g)||[]).length>(lines[0].match(/,/g)||[]).length?';':',';
  const split=line=>{const out=[];let cell='',quoted=false;for(let i=0;i<line.length;i++){const c=line[i];if(c==='"'&&line[i+1]==='"'&&quoted){cell+='"';i++;}else if(c==='"')quoted=!quoted;else if(c===delim&&!quoted){out.push(cell.trim());cell='';}else cell+=c;}out.push(cell.trim());return out;};
  const headers=split(lines[0]).map(v=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  const find=terms=>headers.findIndex(h=>terms.some(t=>h.includes(t)));
  const hi=find(['local','home']),ai=find(['visitante','away']),di=find(['fecha','date']);
  if(hi<0||ai<0||di<0)throw new Error('Se necesitan las columnas Local, Visitante y Fecha.');
  return lines.slice(1).map(split).map(c=>({jornada:'',homeTeam:c[hi],awayTeam:c[ai],date:sunday(c[di])})).filter(r=>r.homeTeam&&r.awayTeam&&r.date);
}

export function mountTeamCalendarImport(container, teamSeason) {
  container.innerHTML =
    '<article class="team-detail-card team-detail-card-wide team-calendar-import">' +
      '<div class="team-calendar-heading"><span class="teams-kicker">CALENDARIO</span><h3>Calendario del equipo</h3></div>' +
      '<div id="teamCalendarSaved"><p class="team-calendar-loading">Cargando partidos guardados…</p></div>' +
      '<div class="team-calendar-import-tools"><h3>Importar partidos</h3><p>Sube el calendario del equipo. Podrás revisar y editar los encuentros antes de guardarlos.</p>' +
        '<div class="team-calendar-upload"><input type="file" id="teamCalendarFile" accept=".pdf,.csv,.txt"><button type="button" class="team-action" id="teamCalendarAnalyze">Analizar archivo</button></div>' +
        '<p class="team-calendar-feedback" id="teamCalendarFeedback" role="status" aria-live="polite"></p><div id="teamCalendarPreview" hidden></div>' +
      '</div>' +
    '</article>';

  const saved=container.querySelector('#teamCalendarSaved');
  const fileInput=container.querySelector('#teamCalendarFile');
  const analyze=container.querySelector('#teamCalendarAnalyze');
  const feedback=container.querySelector('#teamCalendarFeedback');
  const preview=container.querySelector('#teamCalendarPreview');
  let rows=[];
  let matches=[];
  let displayMode='table';
  let editingMatchId=null;
  let editModal=null;

  const say=(message,error=false)=>{feedback.textContent=message;feedback.classList.toggle('is-error',error);};
  const fetchMatches=async()=>{
    const {data,error}=await supabase.from('matches').select('*').eq('team_season_id',teamSeason.id).order('match_date',{ascending:true}).order('jornada',{ascending:true});
    if(error)throw error;
    matches=sortByDate(data||[]);
    renderSaved();
  };
  const renderSaved=()=>{
    const content=matches.length ? (displayMode==='cards'
      ? '<div class="team-calendar-cards">'+matches.map(m=>'<article class="team-match-card"><div class="team-match-card-date"><strong>'+esc(displayDate(m.match_date))+'</strong><span>'+(m.jornada===0?'Amistoso':m.jornada?'Jornada '+esc(m.jornada):'Partido')+'</span></div><div class="team-match-card-game"><strong>'+esc(m.is_home?'La Salle Montemolín':m.opponent_name)+'</strong><span>vs</span><strong>'+esc(m.is_home?m.opponent_name:'La Salle Montemolín')+'</strong></div><div class="team-match-card-actions"><span class="team-match-status">'+(m.home_score!==null&&m.away_score!==null?esc(m.home_score)+' - '+esc(m.away_score):'Pendiente')+'</span><button type="button" class="team-action" data-edit-match="'+m.id+'">Editar</button></div></article>').join('')+'</div>'
      : '<div class="team-calendar-table-wrap"><table class="team-calendar-table team-saved-table"><thead><tr><th>Fecha</th><th>Jornada / tipo</th><th>Local</th><th>Visitante</th><th>Resultado</th><th></th></tr></thead><tbody>'+matches.map(m=>'<tr><td>'+esc(displayDate(m.match_date))+'</td><td>'+esc(jornadaLabel(m.jornada))+'</td><td>'+(m.is_home?'La Salle Montemolín':esc(m.opponent_name))+'</td><td>'+(m.is_home?esc(m.opponent_name):'La Salle Montemolín')+'</td><td>'+(m.home_score!==null&&m.away_score!==null?esc(m.home_score)+' - '+esc(m.away_score):'—')+'</td><td><button type="button" class="team-action" data-edit-match="'+m.id+'">Editar</button></td></tr>').join('')+'</tbody></table></div>')
      : '<p class="team-calendar-empty">Todavía no hay partidos guardados para este equipo.</p>';
    saved.innerHTML='<div class="team-calendar-saved-head"><div><strong>'+matches.length+' partidos</strong><span>Ordenados por fecha de juego</span></div><div class="team-calendar-saved-actions"><button type="button" class="team-action" id="teamCalendarManualAdd">+ Añadir partido</button><div class="team-calendar-view-toggle"><button type="button" data-mode="cards" class="'+(displayMode==='cards'?'active':'')+'">Cards</button><button type="button" data-mode="table" class="'+(displayMode==='table'?'active':'')+'">Tabla</button></div></div></div>'+content;
    saved.querySelector('#teamCalendarManualAdd').addEventListener('click',renderCreateForm);
    saved.querySelectorAll('[data-mode]').forEach(b=>b.addEventListener('click',()=>{displayMode=b.dataset.mode;renderSaved();}));
    saved.querySelectorAll('[data-edit-match]').forEach(b=>b.addEventListener('click',()=>{editingMatchId=b.dataset.editMatch;renderSaved();}));
    if(editingMatchId)renderEditForm();
  };
  const renderCreateForm=()=>{
    editModal?.remove();editingMatchId=null;
    editModal=document.createElement('div');editModal.className='team-match-modal-backdrop';
    editModal.innerHTML='<section class="team-match-modal" role="dialog" aria-modal="true" aria-labelledby="teamMatchModalTitle"><div class="team-match-modal-head"><h3 id="teamMatchModalTitle">Añadir partido</h3><button type="button" class="team-match-modal-close" aria-label="Cerrar">×</button></div><form class="team-match-edit"><div class="team-match-edit-grid">'+
      '<label>Fecha<input name="match_date" type="date" required></label>'+
      '<label>Jornada / tipo<input name="jornada" type="text" inputmode="numeric" placeholder="N.º de jornada o Amistoso"></label>'+
      '<label>Rival<input name="opponent_name" required maxlength="160" placeholder="Nombre del equipo rival"></label>'+
      '<label>Localía<select name="is_home"><option value="true" selected>En casa</option><option value="false">Fuera</option></select></label>'+
      '<label>Puntos equipo local<input name="home_score" type="number" min="0" step="1" placeholder="Dejar vacío si está pendiente"></label>'+
      '<label>Puntos equipo visitante<input name="away_score" type="number" min="0" step="1" placeholder="Dejar vacío si está pendiente"></label>'+
      '</div><div class="team-calendar-actions"><button type="button" class="team-secondary" data-cancel-edit>Cancelar</button><button type="submit" class="teams-primary">Añadir partido</button></div></form></section>';
    container.appendChild(editModal);
    editModal.querySelector('.team-match-modal-close').addEventListener('click',closeEditModal);
    editModal.querySelector('[data-cancel-edit]').addEventListener('click',closeEditModal);
    editModal.addEventListener('click',event=>{if(event.target===editModal)closeEditModal();});
    const form=editModal.querySelector('form');
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Guardando…';
      const fd=new FormData(form);const toScore=value=>value===''?null:Number(value);
      const payload={team_season_id:teamSeason.id,match_date:sunday(fd.get('match_date')),jornada:parseJornada(fd.get('jornada')),opponent_name:String(fd.get('opponent_name')).trim(),is_home:fd.get('is_home')==='true',home_score:toScore(fd.get('home_score')),away_score:toScore(fd.get('away_score')),status:'scheduled'};
      try{const {error}=await supabase.from('matches').insert(payload);if(error)throw error;closeEditModal();await fetchMatches();say('Partido añadido correctamente.');}
      catch(error){say(error.message||'No se pudo añadir el partido.',true);button.disabled=false;button.textContent='Añadir partido';}
    });
  };

  const closeEditModal=()=>{editModal?.remove();editModal=null;editingMatchId=null;};
  const renderEditForm=()=>{
    const m=matches.find(x=>x.id===editingMatchId);if(!m)return;
    editModal?.remove();
    editModal=document.createElement('div');editModal.className='team-match-modal-backdrop';
    editModal.innerHTML='<section class="team-match-modal" role="dialog" aria-modal="true" aria-labelledby="teamMatchModalTitle"><div class="team-match-modal-head"><h3 id="teamMatchModalTitle">Editar partido</h3><button type="button" class="team-match-modal-close" aria-label="Cerrar">×</button></div><form class="team-match-edit"><div class="team-match-edit-grid">'+
      '<label>Fecha<input name="match_date" type="date" required value="'+esc(m.match_date)+'"></label>'+
      '<label>Jornada / tipo<input name="jornada" type="text" inputmode="numeric" placeholder="N.º de jornada o Amistoso" value="'+esc(Number(m.jornada)===0?'Amistoso':m.jornada||'')+'"></label>'+
      '<label>Rival<input name="opponent_name" required maxlength="160" value="'+esc(m.opponent_name)+'"></label>'+
      '<label>Localía<select name="is_home"><option value="true" '+(m.is_home?'selected':'')+'>En casa</option><option value="false" '+(!m.is_home?'selected':'')+'>Fuera</option></select></label>'+
      '<label>Puntos equipo local<input name="home_score" type="number" min="0" step="1" placeholder="—" value="'+esc(m.home_score??'')+'"></label>'+
      '<label>Puntos equipo visitante<input name="away_score" type="number" min="0" step="1" placeholder="—" value="'+esc(m.away_score??'')+'"></label>'+
      '</div><div class="team-calendar-actions"><button type="button" class="team-secondary" data-cancel-edit>Cancelar</button><button type="submit" class="teams-primary">Guardar cambios</button></div></form></section>';
    container.appendChild(editModal);
    editModal.querySelector('.team-match-modal-close').addEventListener('click',closeEditModal);
    editModal.querySelector('[data-cancel-edit]').addEventListener('click',closeEditModal);
    editModal.addEventListener('click',event=>{if(event.target===editModal)closeEditModal();});
    const form=editModal.querySelector('form');
    form.addEventListener('submit',async event=>{
      event.preventDefault();const button=form.querySelector('[type="submit"]');button.disabled=true;button.textContent='Guardando…';
      const fd=new FormData(form);const toScore=value=>value===''?null:Number(value);
      const patch={match_date:sunday(fd.get('match_date')),jornada:fd.get('jornada')?Number(fd.get('jornada')):null,opponent_name:String(fd.get('opponent_name')).trim(),is_home:fd.get('is_home')==='true',home_score:toScore(fd.get('home_score')),away_score:toScore(fd.get('away_score'))};
      try{const {error}=await supabase.from('matches').update(patch).eq('id',m.id);if(error)throw error;closeEditModal();await fetchMatches();say('Partido actualizado correctamente.');}
      catch(error){say(error.message||'No se pudo actualizar el partido.',true);button.disabled=false;button.textContent='Guardar cambios';}
    });
  };

  const renderPreview=()=>{
    sortByDate(rows);
    preview.hidden=false;
    preview.innerHTML='<div class="team-calendar-preview-head"><strong>'+rows.length+' partidos detectados</strong><span>Ordenados por fecha de juego. Revisa antes de guardar.</span></div><div class="team-calendar-table-wrap"><table class="team-calendar-table"><thead><tr><th>Jornada</th><th>Local</th><th>Visitante</th><th>Fecha</th><th></th></tr></thead><tbody>'+rows.map((r,i)=>'<tr data-row="'+i+'"><td><input data-field="jornada" type="text" inputmode="numeric" placeholder="Jornada o Amistoso" value="'+esc(Number(r.jornada)===0?'Amistoso':r.jornada||'')+'"></td><td><input data-field="homeTeam" value="'+esc(r.homeTeam)+'"></td><td><input data-field="awayTeam" value="'+esc(r.awayTeam)+'"></td><td><input data-field="date" type="date" value="'+esc(r.date)+'"></td><td><button type="button" class="team-calendar-remove" data-remove="'+i+'">Eliminar</button></td></tr>').join('')+'</tbody></table></div><div class="team-calendar-actions"><button type="button" class="team-action" id="teamCalendarAdd">Añadir partido</button><button type="button" class="teams-primary" id="teamCalendarSave">Guardar partidos</button></div>';
    preview.querySelectorAll('tbody tr').forEach(tr=>tr.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{const r=rows[Number(tr.dataset.row)];r[input.dataset.field]=input.value;if(input.dataset.field==='date')r.date=sunday(input.value);sortByDate(rows);renderPreview();})));
    preview.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{rows.splice(Number(b.dataset.remove),1);renderPreview();}));
    preview.querySelector('#teamCalendarAdd').addEventListener('click',()=>{rows.push({jornada:'',homeTeam:teamSeason.display_name||teamSeason.team?.name||'La Salle Montemolín',awayTeam:'',date:''});renderPreview();});
    preview.querySelector('#teamCalendarSave').addEventListener('click',save);
  };
  const analyzeFile=async()=>{
    const file=fileInput.files?.[0];if(!file){say('Selecciona primero un archivo.',true);return;}
    analyze.disabled=true;analyze.textContent='Analizando…';say('');
    try{
      if(file.name.toLowerCase().endsWith('.pdf')){
        const parsed=await parseFabCalendarPdf(file);
        rows=parsed.filter(m=>isClub(m.homeTeam)||isClub(m.awayTeam)).map(m=>({jornada:m.jornada,homeTeam:m.homeTeam,awayTeam:m.awayTeam,date:sunday(m.date)})).filter(m=>m.date);
      }else if(file.name.toLowerCase().endsWith('.csv')||file.name.toLowerCase().endsWith('.txt'))rows=parseCsv(await file.text()).filter(m=>isClub(m.homeTeam)||isClub(m.awayTeam));
      else throw new Error('Formato no admitido. Utiliza PDF, CSV o TXT.');
      if(!rows.length)throw new Error('No se encontraron partidos de La Salle Montemolín con fecha válida.');
      sortByDate(rows);renderPreview();say('Análisis completado. No se ha guardado ningún partido todavía.');
    }catch(error){rows=[];preview.hidden=true;say(error.message||'No se pudo analizar el archivo.',true);}
    finally{analyze.disabled=false;analyze.textContent='Analizar archivo';}
  };
  const save=async()=>{
    const button=preview.querySelector('#teamCalendarSave');
    const cleaned=rows.map(r=>({...r,homeTeam:String(r.homeTeam||'').trim(),awayTeam:String(r.awayTeam||'').trim(),date:sunday(r.date)}));
    if(cleaned.some(r=>!r.homeTeam||!r.awayTeam||!r.date)){say('Completa equipos y fechas antes de guardar.',true);return;}
    button.disabled=true;button.textContent='Guardando…';
    try{
      const {data:existing,error:readError}=await supabase.from('matches').select('match_date,opponent_name,is_home').eq('team_season_id',teamSeason.id);
      if(readError)throw readError;
      const keys=new Set((existing||[]).map(m=>[m.match_date,String(m.opponent_name).toLowerCase(),String(m.is_home)].join('|')));
      const payload=[];
      for(const r of cleaned){
        const home=isClub(r.homeTeam),away=isClub(r.awayTeam);
        if(home===away)throw new Error('No se puede identificar a La Salle Montemolín en: '+r.homeTeam+' - '+r.awayTeam+'.');
        const opponent=home?r.awayTeam:r.homeTeam,isHome=home,key=[r.date,opponent.toLowerCase(),String(isHome)].join('|');
        if(!keys.has(key)){payload.push({team_season_id:teamSeason.id,match_date:r.date,opponent_name:opponent,is_home:isHome,status:'scheduled',jornada:parseJornada(r.jornada),external_source:'FAB'});keys.add(key);}
      }
      if(payload.length){const {error}=await supabase.from('matches').insert(payload);if(error)throw error;}
      preview.hidden=true;rows=[];fileInput.value='';
      await fetchMatches();
      say('Calendario guardado correctamente: '+payload.length+' partidos nuevos; '+(cleaned.length-payload.length)+' duplicados omitidos.');
    }catch(error){say(error.message||'No se pudieron guardar los partidos.',true);button.disabled=false;button.textContent='Guardar partidos';}
  };
  analyze.addEventListener('click',analyzeFile);
  fetchMatches().catch(error=>{saved.innerHTML='<p class="team-calendar-feedback is-error">No se pudieron cargar los partidos: '+esc(error.message)+'</p>';});
}
