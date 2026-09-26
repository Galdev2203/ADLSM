import { supabase } from '../../core/supabase.js';

const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
  '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'
}[char]));

const genderLabel = (value) => ({
  male:'Masculino',
  female:'Femenino',
  mixed:'Mixto'
}[value] || value || '—');

const formatSeason = (season) => season ? `${season.start_year}/${String(season.end_year).slice(-2)}` : '—';

let seasons = [];
let teamSeasonRows = [];
let searchTerm = '';
let selectedSeasonId = '';
let editingId = null;

export function initEquipos() {
  const els = {
    list: document.querySelector('#teamList'),
    total: document.querySelector('#teamTotal'),
    active: document.querySelector('#teamActive'),
    seasonCount: document.querySelector('#teamSeasonCount'),
    seasonFilter: document.querySelector('#teamSeasonFilter'),
    search: document.querySelector('#teamSearch'),
    message: document.querySelector('#teamMessage'),
    detail: document.querySelector('#teamDetail'),
    modal: document.querySelector('#teamModal'),
    form: document.querySelector('#teamForm'),
    modalTitle: document.querySelector('#teamModalTitle'),
    season: document.querySelector('#teamSeason'),
    name: document.querySelector('#teamName'),
    displayName: document.querySelector('#teamDisplayName'),
    gender: document.querySelector('#teamGender'),
    category: document.querySelector('#teamCategory'),
    competition: document.querySelector('#teamCompetition'),
    group: document.querySelector('#teamGroup'),
    venue: document.querySelector('#teamVenue'),
    address: document.querySelector('#teamAddress'),
    notes: document.querySelector('#teamNotes'),
    close: document.querySelector('#closeTeamModal'),
    cancel: document.querySelector('#cancelTeam'),
    save: document.querySelector('#saveTeam'),
    newButton: document.querySelector('#newTeamButton')
  };

  const showMessage = (message, type = 'error') => {
    els.message.hidden = !message;
    els.message.className = `team-message ${type}`;
    els.message.textContent = message || '';
  };

  const getSeason = (id) => seasons.find((season) => season.id === id);

  const populateSeasonSelects = () => {
    const options = seasons.map((season) =>
      `<option value="${season.id}">${escapeHtml(formatSeason(season))} · ${escapeHtml(season.name)}</option>`
    ).join('');

    els.seasonFilter.innerHTML = '<option value="">Todas</option>' + options;
    els.season.innerHTML = '<option value="">Selecciona una temporada</option>' + options;
  };

  const openModal = (row = null) => {
    editingId = row?.id || null;
    els.form.reset();
    els.modalTitle.textContent = editingId ? 'Editar equipo' : 'Crear equipo';
    els.save.textContent = editingId ? 'Guardar cambios' : 'Crear equipo';

    if (row) {
      els.season.value = row.season_id;
      els.season.disabled = true;
      els.name.value = row.team?.name || '';
      els.displayName.value = row.display_name || row.team?.name || '';
      els.gender.value = row.gender || row.team?.gender || '';
      els.category.value = row.team?.category || '';
      els.competition.value = row.competition_name || '';
      els.group.value = row.group_name || '';
      els.venue.value = row.venue_name || '';
      els.address.value = row.venue_address || '';
      els.notes.value = row.notes || row.team?.notes || '';
    } else {
      els.season.disabled = false;
      const defaultSeason = selectedSeasonId || seasons.find((season) => season.is_active)?.id || seasons[0]?.id || '';
      els.season.value = defaultSeason;
      els.displayName.value = '';
    }

    els.modal.hidden = false;
    requestAnimationFrame(() => els.name.focus());
  };

  const closeModal = () => {
    els.modal.hidden = true;
    els.form.reset();
    els.season.disabled = false;
    editingId = null;
  };

  const hideDetail = () => {
    els.detail.hidden = true;
    els.list.hidden = false;
    render();
  };

  const render = () => {
    const selected = selectedSeasonId ? getSeason(selectedSeasonId) : null;

    const filtered = teamSeasonRows.filter((row) => {
      if (selectedSeasonId && row.season_id !== selectedSeasonId) return false;
      const haystack = [
        row.display_name,
        row.team?.name,
        row.team?.category,
        row.competition_name,
        row.group_name,
        genderLabel(row.gender),
        row.season?.name
      ].join(' ').toLowerCase();
      return haystack.includes(searchTerm);
    });

    const visibleBaseIds = new Set(filtered.map((row) => row.team_id));
    els.total.textContent = filtered.length;
    els.active.textContent = filtered.filter((row) => row.team?.is_active !== false).length;
    els.seasonCount.textContent = selectedSeasonId
      ? filtered.length
      : teamSeasonRows.filter((row) => row.season?.is_active).length;

    if (!filtered.length) {
      els.list.innerHTML = `
        <div class="team-empty">
          <div class="team-empty-icon">🏀</div>
          <h3>${teamSeasonRows.length ? 'No hay equipos que coincidan' : 'Todavía no hay equipos'}</h3>
          <p>${teamSeasonRows.length
            ? 'Prueba con otra temporada o término de búsqueda.'
            : 'Crea el primer equipo para empezar a organizar las plantillas y competiciones.'}</p>
          ${teamSeasonRows.length ? '' : '<button class="teams-primary" id="emptyNewTeam" type="button">Crear equipo</button>'}
        </div>`;
      document.querySelector('#emptyNewTeam')?.addEventListener('click', () => openModal());
      return;
    }

    els.list.innerHTML = filtered.map((row) => `
      <article class="team-card">
        <div class="team-card-main">
          <div class="team-icon">🏀</div>
          <div class="team-card-info">
            <div class="team-card-title-row">
              <h3>${escapeHtml(row.display_name || row.team?.name || 'Equipo')}</h3>
              <span class="team-status ${row.team?.is_active !== false ? 'active' : ''}">
                ${row.team?.is_active !== false ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
            <p>${escapeHtml(row.competition_name || row.team?.category || 'Sin competición')}</p>
            <div class="team-card-meta">
              <span>${escapeHtml(formatSeason(row.season))}</span>
              <span>${escapeHtml(genderLabel(row.gender || row.team?.gender))}</span>
              ${row.group_name ? `<span>${escapeHtml(row.group_name)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="team-card-actions">
          <button class="team-action team-view-action" type="button" data-action="view" data-id="${row.id}">Ver equipo</button>
          <button class="team-action" type="button" data-action="edit" data-id="${row.id}">Editar</button>
        </div>
      </article>`).join('');

    els.list.querySelectorAll('[data-action="view"]').forEach((button) => {
      button.addEventListener('click', () => showDetail(button.dataset.id));
    });
    els.list.querySelectorAll('[data-action="edit"]').forEach((button) => {
      button.addEventListener('click', () => {
        const row = teamSeasonRows.find((item) => item.id === button.dataset.id);
        if (row) openModal(row);
      });
    });
  };

  const showDetail = (id) => {
    const row = teamSeasonRows.find((item) => item.id === id);
    if (!row) return;

    els.list.hidden = true;
    els.detail.hidden = false;
    els.detail.innerHTML = `
      <div class="team-detail-header">
        <div>
          <button class="team-back" id="backToTeams" type="button">← Volver a equipos</button>
          <div class="team-detail-title-row">
            <div class="team-icon team-detail-icon">🏀</div>
            <div>
              <span class="teams-kicker">EQUIPO · ${escapeHtml(formatSeason(row.season))}</span>
              <h2>${escapeHtml(row.display_name || row.team?.name || 'Equipo')}</h2>
              <span class="team-status ${row.team?.is_active !== false ? 'active' : ''}">
                ${row.team?.is_active !== false ? 'ACTIVO' : 'INACTIVO'}
              </span>
            </div>
          </div>
        </div>
        <div class="team-detail-actions">
          <button class="team-action" id="detailEdit" type="button">Editar equipo</button>
        </div>
      </div>

      <div class="team-detail-stats">
        <div><strong>${escapeHtml(genderLabel(row.gender || row.team?.gender))}</strong><span>género</span></div>
        <div><strong>${escapeHtml(row.team?.category || '—')}</strong><span>categoría</span></div>
        <div><strong>${escapeHtml(row.competition_name || '—')}</strong><span>competición</span></div>
        <div><strong>${escapeHtml(row.group_name || '—')}</strong><span>grupo</span></div>
      </div>

      <div class="team-detail-grid">
        <article class="team-detail-card">
          <span class="teams-kicker">COMPETICIÓN</span>
          <h3>Datos de la temporada</h3>
          <dl>
            <div><dt>Temporada</dt><dd>${escapeHtml(row.season?.name || formatSeason(row.season))}</dd></div>
            <div><dt>Competición</dt><dd>${escapeHtml(row.competition_name || '—')}</dd></div>
            <div><dt>Grupo</dt><dd>${escapeHtml(row.group_name || '—')}</dd></div>
          </dl>
        </article>

        <article class="team-detail-card">
          <span class="teams-kicker">INSTALACIÓN</span>
          <h3>Pabellón</h3>
          <dl>
            <div><dt>Nombre</dt><dd>${escapeHtml(row.venue_name || '—')}</dd></div>
            <div><dt>Dirección</dt><dd>${escapeHtml(row.venue_address || '—')}</dd></div>
          </dl>
        </article>

        <article class="team-detail-card team-detail-card-wide">
          <span class="teams-kicker">INFORMACIÓN</span>
          <h3>Notas</h3>
          <p class="team-detail-notes">${escapeHtml(row.notes || row.team?.notes || 'Sin notas registradas.')}</p>
        </article>
      </div>`;

    els.detail.querySelector('#backToTeams').addEventListener('click', hideDetail);
    els.detail.querySelector('#detailEdit').addEventListener('click', () => openModal(row));
    els.detail.scrollIntoView({ behavior:'smooth', block:'start' });
  };

  const load = async (clearMessage = true) => {
    els.list.hidden = false;
    els.detail.hidden = true;
    els.list.innerHTML = '<div class="team-loading">Cargando equipos…</div>';
    if (clearMessage) showMessage('');

    const [seasonResult, teamResult, relationResult] = await Promise.all([
      supabase.from('seasons').select('id,name,start_year,end_year,is_active').order('start_year', { ascending:false }),
      supabase.from('teams').select('id,name,gender,category,notes,is_active').order('name', { ascending:true }),
      supabase.from('team_seasons').select('id,season_id,team_id,display_name,gender,competition_name,group_name,venue_name,venue_address,notes,created_at,updated_at').order('created_at', { ascending:false })
    ]);

    if (seasonResult.error || teamResult.error || relationResult.error) {
      const error = seasonResult.error || teamResult.error || relationResult.error;
      els.list.innerHTML = `
        <div class="team-empty">
          <div class="team-empty-icon">!</div>
          <h3>No se pudieron cargar los equipos</h3>
          <p>${escapeHtml(error?.message || 'Error desconocido')}</p>
        </div>`;
      return;
    }

    seasons = seasonResult.data || [];
    const teams = teamResult.data || [];
    const relations = relationResult.data || [];
    const teamById = new Map(teams.map((team) => [team.id, team]));
    const seasonById = new Map(seasons.map((season) => [season.id, season]));

    teamSeasonRows = relations.map((row) => ({
      ...row,
      team: teamById.get(row.team_id) || null,
      season: seasonById.get(row.season_id) || null
    })).filter((row) => row.season);

    populateSeasonSelects();

    if (!selectedSeasonId || !seasons.some((season) => season.id === selectedSeasonId)) {
      selectedSeasonId = seasons.find((season) => season.is_active)?.id || '';
    }

    els.seasonFilter.value = selectedSeasonId;
    render();
  };

  const submit = async (event) => {
    event.preventDefault();
    showMessage('');

    const seasonId = els.season.value;
    const name = els.name.value.trim();
    const displayName = els.displayName.value.trim() || name;
    const gender = els.gender.value;
    const category = els.category.value.trim();
    const competition = els.competition.value.trim();
    const group = els.group.value.trim();
    const venue = els.venue.value.trim();
    const address = els.address.value.trim();
    const notes = els.notes.value.trim();

    if (!seasonId || !name || !gender) {
      showMessage('Completa la temporada, el nombre del equipo y el género.');
      return;
    }

    els.save.disabled = true;
    els.save.textContent = editingId ? 'Guardando…' : 'Creando…';

    if (editingId) {
      const row = teamSeasonRows.find((item) => item.id === editingId);
      if (!row) {
        showMessage('No se encontró el equipo que quieres editar.');
        els.save.disabled = false;
        els.save.textContent = 'Guardar cambios';
        return;
      }

      const { error: teamError } = await supabase
        .from('teams')
        .update({ name, gender, category, notes, updated_at:new Date().toISOString() })
        .eq('id', row.team_id);

      if (teamError) {
        showMessage(`No se pudo actualizar el equipo: ${teamError.message}`);
        els.save.disabled = false;
        els.save.textContent = 'Guardar cambios';
        return;
      }

      const { error: relationError } = await supabase
        .from('team_seasons')
        .update({
          display_name:displayName,
          gender,
          competition_name:competition,
          group_name:group,
          venue_name:venue,
          venue_address:address,
          notes,
          updated_at:new Date().toISOString()
        })
        .eq('id', editingId);

      if (relationError) {
        showMessage(`No se pudieron guardar los datos de la temporada: ${relationError.message}`);
        els.save.disabled = false;
        els.save.textContent = 'Guardar cambios';
        await load(false);
        return;
      }

      closeModal();
      await load(false);
      showMessage('Equipo actualizado correctamente.', 'success');
      return;
    }

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({ name, gender, category, notes, is_active:true })
      .select('id,name,gender,category,notes,is_active')
      .single();

    if (teamError) {
      showMessage(`No se pudo crear el equipo: ${teamError.message}`);
      els.save.disabled = false;
      els.save.textContent = 'Crear equipo';
      return;
    }

    const { error: relationError } = await supabase
      .from('team_seasons')
      .insert({
        season_id:seasonId,
        team_id:team.id,
        display_name:displayName,
        gender,
        competition_name:competition,
        group_name:group,
        venue_name:venue,
        venue_address:address,
        notes
      });

    if (relationError) {
      await supabase.from('teams').delete().eq('id', team.id);
      showMessage(`No se pudo vincular el equipo a la temporada: ${relationError.message}`);
      els.save.disabled = false;
      els.save.textContent = 'Crear equipo';
      return;
    }

    closeModal();
    selectedSeasonId = seasonId;
    showMessage(`Equipo ${displayName} creado correctamente.`, 'success');
    await load();
  };

  els.search.addEventListener('input', () => {
    searchTerm = els.search.value.trim().toLowerCase();
    render();
  });

  els.seasonFilter.addEventListener('change', () => {
    selectedSeasonId = els.seasonFilter.value;
    render();
  });

  els.newButton.addEventListener('click', () => {
    if (!seasons.length) {
      showMessage('Primero necesitas crear una temporada.');
      return;
    }
    openModal();
  });

  els.close.addEventListener('click', closeModal);
  els.cancel.addEventListener('click', closeModal);
  els.form.addEventListener('submit', submit);
  els.modal.addEventListener('click', (event) => {
    if (event.target === els.modal) closeModal();
  });

  load();

  return () => {
    seasons = [];
    teamSeasonRows = [];
    searchTerm = '';
    selectedSeasonId = '';
    editingId = null;
  };
}