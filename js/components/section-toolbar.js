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
      <button id="${viewToggle.cardsId}" type="button" class="list-view-button active">Tarjetas</button>
      <button id="${viewToggle.tableId}" type="button" class="list-view-button">Tabla</button>
    </div>` : '';

  const hasFilters = Boolean(searchHtml || filtersHtml || viewHtml);

  return `
    <div class="section-toolbar ${className}" id="${id || ''}">
      <div class="section-toolbar-main">
        <div class="section-toolbar-summary">${summaryHtml}</div>
        ${hasFilters ? `
          <button class="section-toolbar-toggle" type="button" aria-expanded="false" aria-controls="${id || 'sectionToolbar'}Filters">
            <span class="section-toolbar-filter-icon">⌕</span>
            <span class="section-toolbar-open-label">Buscar y filtrar</span>
            <span class="section-toolbar-close-label">Ocultar filtros</span>
          </button>
          <div class="section-toolbar-panel" id="${id || 'sectionToolbar'}Filters" hidden>
            ${searchHtml}
            ${filtersHtml}
            ${viewHtml}
          </div>` : ''}
        ${primaryAction ? `<button class="${primaryAction.className || 'section-toolbar-primary'}" id="${primaryAction.id}" type="button">${primaryAction.label}</button>` : ''}
      </div>
    </div>`;
}

document.addEventListener('click', (event) => {
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
