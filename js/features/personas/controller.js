import { supabase } from '../../core/supabase.js';
import { notify } from '../../core/notifications.js';
import { confirmDialog } from '../../core/dialogs.js';
import { createListView } from '../../core/list-view.js';

const esc=v=>String(v??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const normalize=v=>String(v??'').trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'');
const initials=p=>[p?.first_name,p?.last_name].map(normalize).filter(Boolean).map(x=>x[0].toUpperCase()).join('').slice(0,2)||'P';
const errorText=e=>[e?.message,e?.details,e?.hint].filter(Boolean).join(' · ')||'Error desconocido';
const timeout=async(promise,ms=15000)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('La operación está tardando demasiado. Comprueba la conexión e inténtalo de nuevo.')),ms)})])}finally{clearTimeout(timer)}};

let people=[],playerProfiles=[],coachProfiles=[],responsibilities=[],coordinators=[];
let searchTerm='',functionFilter='',statusFilter='',editingPersonId=null,saving=false;

const functionsFor=personId=>{
  const out=[];
  if(playerProfiles.some(x=>x.person_id===personId))out.push({key:'player',label:'Jugador'});
  if(coachProfiles.some(x=>x.person_id===personId))out.push({key:'coach',label:'Entrenador'});
  if(responsibilities.some(x=>x.person_id===personId&&x.is_active!==false))out.push({key:'responsible',label:'Responsable'});
  if(coordinators.some(x=>x.person_id===personId&&x.is_active!==false))out.push({key:'coordinator',label:'Coordinador'});
  return out;
};

export function initPersonas(){
  const els={
    list:document.querySelector('#peopleList'),count:document.querySelector('#peopleCount'),active:document.querySelector('#peopleActive'),
    search:document.querySelector('#peopleSearch'),functionFilter:document.querySelector('#peopleFunctionFilter'),statusFilter:document.querySelector('#peopleStatusFilter'),pagination:document.querySelector('#peoplePagination'),cardsView:document.querySelector('#peopleCardsView'),tableView:document.querySelector('#peopleTableView'),
    newPerson:document.querySelector('#newPerson'),detail:document.querySelector('#personDetail'),modal:document.querySelector('#personModal'),
    modalTitle:document.querySelector('#personModalTitle'),closeModal:document.querySelector('#closePersonModal'),cancel:document.querySelector('#cancelPerson'),
    form:document.querySelector('#personForm'),firstName:document.querySelector('#personFirstName'),lastName:document.querySelector('#personLastName'),
    birthDate:document.querySelector('#personBirthDate'),phone:document.querySelector('#personPhone'),email:document.querySelector('#personEmail'),
    photoUrl:document.querySelector('#personPhotoUrl'),notes:document.querySelector('#personNotes'),save:document.querySelector('#savePerson')
  };

  if (els.modal && els.modal.parentElement !== document.body) document.body.appendChild(els.modal);

  const load=async()=>{
    const [p,pp,cp,r,c]=await Promise.all([
      timeout(supabase.from('people').select('id,first_name,last_name,phone,email,birth_date,photo_url,notes,is_active,created_at,updated_at').order('last_name',{ascending:true})),
      timeout(supabase.from('player_profiles').select('person_id')),
      timeout(supabase.from('coach_profiles').select('person_id')),
      timeout(supabase.from('responsibilities').select('person_id,is_active,section,start_date,end_date,notes')),
      timeout(supabase.from('coordinator_assignments').select('person_id,is_active,start_date,end_date,notes'))
    ]);
    for(const x of [p,pp,cp,r,c])if(x.error)throw x.error;
    people=p.data||[];playerProfiles=pp.data||[];coachProfiles=cp.data||[];responsibilities=r.data||[];coordinators=c.data||[];
    render();
  };

  const filtered=()=>{
    const q=normalize(searchTerm);
    return people.filter(p=>{
      const funcs=functionsFor(p.id);
      const text=normalize([p.first_name,p.last_name,p.email,p.phone].filter(Boolean).join(' '));
      if(q&&!text.includes(q))return false;
      if(statusFilter==='active'&&p.is_active===false)return false;
      if(statusFilter==='inactive'&&p.is_active!==false)return false;
      if(functionFilter==='none'&&funcs.length)return false;
      if(functionFilter&&functionFilter!=='none'&&!funcs.some(x=>x.key===functionFilter))return false;
      return true;
    });
  };

  let listView=null;

  const renderCards=rows=>rows.map(p=>{
    const funcs=functionsFor(p.id);
    const avatar=p.photo_url?'<img src="'+esc(p.photo_url)+'" alt="" loading="lazy">':'<span>'+esc(initials(p))+'</span>';
    return '<article class="person-card"><div class="person-card-main"><div class="person-avatar">'+avatar+'</div><div class="person-card-info"><div class="person-title-row"><h3>'+esc([p.first_name,p.last_name].filter(Boolean).join(' '))+'</h3><span class="person-status '+(p.is_active!==false?'':'inactive')+'">'+(p.is_active!==false?'ACTIVA':'INACTIVA')+'</span></div><p class="person-contact">'+esc(p.email||p.phone||'Sin datos de contacto')+'</p></div></div><div class="person-functions">'+(funcs.length?funcs.map(f=>'<span class="person-function">'+esc(f.label)+'</span>').join(''):'<span class="person-function">Sin función</span>')+'</div><div class="person-card-actions"><button class="person-action" data-person="'+p.id+'" type="button">Ver persona</button></div></article>';
  }).join('');

  const renderTable=rows=>'<div class="person-table-wrap"><table class="person-table"><thead><tr><th>Persona</th><th>Funciones</th><th>Contacto</th><th>Estado</th><th></th></tr></thead><tbody>'+rows.map(p=>{
    const funcs=functionsFor(p.id);
    return '<tr><td><div class="person-table-person"><span class="person-table-avatar">'+esc(initials(p))+'</span><strong>'+esc([p.first_name,p.last_name].filter(Boolean).join(' '))+'</strong></div></td><td>'+(funcs.length?funcs.map(f=>'<span class="person-function">'+esc(f.label)+'</span>').join(' '):'<span class="person-function">Sin función</span>')+'</td><td>'+esc(p.email||p.phone||'—')+'</td><td><span class="person-status '+(p.is_active!==false?'':'inactive')+'">'+(p.is_active!==false?'ACTIVA':'INACTIVA')+'</span></td><td><button class="person-action" data-person="'+p.id+'" type="button">Ver</button></td></tr>';
  }).join('')+'</tbody></table></div>';

  const render=()=>{
    els.count.textContent=people.length;
    els.active.textContent=people.filter(p=>p.is_active!==false).length;
    const rows=filtered();
    if(!rows.length){
      els.list.className='people-list';
      els.list.innerHTML='<div class="person-empty"><h3>No hay personas</h3><p>Prueba otro filtro o crea una nueva persona.</p></div>';
      els.pagination.hidden=true;
      return;
    }
    listView?.render();
  };

  listView=createListView({
    container:els.list,
    pagination:els.pagination,
    cardsButton:els.cardsView,
    tableButton:els.tableView,
    pageSize:8,
    getRows:filtered,
    renderCards,
    renderTable,
    onRender:()=>{
      els.list.querySelectorAll('[data-person]').forEach(b=>b.onclick=()=>showDetail(b.dataset.person));
    }
  });

  const showDetail=id=>{
    const p=people.find(x=>x.id===id);if(!p)return;
    const funcs=functionsFor(id);
    const resp=responsibilities.filter(x=>x.person_id===id);
    const coord=coordinators.filter(x=>x.person_id===id);
    els.list.hidden=true;
    els.pagination.hidden=true;
    document.querySelector('.personas-toolbar').hidden=true;
    els.detail.hidden=false;
    const avatar=p.photo_url?'<img src="'+esc(p.photo_url)+'" alt="">':'<span>'+esc(initials(p))+'</span>';
    els.detail.innerHTML='<button class="person-detail-back" id="backPeople" type="button">← Volver a personas</button><div class="person-detail-head" style="margin-top:12px"><div class="person-avatar">'+avatar+'</div><div><span class="modal-kicker">PERSONA</span><h2>'+esc([p.first_name,p.last_name].filter(Boolean).join(' '))+'</h2><p>'+esc(p.email||p.phone||'Sin datos de contacto')+'</p></div><span class="person-status '+(p.is_active!==false?'':'inactive')+'">'+(p.is_active!==false?'ACTIVA':'INACTIVA')+'</span><div class="person-detail-actions"><button class="secondary-button" id="editPersonDetail" type="button">Editar</button>'+(p.is_active!==false?'<button class="secondary-button" id="deactivatePerson" type="button">Desactivar</button>':'<button class="primary-button" id="activatePerson" type="button">Activar</button>')+'</div></div><div class="person-detail-grid"><article class="person-detail-card"><h3>Datos personales</h3><dl><div><dt>Fecha de nacimiento</dt><dd>'+esc(p.birth_date||'—')+'</dd></div><div><dt>Teléfono</dt><dd>'+esc(p.phone||'—')+'</dd></div><div><dt>Email</dt><dd>'+esc(p.email||'—')+'</dd></div></dl></article><article class="person-detail-card"><h3>Funciones</h3><div class="person-functions">'+(funcs.length?funcs.map(f=>'<span class="person-function">'+esc(f.label)+'</span>').join(''):'<span class="person-function">Sin función</span>')+'</div></article><article class="person-detail-card wide"><h3>Responsabilidades</h3><div class="person-contact">'+(resp.length?resp.map(x=>esc(x.section)+(x.is_active?' · Activa':' · Inactiva')).join('<br>'):'No tiene responsabilidades registradas.')+'</div><h3 style="margin-top:18px">Coordinación</h3><div class="person-contact">'+(coord.length?'Tiene asignación de coordinación.':'No tiene asignación de coordinación.')+'</div></article><article class="person-detail-card wide"><h3>Notas</h3><div class="person-contact">'+esc(p.notes||'Sin notas.')+'</div></article></div>';
    document.querySelector('#backPeople').onclick=()=>{els.detail.hidden=true;els.list.hidden=false;els.pagination.hidden=false;document.querySelector('.personas-toolbar').hidden=false;render()};
    document.querySelector('#editPersonDetail').onclick=()=>openModal(p);
    const deactivate=document.querySelector('#deactivatePerson');
    const activate=document.querySelector('#activatePerson');
    if(deactivate)deactivate.onclick=()=>setActive(p,false);
    if(activate)activate.onclick=()=>setActive(p,true);
  };

  const setActive=async(p,active)=>{
    if(!active){const ok=await confirmDialog({title:'Desactivar persona',message:'La persona seguirá conservada en ADLSM, pero quedará marcada como inactiva. ¿Continuar?',confirmText:'Desactivar',cancelText:'Cancelar',danger:true});if(!ok)return}
    try{const res=await timeout(supabase.from('people').update({is_active:active,updated_at:new Date().toISOString()}).eq('id',p.id));if(res.error)throw res.error;notify(active?'Persona activada correctamente.':'Persona desactivada correctamente.','success');await load();showDetail(p.id)}catch(e){notify(errorText(e),'error')};
  };

  const openModal=p=>{
    editingPersonId=p?.id||null;els.modalTitle.textContent=p?'Editar persona':'Nueva persona';
    els.firstName.value=p?.first_name||'';els.lastName.value=p?.last_name||'';els.birthDate.value=p?.birth_date||'';els.phone.value=p?.phone||'';els.email.value=p?.email||'';els.photoUrl.value=p?.photo_url||'';els.notes.value=p?.notes||'';
    els.modal.hidden=false;setTimeout(()=>els.firstName.focus(),0);
  };
  const closeModal=()=>{els.modal.hidden=true;editingPersonId=null;els.form.reset()};
  els.newPerson.onclick=()=>openModal();els.closeModal.onclick=closeModal;els.cancel.onclick=closeModal;
  els.modal.addEventListener('click',e=>{if(e.target===els.modal)closeModal()});
  els.search.oninput=e=>{searchTerm=e.target.value;listView?.resetPage()};els.functionFilter.onchange=e=>{functionFilter=e.target.value;listView?.resetPage()};els.statusFilter.onchange=e=>{statusFilter=e.target.value;listView?.resetPage()};
  els.form.onsubmit=async e=>{
    e.preventDefault();if(saving)return;saving=true;els.save.disabled=true;els.save.textContent='Guardando…';
    const payload={first_name:els.firstName.value.trim(),last_name:els.lastName.value.trim(),birth_date:els.birthDate.value||null,phone:els.phone.value.trim()||null,email:els.email.value.trim()||null,photo_url:els.photoUrl.value.trim()||null,notes:els.notes.value.trim()||null,updated_at:new Date().toISOString()};
    try{
      let res;
      if(editingPersonId)res=await timeout(supabase.from('people').update(payload).eq('id',editingPersonId));
      else res=await timeout(supabase.from('people').insert(payload));
      if(res.error)throw res.error;
      closeModal();notify(editingPersonId?'Persona actualizada correctamente.':'Persona creada correctamente.','success');await load();
    }catch(e){notify(errorText(e),'error')}finally{saving=false;els.save.disabled=false;els.save.textContent='Guardar persona'};
  };

  load().catch(e=>{els.list.innerHTML='<div class="person-empty"><h3>No se pudieron cargar las personas</h3><p>'+esc(errorText(e))+'</p></div>';notify(errorText(e),'error')});
  return ()=>{};
}