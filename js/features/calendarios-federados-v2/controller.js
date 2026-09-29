import { supabase } from '../../core/supabase.js';

const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
const todayISO = () => { const d=new Date(); return [d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-'); };
const dateLabel = value => new Intl.DateTimeFormat('es-ES',{weekday:'long',day:'numeric',month:'long',year:'numeric'}).format(new Date(value+'T12:00:00'));

function gameCard(match) {
  const home=match.is_home ? 'La Salle Montemolín' : match.opponent_name;
  const away=match.is_home ? match.opponent_name : 'La Salle Montemolín';
  const score=match.home_score!==null&&match.away_score!==null ? `<b class="federated-v2-score">${esc(match.home_score)} - ${esc(match.away_score)}</b>` : '<span class="federated-v2-pending">Pendiente</span>';
  const round=Number(match.jornada)===0?'Amistoso':match.jornada?`Jornada ${esc(match.jornada)}`:'Partido';
  return `<article class="federated-v2-game"><div class="federated-v2-game-date"><strong>${esc(dateLabel(match.match_date))}</strong><small>${round}${match.match_time?' · '+esc(String(match.match_time).slice(0,5)):''}</small></div><div class="federated-v2-teams"><strong>${esc(home)}</strong><span>vs.</span><strong>${esc(away)}</strong></div><div class="federated-v2-result">${score}</div></article>`;
}

export async function initCalendariosFederadosV2() {
  const status=document.getElementById('federatedV2Status');
  const next=document.getElementById('federatedV2Next');
  const all=document.getElementById('federatedV2All');
  try {
    const {data:seasons,error:seasonError}=await supabase.from('seasons').select('id,name,start_year,end_year').eq('is_active',true);
    if(seasonError)throw seasonError;
    const seasonIds=(seasons||[]).map(s=>s.id);
    if(!seasonIds.length){status.textContent='No hay una temporada activa configurada.';next.innerHTML='';all.innerHTML='';return;}
    const {data:relations,error:relationsError}=await supabase.from('team_seasons').select('id,team_id,season_id,display_name,competition_name').in('season_id',seasonIds);
    if(relationsError)throw relationsError;
    const {data:teams,error:teamsError}=await supabase.from('teams').select('id,name,category').eq('category','Federado');
    if(teamsError)throw teamsError;
    const federatedIds=new Set((teams||[]).map(t=>t.id));
    const federatedRelations=(relations||[]).filter(r=>federatedIds.has(r.team_id));
    const relationById=new Map(federatedRelations.map(r=>[r.id,r]));
    if(!relationById.size){status.textContent='No hay equipos federados asociados a la temporada activa.';next.innerHTML='';all.innerHTML='';return;}
    const {data:matches,error:matchesError}=await supabase.from('matches').select('id,team_season_id,match_date,match_time,opponent_name,is_home,home_score,away_score,jornada,status').in('team_season_id',[...relationById.keys()]).gte('match_date',todayISO()).order('match_date',{ascending:true}).order('match_time',{ascending:true});
    if(matchesError)throw matchesError;
    const upcoming=(matches||[]).filter(m=>m.status!=='cancelled').map(m=>({...m,teamLabel:relationById.get(m.team_season_id)?.display_name||'La Salle Montemolín'}));
    if(!upcoming.length){status.textContent='No hay partidos pendientes en los equipos federados para la temporada activa.';next.innerHTML='';all.innerHTML='';return;}
    upcoming.sort((a,b)=>a.match_date.localeCompare(b.match_date)||(String(a.match_time||'').localeCompare(String(b.match_time||'')))||Number(a.jornada||999)-Number(b.jornada||999));
    const nextGames=[];
    const nextByTeam=new Map();
    for(const match of upcoming){
      if(!nextByTeam.has(match.team_season_id)){
        const teamRound=match.jornada;
        nextByTeam.set(match.team_season_id,teamRound);
        nextGames.push(...upcoming.filter(candidate=>candidate.team_season_id===match.team_season_id&&(
          teamRound!==null&&teamRound!==undefined
            ? String(candidate.jornada)===String(teamRound)
            : candidate.match_date===match.match_date
        )));
      }
    }
    const uniqueNext=[...new Map(nextGames.map(m=>[m.id,m])).values()].sort((a,b)=>a.match_date.localeCompare(b.match_date));
    const remaining=upcoming.filter(m=>!uniqueNext.some(n=>n.id===m.id));
    next.innerHTML=`<div class="federated-v2-round-title"><h3>Próximos partidos por equipo</h3><span>${uniqueNext.length} partido(s)</span></div>${uniqueNext.map(gameCard).join('')}`;
    all.innerHTML=remaining.length?remaining.map(gameCard).join(''):'<div class="federated-v2-empty">No hay más partidos pendientes.</div>';
    status.textContent=`Temporada ${seasons.map(s=>s.name||`${s.start_year}/${s.end_year}`).join(', ')} · ${upcoming.length} partidos pendientes · ${federatedRelations.length} equipos federados`;
  } catch(error) {
    status.textContent=error?.message||'No se pudieron cargar los calendarios federados.';
    next.innerHTML='';all.innerHTML='';
  }
}