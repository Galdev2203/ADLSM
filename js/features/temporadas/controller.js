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
    total: document.querySelector('#seasonTotal'),
    active: document.querySelector('#seasonActive'),
    historical: document.querySelector('#seasonHistorical'),
    search: document.querySelector('#seasonSearch'),
    message: document.querySelector('#seasonMessage'),
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
          ${season.is_active ? '<span class="season-current">En uso</span>' : `<button class="season-action" data-action="activate" data-id="${season.id}">Activar</button>`}
        </div>
      </article>`).join('');

    els.list.querySelectorAll('[data-action="activate"]').forEach((button) => {
      button.addEventListener('click', () => activateSeason(button.dataset.id));
    });
  };

  const load = async () => {
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
