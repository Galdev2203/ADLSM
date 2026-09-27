import { supabase } from '../../core/supabase.js';
import { notify } from '../../core/notifications.js';

const esc = (v) => String(v ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const normalize = (v) => String(v ?? '').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const seasonLabel = s => s ? `${s.start_year}/${String(s.end_year).slice(-2)}` : '—';
const initials = p => [p?.first_name,p?.last_name].map(normalize).filter(Boolean).map(x=>x[0].toUpperCase()).join('').slice(0,2) || 'J';
const supabaseErrorText = error => [error?.message,error?.details,error?.hint].filter(Boolean).join(' · ') || 'Error desconocido';

let seasons=[], teamSeasons=[], teamSeasonById=new Map(), people=[], profiles=[], assignments=[];
let selectedSeasonId='', searchTerm='', saving=false, editingPlayerId=null, editingAssignmentId=null;

const timeout = async (promise, ms=15000) => {
  let timer;
  try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La operación está tardando demasiado. Comprueba la conexión e inténtalo de nuevo.')),ms)})])}
  finally{clearTimeout(timer)}
};

export function initJugadores(){
  const els={
    toolbar:document.querySelector('#playersToolbar'), list:document.querySelector('#playerList'), detail:document.querySelector('#playerDetail'),
    total:document.querySelector('#playerTotal'), active:document.querySelector('#playerActive'), seasonCount:document.querySelector('#playerSeasonCount'),
    seasonFilter:document.querySelector('#playerSeasonFilter'), search:document.querySelector('#playerSearch'), modal:document.querySelector('#playerModal'),
    form:document.querySelector('#playerForm'), close:document.querySelector('#closePlayerModal'), cancel:document.querySelector('#cancelPlayer'),
    newButton:document.querySelector('#newPlayerButton'), save:document.querySelector('#savePlayer'), modalTitle:document.querySelector('#playerModalTitle'),
    firstName:document.querySelector('#playerFirstName'), lastName:document.querySelector('#playerLastName'), birthDate:document.querySelector('#playerBirthDate'),
    phone:document.querySelector('#playerPhone'), email:document.querySelector('#playerEmail'), season:document.querySelector('#playerSeason'),
    teamSeason:document.querySelector('#playerTeamSeason'), license:document.querySelector('#playerLicense'), position:document.querySelector('#playerPosition'),
    shirt:document.querySelector('#playerShirtNumber'), status:document.querySelector('#playerStatus'), notes:document.querySelector('#playerNotes')
  };

  const populateSeasons=()=>{
    const options=seasons.map(s=>`<option value="${s.id}">${esc(seasonLabel(s))} · ${esc(s.name)}</option>`).join('');
    els.seasonFilter.innerHTML='<option value="">Todas</option>'+options;
    els.season.innerHTML='<option value="">Selecciona una temporada</option>'+options;
    els.season.value=selectedSeasonId || seasons.find(s=>s.is_active)?.id || seasons[0]?.id || '';
    populateTeams();
  };
  const populateTeams=async()=>{
    const sid=String(els.season.value || '');
    els.teamSeason.disabled=true;
    els.teamSeason.innerHTML='<option value="">Cargando equipos…</option>';
    if(!sid){
      els.teamSeason.innerHTML='<option value="">Selecciona una temporada primero</option>';
      els.teamSeason.disabled=false;
      return;
    }
    try{
      const {data,error}=await timeout(
        supabase
          .from('team_seasons')
          .select('id,season_id,team_id,display_name,gender,competition_name,group_name')
          .eq('season_id',sid)
          .order('display_name',{ascending:true})
      );
      if(error) throw error;
      const rows=(data||[]).map(row=>({
        ...row,
        team:teamSeasonById.get(String(row.id))?.team || null
      }));
      els.teamSeason.innerHTML='<option value="">Selecciona un equipo</option>'+rows.map(t=>`<option value="${t.id}">${esc(t.display_name||t.team?.name||'Equipo')}${t.team?.category ? ` · ${esc(t.team.category)}` : ''}</option>`).join('');
      if(!rows.length) els.teamSeason.innerHTML='<option value="">No hay equipos en esta temporada</option>';
    }catch(error){
      els.teamSeason.innerHTML='<option value="">No se pudieron cargar los equipos</option>';
      notify('No se pudieron cargar los equipos: '+(error?.message||'Error desconocido'),'error');
    }finally{
      els.teamSeason.disabled=false;
    }
  };
  const rowData=(a)=>{
    const p=people.find(x=>x.id===a.player_id);
    const prof=profiles.find(x=>x.person_id===a.player_id);
    const team=teamSeasonById.get(String(a.team_season_id)) || null;
    return {...a,person:p,profile:prof,team};
  };
  const filtered=()=>assignments.map(rowData).filter(a=>{
    if(selectedSeasonId && a.team?.season_id!==selectedSeasonId) return false;
    const hay=normalize([a.person?.first_name,a.person?.last_name,a.person?.email,a.profile?.federation_license,a.profile?.position,a.team?.display_name,a.team?.team?.name].join(' '));
    return hay.includes(searchTerm);
  });
  const render=()=>{
    const rows=filtered();
    els.total.textContent=new Set(rows.map(r=>r.player_id)).size;
    els.active.textContent=new Set(rows.filter(r=>r.person?.is_active!==false).map(r=>r.player_id)).size;
    els.seasonCount.textContent=selectedSeasonId ? rows.length : assignments.filter(a=>teamSeasonById.get(String(a.team_season_id))?.season?.is_active).length;
    if(!rows.length){els.list.innerHTML=`<div class="player-empty"><h3>${assignments.length?'No hay jugadores que coincidan':'Todavía no hay jugadores'}</h3><p>${assignments.length?'Prueba con otra temporada o búsqueda.':'Crea el primer jugador para empezar a gestionar las plantillas.'}</p><button class="players-primary" id="emptyNewPlayer" type="button">Crear jugador</button></div>`;document.querySelector('#emptyNewPlayer')?.addEventListener('click',openModal);return}
    els.list.innerHTML=rows.map(r=>{const name=[r.person?.first_name,r.person?.last_name].filter(Boolean).join(' ')||'Jugador';return `<article class="player-card"><div class="player-card-main"><div class="player-avatar">${esc(initials(r.person))}</div><div class="player-card-info"><div class="player-title-row"><h3>${esc(name)}</h3><span class="player-status ${r.person?.is_active!==false?'active':''}">${r.person?.is_active!==false?'ACTIVO':'INACTIVO'}</span></div><p>${esc(r.team?.display_name||r.team?.team?.name||'Sin equipo')}</p><div class="player-card-meta"><span>${esc(seasonLabel(r.team?.season))}</span>${r.profile?.position?`<span>${esc(r.profile.position)}</span>`:''}${r.profile?.shirt_number!=null?`<span>Dorsal ${esc(r.profile.shirt_number)}</span>`:''}</div></div></div><div class="player-card-actions"><button class="player-action" data-player="${r.player_id}" data-assignment="${r.id}" type="button">Ver jugador</button><button class="player-action player-action-light" data-edit-player="${r.player_id}" data-assignment="${r.id}" type="button">Editar</button></div></article>`}).join('');
    els.list.querySelectorAll('[data-player]').forEach(b=>b.addEventListener('click',()=>showDetail(b.dataset.player,b.dataset.assignment)));
    els.list.querySelectorAll('[data-edit-player]').forEach(b=>b.addEventListener('click',()=>openEditModal(b.dataset.editPlayer,b.dataset.assignment)));
  };
  const openModal=async()=>{
    editingPlayerId=null; editingAssignmentId=null;
    els.form.reset(); els.modalTitle.textContent='Nuevo jugador'; els.save.textContent='Crear jugador';
    els.season.value=selectedSeasonId||seasons.find(s=>s.is_active)?.id||seasons[0]?.id||'';
    els.modal.hidden=false; await populateTeams(); requestAnimationFrame(()=>els.firstName.focus());
  };
  const openEditModal=async(personId,assignmentId)=>{
    const p=people.find(x=>x.id===personId), prof=profiles.find(x=>x.person_id===personId), a=assignments.find(x=>x.id===assignmentId) || assignments.find(x=>x.player_id===personId);
    if(!p||!prof||!a){notify('No se encontró el jugador que quieres editar.','error');return}
    editingPlayerId=personId; editingAssignmentId=a.id;
    els.modalTitle.textContent='Editar jugador'; els.save.textContent='Guardar cambios';
    els.firstName.value=p.first_name||''; els.lastName.value=p.last_name||''; els.birthDate.value=p.birth_date||'';
    els.phone.value=p.phone||''; els.email.value=p.email||''; els.license.value=prof.federation_license||'';
    els.position.value=prof.position||''; els.shirt.value=prof.shirt_number ?? a.shirt_number ?? ''; els.status.value=a.status||'active'; els.notes.value=prof.notes||a.notes||'';
    const team=teamSeasonById.get(String(a.team_season_id)) || null;
    els.season.value=team?.season_id||seasons.find(s=>s.is_active)?.id||seasons[0]?.id||'';
    els.modal.hidden=false; await populateTeams(); els.teamSeason.value=a.team_season_id||'';
    requestAnimationFrame(()=>els.firstName.focus());
  };
  const closeModal=()=>{els.modal.hidden=true;els.form.reset();editingPlayerId=null;editingAssignmentId=null};
  const showDetail=(personId,assignmentId)=>{
    const p=people.find(x=>x.id===personId), prof=profiles.find(x=>x.person_id===personId);
    const history=assignments.filter(a=>a.player_id===personId).map(rowData).sort((a,b)=>Number(b.team?.season?.start_year||0)-Number(a.team?.season?.start_year||0));
    if(!p||!prof)return;
    const current=history.find(x=>x.id===assignmentId)||history[0];
    els.toolbar.hidden=true;els.list.hidden=true;els.detail.hidden=false;
    els.detail.innerHTML=`<div class="player-detail-header"><button class="player-back" id="backPlayers">← Volver a jugadores</button><div class="player-detail-title"><div class="player-avatar">${esc(initials(p))}</div><div><span class="players-kicker">JUGADOR</span><h2>${esc([p.first_name,p.last_name].filter(Boolean).join(' '))}</h2></div><div class="player-detail-actions"><button class="player-secondary" id="editPlayerDetail" type="button">Editar jugador</button><button class="player-delete" id="deletePlayerDetail" type="button">Eliminar jugador</button></div></div></div><div class="player-detail-grid"><article class="player-detail-card"><h3>Datos personales</h3><dl><div><dt>Fecha de nacimiento</dt><dd>${esc(p.birth_date||'—')}</dd></div><div><dt>Teléfono</dt><dd>${esc(p.phone||'—')}</dd></div><div><dt>Email</dt><dd>${esc(p.email||'—')}</dd></div></dl></article><article class="player-detail-card"><h3>Perfil deportivo</h3><dl><div><dt>Licencia</dt><dd>${esc(prof.federation_license||'—')}</dd></div><div><dt>Posición</dt><dd>${esc(prof.position||'—')}</dd></div><div><dt>Dorsal</dt><dd>${esc(prof.shirt_number??current?.shirt_number??'—')}</dd></div></dl></article><article class="player-detail-card player-detail-card-wide"><h3>Historial de equipos</h3><div class="player-history">${history.length?history.map(r=>`<div class="player-history-row"><strong>${esc(r.team?.display_name||r.team?.team?.name||'Equipo')}</strong><span>${esc(seasonLabel(r.team?.season))}${r.is_primary?' · Principal':''}</span></div>`).join(''):'<span>No hay historial de equipos.</span>'}</div></article></div>`;
    document.querySelector('#backPlayers').onclick=hideDetail;
    document.querySelector('#editPlayerDetail').onclick=()=>openEditModal(personId,current?.id);
    document.querySelector('#deletePlayerDetail').onclick=()=>deletePlayer(personId);
  };
  const hideDetail=()=>{els.detail.hidden=true;els.toolbar.hidden=false;els.list.hidden=false;render()};
  const load=async()=>{
    els.list.innerHTML='<div class="player-loading">Cargando jugadores…</div>';
    const [s,p,pr,t,ts]=await Promise.all([
      supabase.from('seasons').select('id,name,start_year,end_year,is_active').order('start_year',{ascending:false}),
      supabase.from('people').select('id,first_name,last_name,phone,email,birth_date,photo_url,notes,is_active,created_at,updated_at').order('last_name'),
      supabase.from('player_profiles').select('person_id,federation_license,position,shirt_number,notes,created_at'),
      supabase.from('team_seasons').select('id,season_id,team_id,display_name,gender,competition_name,group_name'),
      supabase.from('teams').select('id,name,gender,category,is_active')
    ]);
    const tp=await supabase.from('team_players').select('id,team_season_id,player_id,is_primary,shirt_number,joined_at,left_at,status,notes,created_at').order('created_at',{ascending:false});
    const err=[s,p,pr,t,ts,tp].find(x=>x.error)?.error;
    if(err){els.list.innerHTML=`<div class="player-empty"><h3>No se pudieron cargar los jugadores</h3><p>${esc(err.message)}</p></div>`;return}
    seasons=s.data||[];people=p.data||[];profiles=pr.data||[];
    const teamMap=new Map((ts.data||[]).map(x=>[x.id,{...x,season:seasons.find(s=>s.id===x.season_id),team:(t.data||[]).find(y=>y.id===x.team_id)}]));
    teamSeasons=[...teamMap.values()];
    teamSeasonById=new Map(teamSeasons.map(x=>[String(x.id),x]));
    assignments=tp.data||[];
    populateSeasons();render();
  };
  const save=async(e)=>{
    e.preventDefault(); if(saving)return;
    const first=els.firstName.value.trim(),last=els.lastName.value.trim(),email=els.email.value.trim()||null,phone=els.phone.value.trim()||null,teamSeasonId=els.teamSeason.value;
    if(!first||!last||!teamSeasonId){notify('Completa nombre, apellidos y equipo principal.','warning');return}
    saving=true;els.save.disabled=true;els.save.textContent=editingPlayerId?'Guardando…':'Creando…';
    let createdPersonId=null, createdProfile=false;
    try{
      if(editingPlayerId){
        const {error:personError}=await timeout(supabase.from('people').update({first_name:first,last_name:last,phone,email,birth_date:els.birthDate.value||null,updated_at:new Date().toISOString()}).eq('id',editingPlayerId));
        if(personError)throw personError;
        const {error:profileError}=await timeout(supabase.from('player_profiles').update({federation_license:els.license.value.trim()||null,position:els.position.value.trim()||null,shirt_number:els.shirt.value?Number(els.shirt.value):null,notes:els.notes.value.trim()||null}).eq('person_id',editingPlayerId));
        if(profileError)throw profileError;
        const {error:assignmentError}=await timeout(supabase.from('team_players').update({team_season_id:teamSeasonId,shirt_number:els.shirt.value?Number(els.shirt.value):null,status:els.status.value,notes:els.notes.value.trim()||null}).eq('id',editingAssignmentId));
        if(assignmentError)throw assignmentError;
        closeModal();await load();notify('Jugador actualizado correctamente.','success');return;
      }
      let person=null;
      if(email) person=people.find(p=>normalize(p.email)===normalize(email));
      if(!person&&phone) person=people.find(p=>normalize(p.phone)===normalize(phone));
      const sameName=people.filter(p=>normalize(p.first_name)===normalize(first)&&normalize(p.last_name)===normalize(last));
      if(!person&&sameName.length===1) person=sameName[0];
      if(!person&&sameName.length>1&&!email&&!phone) throw new Error('Ya existen varias personas con ese nombre. Añade un email o teléfono para identificarla sin crear un duplicado.');
      if(!person){
        const {data,error}=await timeout(supabase.from('people').insert({first_name:first,last_name:last,phone,email,birth_date:els.birthDate.value||null}).select('id').single());
        if(error)throw error; person={id:data.id}; createdPersonId=data.id;
      }
      const {data:existingProfile,error:profileLookupError}=await timeout(supabase.from('player_profiles').select('person_id').eq('person_id',person.id).maybeSingle());
      if(profileLookupError)throw profileLookupError;
      if(existingProfile)throw new Error('Esta persona ya está registrada como jugador.');
      const {error:profileError}=await timeout(supabase.from('player_profiles').insert({person_id:person.id,federation_license:els.license.value.trim()||null,position:els.position.value.trim()||null,shirt_number:els.shirt.value?Number(els.shirt.value):null,notes:els.notes.value.trim()||null}));
      if(profileError)throw profileError; createdProfile=true;
      const {error:assignmentError}=await timeout(supabase.from('team_players').insert({team_season_id:teamSeasonId,player_id:person.id,is_primary:true,shirt_number:els.shirt.value?Number(els.shirt.value):null,status:els.status.value,notes:els.notes.value.trim()||null}));
      if(assignmentError)throw assignmentError;
      closeModal();await load();notify('Jugador creado correctamente.','success');
    }catch(error){
      if(createdProfile&&createdPersonId)await supabase.from('player_profiles').delete().eq('person_id',createdPersonId);
      if(createdPersonId)await supabase.from('people').delete().eq('id',createdPersonId);
      notify('No se pudo guardar el jugador: '+supabaseErrorText(error),'error');
    }finally{saving=false;els.save.disabled=false;els.save.textContent=editingPlayerId?'Guardar cambios':'Crear jugador'}
  };
  const deletePlayer=async(personId)=>{
    const p=people.find(x=>x.id===personId); if(!p)return;
    const name=[p.first_name,p.last_name].filter(Boolean).join(' ')||'este jugador';
    const confirmed=await (await import('../../core/dialogs.js')).confirmDialog({title:'Eliminar jugador',message:`¿Quieres eliminar a ${name}? Se eliminarán sus asignaciones de equipos y su perfil de jugador. La persona se conservará para poder reutilizarla en el futuro.`,confirmText:'Eliminar jugador',cancelText:'Cancelar',danger:true});
    if(!confirmed||saving)return;
    saving=true;
    try{
      const {error:assignmentError}=await timeout(supabase.from('team_players').delete().eq('player_id',personId)); if(assignmentError)throw assignmentError;
      const {error:profileError}=await timeout(supabase.from('player_profiles').delete().eq('person_id',personId)); if(profileError)throw profileError;
      await load();
      hideDetail();
      notify('Jugador eliminado correctamente.','success');
    }catch(error){notify('No se pudo eliminar el jugador: '+supabaseErrorText(error),'error')}finally{saving=false}
  };

  els.newButton.addEventListener('click',openModal);els.close.addEventListener('click',closeModal);els.cancel.addEventListener('click',closeModal);
  els.modal.addEventListener('click',e=>{if(e.target===els.modal)closeModal()});
  els.form.addEventListener('submit',save);els.season.addEventListener('change',()=>populateTeams());
  els.seasonFilter.addEventListener('change',()=>{selectedSeasonId=els.seasonFilter.value;render()});
  els.search.addEventListener('input',()=>{searchTerm=normalize(els.search.value);render()});
  load();
  return ()=>{els.form?.removeEventListener('submit',save)};
}