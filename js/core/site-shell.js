import { APP_CONFIG, APP_VERSION_LABEL } from './app-config.js';

export function initSiteShell(active = '') {
  document.querySelectorAll('[data-app-version]').forEach(node => { node.textContent = APP_VERSION_LABEL; });
  if (APP_CONFIG.season) document.querySelectorAll('[data-season]').forEach(node => { node.textContent = APP_CONFIG.season; });
  document.querySelectorAll('[data-site-nav]').forEach(nav => nav.querySelectorAll('a[data-route]').forEach(link => { const route=link.dataset.route; link.classList.toggle('active',route===active); if(route===active)link.setAttribute('aria-current','page'); else link.removeAttribute('aria-current'); }));
}
initSiteShell(document.body.dataset.page || '');
