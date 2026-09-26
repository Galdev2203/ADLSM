import { supabase } from './js/core/supabase.js';
import { initDashboard } from './js/dashboard/dashboard.js?v=20260926-13';

const app = document.querySelector('#app');

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;'
}[char]));

function landing() {
  app.innerHTML = `
    <main class="landing">
      <nav class="nav">
        <a class="brand" href="#" aria-label="ADLSM"><img src="assets/logos/ADLSM.jpg" alt="ADLSM"><span>ADLSM</span></a>
        <button class="text-button" id="goLogin">Iniciar sesión</button>
      </nav>
      <section class="hero">
        <div class="hero-copy">
          <p class="kicker">AGRUPACIÓN DEPORTIVA LA SALLE MONTEMOLÍN</p>
          <h1>Todo el club.<br><span>En un mismo lugar.</span></h1>
          <p class="lead">ADLSM es la plataforma interna para organizar y gestionar la actividad deportiva de La Salle Montemolín.</p>
          <button class="primary-button" id="heroLogin">Acceder <span aria-hidden="true">→</span></button>
        </div>
        <div class="hero-mark" aria-hidden="true"><div class="mark-line"></div><div class="mark-circle"></div><div class="mark-line mark-line-short"></div></div>
      </section>
      <footer class="landing-footer"><span>ADLSM</span><span>La Salle Montemolín</span></footer>
    </main>`;
  document.querySelector('#goLogin').onclick = () => showLogin();
  document.querySelector('#heroLogin').onclick = () => showLogin();
}

function showLogin(message = '') {
  app.innerHTML = `
    <main class="login-page">
      <section class="login-brand-side">
        <div class="login-brand-content"><img src="assets/logos/ADLSM.jpg" alt="ADLSM"><div class="brand-side-title">ADLSM</div><div class="brand-side-line"></div><p>Gestión deportiva<br>La Salle Montemolín</p></div>
      </section>
      <section class="login-panel">
        <button class="back-button" id="back">← Volver</button>
        <div class="login-heading"><p class="kicker">ADLSM</p><h1>Iniciar sesión</h1><p>Accede a la plataforma interna de La Salle Montemolín.</p></div>
        ${message ? `<div class="message error">${esc(message)}</div>` : ''}
        <form id="loginForm" novalidate>
          <label>Correo electrónico<input name="email" type="email" autocomplete="email" placeholder="tu@email.com" required></label>
          <label>Contraseña<input name="password" type="password" autocomplete="current-password" placeholder="Contraseña" required></label>
          <button class="primary-button full" type="submit">Entrar <span aria-hidden="true">→</span></button>
        </form>
      </section>
    </main>`;
  document.querySelector('#back').onclick = () => landing();
  document.querySelector('#loginForm').onsubmit = login;
}

async function login(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector('button[type="submit"]');
  const email = form.email.value.trim();
  const password = form.password.value;
  if (!email || !password) { showLogin('Introduce tu correo y contraseña.'); return; }
  button.disabled = true;
  button.innerHTML = 'Entrando…';
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) { showLogin(error.message); return; }
  await showAuthenticated();
}

async function showAuthenticated() {
  const { data: { user } } = await supabase.auth.getUser();
  await initDashboard(app, user, async () => {
    await supabase.auth.signOut();
    landing();
  });
}

async function init() {
  const { data: { session } } = await supabase.auth.getSession();
  if (session) await showAuthenticated();
  else landing();
}

supabase.auth.onAuthStateChange((_event, session) => {
  if (!session && !document.querySelector('#loginForm')) landing();
});

init().catch((error) => showLogin(error?.message || 'No se ha podido iniciar la aplicación.'));