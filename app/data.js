import { supabase } from '../js/core/supabase.js';
import { getCurrentUserContext } from '../js/core/auth.js';
import { hasRole, ROLES } from '../js/core/permissions.js';

export async function requireContext() { const context=await getCurrentUserContext(); if(!context){window.location.replace('./login.html');throw new Error('Sesión no iniciada')} if(context.profile?.is_active===false){window.location.replace('./login.html');throw new Error('Usuario desactivado')} return context; }
export async function query(table,columns='*',builder=null){let request=supabase.from(table).select(columns);if(builder)request=builder(request);const{data,error}=await request;if(error)throw error;return data||[]}
export async function insert(table,values){const{data,error}=await supabase.from(table).insert(values).select().single();if(error)throw error;return data}
export async function update(table,id,values){return updateBy(table,'id',id,values)}
export async function updateBy(table,column,value,values){const{data,error}=await supabase.from(table).update(values).eq(column,value).select().single();if(error)throw error;return data}
export async function remove(table,id){const{error}=await supabase.from(table).delete().eq('id',id);if(error)throw error}
export function escapeHtml(value){return String(value??'').replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}
export function formatDate(value){if(!value)return'—';return new Intl.DateTimeFormat('es-ES').format(new Date(value))}
export function formatDateTimeLocal(value){if(!value)return'';const date=new Date(value),offset=date.getTimezoneOffset();return new Date(date.getTime()-offset*60000).toISOString().slice(0,16)}
export function setHeader(context,title){document.querySelector('#page-title')?.replaceChildren(document.createTextNode(title));const userNode=document.querySelector('#user-name');if(userNode)userNode.textContent=context.profile?.display_name||context.user.email;const rolesNode=document.querySelector('#user-roles');if(rolesNode)rolesNode.textContent=context.roles.join(' · ')||'Sin rol asignado'}
export function enableLogout(){document.querySelector('#logout')?.addEventListener('click',async()=>{await supabase.auth.signOut();window.location.replace('./login.html')})}
export function canEditAll(context){return hasRole(context,ROLES.COORDINADOR)}
export function canEditSection(context){return canEditAll(context)||hasRole(context,ROLES.RESPONSABLE)}
export function canEditTeam(context){return canEditSection(context)||hasRole(context,ROLES.ENTRENADOR)}
export function showMessage(node,message,type='info'){if(!node)return;node.textContent=message;node.className=`form-message ${type}`}
