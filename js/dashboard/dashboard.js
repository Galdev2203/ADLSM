import { HORARIOS_VIEW } from '../features/horarios/view.js';
import { initHorarios } from '../features/horarios/controller.js';
import { initPerfil } from '../features/perfil/profile.js';
import { TEMPORADAS_VIEW } from '../features/temporadas/view.js';
import { initTemporadas } from '../features/temporadas/controller.js?v=20260926-3';
import { EQUIPOS_VIEW } from '../features/equipos/view.js';
import { initEquipos } from '../features/equipos/controller.js?v=20260926-3';

let horariosCleanup = null;
let perfilLoaded = false;
let temporadasCleanup = null;
let equiposCleanup = null;

function ensureStylesheet(href, id) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export async function initDashboard(app, user, onLogout) {
  ensureStylesheet('./js/dashboard/dashboard.css?v=20260926-5', 'dashboard-styles');
  ensureStylesheet('./js/features/perfil/profile.css?v=20260926-1', 'perfil-styles');
  ensureStylesheet('./js/features/temporadas/temporadas.css?v=20260926-2', 'temporadas-styles');
  ensureStylesheet('./js/features/equipos/equipos.css?v=20260926-3', 'equipos-styles');

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
          <button class="dashboard-nav-item" data-section="temporadas">
            <span>Temporadas</span>
          </button>
          <button class="dashboard-nav-item" data-section="equipos">
            <span>Equipos</span>
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
          <section id="sectionTemporadas" class="dashboard-section" hidden></section>
          <section id="sectionEquipos" class="dashboard-section" hidden></section>
          <section id="sectionPerfil" class="dashboard-section" hidden></section>
        </div>
      </section>
    </main>
  `;

  const horariosSection = document.querySelector('#sectionHorarios');
  const perfilSection = document.querySelector('#sectionPerfil');
  const temporadasSection = document.querySelector('#sectionTemporadas');
  const equiposSection = document.querySelector('#sectionEquipos');
  const dashboardTitle = document.querySelector('#dashboardTitle');
  const navItems = [...document.querySelectorAll('.dashboard-nav-item')];

  document.querySelector('#dashboardLogout').onclick = async () => {
    if (horariosCleanup) {
      horariosCleanup();
      horariosCleanup = null;
    }
    if (temporadasCleanup) {
      temporadasCleanup();
      temporadasCleanup = null;
    }
    if (equiposCleanup) {
      equiposCleanup();
      equiposCleanup = null;
    }
    await onLogout();
  };

  horariosSection.innerHTML = HORARIOS_VIEW;
  ensureStylesheet('./js/features/horarios/horarios.css?v=20260926-9', 'horarios-styles');

  if (horariosCleanup) horariosCleanup();
  horariosCleanup = initHorarios();

  const showSection = async (sectionName) => {
    const isPerfil = sectionName === 'perfil';
    const isTemporadas = sectionName === 'temporadas';
    const isEquipos = sectionName === 'equipos';

    horariosSection.hidden = isPerfil || isTemporadas || isEquipos;
    perfilSection.hidden = !isPerfil;
    temporadasSection.hidden = !isTemporadas;
    equiposSection.hidden = !isEquipos;
    dashboardTitle.textContent = isPerfil
      ? 'Perfil'
      : (isTemporadas ? 'Temporadas' : (isEquipos ? 'Equipos' : 'Horarios'));

    navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.section === sectionName);
    });

    if (isTemporadas && !temporadasCleanup) {
      temporadasSection.innerHTML = TEMPORADAS_VIEW;
      temporadasCleanup = initTemporadas();
    }

    if (isEquipos && !equiposCleanup) {
      equiposSection.innerHTML = EQUIPOS_VIEW;
      equiposCleanup = initEquipos();
    }

    if (isPerfil && !perfilLoaded) {
      perfilLoaded = true;
      await initPerfil(perfilSection, user);
    }
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => showSection(item.dataset.section));
  });
}
