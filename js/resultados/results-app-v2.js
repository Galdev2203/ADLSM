import { analyzeTeam, fetchCompetition } from './results-runtime-v15.js?v=20260922-15';
import {
  discoverSeasons,
  discoverSource as discoverCompetitionCatalog
} from './competition-discovery.js?v=20260922-15';

const ids = {
  form: 'resultsForm',
  source: 'resultsSource',
  category: 'resultsCategory',
  season: 'resultsSeason',
  view: 'resultsView',
  team: 'resultsTeam',
  status: 'resultsStatus',
  summary: 'resultsSummary',
  classification: 'resultsClassification',
  matches: 'resultsMatches',
  metadata: 'resultsMetadata',
  search: 'resultsSearch',
  openSource: 'openSource',
  exportCsv: 'exportCsv',
  matchesTitle: 'resultsMatchesTitle',
  matchesSubtitle: 'resultsMatchesSubtitle',
  classificationTitle: 'resultsClassificationTitle',
  classificationSubtitle: 'resultsClassificationSubtitle'
};

const els = Object.fromEntries(
  Object.entries(ids).map(([key, id]) => [key, document.getElementById(id)])
);

let dataset = null;
let catalog = null;
let loading = false;

const text = (value) => String(value ?? '');

const escapeHtml = (value) => text(value).replace(/[&<>"']/g, (char) => {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  };
  return map[char];
});

const normalizeKey = (value) => text(value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es')
  .replace(/\s+/g, ' ')
  .trim();

const formatNumber = (value) => Number(value || 0).toLocaleString('es-ES', {
  maximumFractionDigits: 1
});

function setStatus(message, kind = 'info') {
  if (!els.status) return;
  els.status.textContent = message;
  els.status.className = `results-status ${kind}`;
}

function setOptions(select, options, placeholder) {
  if (!select) return;
  select.innerHTML = '';

  const first = document.createElement('option');
  first.value = '';
  first.textContent = placeholder;
  select.appendChild(first);

  for (const option of options || []) {
    const node = document.createElement('option');
    node.value = option.url;
    node.textContent = option.label;
    select.appendChild(node);
  }

  select.disabled = !(options && options.length);
}

function setTeams(rows) {
  if (!els.team) return;

  const previous = els.team.value;
  const names = (rows || [])
    .map((row) => row.team || row.name)
    .filter(Boolean);

  els.team.innerHTML = '';

  const all = document.createElement('option');
  all.value = '';
  all.textContent = 'Todos los equipos';
  els.team.appendChild(all);

  for (const name of names) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name;
    els.team.appendChild(option);
  }

  els.team.disabled = names.length === 0;

  if (names.includes(previous)) {
    els.team.value = previous;
  }
}

function selectedTeam() {
  return text(els.team?.value).trim();
}

function teamMatches(team = selectedTeam()) {
  if (!dataset) return [];

  const query = normalizeKey(team);
  if (!query) return dataset.matches || [];

  return (dataset.matches || []).filter((match) => {
    return normalizeKey(match.home) === query || normalizeKey(match.away) === query;
  });
}

function filteredMatches() {
  const query = text(els.search?.value).trim().toLocaleLowerCase('es');
  const base = els.view?.value === 'team'
    ? teamMatches()
    : (dataset?.matches || []);

  return base.filter((match) => {
    if (!query) return true;
    const haystack = `${match.home} ${match.away} ${match.jornada}`.toLocaleLowerCase('es');
    return haystack.includes(query);
  });
}

function renderSummary() {
  if (!dataset || !els.summary) return;

  const team = selectedTeam();

  if (team) {
    const stats = analyzeTeam(dataset, team);
    const cards = [
      ['Equipo', team],
      ['Partidos', stats.matches],
      ['Jugados', stats.played],
      ['Pendientes', stats.scheduled],
      ['Victorias', stats.wins],
      ['Derrotas', stats.losses],
      ['PF / PC', `${formatNumber(stats.pointsFor)} / ${formatNumber(stats.pointsAgainst)}`],
      ['% victorias', `${formatNumber(stats.winRate)}%`]
    ];

    els.summary.innerHTML = cards.map(([label, value]) => `
      <article class="stat-card">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value)}</strong>
      </article>
    `).join('');
    return;
  }

  const played = (dataset.matches || []).filter((match) => match.played);
  const totalPoints = played.reduce(
    (sum, match) => sum + Number(match.homeScore || 0) + Number(match.awayScore || 0),
    0
  );

  const cards = [
    ['Equipos', dataset.classification.length || dataset.teams.length],
    ['Partidos', dataset.matches.length],
    ['Jugados', played.length],
    ['Pendientes', dataset.matches.length - played.length],
    ['Puntos anotados', formatNumber(totalPoints)],
    ['Media puntos / partido', played.length ? formatNumber(totalPoints / played.length) : '0'],
    ['Clasificación', dataset.classification.length ? 'Disponible' : 'No disponible'],
    ['Fuente', dataset.sourceId === 'zaragoza' ? 'Zaragoza' : 'Aragón · FEB/FAB']
  ];

  els.summary.innerHTML = cards.map(([label, value]) => `
    <article class="stat-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </article>
  `).join('');
}

function renderClassification() {
  if (!els.classification) return;

  const rows = dataset?.classification || [];

  if (!rows.length) {
    els.classification.innerHTML = '<div class="results-empty-small">La fuente consultada no muestra una clasificación.</div>';
    return;
  }

  els.classification.innerHTML = `
    <div class="results-table-wrap">
      <table class="results-table clickable-table">
        <thead>
          <tr>
            <th>#</th>
            <th>Equipo</th>
            <th>PJ</th>
            <th>PG</th>
            <th>PP</th>
            <th>PF</th>
            <th>PC</th>
            <th>Pts.</th>
            <th>R.</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map((row) => `
            <tr data-team="${escapeHtml(row.team)}">
              <td>${escapeHtml(row.position)}</td>
              <td><strong>${escapeHtml(row.team)}</strong></td>
              <td>${escapeHtml(row.played)}</td>
              <td>${escapeHtml(row.wins)}</td>
              <td>${escapeHtml(row.losses)}</td>
              <td>${escapeHtml(row.pointsFor)}</td>
              <td>${escapeHtml(row.pointsAgainst)}</td>
              <td>${escapeHtml(row.points)}</td>
              <td>${escapeHtml(row.form)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;

  els.classification.querySelectorAll('tbody tr').forEach((row) => {
    row.addEventListener('click', () => {
      const team = row.dataset.team || '';
      els.team.value = team;
      render();
    });
  });
}

function crossScore(rowTeam, columnTeam) {
  const rowKey = normalizeKey(rowTeam);
  const columnKey = normalizeKey(columnTeam);

  return (dataset.matches || [])
    .filter((match) => {
      const home = normalizeKey(match.home);
      const away = normalizeKey(match.away);
      return (home === rowKey && away === columnKey) ||
        (home === columnKey && away === rowKey);
    })
    .filter((match) => match.played)
    .sort((a, b) => String(a.date).localeCompare(String(b.date)))
    .map((match) => {
      const home = normalizeKey(match.home);
      return home === rowKey
        ? `${match.homeScore}-${match.awayScore}`
        : `${match.awayScore}-${match.homeScore}`;
    })
    .join(' / ');
}

function renderCross() {
  if (!els.classification) return;

  const teams = (dataset?.classification || []).map((row) => row.team).filter(Boolean);

  if (!teams.length) {
    els.classification.innerHTML = '<div class="results-empty-small">No se ha podido construir la tabla cruzada.</div>';
    return;
  }

  const selected = normalizeKey(selectedTeam());

  const header = teams.map((team) => `
    <th class="cross-col ${selected === normalizeKey(team) ? 'selected-team' : ''}">
      ${escapeHtml(team)}
    </th>
  `).join('');

  const body = teams.map((rowTeam) => `
    <tr class="${selected === normalizeKey(rowTeam) ? 'selected-team' : ''}">
      <th class="cross-row">${escapeHtml(rowTeam)}</th>
      ${teams.map((columnTeam) => {
        const same = normalizeKey(rowTeam) === normalizeKey(columnTeam);
        const highlighted = selected === normalizeKey(rowTeam) || selected === normalizeKey(columnTeam);
        return `
          <td class="${highlighted ? 'selected-team' : ''}">
            ${same ? '—' : escapeHtml(crossScore(rowTeam, columnTeam))}
          </td>
        `;
      }).join('')}
    </tr>
  `).join('');

  els.classification.innerHTML = `
    <div class="cross-results-wrap">
      <table class="cross-results-table">
        <thead>
          <tr>
            <th class="cross-corner">L / V</th>
            ${header}
          </tr>
        </thead>
        <tbody>${body}</tbody>
      </table>
    </div>
    <p class="cross-results-note">Cada celda muestra el resultado desde la perspectiva del equipo de la fila.</p>
  `;
}

function renderMatches() {
  if (!els.matches) return;

  const team = selectedTeam();
  const rows = filteredMatches();

  if (!rows.length) {
    els.matches.innerHTML = '<div class="results-empty-small">No hay partidos que coincidan con el filtro.</div>';
    return;
  }

  els.matches.innerHTML = rows.map((match) => {
    const homeKey = normalizeKey(match.home);
    const awayKey = normalizeKey(match.away);
    const teamKey = normalizeKey(team);
    const own = Boolean(team && (homeKey === teamKey || awayKey === teamKey));
    const score = match.played
      ? `<strong>${escapeHtml(match.homeScore)} - ${escapeHtml(match.awayScore)}</strong>`
      : '<span class="pending-score">Pendiente</span>';

    return `
      <article class="result-match ${own ? 'team-match' : ''}">
        <div class="result-match-main">
          <div class="result-match-teams">
            <span class="${team && homeKey === teamKey ? 'own-team' : ''}">${escapeHtml(match.home)}</span>
            <b>VS</b>
            <span class="${team && awayKey === teamKey ? 'own-team' : ''}">${escapeHtml(match.away)}</span>
          </div>
          <div class="result-match-score">${score}</div>
        </div>
        <div class="result-match-meta">
          <span>Jornada ${escapeHtml(match.jornada || '—')}</span>
          <span>${escapeHtml(match.date || '—')}</span>
          <span>${escapeHtml(match.time || '—')}</span>
        </div>
      </article>
    `;
  }).join('');
}

function render() {
  if (!dataset) return;

  const team = selectedTeam();
  const view = els.view.value;

  els.metadata.innerHTML = `
    <div><span>Temporada</span><strong>${escapeHtml(dataset.season || els.season.selectedOptions[0]?.textContent || '—')}</strong></div>
    <div><span>Categoría</span><strong>${escapeHtml(dataset.category || els.category.selectedOptions[0]?.textContent || '—')}</strong></div>
    <div><span>Equipo</span><strong>${escapeHtml(team || 'Todos')}</strong></div>
    <div><span>Análisis</span><strong>${escapeHtml(view === 'team' ? 'Partidos del equipo' : view === 'cross' ? 'Resultados cruzados' : 'Clasificación · todos los equipos')}</strong></div>
  `;

  renderSummary();

  els.matchesTitle.textContent = view === 'team' && team
    ? `Partidos de ${team}`
    : 'Partidos de la competición';

  els.matchesSubtitle.textContent = view === 'team'
    ? 'Todos los partidos detectados de la temporada.'
    : 'Calendario completo utilizado para el análisis.';

  renderMatches();

  els.classificationTitle.textContent = view === 'cross' ? 'Resultados cruzados' : 'Clasificación';
  els.classificationSubtitle.textContent = view === 'cross'
    ? 'Matriz de resultados de todos los equipos de la competición.'
    : 'Clasificación completa de la competición.';

  if (view === 'cross') {
    renderCross();
  } else {
    renderClassification();
  }

  els.exportCsv.disabled = !(dataset.matches && dataset.matches.length);
  els.openSource.href = dataset.url || '#';
}

async function loadCompetition(url) {
  if (!url || loading) return;

  loading = true;
  setStatus('Cargando clasificación y calendario completo…', 'loading');

  try {
    const [resultsData, calendarData] = await Promise.all([
      fetchCompetition(url, 'results'),
      fetchCompetition(url, 'calendar')
    ]);

    dataset = {
      ...resultsData,
      sourceId: els.source.value,
      matches: calendarData.matches?.length ? calendarData.matches : resultsData.matches,
      classification: resultsData.classification?.length
        ? resultsData.classification
        : calendarData.classification,
      teams: resultsData.teams?.length ? resultsData.teams : calendarData.teams
    };

    setTeams(
      dataset.classification?.length
        ? dataset.classification
        : (dataset.teams || []).map((team) => ({ team: team.name || team.team }))
    );

    render();
    setStatus(
      `Competición cargada: ${dataset.classification.length} equipos y ${dataset.matches.length} partidos detectados.`,
      'success'
    );
  } catch (error) {
    dataset = null;
    setTeams([]);
    els.summary.replaceChildren();
    els.classification.replaceChildren();
    els.matches.replaceChildren();
    els.metadata.replaceChildren();
    setStatus(
      error instanceof Error ? error.message : 'No se ha podido cargar la competición.',
      'error'
    );
  } finally {
    loading = false;
  }
}

async function loadSeasons(url) {
  if (!url) return;

  setStatus('Cargando temporadas de la categoría…', 'loading');

  try {
    const data = await discoverSeasons(url);
    setOptions(els.season, data.options, 'Selecciona una temporada');

    if (data.selected) {
      els.season.value = data.selected;
    }

    if (els.season.value) {
      await loadCompetition(els.season.value);
    } else {
      setStatus('Categoría cargada. Selecciona una temporada.', 'info');
    }
  } catch (error) {
    setOptions(els.season, [], 'Temporadas no disponibles');
    setStatus(
      error instanceof Error ? error.message : 'No se han podido cargar las temporadas.',
      'error'
    );
  }
}

async function discoverSource(source) {
  setStatus('Cargando categorías de FEB/FAB…', 'loading');
  els.category.disabled = true;
  els.season.disabled = true;
  els.team.disabled = true;

  try {
    catalog = await discoverCompetitionCatalog(source);
    setOptions(els.category, catalog.categoryOptions, 'Selecciona una categoría');

    if (catalog.defaultCategory) {
      els.category.value = catalog.defaultCategory;
    }

    if (els.category.value) {
      await loadSeasons(els.category.value);
    } else {
      setStatus('Selecciona una categoría.', 'info');
    }
  } catch (error) {
    catalog = null;
    setOptions(els.category, [], 'Categorías no disponibles');
    setOptions(els.season, [], 'Temporadas no disponibles');
    setTeams([]);
    setStatus(
      error instanceof Error ? error.message : 'No se han podido cargar las categorías.',
      'error'
    );
  }
}

els.source.addEventListener('change', () => {
  discoverSource(els.source.value);
});

els.category.addEventListener('change', () => {
  loadSeasons(els.category.value);
});

els.season.addEventListener('change', () => {
  if (els.season.value) {
    loadCompetition(els.season.value);
  }
});

els.team.addEventListener('change', () => {
  if (dataset) render();
});

els.view.addEventListener('change', () => {
  if (dataset) render();
});

els.search.addEventListener('input', () => {
  if (dataset) render();
});

els.form.addEventListener('submit', (event) => {
  event.preventDefault();

  if (!els.season.value) {
    setStatus('Selecciona una temporada antes de consultar.', 'error');
    return;
  }

  loadCompetition(els.season.value);
});

els.exportCsv.addEventListener('click', () => {
  if (!dataset?.matches?.length) return;

  const rows = [
    ['Jornada', 'Local', 'Visitante', 'Resultado', 'Fecha', 'Hora'],
    ...dataset.matches.map((match) => [
      match.jornada,
      match.home,
      match.away,
      match.played ? `${match.homeScore}-${match.awayScore}` : '',
      match.date,
      match.time
    ])
  ];

  const csv = rows
    .map((row) => row.map((value) => {
      const escaped = String(value ?? '').replace(/"/g, '""');
      return `"${escaped}"`;
    }).join(';'))
    .join('\n');

  const blob = new Blob([`\ufeff${csv}`], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'adlsm-resultados.csv';
  anchor.click();
  URL.revokeObjectURL(url);
});

discoverSource(els.source.value);
