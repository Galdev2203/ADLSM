import { analyzeTeam, fetchCompetition } from './results-runtime.js?v=20260922-14';
import { discoverSeasons, discoverSource as discoverCompetitionCatalog } from './competition-discovery.js?v=20260922-14';

const els = Object.fromEntries(['form','source','category','season','view','team','status','summary','classification','matches','metadata','search','openSource','exportCsv','matchesTitle','matchesSubtitle','classificationTitle','classificationSubtitle'].map(id => [id, document.querySelector(`#${id === 'form' ? 'resultsForm' : id === 'source' ? 'resultsSource' : id === 'category' ? 'resultsCategory' : id === 'season' ? 'resultsSeason' : id === 'view' ? 'resultsView' : id === 'team' ? 'resultsTeam' : id === 'status' ? 'resultsStatus' : id === 'summary' ? 'resultsSummary' : id === 'classification' ? 'resultsClassification' : id === 'matches' ? 'resultsMatches' : id === 'metadata' ? 'resultsMetadata' : id === 'search' ? 'resultsSearch' : id === 'openSource' ? 'openSource' : id === 'exportCsv' ? 'exportCsv' : id === 'matchesTitle' ? 'resultsMatchesTitle' : id === 'matchesSubtitle' ? 'resultsMatchesSubtitle' : id === 'classificationTitle' ? 'resultsClassificationTitle' : 'resultsClassificationSubtitle'}`})));

let dataset = null;
let catalog = null;
let loading = false;

const text = v => String(v ?? '');
const escapeHtml = v => text(v).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
const normalizeKey = v => text(v).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase('es').replace(/\s+/g,' ').trim();
const formatNumber = v => Number(v || 0).toLocaleString('es-ES',{maximumFractionDigits:1});
const setStatus = (msg, kind='info') => { els.status.textContent = msg; els.status.className = `results-status ${kind}`; };

function setOptions(select, options, placeholder) {
  select.innerHTML = `<option value="">${escapeHtml(placeholder)}</option>`;
  for (const option of options || []) { const node=document.createElement('option'); node.value=option.url; node.textContent=option.label; select.appendChild(node); }
  select.disabled = !(options?.length);
}
function setTeams(rows) {
  const previous=els.team.value;
  const names=(rows||[]).map(r=>r.team||r.name).filter(Boolean);
  els.team.innerHTML='<option value="">Todos los equipos</option>';
  for(const name of names){const o=document.createElement('option');o.value=name;o.textContent=name;els.team.appendChild(o);}
  els.team.disabled=!names.length;
  if(names.includes(previous)) els.team.value=previous;
}
function selectedTeam(){return els.team.value.trim();}
function teamMatches(team=selectedTeam()){
  if(!dataset) return [];
  const q=normalizeKey(team); if(!q) return dataset.matches;
  return dataset.matches.filter(m=>normalizeKey(m.home)===q||normalizeKey(m.away)===q);
}
function filteredMatches(){
  const q=text(els.search.value).trim().toLocaleLowerCase('es');
  const base=els.view.value==='team'?teamMatches():dataset?.matches||[];
  return base.filter(m=>!q||`${m.home} ${m.away} ${m.jornada}`.toLocaleLowerCase('es').includes(q));
}
function renderSummary(){
  if(!dataset)return;
  const team=selectedTeam();
  if(team){const s=analyzeTeam({...dataset,matches:teamMatches(team)},team);const cards=[['Equipo',team],['Partidos',s.matches],['Jugados',s.played],['Pendientes',s.scheduled],['Victorias',s.wins],['Derrotas',s.losses],['PF / PC',`${formatNumber(s.pointsFor)} / ${formatNumber(s.pointsAgainst)}`],['% victorias',`${formatNumber(s.winRate)}%`]];els.summary.innerHTML=cards.map(([a,b])=>`<article class="stat-card"><span>${escapeHtml(a)}</span><strong>${escapeHtml(b)}</strong></article>`).join('');return;}
  const played=(dataset.matches||[]).filter(m=>m.played);const total=played.reduce((s,m)=>s+m.homeScore+m.awayScore,0);const cards=[['Equipos',dataset.classification.length||dataset.teams.length],['Partidos',dataset.matches.length],['Jugados',played.length],['Pendientes',dataset.matches.length-played.length],['Puntos anotados',formatNumber(total)],['Media puntos / partido',played.length?formatNumber(total/played.length):'0'],['Clasificación',dataset.classification.length?'Disponible':'No disponible'],['Fuente',dataset.sourceId==='zaragoza'?'Zaragoza':'Aragón · FEB/FAB']];els.summary.innerHTML=cards.map(([a,b])=>`<article class="stat-card"><span>${escapeHtml(a)}</span><strong>${escapeHtml(b)}</strong></article>`).join('');
}
function renderClassification(){
  const rows=dataset?.classification||[];
  if(!rows.length){els.classification.innerHTML='<div class="results-empty-small">La fuente consultada no muestra una clasificación.</div>';return;}
  els.classification.innerHTML=`<div class="results-table-wrap"><table class="results-table clickable-table"><thead><tr><th>#</th><th>Equipo</th><th>PJ</th><th>PG</th><th>PP</th><th>PF</th><th>PC</th><th>Pts.</th><th>R.</th></tr></thead><tbody>${rows.map(r=>`<tr data-team="${escapeHtml(r.team)}"><td>${r.position}</td><td><strong>${escapeHtml(r.team)}</strong></td><td>${r.played}</td><td>${r.wins}</td><td>${r.losses}</td><td>${r.pointsFor}</td><td>${r.pointsAgainst}</td><td>${r.points}</td><td>${escapeHtml(r.form)}</td></tr>`).join('')}</tbody></table></div>`;
  els.classification.querySelectorAll('tbody tr').forEach(row=>row.addEventListener('click',()=>{els.team.value=row.dataset.team;render();}));
}
function crossScore(a,b){const ak=normalizeKey(a),bk=normalizeKey(b);return dataset.matches.filter(m=>{const h=normalizeKey(m.home),v=normalizeKey(m.away);return(h===ak&&v===bk)||(h===bk&&v===ak);}).filter(m=>m.played).sort((x,y)=>String(x.date).localeCompare(String(y.date))).map(m=>normalizeKey(m.home)===ak?`${m.homeScore}-${m.awayScore}`:`${m.awayScore}-${m.homeScore}`).join(' / ');}
function renderCross(){
  const teams=(dataset?.classification||[]).map(r=>r.team);if(!teams.length){els.classification.innerHTML='<div class="results-empty-small">No se ha podido construir la tabla cruzada.</div>';return;}
  const selected=normalizeKey(selectedTeam());
  const head=teams.map(t=>`<th class="cross-col ${selected===normalizeKey(t)?'selected-team':''}">${escapeHtml(t)}</th>`).join('');
  const body=teams.map(a=>`<tr class="${selected===normalizeKey(a)?'selected-team':''}"><th class="cross-row">${escapeHtml(a)}</th>${teams.map(b=>{const same=normalizeKey(a)===normalizeKey(b);return `<td class="${selected===normalizeKey(a)||selected===normalizeKey(b)?'selected-team':''}">${same?'—':escapeHtml(crossScore(a,b))}</td>`;}).join('')}</tr>`).join('');
  els.classification.innerHTML=`<div class="cross-results-wrap"><table class="cross-results-table"><thead><tr><th class="cross-corner">L / V</th>${head}</tr></thead><tbody>${body}</tbody></table></div><p class="cross-results-note">Cada celda muestra el resultado desde la perspectiva del equipo de la fila.</p>`;
}
function renderMatches(){
  const team=selectedTeam();const rows=filteredMatches();if(!rows.length){els.matches.innerHTML='<div class="results-empty-small">No hay partidos que coincidan con el filtro.</div>';return;}
  els.matches.innerHTML=rows.map(m=>{const own=team&&(normalizeKey(m.home)===normalizeKey(team)||normalizeKey(m.away)===normalizeKey(team));const score=m.played?`<strong>${m.homeScore} - ${m.awayScore}</strong>`:'<span class="pending-score">Pendiente</span>';return `<article class="result-match ${own?'team-match':''}"><div class="result-match-main"><div class="result-match-teams"><span class="${team&&normalizeKey(m.home)===normalizeKey(team)?'own-team':''}">${escapeHtml(m.home)}</span><b>VS</b><span class="${team&&normalizeKey(m.away)===normalizeKey(team)?'own-team':''}">${escapeHtml(m.away)}</span></div><div class="result-match-score">${score}</div></div><div class="result-match-meta"><span>Jornada ${escapeHtml(m.jornada||'—')}</span><span>${escapeHtml(m.date||'—')}</span><span>${escapeHtml(m.time||'—')}</span></div></article>`;}).join('');
}
function render(){
  if(!dataset)return;const team=selectedTeam(),view=els.view.value;els.metadata.innerHTML=`<div><span>Temporada</span><strong>${escapeHtml(dataset.season||els.season.selectedOptions[0]?.textContent||'—')}</strong></div><div><span>Categoría</span><strong>${escapeHtml(dataset.category||els.category.selectedOptions[0]?.textContent||'—')}</strong></div><div><span>Equipo</span><strong>${escapeHtml(team||'Todos')}</strong></div><div><span>Análisis</span><strong>${escapeHtml(view==='team'?'Partidos del equipo':view==='cross'?'Resultados cruzados':'Clasificación · todos los equipos')}</strong></div>`;renderSummary();
  els.matchesTitle.textContent=view==='team'&&team?`Partidos de ${team}`:'Partidos de la competición';els.matchesSubtitle.textContent=view==='team'?'Todos los partidos detectados de la temporada.':'Calendario completo utilizado para el análisis.';renderMatches();
  els.classificationTitle.textContent=view==='cross'?'Resultados cruzados':'Clasificación';els.classificationSubtitle.textContent=view==='cross'?'Matriz de resultados de todos los equipos de la competición.':'Clasificación completa de la competición.';view==='cross'?renderCross():renderClassification();els.exportCsv.disabled=!dataset.matches.length;els.openSource.href=dataset.url;
}
async function loadCompetition(url){
  if(!url||loading)return;loading=true;setStatus('Cargando clasificación y calendario completo…','loading');
  try{const [a,b]=await Promise.all([fetchCompetition(url,'results'),fetchCompetition(url,'calendar')]);dataset={...a,sourceId:els.source.value,matches:b.matches.length?b.matches:a.matches,classification:a.classification.length?a.classification:b.classification,teams:a.teams.length?a.teams:b.teams};setTeams(dataset.classification.length?dataset.classification:dataset.teams.map(t=>({team:t.name})));render();setStatus(`Competición cargada: ${dataset.classification.length} equipos y ${dataset.matches.length} partidos detectados.`,'success');}
  catch(e){dataset=null;setTeams([]);els.summary.replaceChildren();els.classification.replaceChildren();els.matches.replaceChildren();els.metadata.replaceChildren();setStatus(e instanceof Error?e.message:'No se ha podido cargar la competición.','error');}
  finally{loading=false;}
}
async function loadSeasons(url){
  if(!url)return;setStatus('Cargando temporadas de la categoría…','loading');
  try{const data=await discoverSeasons(url);setOptions(els.season,data.options,'Selecciona una temporada');if(data.selected)els.season.value=data.selected;if(els.season.value)await loadCompetition(els.season.value);else setStatus('Categoría cargada. Selecciona una temporada.','info');}
  catch(e){setOptions(els.season,[],'Temporadas no disponibles');setStatus(e instanceof Error?e.message:'No se han podido cargar las temporadas.','error');}
}
async function discoverSource(source){
  setStatus('Cargando categorías de FEB/FAB…','loading');els.category.disabled=true;els.season.disabled=true;els.team.disabled=true;
  try{catalog=await discoverCompetitionCatalog(source);setOptions(els.category,catalog.categoryOptions,'Selecciona una categoría');if(catalog.defaultCategory)els.category.value=catalog.defaultCategory;if(els.category.value)await loadSeasons(els.category.value);else setStatus('Selecciona una categoría.','info');}
  catch(e){catalog=null;setOptions(els.category,[],'Categorías no disponibles');setOptions(els.season,[],'Temporadas no disponibles');setTeams([]);setStatus(e instanceof Error?e.message:'No se han podido cargar las categorías.','error');}
}

els.source.addEventListener('change',()=>discoverSource(els.source.value));
els.category.addEventListener('change',()=>loadSeasons(els.category.value));
els.season.addEventListener('change',()=>{if(els.season.value)loadCompetition(els.season.value);});
els.team.addEventListener('change',()=>dataset&&render());
els.view.addEventListener('change',()=>dataset&&render());
els.search.addEventListener('input',()=>dataset&&render());
els.form.addEventListener('submit',e=>{e.preventDefault();if(!els.season.value){setStatus('Selecciona una temporada antes de consultar.','error');return;}loadCompetition(els.season.value);});
els.exportCsv.addEventListener('click',()=>{if(!dataset?.matches?.length)return;const rows=[['Jornada','Local','Visitante','Resultado','Fecha','Hora'],...dataset.matches.map(m=>[m.jornada,m.home,m.away,m.played?`${m.homeScore}-${m.awayScore}`:'',m.date,m.time])];const csv=rows.map(r=>r.map(v=>`"${String(v??'').replace(/"/g,'""')}"`).join(';')).join('\n');const blob=new Blob([`\ufeff${csv}`],{type:'text/csv;charset=utf-8;'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download='adlsm-resultados.csv';a.click();URL.revokeObjectURL(a.href);});

discoverSource(els.source.value);
