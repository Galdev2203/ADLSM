import { supabase } from '../../core/supabase.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[char]));

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat('es-ES', { dateStyle:'medium' }).format(date);
};

let seasons = [];
let searchTerm = '';

export function initTemporadas() {
  const els = {
    list: document.querySelector('#seasonList'),
    toolbar: document.querySelector('#seasonsToolbar'),
    total: document.querySelector('#seasonTotal'),
    active: document.querySelector('#seasonActive'),
    historical: document.querySelector('#seasonHistorical'),
    search: document.querySelector('#seasonSearch'),
    message: document.querySelector('#seasonMessage'),
    detail: document.querySelector('#seasonDetail'),
    modal: document.querySelector('#seasonModal'),
    form: document.querySelector('#seasonForm'),
    name: document.querySelector('#seasonName'),
    start: document.querySelector('#seasonStart'),
    end: document.querySelector('#seasonEnd'),
    close: document.querySelector('#closeSeasonModal'),
    cancel: document.querySelector('#cancelSeason'),
    save: document.querySelector('#saveSeason'),
    newButton: document.querySelector('#newSeasonButton')
  };

  const showMessage = (message, type = 'error') => {
    els.message.hidden = !message;
    els.message.className = `season-message ${type}`;
    els.message.textContent = message || '';
  };

  const openModal = () => {
    els.form.reset();
    const year = new Date().getFullYear();
    els.start.value = year;
    els.end.value = year + 1;
    els.modal.hidden = false;
    requestAnimationFrame(() => els.name.focus());
  };

  const closeModal = () => {
    els.modal.hidden = true;
    els.form.reset();
  };

  const hideDetail = () => {
    els.detail.hidden = true;
    els.list.hidden = false;
    els.toolbar.hidden = false;
    els.detail.innerHTML = '';
  };

  const render = () => {
    const filtered = seasons.filter((season) => {
      const haystack = `${season.name || ''} ${season.start_year || ''}/${season.end_year || ''}`.toLowerCase();
      return haystack.includes(searchTerm);
    });

    els.total.textContent = seasons.length;
    els.active.textContent = seasons.filter((season) => season.is_active).length;
    els.historical.textContent = seasons.filter((season) => !season.is_active).length;

    if (!filtered.length) {
      els.list.innerHTML = `
        <div class="season-empty">
          <div class="season-empty-icon">◷</div>
          <h3>${seasons.length ? 'No hay coincidencias' : 'Todavía no hay temporadas'}</h3>
          <p>${seasons.length ? 'Prueba con otro término de búsqueda.' : 'Crea la primera temporada para empezar a organizar la competición.'}</p>
          ${seasons.length ? '' : '<button class="seasons-primary" id="emptyNewSeason">Crear temporada</button>'}
        </div>`;
      document.querySelector('#emptyNewSeason')?.addEventListener('click', openModal);
      return;
    }

    els.list.innerHTML = filtered.map((season) => `
      <article class="season-card ${season.is_active ? 'active' : ''}">
        <div class="season-card-main">
          <div class="season-year-badge">${escapeHtml(season.start_year)}/${String(season.end_year).slice(-2)}</div>
          <div class="season-card-info">
            <div class="season-card-title-row">
              <h3>${escapeHtml(season.name)}</h3>
              <span class="season-status ${season.is_active ? 'active' : ''}">${season.is_active ? 'ACTIVA' : 'HISTÓRICA'}</span>
            </div>
            <p>${season.is_active ? 'Temporada de trabajo actual' : `Creada el ${formatDate(season.created_at)}`}</p>
            <div class="season-card-meta">
              <span><strong>${season.team_count}</strong> equipos vinculados</span>
              <span>${escapeHtml(season.start_year)} — ${escapeHtml(season.end_year)}</span>
            </div>
          </div>
        </div>
        <div class="season-card-actions">
          <button class="season-action season-view-action" data-action="view" data-id="${season.id}">Ver temporada</button>
          ${season.is_active ? '<span class="season-current">En uso</span>' : `<button class="season-action" data-action="activate" data-id="${season.id}">Activar</button>`}
        </div>
      </article>`).join('');

    els.list.querySelectorAll('[data-action="view"]').forEach((button) => {
      button.addEventListener('click', () => showDetail(button.dataset.id));
    });

    els.list.querySelectorAll('[data-action="activate"]').forEach((button) => {
      button.addEventListener('click', () => activateSeason(button.dataset.id));
    });
  };

  const showDetail = async (id) => {
    const season = seasons.find((item) => item.id === id);
    if (!season) return;

    els.detail.hidden = false;
    els.list.hidden = true;
    els.toolbar.hidden = true;
    els.detail.innerHTML = `<div class="season-detail-loading">Cargando información de ${escapeHtml(season.name)}…</div>`;

    const { data: teamRows, error } = await supabase
      .from('team_seasons')
      .select('id,team_id,display_name,gender,competition_name,group_name,venue_name,venue_address,notes')
      .eq('season_id', id)
      .order('display_name', { ascending:true });

    if (error) {
      els.detail.innerHTML = `
        <div class="season-detail-header">
          <button class="season-back" id="backToSeasons">← Temporadas</button>
          <h2>${escapeHtml(season.name)}</h2>
        </div>
        <div class="season-detail-empty">No se pudieron cargar los datos de la temporada.<br><small>${escapeHtml(error.message)}</small></div>`;
      els.detail.querySelector('#backToSeasons').addEventListener('click', hideDetail);
      return;
    }

    const rows = teamRows || [];
    let teams = [];
    if (rows.length) {
      const teamIds = [...new Set(rows.map((row) => row.team_id).filter(Boolean))];
      const { data: teamData } = await supabase
        .from('teams')
        .select('id,name,gender,category,is_active')
        .in('id', teamIds);
      teams = teamData || [];
    }

    const teamById = new Map(teams.map((team) => [team.id, team]));

    els.detail.innerHTML = `
      <div class="season-detail-header">
        <div>
          <button class="season-back" id="backToSeasons">← Volver a temporadas</button>
          <div class="season-detail-title-row">
            <div class="season-year-badge">${escapeHtml(season.start_year)}/${String(season.end_year).slice(-2)}</div>
            <div>
              <span class="seasons-kicker">TEMPORADA</span>
              <h2>${escapeHtml(season.name)}</h2>
              <span class="season-status ${season.is_active ? 'active' : ''}">${season.is_active ? 'ACTIVA' : 'HISTÓRICA'}</span>
            </div>
          </div>
        </div>
        <div class="season-detail-actions">
          ${!season.is_active ? '<button class="season-action" id="detailActivate">Activar temporada</button>' : ''}
          <button class="season-delete" id="deleteSeason">Eliminar temporada</button>
        </div>
      </div>

      <div class="season-detail-stats">
        <div><strong>${rows.length}</strong><span>equipos</span></div>
        <div><strong>${escapeHtml(season.start_year)}</strong><span>inicio</span></div>
        <div><strong>${escapeHtml(season.end_year)}</strong><span>fin</span></div>
        <div><strong>${formatDate(season.created_at)}</strong><span>creada</span></div>
      </div>

      <div class="season-detail-card">
        <div class="season-detail-card-heading">
          <div>
            <span class="seasons-kicker">ESTRUCTURA</span>
            <h3>Equipos de la temporada</h3>
          </div>
          <span class="season-detail-count">${rows.length}</span>
        </div>
        ${rows.length ? `
          <div class="season-team-list">
            ${rows.map((row) => {
              const team = teamById.get(row.team_id);
              return `
                <article class="season-team-row">
                  <div class="season-team-icon">🏀</div>
                  <div class="season-team-info">
                    <strong>${escapeHtml(row.display_name || team?.name || 'Equipo')}</strong>
                    <span>${escapeHtml(row.competition_name || team?.category || 'Sin competición')}${row.group_name ? ` · ${escapeHtml(row.group_name)}` : ''}</span>
                  </div>
                  <span class="season-team-status">${team?.is_active === false ? 'Inactivo' : 'Activo'}</span>
                </article>`;
            }).join('')}
          </div>` : `
          <div class="season-detail-empty">
            <div class="season-empty-icon">🏀</div>
            <h3>Sin equipos vinculados</h3>
            <p>Esta temporada todavía no tiene equipos asociados.</p>
          </div>`}
      </div>`;

    els.detail.querySelector('#backToSeasons').addEventListener('click', hideDetail);
    els.detail.querySelector('#detailActivate')?.addEventListener('click', () => activateSeason(id));
    els.detail.querySelector('#deleteSeason').addEventListener('click', () => deleteSeason(id));
    els.detail.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  const load = async () => {
    els.list.hidden = false;
    els.detail.hidden = true;
    els.list.innerHTML = '<div class="season-loading">Cargando temporadas…</div>';
    showMessage('');

    const { data, error } = await supabase
      .from('seasons')
      .select('id,name,start_year,end_year,is_active,created_at')
      .order('start_year', { ascending:false });

    if (error) {
      els.list.innerHTML = `<div class="season-empty"><div class="season-empty-icon">!</div><h3>No se pudieron cargar las temporadas</h3><p>${escapeHtml(error.message)}</p></div>`;
      return;
    }

    const rows = data || [];
    let counts = [];
    if (rows.length) {
      const { data: teamRows, error: teamError } = await supabase
        .from('team_seasons')
        .select('season_id');
      if (!teamError) counts = teamRows || [];
    }

    seasons = rows.map((season) => ({
      ...season,
      team_count: counts.filter((row) => row.season_id === season.id).length
    }));
    render();
  };

  const activateSeason = async (id) => {
    const season = seasons.find((item) => item.id === id);
    if (!season || season.is_active) return;

    const confirmed = window.confirm(`¿Activar la temporada "${season.name}"? La temporada activa actual dejará de estar activa.`);
    if (!confirmed) return;

    const { error: deactivateError } = await supabase
      .from('seasons')
      .update({ is_active:false })
      .eq('is_active', true);

    if (deactivateError) {
      showMessage(`No se pudo cambiar la temporada activa: ${deactivateError.message}`);
      return;
    }

    const { error } = await supabase
      .from('seasons')
      .update({ is_active:true })
      .eq('id', id);

    if (error) {
      showMessage(`No se pudo activar la temporada: ${error.message}`);
      await load();
      return;
    }

    showMessage(`La temporada ${season.name} está ahora activa.`, 'success');
    await load();
  };

  const deleteSeason = async (id) => {
    const season = seasons.find((item) => item.id === id);
    if (!season) return;

    if (season.is_active) {
      showMessage('No se puede eliminar la temporada activa. Activa otra temporada antes de eliminarla.');
      return;
    }

    const { count, error: dependencyError } = await supabase
      .from('team_seasons')
      .select('id', { count:'exact', head:true })
      .eq('season_id', id);

    if (dependencyError) {
      showMessage(`No se pudo comprobar si la temporada tiene datos asociados: ${dependencyError.message}`);
      return;
    }

    if ((count || 0) > 0) {
      showMessage('No se puede eliminar esta temporada porque tiene equipos vinculados. Para proteger el historial, primero hay que gestionar esos equipos.');
      return;
    }

    const confirmed = window.confirm(`¿Eliminar definitivamente la temporada "${season.name}"? Esta acción no se puede deshacer.`);
    if (!confirmed) return;

    const { error } = await supabase
      .from('seasons')
      .delete()
      .eq('id', id);

    if (error) {
      showMessage(`No se pudo eliminar la temporada: ${error.message}`);
      return;
    }

    hideDetail();
    showMessage(`Temporada ${season.name} eliminada correctamente.`, 'success');
    await load();
  };

  const submit = async (event) => {
    event.preventDefault();
    showMessage('');
    const startYear = Number(els.start.value);
    const endYear = startYear + 1;
    const name = els.name.value.trim();

    if (!name || !startYear) return;
    els.end.value = endYear;
    els.save.disabled = true;
    els.save.textContent = 'Creando…';

    const { error } = await supabase.from('seasons').insert({
      name,
      start_year:startYear,
      end_year:endYear,
      is_active:false
    });

    els.save.disabled = false;
    els.save.textContent = 'Crear temporada';

    if (error) {
      showMessage(`No se pudo crear la temporada: ${error.message}`);
      return;
    }

    closeModal();
    showMessage(`Temporada ${name} creada correctamente.`, 'success');
    await load();
  };

  els.search.addEventListener('input', () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });
  els.newButton.addEventListener('click', openModal);
  els.close.addEventListener('click', closeModal);
  els.cancel.addEventListener('click', closeModal);
  els.form.addEventListener('submit', submit);
  els.modal.addEventListener('click', (event) => {
    if (event.target === els.modal) closeModal();
  });

  load();

  return () => {
    searchTerm = '';
    seasons = [];
  };
}
