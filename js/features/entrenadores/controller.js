import { supabase } from '../../core/supabase.js';
import { notify } from '../../core/notifications.js';
import { confirmDialog } from '../../core/dialogs.js';

const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const normalize=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const seasonLabel=s=>s?`${s.start_year}/${String(s.end_year).slice(-2)}`:'—';
const initials=p=>[p?.first_name,p?.last_name].map(normalize).filter(Boolean).map(x=>x[0].toUpperCase()).join('').slice(0,2)||'E';
const errorText=e=>[e?.message,e?.details,e?.hint].filter(Boolean).join(' · ')||'Error desconocido';
const timeout=async(promise,ms=15000)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La operación está tardando demasiado. Comprueba la conexión e inténtalo de nuevo.')),ms)})])}finally{clearTimeout(timer)}};

let seasons=[],teamSeasons=[],teamSeasonById=new Map(),people=[],profiles=[],assignments=[];
let selectedSeasonId='',searchTerm='',saving=false,editingCoachId=null,editingAssignmentId=null;

export function initEntrenadores(){
  const els={
    toolbar:document.querySelector('#coachesToolbar'),list:document.querySelector('#coachList'),detail:document.querySelector('#coachDetail'),
    total:document.querySelector('#coachTotal'),active:document.querySelector('#coachActive'),teamCount:document.querySelector('#coachTeamCount'),
    seasonFilter:document.querySelector('#coachSeasonFilter'),search:document.querySelector('#coachSearch'),modal:document.querySelector('#coachModal'),
    form:document.querySelector('#coachForm'),close:document.querySelector('#closeCoachModal'),cancel:document.querySelector('#cancelCoach'),
    newButton:document.querySelector('#newCoachButton'),save:document.querySelector('#saveCoach'),modalTitle:document.querySelector('#coachModalTitle'),
    firstName:document.querySelector('#coachFirstName'),lastName:document.querySelector('#coachLastName'),birthDate:document.querySelector('#coachBirthDate'),
    phone:document.querySelector('#coachPhone'),email:document.querySelector('#coachEmail'),license:document.querySelector('#coachLicense'),
    qualification:document.querySelector('#coachQualification'),notes:document.querySelector('#coachNotes'),season:document.querySelector('#coachSeason'),
    teamSeason:document.querySelector('#coachTeamSeason'),role:document.querySelector('#coachRole'),
  };

  const populateSeasons=()=>{
    const options=seasons.map(s=>`<option value="${s.id}">${esc(seasonLabel(s))} · ${esc(s.name)}</option>`).join('');
    els.seasonFilter.innerHTML='<option value="">Todas</option>'+options;
    els.season.innerHTML='<option value="">Selecciona una temporada</option>'+options;
    els.season.value=selectedSeasonId||seasons.find(s=>s.is_active)?.id||seasons[0]?.id||'';
    populateTeams();
  };
  const populateTeams=async()=>{
    const sid=String(els.season.value||'');
    els.teamSeason.disabled=true;
    els.teamSeason.innerHTML='<option value="">Cargando equipos…</option>';
    if(!sid){els.teamSeason.innerHTML='<option value="">Selecciona una temporada primero</option>';els.teamSeason.disabled=false;return}
    try{
      const {data,error}=await timeout(supabase.from('team_seasons').select('id,season_id,team_id,display_name,gender,competition_name,group_name').eq('season_id',sid).order('display_name',{ascending:true}));
      if(error)throw error;
      els.teamSeason.innerHTML='<option value="">Selecciona un equipo</option>'+((data||[]).map(t=>`<option value="${t.id}">${esc(t.display_name||'Equipo')}</option>`).join(''));
      if(!data?.length)els.teamSeason.innerHTML='<option value="">No hay equipos en esta temporada</option>';
    }catch(e){els.teamSeason.innerHTML='<option value="">No se pudieron cargar los equipos</option>';notify('No se pudieron cargar los equipos: '+errorText(e),'error')}finally{els.teamSeason.disabled=false}
  };

  const rowData=a=>{
    const p=people.find(x=>x.id===a.coach_id),prof=profiles.find(x=>x.person_id===a.coach_id);
    const team=a.embeddedTeamSeason||teamSeasonById.get(String(a.team_season_id))||null;
    return {...a,person:p,profile:prof,team};
  };
  const filtered=()=>assignments.map(rowData).filter(a=>{
    if(selectedSeasonId&&a.team?.season_id!==selectedSeasonId)return false;
    return normalize([a.person?.first_name,a.person?.last_name,a.person?.email,a.profile?.federation_license,a.profile?.qualification,a.team?.display_name,a.role].join(' ')).includes(searchTerm);
  });
  const render=()=>{
    const rows=filtered();
    els.total.textContent=new Set(rows.map(r=>r.coach_id)).size;
    els.active.textContent=new Set(rows.filter(r=>r.person?.is_active!==false).map(r=>r.coach_id)).size;
    els.teamCount.textContent=new Set(rows.map(r=>r.team_season_id).filter(Boolean)).size;
    if(!rows.length){els.list.innerHTML=`<div class="coach-empty"><h3>${assignments.length?'No hay entrenadores que coincidan':'Todavía no hay entrenadores'}</h3><p>${assignments.length?'Prueba con otra temporada o búsqueda.':'Crea el primer entrenador para empezar a gestionar los cuerpos técnicos.'}</p><button class="coaches-primary" id="emptyNewCoach" type="button">Crear entrenador</button></div>`;document.querySelector('#emptyNewCoach')?.addEventListener('click',openModal);return}
    els.list.innerHTML=rows.map(r=>{
      const name=[r.person?.first_name,r.person?.last_name].filter(Boolean).join(' ')||'Entrenador';
      const avatar=r.person?.photo_url?`<img class="coach-avatar coach-avatar-image" src="${esc(r.person.photo_url)}" alt="" loading="lazy">`:`<div class="coach-avatar">${esc(initials(r.person))}</div>`;
      const role=({principal:'Primer entrenador',second:'Segundo entrenador',assistant:'Ayudante'})[r.role]||'Ayudante';
      return `<article class="coach-card"><div class="coach-card-main">${avatar}<div class="coach-card-info"><div class="coach-title-row"><h3>${esc(name)}</h3><span class="coach-status ${r.person?.is_active!==false?'active':''}">${r.person?.is_active!==false?'ACTIVO':'INACTIVO'}</span></div><p class="coach-card-team">${esc(r.team?.display_name||r.team?.team?.name||'Sin equipo')}</p><div class="coach-card-meta"><span>${esc(seasonLabel(r.team?.season))}</span><span>${esc(role)}</span>${r.profile?.qualification?`<span>${esc(r.profile.qualification)}</span>`:''}</div></div></div><div class="coach-card-actions"><button class="coach-action" data-coach="${r.coach_id}" data-assignment="${r.id}" type="button">Ver entrenador</button><button class="coach-action coach-action-light" data-edit-coach="${r.coach_id}" data-assignment="${r.id}" type="button">Editar</button></div></article>`
    }).join('');
    els.list.querySelectorAll('[data-coach]').forEach(b=>b.addEventListener('click',()=>showDetail(b.dataset.coach,b.dataset.assignment)));
    els.list.querySelectorAll('[data-edit-coach]').forEach(b=>b.addEventListener('click',()=>openEditModal(b.dataset.editCoach,b.dataset.assignment)));
  };

  const openModal=async()=>{
    editingCoachId=null;editingAssignmentId=null;els.form.reset();els.modalTitle.textContent='Nuevo entrenador';els.save.textContent='Crear entrenador';
    els.season.value=selectedSeasonId||seasons.find(s=>s.is_active)?.id||seasons[0]?.id||'';els.modal.hidden=false;await populateTeams();requestAnimationFrame(()=>els.firstName.focus());
  };
  const openEditModal=async(personId,assignmentId)=>{
    const p=people.find(x=>x.id===personId),prof=profiles.find(x=>x.person_id===personId),a=assignments.find(x=>x.id===assignmentId)||assignments.find(x=>x.coach_id===personId);
    if(!p||!prof||!a){notify('No se encontró el entrenador que quieres editar.','error');return}
    editingCoachId=personId;editingAssignmentId=a.id;els.modalTitle.textContent='Editar entrenador';els.save.textContent='Guardar cambios';
    els.firstName.value=p.first_name||'';els.lastName.value=p.last_name||'';els.birthDate.value=p.birth_date||'';els.phone.value=p.phone||'';els.email.value=p.email||'';
    els.license.value=prof.federation_license||'';els.qualification.value=prof.qualification||'';els.notes.value=prof.notes||a.notes||'';
    const team=teamSeasonById.get(String(a.team_season_id))||a.embeddedTeamSeason||null;els.season.value=team?.season_id||seasons.find(s=>s.is_active)?.id||seasons[0]?.id||'';
    els.role.value=a.role||'assistant';els.modal.hidden=false;await populateTeams();els.teamSeason.value=a.team_season_id||'';requestAnimationFrame(()=>els.firstName.focus());
  };
  const closeModal=()=>{els.modal.hidden=true;els.form.reset();editingCoachId=null;editingAssignmentId=null};
  const showDetail=(personId,assignmentId)=>{
    const p=people.find(x=>x.id===personId),prof=profiles.find(x=>x.person_id===personId);
    const history=assignments.filter(a=>a.coach_id===personId).map(rowData).sort((a,b)=>Number(b.team?.season?.start_year||0)-Number(a.team?.season?.start_year||0));
    if(!p||!prof)return;
    const current=history.find(x=>x.id===assignmentId)||history[0];
    const team=current?.team?.display_name||current?.team?.team?.name||'Sin equipo';
    const avatar=p.photo_url?`<img class="coach-avatar coach-avatar-image" src="${esc(p.photo_url)}" alt="">`:`<div class="coach-avatar">${esc(initials(p))}</div>`;
    els.toolbar.hidden=true;els.list.hidden=true;els.detail.hidden=false;
    els.detail.innerHTML=`<button class="coach-back" id="backCoaches">← Volver a entrenadores</button><div class="coach-detail-title">${avatar}<div class="coach-detail-heading"><span class="coaches-kicker">ENTRENADOR</span><h2>${esc([p.first_name,p.last_name].filter(Boolean).join(' '))}</h2><p>${esc(team)} · ${esc(seasonLabel(current?.team?.season))}</p></div><span class="coach-status ${p.is_active!==false?'active':''}">${p.is_active!==false?'ACTIVO':'INACTIVO'}</span><div class="coach-detail-actions"><button class="coach-secondary" id="editCoachDetail" type="button">Editar entrenador</button><button class="coach-delete" id="deleteCoachDetail" type="button">Eliminar entrenador</button></div></div><div class="coach-detail-grid"><article class="coach-detail-card"><h3>Datos personales</h3><dl><div><dt>Fecha de nacimiento</dt><dd>${esc(p.birth_date||'—')}</dd></div><div><dt>Teléfono</dt><dd>${esc(p.phone||'—')}</dd></div><div><dt>Email</dt><dd>${esc(p.email||'—')}</dd></div></dl></article><article class="coach-detail-card"><h3>Perfil profesional</h3><dl><div><dt>Licencia</dt><dd>${esc(prof.federation_license||'—')}</dd></div><div><dt>Cualificación</dt><dd>${esc(prof.qualification||'—')}</dd></div></dl></article><article class="coach-detail-card coach-detail-card-wide"><h3>Equipos</h3><div class="coach-history">${history.length?history.map(r=>`<div class="coach-history-row"><button type="button" class="coach-team-link" data-open-team="${esc(r.team_season_id)}">${esc(r.team?.display_name||r.team?.team?.name||'Equipo')}</button><span>${esc(seasonLabel(r.team?.season))} · ${esc(({principal:'Primer entrenador',second:'Segundo entrenador',assistant:'Ayudante'})[r.role]||'Ayudante')}</span></div>`).join(''):'<span>No hay equipos.</span>'}</div></article></div>`;
    els.detail.querySelectorAll('[data-open-team]').forEach(button=>button.addEventListener('click',()=>window.dispatchEvent(new CustomEvent('adlsm:navigate-detail',{detail:{section:'equipos',teamSeasonId:button.dataset.openTeam}}))));document.querySelector('#backCoaches').onclick=hideDetail;document.querySelector('#editCoachDetail').onclick=()=>openEditModal(personId,current?.id);document.querySelector('#deleteCoachDetail').onclick=()=>deleteCoach(personId);
  };
  const hideDetail=()=>{els.detail.hidden=true;els.toolbar.hidden=false;els.list.hidden=false;render()};

  const load=async()=>{
    els.list.innerHTML='<div class="coach-loading">Cargando entrenadores…</div>';
    const [s,p,pr,t,ts]=await Promise.all([
      supabase.from('seasons').select('id,name,start_year,end_year,is_active').order('start_year',{ascending:false}),
      supabase.from('people').select('id,first_name,last_name,phone,email,birth_date,photo_url,notes,is_active').order('last_name'),
      supabase.from('coach_profiles').select('person_id,federation_license,qualification,notes,created_at'),
      supabase.from('teams').select('id,name,gender,category,is_active'),
      supabase.from('team_seasons').select('id,season_id,team_id,display_name,gender,competition_name,group_name')
    ]);
    const tc=await supabase.from('team_coaches').select(`
      id,team_season_id,coach_id,role,is_primary,joined_at,left_at,notes,created_at,
      teamSeason:team_seasons(id,season_id,team_id,display_name,gender,competition_name,group_name,
        team:teams(id,name,gender,category,is_active),
        season:seasons(id,name,start_year,end_year,is_active)
      )
    `).order('created_at',{ascending:false});
    const err=[s,p,pr,t,ts,tc].find(x=>x.error)?.error;
    if(err){els.list.innerHTML=`<div class="coach-empty"><h3>No se pudieron cargar los entrenadores</h3><p>${esc(errorText(err))}</p></div>`;return}
    seasons=s.data||[];people=p.data||[];profiles=pr.data||[];
    const teamMap=new Map((ts.data||[]).map(x=>[x.id,{...x,season:seasons.find(s=>s.id===x.season_id),team:(t.data||[]).find(y=>y.id===x.team_id)}]));
    teamSeasons=[...teamMap.values()];teamSeasonById=new Map(teamSeasons.map(x=>[String(x.id),x]));
    assignments=(tc.data||[]).map(row=>({...row,embeddedTeamSeason:row.teamSeason||null}));
    populateSeasons();render();
  };

  const save=async e=>{
    e.preventDefault();if(saving)return;
    const first=els.firstName.value.trim(),last=els.lastName.value.trim(),email=els.email.value.trim()||null,phone=els.phone.value.trim()||null,teamSeasonId=els.teamSeason.value;
    if(!first||!last||!teamSeasonId){notify('Completa nombre, apellidos y equipo.','warning');return}
    saving=true;els.save.disabled=true;els.save.textContent=editingCoachId?'Guardando…':'Creando…';
    let createdPersonId=null,createdProfile=false;
    try{
      const profileData={federation_license:els.license.value.trim()||null,qualification:els.qualification.value.trim()||null,notes:els.notes.value.trim()||null};
      if(editingCoachId){
        let result=await timeout(supabase.from('people').update({first_name:first,last_name:last,phone,email,birth_date:els.birthDate.value||null,updated_at:new Date().toISOString()}).eq('id',editingCoachId));if(result.error)throw result.error;
        result=await timeout(supabase.from('coach_profiles').update(profileData).eq('person_id',editingCoachId));if(result.error)throw result.error;
        result=await timeout(supabase.from('team_coaches').update({team_season_id:teamSeasonId,role:els.role.value,is_primary:els.role.value==='principal',notes:els.notes.value.trim()||null}).eq('id',editingAssignmentId));if(result.error)throw result.error;
        closeModal();await load();notify('Entrenador actualizado correctamente.','success');return;
      }
      let person=null;
      if(email)person=people.find(p=>normalize(p.email)===normalize(email));
      if(!person&&phone)person=people.find(p=>normalize(p.phone)===normalize(phone));
      const sameName=people.filter(p=>normalize(p.first_name)===normalize(first)&&normalize(p.last_name)===normalize(last));
      if(!person&&sameName.length===1)person=sameName[0];
      if(!person&&sameName.length>1&&!email&&!phone)throw new Error('Ya existen varias personas con ese nombre. Añade un email o teléfono para identificarla sin crear un duplicado.');
      if(!person){
        const {data,error}=await timeout(supabase.from('people').insert({first_name:first,last_name:last,phone,email,birth_date:els.birthDate.value||null}).select('id').single());
        if(error)throw error;person={id:data.id};createdPersonId=data.id;
      }
      const {data:existing,error:lookupError}=await timeout(supabase.from('coach_profiles').select('person_id').eq('person_id',person.id).maybeSingle());if(lookupError)throw lookupError;
      if(existing)throw new Error('Esta persona ya está registrada como entrenador.');
      let result=await timeout(supabase.from('coach_profiles').insert({...profileData,person_id:person.id}));if(result.error)throw result.error;createdProfile=true;
      result=await timeout(supabase.from('team_coaches').insert({team_season_id:teamSeasonId,coach_id:person.id,role:els.role.value,is_primary:els.role.value==='principal',notes:els.notes.value.trim()||null}));if(result.error)throw result.error;
      closeModal();await load();notify('Entrenador creado correctamente.','success');
    }catch(e){
      if(createdProfile&&createdPersonId)await supabase.from('coach_profiles').delete().eq('person_id',createdPersonId);
      if(createdPersonId)await supabase.from('people').delete().eq('id',createdPersonId);
      notify('No se pudo guardar el entrenador: '+errorText(e),'error');
    }finally{saving=false;els.save.disabled=false;els.save.textContent=editingCoachId?'Guardar cambios':'Crear entrenador'}
  };

  const deleteCoach=async personId=>{
    const p=people.find(x=>x.id===personId);if(!p)return;
    const name=[p.first_name,p.last_name].filter(Boolean).join(' ')||'este entrenador';
    const confirmed=await confirmDialog({title:'Eliminar entrenador',message:`¿Quieres eliminar a ${name}? Se eliminarán sus asignaciones de equipos y su perfil de entrenador. La persona se conservará para poder reutilizarla en el futuro.`,confirmText:'Eliminar entrenador',cancelText:'Cancelar',danger:true});
    if(!confirmed||saving)return;saving=true;
    try{
      let result=await timeout(supabase.from('team_coaches').delete().eq('coach_id',personId));if(result.error)throw result.error;
      result=await timeout(supabase.from('coach_profiles').delete().eq('person_id',personId));if(result.error)throw result.error;
      await load();hideDetail();notify('Entrenador eliminado correctamente.','success');
    }catch(e){notify('No se pudo eliminar el entrenador: '+errorText(e),'error')}finally{saving=false}
  };

  els.newButton.addEventListener('click',openModal);els.close.addEventListener('click',closeModal);els.cancel.addEventListener('click',closeModal);
  els.modal.addEventListener('click',e=>{if(e.target===els.modal)closeModal()});els.form.addEventListener('submit',save);els.season.addEventListener('change',populateTeams);
  els.seasonFilter.addEventListener('change',()=>{selectedSeasonId=els.seasonFilter.value;render()});els.search.addEventListener('input',()=>{searchTerm=normalize(els.search.value);render()});
  window.addEventListener('adlsm:open-coach-detail', async event => { const {personId,assignmentId}=event.detail||{}; if(personId){ await load(); showDetail(personId,assignmentId); } });
  load();return()=>{els.form?.removeEventListener('submit',save)};
}