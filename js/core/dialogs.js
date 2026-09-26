let activeDialog = null;

export function confirmDialog({
  title = 'Confirmar acción',
  message = '¿Quieres continuar?',
  confirmText = 'Confirmar',
  cancelText = 'Cancelar',
  danger = false
} = {}) {
  if (activeDialog) {
    activeDialog.close(false);
  }

  const backdrop = document.createElement('div');
  backdrop.className = 'adlsm-dialog-backdrop';
  backdrop.innerHTML = `
    <div class="adlsm-dialog" role="alertdialog" aria-modal="true" aria-labelledby="adlsm-dialog-title" aria-describedby="adlsm-dialog-message">
      <div class="adlsm-dialog-icon ${danger ? 'danger' : 'confirm'}" aria-hidden="true">${danger ? '!' : '?'}</div>
      <div class="adlsm-dialog-content">
        <span class="adlsm-dialog-kicker">ADLSM</span>
        <h2 id="adlsm-dialog-title"></h2>
        <p id="adlsm-dialog-message"></p>
      </div>
      <div class="adlsm-dialog-actions">
        <button class="adlsm-dialog-button secondary" type="button" data-dialog-cancel></button>
        <button class="adlsm-dialog-button primary" type="button" data-dialog-confirm></button>
      </div>
    </div>`;

  backdrop.querySelector('#adlsm-dialog-title').textContent = title;
  backdrop.querySelector('#adlsm-dialog-message').textContent = message;
  backdrop.querySelector('[data-dialog-cancel]').textContent = cancelText;
  backdrop.querySelector('[data-dialog-confirm]').textContent = confirmText;

  document.body.appendChild(backdrop);

  let settled = false;
  let resolveDialog;

  const promise = new Promise((resolve) => {
    resolveDialog = resolve;
  });

  const finish = (value) => {
    if (settled) return;
    settled = true;
    document.removeEventListener('keydown', onKeyDown);
    backdrop.classList.remove('visible');
    window.setTimeout(() => backdrop.remove(), 180);
    activeDialog = null;
    resolveDialog(value);
  };

  const close = (value = false) => finish(value);
  activeDialog = { close };

  const onKeyDown = (event) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      finish(false);
    }
  };

  backdrop.querySelector('[data-dialog-cancel]').addEventListener('click', () => finish(false));
  backdrop.querySelector('[data-dialog-confirm]').addEventListener('click', () => finish(true));
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop) finish(false);
  });
  document.addEventListener('keydown', onKeyDown);

  requestAnimationFrame(() => {
    backdrop.classList.add('visible');
    backdrop.querySelector('[data-dialog-confirm]').focus();
  });

  return promise;
}
