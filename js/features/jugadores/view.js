import { createSectionToolbar } from '../../components/section-toolbar.js?v=20260927-2';

export const JUGADORES_VIEW = `
<section class="players-page">
    ${createSectionToolbar({
    className: 'players-toolbar', id: 'playersToolbar',
    summary: [
      { id: 'playerTotal', label: 'jugadores' }, { id: 'playerActive', label: 'activos' }, { id: 'playerSeasonCount', label: 'en temporada' }
    ],
    primaryAction: { id: 'newPlayerButton', label: '+ Nuevo jugador' },
    search: { id: 'playerSearch', placeholder: 'Buscar jugador…' },
    filters: [{ id: 'playerSeasonFilter', label: 'Temporada', options: [{ value: '', label: 'Todas' }] }],
    viewToggle: { cardsId: 'playersCardsView', tableId: 'playersTableView', label: 'Vista de jugadores' }
  })}

  <div id="playerList" class="player-list"><div class="player-loading">Cargando jugadores…</div></div>
  <div id="playerPagination" class="list-pagination" hidden></div>
  <section id="playerDetail" class="player-detail" hidden></section>
</section>

<div class="player-modal-backdrop" id="playerModal" hidden>
  <div class="player-modal" role="dialog" aria-modal="true" aria-labelledby="playerModalTitle">
    <div class="player-modal-header">
      <div><span class="players-kicker">JUGADORES</span><h3 id="playerModalTitle">Nuevo jugador</h3></div>
      <button class="player-close" id="closePlayerModal" type="button" aria-label="Cerrar">×</button>
    </div>
    <form id="playerForm">
      <div class="player-form-section"><span class="players-kicker">DATOS PERSONALES</span></div>
      <div class="player-form-grid">
        <label>Nombre<input id="playerFirstName" type="text" maxlength="100" required></label>
        <label>Apellidos<input id="playerLastName" type="text" maxlength="160" required></label>
      </div>
      <div class="player-form-grid">
        <label>Fecha de nacimiento<input id="playerBirthDate" type="date"></label>
        <label>Teléfono<input id="playerPhone" type="tel" maxlength="40"></label>
      </div>
      <label>Email<input id="playerEmail" type="email" maxlength="180" placeholder="correo@ejemplo.com"></label>

      <div class="player-form-section"><span class="players-kicker">DATOS DEPORTIVOS</span></div>
      <div class="player-form-grid">
        <label>Temporada inicial<select id="playerSeason" required><option value="">Selecciona una temporada</option></select></label>
        <label>Equipo principal<select id="playerTeamSeason" required><option value="">Selecciona una temporada primero</option></select></label>
      </div>
      <div class="player-form-grid">
        <label>Licencia federativa<input id="playerLicense" type="text" maxlength="100"></label>
        <label>Posición<input id="playerPosition" type="text" maxlength="80" placeholder="Base, escolta…"></label>
      </div>
      <div class="player-form-grid">
        <label>Dorsal<input id="playerShirtNumber" type="number" min="0" max="99"></label>
        <label>Estado<select id="playerStatus"><option value="active">Activo</option><option value="inactive">Inactivo</option></select></label>
      </div>
      <label>Notas<textarea id="playerNotes" rows="3" maxlength="1000"></textarea></label>
      <p class="player-form-hint">Si ya existe una persona con el mismo email, teléfono o nombre completo, ADLSM reutilizará su ficha en lugar de crear otra.</p>
      <div class="player-modal-actions">
        <button type="button" class="player-secondary" id="cancelPlayer">Cancelar</button>
        <button type="submit" class="players-primary" id="savePlayer">Crear jugador</button>
      </div>
    </form>
  </div>
</div>`;