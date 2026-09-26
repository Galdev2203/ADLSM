import { HORARIOS_VIEW } from '../features/horarios/view.js';
import { initHorarios } from '../features/horarios/controller.js';
import { initPerfil } from '../features/perfil/profile.js';

let horariosCleanup = null;
let perfilLoaded = false;

function ensureStylesheet(href, id) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export async function initDashboard(app, user, onLogout) {
  ensureStylesheet('./js/dashboard/dashboard.css?v=20260926-3', 'dashboard-styles');
  ensureStylesheet('./js/features/perfil/profile.css?v=20260926-1', 'perfil-styles');

  app.innerHTML = `
    <main class="dashboard-shell">
      <aside class="dashboard-sidebar">
        <div class="dashboard-brand">
          <img src="assets/logos/ADLSM.jpg" alt="ADLSM">
          <div><strong>ADLSM</strong><span>Gestión deportiva</span></div>
        </div>

        <nav class="dashboard-nav" aria-label="Navegación principal">
          <button class="dashboard-nav-item active" data-section="horarios">
            <span>Horarios</span>
          </button>
          <button class="dashboard-nav-item" data-section="perfil">
            <span>Perfil</span>
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
          <section id="sectionPerfil" class="dashboard-section" hidden></section>
        </div>
      </section>
    </main>
  `;

  const horariosSection = document.querySelector('#sectionHorarios');
  const perfilSection = document.querySelector('#sectionPerfil');
  const dashboardTitle = document.querySelector('#dashboardTitle');
  const navItems = [...document.querySelectorAll('.dashboard-nav-item')];

  document.querySelector('#dashboardLogout').onclick = async () => {
    if (horariosCleanup) {
      horariosCleanup();
      horariosCleanup = null;
    }
    await onLogout();
  };

  horariosSection.innerHTML = HORARIOS_VIEW;
  ensureStylesheet('./js/features/horarios/horarios.css?v=20260926-8', 'horarios-styles');

  if (horariosCleanup) horariosCleanup();
  horariosCleanup = initHorarios();

  const showSection = async (sectionName) => {
    const isPerfil = sectionName === 'perfil';

    horariosSection.hidden = isPerfil;
    perfilSection.hidden = !isPerfil;
    dashboardTitle.textContent = isPerfil ? 'Perfil' : 'Horarios';

    navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.section === sectionName);
    });

    if (isPerfil && !perfilLoaded) {
      perfilLoaded = true;
      await initPerfil(perfilSection, user);
    }
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => showSection(item.dataset.section));
  });
}
