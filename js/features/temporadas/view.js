export const TEMPORADAS_VIEW = `
<section class="seasons-page">
  <div class="seasons-header">
    <div>
      <span class="seasons-kicker">GESTIÓN</span>
      <h2>Temporadas</h2>
      <p>Gestiona las temporadas deportivas y conserva todo el historial del club.</p>
    </div>
    <button class="seasons-primary" id="newSeasonButton">+ Nueva temporada</button>
  </div>

  <div class="seasons-toolbar">
    <div class="seasons-summary">
      <div><strong id="seasonTotal">0</strong><span>temporadas</span></div>
      <div><strong id="seasonActive">0</strong><span>activa</span></div>
      <div><strong id="seasonHistorical">0</strong><span>históricas</span></div>
    </div>
    <label class="seasons-search">
      <span>Buscar</span>
      <input id="seasonSearch" type="search" placeholder="Buscar temporada…">
    </label>
  </div>

  <div id="seasonMessage" class="season-message" hidden></div>
  <div id="seasonList" class="season-list">
    <div class="season-loading">Cargando temporadas…</div>
  </div>
</section>

<div class="season-modal-backdrop" id="seasonModal" hidden>
  <div class="season-modal" role="dialog" aria-modal="true" aria-labelledby="seasonModalTitle">
    <div class="season-modal-header">
      <div>
        <span class="seasons-kicker">NUEVA TEMPORADA</span>
        <h3 id="seasonModalTitle">Crear temporada</h3>
      </div>
      <button class="season-close" id="closeSeasonModal" type="button" aria-label="Cerrar">×</button>
    </div>
    <form id="seasonForm">
      <label>Nombre de la temporada
        <input id="seasonName" name="name" type="text" placeholder="Ej.: 2026/27" required maxlength="80">
      </label>
      <div class="season-form-grid">
        <label>Año de inicio
          <input id="seasonStart" name="start_year" type="number" min="1900" max="2200" required>
        </label>
        <label>Año de finalización
          <input id="seasonEnd" name="end_year" type="number" readonly>
        </label>
      </div>
      <p class="season-form-help">La base de datos exige que la temporada abarque exactamente un año deportivo.</p>
      <div class="season-modal-actions">
        <button type="button" class="season-secondary" id="cancelSeason">Cancelar</button>
        <button type="submit" class="seasons-primary" id="saveSeason">Crear temporada</button>
      </div>
    </form>
  </div>
</div>`;
