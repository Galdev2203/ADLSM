import { supabase } from '../../core/supabase.js';
import { parseFabCalendarPdf, parsePdfFile } from '../horarios/fab/fab-parser.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateToSunday = (iso) => {
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + (7 - d.getDay()) % 7);
  return [d.getFullYear(), String(d.getMonth()+1).padStart(2,'0'), String(d.getDate()).padStart(2,'0')].join('-');
};
const dateFromAny = (value) => {
  const s = String(value ?? '').trim();
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (m) return dateToSunday(`${m[1]}-${m[2].padStart(2,'0')}-${m[3].padStart(2,'0')}`);
  m = s.match(/^(\d{1,2})[\/-](\d{1,2})(?:[\/-](\d{2,4}))?$/);
  if (!m) return '';
  const year = m[3] ? Number(m[3].length === 2 ? `20${m[3]}` : m[3]) : new Date().getFullYear();
  return dateToSunday(`${year}-${m[2].padStart(2,'0')}-${m[1].padStart(2,'0')}`);
};
function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, '').split(/\r?\n/).filter(line => line.trim());
  if (lines.length < 2) throw new Error('El CSV no contiene filas de partidos.');
  const delim = (lines[0].match(/;/g)||[]).length > (lines[0].match(/,/g)||[]).length ? ';' : ',';
  const split = (line) => { const out=[]; let cell='', quoted=false; for(let i=0;i<line.length;i++){const c=line[i]; if(c==='"' && line[i+1]==='"' && quoted){cell+='"';i++;} else if(c==='"') quoted=!quoted; else if(c===delim&&!quoted){out.push(cell.trim());cell='';} else cell+=c;} out.push(cell.trim()); return out; };
  const headers=split(lines[0]).map(v=>v.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,''));
  const find=(terms)=>headers.findIndex(h=>terms.some(t=>h.includes(t)));
  const hi=find(['local','home','equipo local']), ai=find(['visitante','away','equipo visitante']), di=find(['fecha','date']);
  if(hi<0||ai<0||di<0) throw new Error('No se reconocen las columnas. Se necesitan Local, Visitante y Fecha.');
  return lines.slice(1).map(split).map(c=>({homeTeam:c[hi],awayTeam:c[ai],date:dateFromAny(c[di])})).filter(m=>m.homeTeam&&m.awayTeam&&m.date);
}
export function mountTeamCalendarImport(container, teamSeason) {
  const teamName = teamSeason.display_name || teamSeason.team?.name || '';
  container.innerHTML = `
    <article class="team-detail-card team-detail-card-wide team-calendar-import">
      <div class="team-calendar-heading"><div><span class="teams-kicker">CALENDARIO</span><h3>Importar partidos</h3><p>Sube el calendario del equipo. Podrás revisar y editar todos los encuentros antes de guardarlos.</p></div></div>
      <div class="team-calendar-upload"><input type="file" id="teamCalendarFile" accept=".pdf,.csv,.txt,.xls,.xlsx"><button type="button" class="team-action" id="teamCalendarAnalyze">Analizar archivo</button></div>
      <p class="team-calendar-feedback" id="teamCalendarFeedback" role="status" aria-live="polite"></p>
      <div id="teamCalendarPreview" hidden></div>
    </article>`;
  const fileInput=container.querySelector('#teamCalendarFile'), analyze=container.querySelector('#teamCalendarAnalyze'), feedback=container.querySelector('#teamCalendarFeedback'), preview=container.querySelector('#teamCalendarPreview');
  let rows=[];
  const say=(message, error=false)=>{feedback.textContent=message;feedback.classList.toggle('is-error',error);};
  const render=()=>{
    preview.hidden=false;
    preview.innerHTML=`<div class="team-calendar-preview-head"><strong>${rows.length} partidos detectados</strong><span>Revisa los datos antes de guardar.</span></div>
      <div class="team-calendar-table-wrap"><table class="team-calendar-table"><thead><tr><th>Jornada</th><th>Local</th><th>Visitante</th><th>Domingo de juego</th><th></th></tr></thead><tbody>${rows.map((r,i)=>`<tr data-row="${i}"><td><input aria-label="Jornada ${i+1}" data-field="jornada" type="number" min="1" value="${esc(r.jornada||'')}"></td><td><input aria-label="Equipo local" data-field="homeTeam" value="${esc(r.homeTeam)}"></td><td><input aria-label="Equipo visitante" data-field="awayTeam" value="${esc(r.awayTeam)}"></td><td><input aria-label="Fecha" data-field="date" type="date" value="${esc(r.date)}"></td><td><button type="button" class="team-calendar-remove" data-remove="${i}" aria-label="Eliminar partido">Eliminar</button></td></tr>`).join('')}</tbody></table></div>
      <div class="team-calendar-actions"><button type="button" class="team-action" id="teamCalendarAdd">Añadir partido</button><button type="button" class="teams-primary" id="teamCalendarSave">Guardar partidos</button></div>`;
    preview.querySelectorAll('tbody tr').forEach(tr=>tr.querySelectorAll('input').forEach(input=>input.addEventListener('change',()=>{const r=rows[Number(tr.dataset.row)];r[input.dataset.field]=input.value;if(input.dataset.field==='date')r.date=dateToSunday(input.value); })));
    preview.querySelectorAll('[data-remove]').forEach(b=>b.addEventListener('click',()=>{rows.splice(Number(b.dataset.remove),1);render();}));
    preview.querySelector('#teamCalendarAdd').addEventListener('click',()=>{rows.push({jornada:'',homeTeam:teamName,awayTeam:'',date:''});render();});
    preview.querySelector('#teamCalendarSave').addEventListener('click',save);
  };
  const analyzeFile=async()=>{
    const file=fileInput.files?.[0]; if(!file){say('Selecciona primero un archivo.',true);return;}
    analyze.disabled=true; analyze.textContent='Analizando…'; say('');
    try{
      if(file.name.toLowerCase().endsWith('.pdf')) {
        const parsed=await parsePdfFile(file,file.name);
        rows=parsed.map((m,i)=>({jornada:'',homeTeam:m.homeTeam,awayTeam:m.awayTeam,date:dateToSunday(m.date)})).filter(m=>m.date);
      } else if(file.name.toLowerCase().endsWith('.csv')||file.name.toLowerCase().endsWith('.txt')) {
        rows=parseCsv(await file.text());
      } else {
        throw new Error('Por ahora se admiten PDF y CSV/TXT. Los archivos Excel se habilitarán con el analizador correspondiente.');
      }
      if(!rows.length) throw new Error('No se encontraron partidos con fecha válida. Comprueba el formato del archivo.');
      render(); say('Análisis completado. No se ha guardado ningún partido todavía.');
    }catch(e){rows=[];preview.hidden=true;say(e.message||'No se pudo analizar el archivo.',true);}
    finally{analyze.disabled=false;analyze.textContent='Analizar archivo';}
  };
  const save=async()=>{
    const button=preview.querySelector('#teamCalendarSave');
    const cleaned=rows.map(r=>({...r,homeTeam:String(r.homeTeam||'').trim(),awayTeam:String(r.awayTeam||'').trim(),date:dateToSunday(r.date)}));
    if(cleaned.some(r=>!r.homeTeam||!r.awayTeam||!r.date)){say('Completa los equipos y fechas de todos los partidos antes de guardar.',true);return;}
    button.disabled=true;button.textContent='Guardando…';
    try{
      const {data:existing,error:readError}=await supabase.from('matches').select('match_date,opponent_name,is_home').eq('team_season_id',teamSeason.id);
      if(readError) throw readError;
      const keys=new Set((existing||[]).map(m=>[m.match_date,m.opponent_name.toLowerCase(),String(m.is_home)].join('|')));
      const payload=[];
      for(const r of cleaned){
        const home=r.homeTeam.toLocaleLowerCase()===teamName.toLocaleLowerCase();
        const away=r.awayTeam.toLocaleLowerCase()===teamName.toLocaleLowerCase();
        if(home===away) throw new Error(`No se puede identificar a ${teamName} en el partido ${r.homeTeam} - ${r.awayTeam}. Revisa el nombre del equipo.`);
        const opponent=home?r.awayTeam:r.homeTeam, isHome=home;
        const key=[r.date,opponent.toLowerCase(),String(isHome)].join('|');
        if(!keys.has(key)){payload.push({team_season_id:teamSeason.id,match_date:r.date,opponent_name:opponent,is_home:isHome,status:'scheduled',jornada:r.jornada?Number(r.jornada):null,external_source:'FAB'});keys.add(key);}
      }
      if(payload.length){const {error}=await supabase.from('matches').insert(payload);if(error)throw error;}
      say(`Importación completada: ${payload.length} nuevos partidos guardados; ${cleaned.length-payload.length} duplicados omitidos.`);
      button.textContent='Guardado';
    }catch(e){say(e.message||'No se pudieron guardar los partidos.',true);button.disabled=false;button.textContent='Guardar partidos';}
  };
  analyze.addEventListener('click',analyzeFile);
}
