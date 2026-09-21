const PAGE_SIZE = 20;

export function renderMatches(container, matches, options = {}) {
  const {
    page = 1,
    view = 'cards',
    selectedIds = new Set(),
    onPageChange,
    onToggleSelection
  } = options;

  container.classList.toggle('empty', matches.length === 0);

  if (!matches.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏀</div>
        <h3>No hay partidos para este filtro</h3>
        <p>Prueba otra selección o muestra todos los partidos.</p>
      </div>`;
    return;
  }

  const totalPages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const start = (currentPage - 1) * PAGE_SIZE;
  const visible = matches.slice(start, start + PAGE_SIZE);

  container.innerHTML = view === 'table'
    ? renderTable(visible, selectedIds)
    : renderCards(visible, selectedIds);

  container.insertAdjacentHTML('beforeend', renderPagination(
    currentPage,
    totalPages,
    matches.length,
    start + 1,
    Math.min(start + PAGE_SIZE, matches.length)
  ));

  container.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => onPageChange?.(Number(button.dataset.page)));
  });

  container.querySelectorAll('[data-match-id]').forEach(item => {
    item.addEventListener('click', event => {
      if (event.target.closest('input, button, a')) return;
      onToggleSelection?.(item.dataset.matchId);
    });

    item.addEventListener('keydown', event => {
      if (event.key !== 'Enter' && event.key !== ' ') return;
      if (event.target.closest('input, button, a')) return;
      event.preventDefault();
      onToggleSelection?.(item.dataset.matchId);
    });
  });

  container.querySelectorAll('[data-select-checkbox]').forEach(checkbox => {
    checkbox.addEventListener('change', event => {
      onToggleSelection?.(event.target.dataset.selectCheckbox);
    });
  });
}

function renderCards(matches, selectedIds) {
  return matches.map(match => {
    const selected = selectedIds.has(match.id);
    return `
      <article class="match-card selectable-match${selected ? ' selected' : ''}"
        data-match-id="${escapeHtml(match.id)}"
        tabindex="0"
        role="button"
        aria-pressed="${selected}">
        <div class="match-card-top">
          <div class="match-meta">
            ${match.competition ? `<span>${escapeHtml(match.competition)}</span>` : ''}
            <span>${escapeHtml(match.date)}</span>
            <span>${escapeHtml(match.time)}</span>
          </div>
          <label class="selection-check" title="Seleccionar partido">
            <input type="checkbox" data-select-checkbox="${escapeHtml(match.id)}" ${selected ? 'checked' : ''} aria-label="Seleccionar ${escapeHtml(match.homeTeam)} contra ${escapeHtml(match.awayTeam)}">
            <span></span>
          </label>
        </div>
        <div class="match-teams">
          <span>${escapeHtml(match.homeTeam)}</span>
          <span class="versus">vs</span>
          <span>${escapeHtml(match.awayTeam)}</span>
        </div>
        ${match.venue ? `<p class="muted">📍 ${escapeHtml(match.venue)}</p>` : ''}
      </article>`;
  }).join('');
}

function renderTable(matches, selectedIds) {
  return `<div class="table-wrap"><table class="matches-table">
    <thead><tr>
      <th class="selection-column">Sel.</th><th>Fecha</th><th>Hora</th><th>Local</th><th>Visitante</th><th>Competición</th><th>Pabellón</th>
    </tr></thead>
    <tbody>${matches.map(match => {
      const selected = selectedIds.has(match.id);
      return `<tr class="selectable-row${selected ? ' selected' : ''}" data-match-id="${escapeHtml(match.id)}" tabindex="0" role="button" aria-pressed="${selected}">
        <td class="selection-column"><label class="selection-check" title="Seleccionar partido"><input type="checkbox" data-select-checkbox="${escapeHtml(match.id)}" ${selected ? 'checked' : ''} aria-label="Seleccionar ${escapeHtml(match.homeTeam)} contra ${escapeHtml(match.awayTeam)}"><span></span></label></td>
        <td>${escapeHtml(match.date)}</td>
        <td>${escapeHtml(match.time)}</td>
        <td>${escapeHtml(match.homeTeam)}</td>
        <td>${escapeHtml(match.awayTeam)}</td>
        <td>${escapeHtml(match.competition)}</td>
        <td>${escapeHtml(match.venue)}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}

function renderPagination(page, totalPages, total, from, to) {
  if (totalPages <= 1) return '';

  const buttons = [];
  const add = (p, label, disabled = false, active = false) => buttons.push(
    `<button type="button" class="page-button${active ? ' active' : ''}" data-page="${p}" ${disabled ? 'disabled' : ''}>${label}</button>`
  );

  add(page - 1, '‹', page === 1);
  const pages = new Set([1, totalPages, page - 1, page, page + 1].filter(p => p >= 1 && p <= totalPages));
  let previous = 0;
  for (const p of [...pages].sort((a, b) => a - b)) {
    if (previous && p - previous > 1) buttons.push('<span class="page-gap">…</span>');
    add(p, String(p), false, p === page);
    previous = p;
  }
  add(page + 1, '›', page === totalPages);

  return `<div class="pagination"><span class="pagination-info">${from}–${to} de ${total}</span><div class="pagination-buttons">${buttons.join('')}</div></div>`;
}

export { PAGE_SIZE };

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
