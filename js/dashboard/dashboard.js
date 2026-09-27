import { HORARIOS_VIEW } from '../features/horarios/view.js';
import { initHorarios } from '../features/horarios/controller.js';
import { initPerfil } from '../features/perfil/profile.js';
import { TEMPORADAS_VIEW } from '../features/temporadas/view.js';
import { initTemporadas } from '../features/temporadas/controller.js?v=20260926-4';
import { EQUIPOS_VIEW } from '../features/equipos/view.js';
import { JUGADORES_VIEW } from '../features/jugadores/view.js';
import { ENTRENADORES_VIEW } from '../features/entrenadores/view.js';
import { PERSONAS_VIEW } from '../features/personas/view.js';
import { initJugadores } from '../features/jugadores/controller.js?v=20260927-7';
import { initEntrenadores } from '../features/entrenadores/controller.js?v=20260927-5';
import { initPersonas } from '../features/personas/controller.js?v=20260927-4';
import { initEquipos } from '../features/equipos/controller.js?v=20260927-2';
import { confirmDialog } from '../core/dialogs.js';

let horariosCleanup = null;
let perfilLoaded = false;
let temporadasCleanup = null;
let equiposCleanup = null;
let jugadoresCleanup = null;
let entrenadoresCleanup = null;
let personasCleanup = null;

function ensureStylesheet(href, id) {
  if (document.getElementById(id)) return;
  const link = document.createElement('link');
  link.id = id;
  link.rel = 'stylesheet';
  link.href = href;
  document.head.appendChild(link);
}

export async function initDashboard(app, user, onLogout) {
  ensureStylesheet('./js/dashboard/dashboard.css?v=20260927-1', 'dashboard-styles');
  ensureStylesheet('./js/dashboard/responsive.css?v=20260927-1', 'responsive-styles');
  ensureStylesheet('./js/features/perfil/profile.css?v=20260926-1', 'perfil-styles');
  ensureStylesheet('./js/features/temporadas/temporadas.css?v=20260926-2', 'temporadas-styles');
  ensureStylesheet('./js/features/equipos/equipos.css?v=20260927-2', 'equipos-styles');
  ensureStylesheet('./js/features/jugadores/jugadores.css?v=20260927-5', 'jugadores-styles');
  ensureStylesheet('./js/features/entrenadores/entrenadores.css?v=20260927-1', 'entrenadores-styles');
  ensureStylesheet('./js/features/personas/personas.css?v=20260927-10', 'personas-styles');
  ensureStylesheet('./js/components/section-toolbar.css?v=20260927-6', 'section-toolbar-styles');

  app.innerHTML = `
    <main class="dashboard-shell">
      <aside class="dashboard-sidebar">
        <div class="dashboard-brand">
          <img src="assets/logos/ADLSM.jpg" alt="ADLSM">
          <div><strong>ADLSM</strong><span>Gestión deportiva</span></div>
          <button class="dashboard-mobile-toggle" id="dashboardMobileToggle" type="button" aria-label="Abrir menú" aria-expanded="false" aria-controls="dashboardNav">☰</button>
        </div>

        <nav class="dashboard-nav" id="dashboardNav" aria-label="Navegación principal">
          <button class="dashboard-nav-item active" data-section="inicio">
            <span>Inicio</span>
          </button>
          <button class="dashboard-nav-item" data-section="equipos">
            <span>Equipos</span>
          </button>
          <button class="dashboard-nav-item" data-section="jugadores">
            <span>Jugadores</span>
          </button>
          <button class="dashboard-nav-item" data-section="entrenadores">
            <span>Entrenadores</span>
          </button>
          <button class="dashboard-nav-item" data-section="temporadas">
            <span>Temporadas</span>
          </button>
          <button class="dashboard-nav-item" data-section="personas">
            <span>Personas</span>
          </button>
          <button class="dashboard-nav-item" data-section="horarios">
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
            <h1 id="dashboardTitle">Inicio</h1>
          </div>
          <div class="dashboard-status"><span></span>Conectado</div>
        </header>

        <div id="dashboardContent" class="dashboard-content">
          <section id="sectionInicio" class="dashboard-section"></section>
          <section id="sectionHorarios" class="dashboard-section" hidden></section>
          <section id="sectionTemporadas" class="dashboard-section" hidden></section>
          <section id="sectionEquipos" class="dashboard-section" hidden></section>
          <section id="sectionPersonas" class="dashboard-section" hidden></section>
          <section id="sectionJugadores" class="dashboard-section" hidden></section>
          <section id="sectionEntrenadores" class="dashboard-section" hidden></section>
          <section id="sectionPerfil" class="dashboard-section" hidden></section>
        </div>
      </section>
    </main>
  `;

  const inicioSection = document.querySelector('#sectionInicio');
  const horariosSection = document.querySelector('#sectionHorarios');
  const perfilSection = document.querySelector('#sectionPerfil');
  const temporadasSection = document.querySelector('#sectionTemporadas');
  const equiposSection = document.querySelector('#sectionEquipos');
  const personasSection = document.querySelector('#sectionPersonas');
  const jugadoresSection = document.querySelector('#sectionJugadores');
  const entrenadoresSection = document.querySelector('#sectionEntrenadores');
  const dashboardTitle = document.querySelector('#dashboardTitle');
  const navItems = [...document.querySelectorAll('.dashboard-nav-item')];
  const sidebar = document.querySelector('.dashboard-sidebar');
  const mobileToggle = document.querySelector('#dashboardMobileToggle');

  const closeMobileNav = () => {
    sidebar?.classList.remove('mobile-open');
    mobileToggle?.setAttribute('aria-expanded', 'false');
    mobileToggle?.setAttribute('aria-label', 'Abrir menú');
    if (mobileToggle) mobileToggle.textContent = '☰';
  };

  mobileToggle?.addEventListener('click', () => {
    const open = sidebar.classList.toggle('mobile-open');
    mobileToggle.setAttribute('aria-expanded', String(open));
    mobileToggle.setAttribute('aria-label', open ? 'Cerrar menú' : 'Abrir menú');
    mobileToggle.textContent = open ? '×' : '☰';
  });

  document.querySelector('#dashboardLogout').onclick = async () => {
    const confirmed = await confirmDialog({
      title: 'Cerrar sesión',
      message: '¿Quieres cerrar tu sesión de ADLSM?',
      confirmText: 'Cerrar sesión',
      cancelText: 'Cancelar'
    });
    if (!confirmed) return;

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
    if (jugadoresCleanup) {
      jugadoresCleanup();
      jugadoresCleanup = null;
    }
    if (personasCleanup) {
      personasCleanup();
      personasCleanup = null;
    }
    if (entrenadoresCleanup) {
      entrenadoresCleanup();
      entrenadoresCleanup = null;
    }
    await onLogout();
  };

  horariosSection.innerHTML = HORARIOS_VIEW;
  ensureStylesheet('./js/features/horarios/horarios.css?v=20260926-9', 'horarios-styles');

  if (horariosCleanup) horariosCleanup();
  horariosCleanup = initHorarios();

  const showSection = async (sectionName) => {
    const isInicio = sectionName === 'inicio';
    const isPerfil = sectionName === 'perfil';
    const isTemporadas = sectionName === 'temporadas';
    const isEquipos = sectionName === 'equipos';
    const isPersonas = sectionName === 'personas';
    const isJugadores = sectionName === 'jugadores';
    const isEntrenadores = sectionName === 'entrenadores';

    inicioSection.hidden = !isInicio;
    horariosSection.hidden = isInicio || isPerfil || isTemporadas || isEquipos || isPersonas || isJugadores || isEntrenadores;
    perfilSection.hidden = !isPerfil;
    temporadasSection.hidden = !isTemporadas;
    equiposSection.hidden = !isEquipos;
    personasSection.hidden = !isPersonas;
    jugadoresSection.hidden = !isJugadores;
    entrenadoresSection.hidden = !isEntrenadores;
    const sectionTitles = {
      inicio: 'Inicio',
      horarios: 'Horarios',
      temporadas: 'Temporadas',
      equipos: 'Equipos',
      personas: 'Personas',
      jugadores: 'Jugadores',
      entrenadores: 'Entrenadores',
      perfil: 'Perfil'
    };
    dashboardTitle.textContent = sectionTitles[sectionName] || 'Horarios';

    navItems.forEach((item) => {
      item.classList.toggle('active', item.dataset.section === sectionName);
    });

    if (isInicio && !inicioSection.dataset.loaded) {
      inicioSection.innerHTML = `
        <section class="dashboard-home">
          <div class="dashboard-home-hero">
            <div>
              <span class="dashboard-home-kicker">ADLSM · GESTIÓN DEPORTIVA</span>
              <h2>Bienvenido a ADLSM</h2>
              <p>Desde aquí puedes acceder rápidamente a la gestión deportiva de la agrupación.</p>
            </div>
          </div>
          <div class="dashboard-home-grid">
            <button class="dashboard-home-card" type="button" data-home-section="equipos"><span class="dashboard-home-card-icon">E</span><span><strong>Equipos</strong><small>Gestiona los equipos y sus temporadas.</small></span><span class="dashboard-home-card-arrow">→</span></button>
            <button class="dashboard-home-card" type="button" data-home-section="jugadores"><span class="dashboard-home-card-icon">J</span><span><strong>Jugadores</strong><small>Consulta y gestiona las plantillas.</small></span><span class="dashboard-home-card-arrow">→</span></button>
            <button class="dashboard-home-card" type="button" data-home-section="entrenadores"><span class="dashboard-home-card-icon">E</span><span><strong>Entrenadores</strong><small>Gestiona entrenadores y asignaciones.</small></span><span class="dashboard-home-card-arrow">→</span></button>
            <button class="dashboard-home-card" type="button" data-home-section="temporadas"><span class="dashboard-home-card-icon">T</span><span><strong>Temporadas</strong><small>Consulta y administra las temporadas.</small></span><span class="dashboard-home-card-arrow">→</span></button>
            <button class="dashboard-home-card" type="button" data-home-section="personas"><span class="dashboard-home-card-icon">P</span><span><strong>Personas</strong><small>Gestiona las personas de la agrupación.</small></span><span class="dashboard-home-card-arrow">→</span></button>
            <button class="dashboard-home-card" type="button" data-home-section="horarios"><span class="dashboard-home-card-icon">H</span><span><strong>Horarios</strong><small>Consulta y organiza los horarios.</small></span><span class="dashboard-home-card-arrow">→</span></button>
          </div>
          <div class="dashboard-home-session"><span>Sesión iniciada como</span><strong>${String(user?.email || '')}</strong></div>
        </section>`;
      inicioSection.dataset.loaded = 'true';
      inicioSection.querySelectorAll('[data-home-section]').forEach((button) => {
        button.addEventListener('click', () => showSection(button.dataset.homeSection));
      });
    }

    if (isTemporadas && !temporadasCleanup) {
      temporadasSection.innerHTML = TEMPORADAS_VIEW;
      temporadasCleanup = initTemporadas();
    }

    if (isEquipos && !equiposCleanup) {
      equiposSection.innerHTML = EQUIPOS_VIEW;
      equiposCleanup = initEquipos();
    }

    if (isPersonas && !personasCleanup) {
      personasSection.innerHTML = PERSONAS_VIEW;
      personasCleanup = initPersonas();
    }

    if (isJugadores && !jugadoresCleanup) {
      jugadoresSection.innerHTML = JUGADORES_VIEW;
      jugadoresCleanup = initJugadores();
    }

    if (isEntrenadores && !entrenadoresCleanup) {
      entrenadoresSection.innerHTML = ENTRENADORES_VIEW;
      entrenadoresCleanup = initEntrenadores();
    }

    if (isPerfil && !perfilLoaded) {
      perfilLoaded = true;
      await initPerfil(perfilSection, user);
    }
  };

  navItems.forEach((item) => {
    item.addEventListener('click', () => {
      showSection(item.dataset.section);
      closeMobileNav();
    });
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) closeMobileNav();
  });
}
