import { supabase } from '../../core/supabase.js';

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#039;'
}[char]));

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return new Intl.DateTimeFormat('es-ES', {
    dateStyle: 'long',
    timeStyle: 'short'
  }).format(date);
};

const displayName = (user) => {
  const metadata = user?.user_metadata || {};
  return metadata.full_name || metadata.name || metadata.display_name || user?.email || 'Usuario';
};

const initials = (name) => {
  const parts = String(name || 'U').trim().split(/\\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join('') || 'U').toUpperCase();
};

function valueOrDash(value) {
  if (value === null || value === undefined || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'Sí' : 'No';
  return String(value);
}

export async function initPerfil(container, user) {
  const name = displayName(user);
  const metadata = user?.user_metadata || {};

  container.innerHTML = `
    <section class="profile-page">
      <div class="profile-hero">
        <div class="profile-avatar" aria-hidden="true">${esc(initials(name))}</div>
        <div>
          <span class="profile-kicker">MI PERFIL</span>
          <h2>${esc(name)}</h2>
          <p>Información de tu cuenta en ADLSM.</p>
        </div>
      </div>

      <div class="profile-grid">
        <article class="profile-card">
          <div class="profile-card-heading">
            <div>
              <span class="profile-card-kicker">CUENTA</span>
              <h3>Datos de acceso</h3>
            </div>
          </div>
          <div class="profile-fields">
            <div class="profile-field">
              <span>Nombre</span>
              <strong>${esc(name)}</strong>
            </div>
            <div class="profile-field">
              <span>Correo electrónico</span>
              <strong>${esc(user?.email || '—')}</strong>
            </div>
            <div class="profile-field">
              <span>Último acceso</span>
              <strong>${esc(formatDate(user?.last_sign_in_at))}</strong>
            </div>
            <div class="profile-field">
              <span>Cuenta creada</span>
              <strong>${esc(formatDate(user?.created_at))}</strong>
            </div>
          </div>
        </article>

        <article class="profile-card">
          <div class="profile-card-heading">
            <div>
              <span class="profile-card-kicker">ADLSM</span>
              <h3>Información del perfil</h3>
            </div>
            <span class="profile-state" id="profileState">Cargando…</span>
          </div>
          <div class="profile-fields" id="profileFields">
            <div class="profile-loading">Consultando tu perfil…</div>
          </div>
        </article>
      </div>

      <article class="profile-card profile-roles-card">
        <div class="profile-card-heading">
          <div>
            <span class="profile-card-kicker">PERMISOS</span>
            <h3>Roles de usuario</h3>
          </div>
        </div>
        <div class="profile-roles" id="profileRoles">
          <span class="profile-loading">Consultando roles…</span>
        </div>
      </article>

      <article class="profile-card profile-meta-card">
        <div class="profile-card-heading">
          <div>
            <span class="profile-card-kicker">IDENTIFICACIÓN</span>
            <h3>Datos técnicos</h3>
          </div>
        </div>
        <div class="profile-field profile-field-wide">
          <span>ID de usuario</span>
          <strong class="profile-mono">${esc(user?.id || '—')}</strong>
        </div>
        ${metadata.phone ? `
          <div class="profile-field profile-field-wide">
            <span>Teléfono</span>
            <strong>${esc(metadata.phone)}</strong>
          </div>` : ''}
      </article>
    </section>
  `;

  const profileFields = container.querySelector('#profileFields');
  const profileState = container.querySelector('#profileState');
  const profileRoles = container.querySelector('#profileRoles');

  if (!user?.id) {
    profileState.textContent = 'Sin sesión';
    profileFields.innerHTML = '<div class="profile-empty">No se ha podido identificar la cuenta.</div>';
    profileRoles.innerHTML = '<span class="profile-empty">—</span>';
    return;
  }

  const [profileResult, rolesResult] = await Promise.all([
    supabase.from('user_profiles').select('*').eq('user_id', user.id).maybeSingle(),
    supabase.from('user_roles').select('role').eq('user_id', user.id).order('created_at', { ascending: true })
  ]);

  if (profileResult.error) {
    profileState.textContent = 'Cuenta';
    profileFields.innerHTML = `
      <div class="profile-field">
        <span>Estado</span>
        <strong>Cuenta autenticada</strong>
      </div>
      <div class="profile-empty profile-inline-message">
        No se ha podido cargar el perfil de ADLSM.
      </div>`;
  } else {
    const profile = profileResult.data;
    profileState.textContent = profile?.is_active === false ? 'Inactiva' : 'Activa';

    const fields = [
      ['Estado', profile?.is_active === false ? 'Inactiva' : 'Activa'],
      ['Perfil registrado', profile ? 'Sí' : 'No'],
      ['Alta del perfil', formatDate(profile?.created_at)],
      ['Última actualización', formatDate(profile?.updated_at)]
    ];

    profileFields.innerHTML = fields.map(([label, value]) => `
      <div class="profile-field">
        <span>${esc(label)}</span>
        <strong>${esc(valueOrDash(value))}</strong>
      </div>`).join('');
  }

  if (rolesResult.error) {
    profileRoles.innerHTML = '<span class="profile-empty">No se han podido cargar los roles.</span>';
  } else {
    const roles = (rolesResult.data || []).map((item) => item.role).filter(Boolean);
    profileRoles.innerHTML = roles.length
      ? roles.map((role) => `<span class="profile-role">${esc(role)}</span>`).join('')
      : '<span class="profile-empty">No hay roles asignados.</span>';
  }
}
