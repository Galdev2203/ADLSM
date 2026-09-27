export function createSectionToolbar({
  className = '',
  id,
  summary = [],
  primaryAction,
  search = null,
  filters = [],
  viewToggle = null
} = {}) {
  const summaryHtml = summary.map(item =>
    `<div class="section-toolbar-stat"><strong id="${item.id}">0</strong><span>${item.label}</span></div>`
  ).join('');

  const searchHtml = search ? `
    <label class="section-toolbar-field section-toolbar-search">
      <span>${search.label || 'Buscar'}</span>
      <input id="${search.id}" type="search" placeholder="${search.placeholder || 'Buscar…'}" autocomplete="off">
    </label>` : '';

  const filtersHtml = filters.map(filter => `
    <label class="section-toolbar-field section-toolbar-filter">
      <span>${filter.label}</span>
      <select id="${filter.id}" aria-label="${filter.label}">
        ${(filter.options || []).map(option => `<option value="${option.value}">${option.label}</option>`).join('')}
      </select>
    </label>`).join('');

  const viewHtml = viewToggle ? `
    <div class="section-toolbar-view list-view-toggle" role="group" aria-label="${viewToggle.label || 'Vista'}">
      <button id="${viewToggle.cardsId}" type="button" class="list-view-button active" aria-label="Vista de tarjetas" title="Vista de tarjetas"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/></svg></button>
      <button id="${viewToggle.tableId}" type="button" class="list-view-button" aria-label="Vista de tabla" title="Vista de tabla"><svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="5" width="16" height="14" rx="1"/><path d="M4 10h16M4 14h16M10 5v14"/></svg></button>
    </div>` : '';

  const hasFilters = Boolean(searchHtml || filtersHtml);

  return `
    <div class="section-toolbar ${className}" id="${id || ''}">
      <div class="section-toolbar-main">
        <div class="section-toolbar-summary">${summaryHtml}</div>
        <div class="section-toolbar-actions">
          ${viewHtml}
          ${hasFilters ? `
            <button class="section-toolbar-toggle" type="button" aria-expanded="false" aria-controls="${id || 'sectionToolbar'}Filters">
              <span class="section-toolbar-filter-icon">⌕</span>
              <span class="section-toolbar-open-label">Buscar y filtrar</span>
              <span class="section-toolbar-close-label">Ocultar filtros</span>
            </button>` : ''}
          ${primaryAction ? `<button class="${primaryAction.className || 'section-toolbar-primary'}" id="${primaryAction.id}" type="button">${primaryAction.label}</button>` : ''}
        </div>
        ${hasFilters ? `
          <div class="section-toolbar-panel" id="${id || 'sectionToolbar'}Filters" hidden>
            ${searchHtml}
            ${filtersHtml}
          </div>` : ''}
      </div>
    </div>`;
}

document.addEventListener('click', (event) => {
  const viewButton = event.target.closest('.section-toolbar-view .list-view-button');
  if (viewButton) {
    const toolbar = viewButton.closest('.section-toolbar');
    const section = toolbar?.closest('section');
    const list = section?.querySelector('[id$="List"]');
    if (toolbar && list) {
      const tableMode = viewButton.id.toLowerCase().includes('table');
      list.classList.toggle('list-view-table', tableMode);
      toolbar.querySelectorAll('.section-toolbar-view .list-view-button').forEach((button) => {
        button.classList.toggle('active', button === viewButton);
      });
    }
  }

  const toggle = event.target.closest('.section-toolbar-toggle');
  if (!toggle) return;
  const toolbar = toggle.closest('.section-toolbar');
  const panel = toolbar?.querySelector('.section-toolbar-panel');
  if (!toolbar || !panel) return;
  const open = !toolbar.classList.contains('is-open');
  toolbar.classList.toggle('is-open', open);
  toggle.setAttribute('aria-expanded', String(open));
  panel.hidden = !open;
});
