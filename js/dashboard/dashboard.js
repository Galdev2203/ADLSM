import { HORARIOS_VIEW } from '../features/horarios/view.js';
import { initHorarios } from '../features/horarios/controller.js';

let horariosCleanup = null;

function ensureStylesheet(href, id) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export async function initDashboard(app, user, onLogout) {
  ensureStylesheet('./js/dashboard/dashboard.css', 'dashboard-styles');

  app.innerHTML = `
    <main class="dashboard-shell">
      <aside class="dashboard-sidebar">
        <div class="dashboard-brand">
          <img src="assets/logos/ADLSM.jpg" alt="ADLSM">
          <div><strong>ADLSM</strong><span>Gestión deportiva</span></div>
        </div>

        <nav class="dashboard-nav" aria-label="Navegación principal">
          <button class="dashboard-nav-item active" data-section="horarios">
            <span class="nav-index">01</span>
            <span>Generar horarios</span>
          </button>
        </nav>

        <div class="dashboard-account">
          <span class="account-label">SESIÓN</span>
          <span class="account-email">${String(user?.email || '')}</span>
          <button class="dashboard-logout" id="dashboardLogout">Cerrar sesión</button>
        </div>
      </aside>

      <section class="dashboard-main">
        <header class="dashboard-topbar">
          <div>
            <span class="dashboard-kicker">PANEL DE CONTROL</span>
            <h1 id="dashboardTitle">Horarios</h1>
          </div>
          <div class="dashboard-status"><span></span>Conectado</div>
        </header>

        <div id="dashboardContent" class="dashboard-content">
          <section id="sectionHorarios" class="dashboard-section"></section>
        </div>
      </section>
    </main>
  `;

  document.querySelector('#dashboardLogout').onclick = async () => {
    if (horariosCleanup) { horariosCleanup(); horariosCleanup = null; }
    await onLogout();
  };

  const section = document.querySelector('#sectionHorarios');
  section.innerHTML = HORARIOS_VIEW;

  ensureStylesheet('./js/features/horarios/horarios.css?v=20260926-6', 'horarios-styles');

  if (horariosCleanup) horariosCleanup();
  horariosCleanup = initHorarios();
}
