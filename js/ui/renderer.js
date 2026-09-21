export function renderMatches(container, matches) {
  container.classList.toggle('empty', matches.length === 0);

  if (!matches.length) {
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">🏀</div>
        <h3>Aún no hay partidos</h3>
        <p>Busca una jornada en FAB o carga un PDF manualmente.</p>
      </div>`;
    return;
  }

  container.innerHTML = matches.map(match => `
    <article class="match-card">
      <div class="match-meta">
        ${match.competition ? `<span>${escapeHtml(match.competition)}</span>` : ''}
        <span>${escapeHtml(match.date)}</span>
        <span>${escapeHtml(match.time)}</span>
      </div>
      <div class="match-teams">${escapeHtml(match.homeTeam)} <span>vs</span> ${escapeHtml(match.awayTeam)}</div>
      ${match.venue ? `<p class="muted">${escapeHtml(match.venue)}</p>` : ''}
    </article>`).join('');
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}
