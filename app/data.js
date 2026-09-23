import { supabase } from '../js/core/supabase.js';
import { getCurrentUserContext } from '../js/core/auth.js';

export async function requireContext() {
  const context = await getCurrentUserContext();
  if (!context) {
    window.location.replace('./login.html');
    throw new Error('Sesión no iniciada');
  }
  return context;
}

export async function query(table, columns = '*') {
  const { data, error } = await supabase.from(table).select(columns);
  if (error) throw error;
  return data || [];
}

export function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

export function formatDate(value) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('es-ES').format(new Date(value));
}

export function setHeader(context, title) {
  document.querySelector('#page-title').textContent = title;
  document.querySelector('#user-name').textContent = context.profile?.display_name || context.user.email;
  document.querySelector('#user-roles').textContent = context.roles.join(' · ') || 'Sin rol asignado';
}

export function enableLogout() {
  document.querySelector('#logout').addEventListener('click', async () => {
    await supabase.auth.signOut();
    window.location.replace('./login.html');
  });
}
