import { supabase } from '../../core/supabase.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const PAGE_WEEKS = 4;
const todayISO = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const dateLabel = (value, options={weekday:'long',day:'numeric',month:'long',year:'numeric'}) => new Intl.DateTimeFormat('es-ES',options).format(new Date(value+'T12:00:00'));
const weekKey = iso => { const d=new Date(iso+'T12:00:00'); d.setDate(d.getDate()-((d.getDay()+6)%7)); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const addDays = (iso,n) => { const d=new Date(iso+'T12:00:00');d.setDate(d.getDate()+n);return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
function gameCard(m){
 const club=m.teamLabel||'La Salle Montemolín';
 const home=m.is_home?club:m.opponent_name, away=m.is_home?m.opponent_name:club;
 const round=Number(m.jornada)===0?'Amistoso':m.jornada?'Jornada '+esc(m.jornada):'Partido';
 const result=m.home_score!==null&&m.away_score!==null?'<b class="federated-v2-score">'+esc(m.home_score)+' - '+esc(m.away_score)+'</b>':'<span class="federated-v2-pending">Sin resultado</span>';
 return '<article class="federated-v2-game"><div class="federated-v2-game-date"><small>'+round+(m.match_time?' · '+esc(String(m.match_time).slice(0,5)):'')+'</small></div><div class="federated-v2-teams"><strong>'+esc(home)+'</strong><span>vs.</span><strong>'+esc(away)+'</strong></div><div class="federated-v2-result">'+result+'</div></article>';
}
function groupByDate(matches){const map=new Map();matches.forEach(m=>{if(!map.has(m.match_date))map.set(m.match_date,[]);map.get(m.match_date).push(m);});return [...map.entries()].sort((a,b)=>a[0].localeCompare(b[0]));}
function renderDay(date,matches){
 const home=matches.filter(m=>m.is_home),away=matches.filter(m=>!m.is_home);
 const section=(label,games,kind)=>games.length?'<div class="federated-v2-venue federated-v2-venue-'+kind+'"><h5>'+label+' <span>'+games.length+'</span></h5>'+games.map(gameCard).join('')+'</div>':'';
 return '<section class="federated-v2-day"><header><div><h4>'+esc(dateLabel(date))+'</h4><span>'+home.length+' en casa · '+away.length+' fuera</span></div>'+(home.length>1?'<b class="federated-v2-conflict">Coincidencia en casa</b>':'')+'</header>'+section('Partidos en casa',home,'home')+section('Partidos fuera',away,'away')+'</section>';
}
function renderNext(next,matches){if(!matches.length){next.innerHTML='<div class="federated-v2-empty">No hay próximos partidos.</div>';return;}const groups=groupByDate(matches);const conflicts=groups.filter(([,games])=>games.filter(g=>g.is_home).length>1).length;next.innerHTML='<div class="federated-v2-round-title"><h3>Próximos encuentros de los equipos federados</h3><span>'+matches.length+' partidos · '+conflicts+' fechas con coincidencias en casa</span></div>'+groups.map(([date,games])=>renderDay(date,games)).join('');}
function renderPagedCalendar(container,matches,page=0){
 const weeks=new Map();matches.forEach(m=>{const key=weekKey(m.match_date);if(!weeks.has(key))weeks.set(key,[]);weeks.get(key).push(m);});
 const entries=[...weeks.entries()].sort((a,b)=>a[0].localeCompare(b[0]));const pages=Math.max(1,Math.ceil(entries.length/PAGE_WEEKS));page=Math.min(Math.max(0,page),pages-1);
 const visible=entries.slice(page*PAGE_WEEKS,(page+1)*PAGE_WEEKS);
 const content=visible.map(([start,games])=>{const end=addDays(start,6),homes=games.filter(g=>g.is_home).length;return '<article class="federated-v2-week"><header class="federated-v2-week-heading"><div><span>SEMANA</span><h3>'+esc(dateLabel(start,{day:'numeric',month:'long'}))+' — '+esc(dateLabel(end,{day:'numeric',month:'long',year:'numeric'}))+'</h3></div><div class="federated-v2-week-count"><strong>'+games.length+'</strong><span>partidos</span></div>'+(homes>1?'<b class="federated-v2-conflict">Varios partidos en casa</b>':'')+'</header>'+groupByDate(games).map(([date,dayGames])=>renderDay(date,dayGames)).join('')+'</article>';}).join('');
 container.innerHTML=content+'<nav class="federated-v2-pagination" aria-label="Paginación del calendario"><button type="button" data-page="'+(page-1)+'" '+(page===0?'disabled':'')+'>← Anterior</button><span>Página '+(page+1)+' de '+pages+' · '+entries.length+' semanas</span><button type="button" data-page="'+(page+1)+'" '+(page>=pages-1?'disabled':'')+'>Siguiente →</button></nav>';
 container.querySelectorAll('[data-page]').forEach(btn=>btn.addEventListener('click',()=>renderPagedCalendar(container,matches,Number(btn.dataset.page))));
}
export async function initCalendariosFederadosV2(){
 const status=document.getElementById('federatedV2Status'),next=document.getElementById('federatedV2Next'),all=document.getElementById('federatedV2All');
 try{
  const {data:seasons,error:se}=await supabase.from('seasons').select('id,name,start_year,end_year').eq('is_active',true);if(se)throw se;
  const seasonIds=(seasons||[]).map(s=>s.id);if(!seasonIds.length){status.textContent='No hay una temporada activa configurada.';next.innerHTML='';all.innerHTML='';return;}
  const {data:relations,error:re}=await supabase.from('team_seasons').select('id,team_id,season_id,display_name,competition_name').in('season_id',seasonIds);if(re)throw re;
  const {data:teams,error:te}=await supabase.from('teams').select('id,name,category').eq('category','Federado');if(te)throw te;
  const ids=new Set((teams||[]).map(t=>t.id));const relevant=(relations||[]).filter(r=>ids.has(r.team_id));const byId=new Map(relevant.map(r=>[r.id,r]));
  if(!byId.size){status.textContent='No hay equipos federados asociados a la temporada activa.';next.innerHTML='';all.innerHTML='';return;}
  const {data:rows,error:me}=await supabase.from('matches').select('id,team_season_id,match_date,match_time,opponent_name,is_home,home_score,away_score,jornada,status').in('team_season_id',[...byId.keys()]).gte('match_date',todayISO()).order('match_date',{ascending:true}).order('match_time',{ascending:true});if(me)throw me;
  const upcoming=(rows||[]).filter(m=>m.status!=='cancelled').map(m=>({...m,teamLabel:byId.get(m.team_season_id)?.display_name||'La Salle Montemolín'})).sort((a,b)=>a.match_date.localeCompare(b.match_date)||String(a.match_time||'').localeCompare(String(b.match_time||'')));
  if(!upcoming.length){status.textContent='No hay partidos por jugar en los equipos federados para la temporada activa.';next.innerHTML='';all.innerHTML='';return;}
  // La siguiente jornada es el primer bloque semanal con partidos, no el próximo partido individual de cada equipo.
  const firstWeek=weekKey(upcoming[0].match_date);
  const nextMatches=upcoming.filter(m=>weekKey(m.match_date)===firstWeek);
  const nextIds=new Set(nextMatches.map(m=>m.id));
  nextMatches.sort((a,b)=>a.match_date.localeCompare(b.match_date)||String(a.match_time||'').localeCompare(String(b.match_time||'')));
  const rest=upcoming.filter(m=>!nextIds.has(m.id));renderNext(next,nextMatches);renderPagedCalendar(all,rest,0);
  const seasonText=(seasons||[]).map(s=>s.name||String(s.start_year||'')+'/'+String(s.end_year||'')).join(', ');status.textContent='Temporada '+seasonText+' · '+upcoming.length+' partidos futuros · '+relevant.length+' equipos federados';
 }catch(error){status.textContent=error?.message||'No se pudieron cargar los calendarios federados.';next.innerHTML='';all.innerHTML='';}
}