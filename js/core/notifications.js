const state = {
  container: null,
  timers: new Set()
};

const ensureContainer = () => {
  if (state.container?.isConnected) return state.container;

  const container = document.createElement('div');
  container.className = 'adlsm-notifications';
  container.setAttribute('aria-live', 'polite');
  container.setAttribute('aria-atomic', 'false');
  document.body.appendChild(container);
  state.container = container;
  return container;
};

const icons = {
  success: '✓',
  error: '!',
  warning: '!',
  info: 'i'
};

export const notify = (message, type = 'info', duration) => {
  if (!message) return;

  const container = ensureContainer();
  const notification = document.createElement('div');
  const safeType = ['success', 'error', 'warning', 'info'].includes(type) ? type : 'info';
  const timeout = Number.isFinite(duration) ? duration : (safeType === 'error' ? 5000 : 3200);

  notification.className = `adlsm-notification ${safeType}`;
  notification.setAttribute('role', safeType === 'error' ? 'alert' : 'status');
  notification.innerHTML = `
    <span class="adlsm-notification-icon" aria-hidden="true">${icons[safeType]}</span>
    <span class="adlsm-notification-message"></span>
    <button class="adlsm-notification-close" type="button" aria-label="Cerrar">×</button>
  `;

  notification.querySelector('.adlsm-notification-message').textContent = message;
  container.appendChild(notification);

  requestAnimationFrame(() => notification.classList.add('visible'));

  const close = () => {
    if (!notification.isConnected) return;
    notification.classList.remove('visible');
    notification.classList.add('leaving');
    window.setTimeout(() => notification.remove(), 180);
  };

  notification.querySelector('.adlsm-notification-close').addEventListener('click', close);

  const timer = window.setTimeout(() => {
    state.timers.delete(timer);
    close();
  }, timeout);

  state.timers.add(timer);
};

export const clearNotifications = () => {
  state.timers.forEach((timer) => window.clearTimeout(timer));
  state.timers.clear();
  state.container?.querySelectorAll('.adlsm-notification').forEach((item) => item.remove());
};
