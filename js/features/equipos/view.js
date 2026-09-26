export const EQUIPOS_VIEW = `
<section class="teams-page">
  <div class="teams-toolbar" id="teamsToolbar">
    <button class="teams-primary teams-toolbar-new" id="newTeamButton" type="button">+ Nuevo equipo</button>

    <div class="teams-summary">
      <div><strong id="teamTotal">0</strong><span>equipos</span></div>
      <div><strong id="teamActive">0</strong><span>activos</span></div>
      <div><strong id="teamSeasonCount">0</strong><span>en temporada</span></div>
    </div>

    <label class="teams-filter">
      <span>Temporada</span>
      <select id="teamSeasonFilter">
        <option value="">Todas</option>
      </select>
    </label>

    <label class="teams-search">
      <span>Buscar</span>
      <input id="teamSearch" type="search" placeholder="Buscar equipo…">
    </label>
  </div>

  <div id="teamMessage" class="team-message" hidden></div>

  <div id="teamList" class="team-list">
    <div class="team-loading">Cargando equipos…</div>
  </div>

  <section id="teamDetail" class="team-detail" hidden></section>
</section>

<div class="team-modal-backdrop" id="teamModal" hidden>
  <div class="team-modal" role="dialog" aria-modal="true" aria-labelledby="teamModalTitle">
    <div class="team-modal-header">
      <div>
        <span class="teams-kicker">NUEVO EQUIPO</span>
        <h3 id="teamModalTitle">Crear equipo</h3>
      </div>
      <button class="team-close" id="closeTeamModal" type="button" aria-label="Cerrar">×</button>
    </div>

    <form id="teamForm">
      <label>Temporada
        <select id="teamSeason" name="season_id" required>
          <option value="">Selecciona una temporada</option>
        </select>
      </label>

      <div class="team-form-grid">
        <label>Nombre del equipo
          <input id="teamName" name="name" type="text" placeholder="Ej.: Senior Masculino" maxlength="120" required>
        </label>
        <label>Nombre en la temporada
          <input id="teamDisplayName" name="display_name" type="text" placeholder="Ej.: Senior Masculino A" maxlength="120">
        </label>
      </div>

      <div class="team-form-grid">
        <label>Género
          <select id="teamGender" name="gender" required>
            <option value="">Selecciona</option>
            <option value="male">Masculino</option>
            <option value="female">Femenino</option>
            <option value="mixed">Mixto</option>
          </select>
        </label>
        <label>Categoría
          <input id="teamCategory" name="category" type="text" placeholder="Ej.: Senior" maxlength="100">
        </label>
      </div>

      <div class="team-form-grid">
        <label>Competición
          <input id="teamCompetition" name="competition_name" type="text" placeholder="Ej.: Segunda Aragonesa Masculina" maxlength="160">
        </label>
        <label>Grupo
          <input id="teamGroup" name="group_name" type="text" placeholder="Ej.: Grupo A" maxlength="100">
        </label>
      </div>

      <div class="team-form-grid">
        <label>Pabellón
          <input id="teamVenue" name="venue_name" type="text" placeholder="Nombre del pabellón" maxlength="160">
        </label>
        <label>Dirección
          <input id="teamAddress" name="venue_address" type="text" placeholder="Dirección del pabellón" maxlength="240">
        </label>
      </div>

      <label>Notas
        <textarea id="teamNotes" name="notes" rows="3" maxlength="1000" placeholder="Información adicional del equipo…"></textarea>
      </label>

      <div class="team-modal-actions">
        <button type="button" class="team-secondary" id="cancelTeam">Cancelar</button>
        <button type="submit" class="teams-primary" id="saveTeam">Crear equipo</button>
      </div>
    </form>
  </div>
</div>`;