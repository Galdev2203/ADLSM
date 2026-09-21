const PAGE_SIZE = 20;

export function renderMatches(container, matches, options = {}) {
  const { page = 1, view = 'cards', onPageChange } = options;
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
    ? renderTable(visible)
    : renderCards(visible);

  container.insertAdjacentHTML('beforeend', renderPagination(currentPage, totalPages, matches.length, start + 1, Math.min(start + PAGE_SIZE, matches.length)));

  container.querySelectorAll('[data-page]').forEach(button => {
    button.addEventListener('click', () => onPageChange?.(Number(button.dataset.page)));
  });
}

function renderCards(matches) {
  return matches.map(match => `
    <article class="match-card">
      <div class="match-meta">
        ${match.competition ? `<span>${escapeHtml(match.competition)}</span>` : ''}
        <span>${escapeHtml(match.date)}</span>
        <span>${escapeHtml(match.time)}</span>
      </div>
      <div class="match-teams">
        <span>${escapeHtml(match.homeTeam)}</span>
        <span class="versus">vs</span>
        <span>${escapeHtml(match.awayTeam)}</span>
      </div>
      ${match.venue ? `<p class="muted">📍 ${escapeHtml(match.venue)}</p>` : ''}
    </article>`).join('');
}

function renderTable(matches) {
  return `<div class="table-wrap"><table class="matches-table">
    <thead><tr>
      <th>Fecha</th><th>Hora</th><th>Local</th><th>Visitante</th><th>Competición</th><th>Pabellón</th>
    </tr></thead>
    <tbody>${matches.map(match => `<tr>
      <td>${escapeHtml(match.date)}</td>
      <td>${escapeHtml(match.time)}</td>
      <td>${escapeHtml(match.homeTeam)}</td>
      <td>${escapeHtml(match.awayTeam)}</td>
      <td>${escapeHtml(match.competition)}</td>
      <td>${escapeHtml(match.venue)}</td>
    </tr>`).join('')}</tbody>
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
