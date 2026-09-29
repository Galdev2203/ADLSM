import { createSectionToolbar } from '../../components/section-toolbar.js?v=20260927-4';

export const ENTRENADORES_VIEW = `
<section class="coaches-page">
    ${createSectionToolbar({
    className: 'coaches-toolbar', id: 'coachesToolbar',
    summary: [
      { id: 'coachTotal', label: 'entrenadores' }, { id: 'coachActive', label: 'activos' }, { id: 'coachTeamCount', label: 'equipos' }
    ],
    viewToggle: { cardsId: 'coachCardsView', tableId: 'coachTableView', label: 'Vista de entrenadores' },
    primaryAction: { id: 'newCoachButton', label: '+ Nuevo entrenador' },
    search: { id: 'coachSearch', placeholder: 'Buscar entrenador…' },
    filters: [{ id: 'coachSeasonFilter', label: 'Temporada', options: [{ value: '', label: 'Todas' }] }]
  })}

  <div id="coachList" class="coach-list"><div class="coach-loading">Cargando entrenadores…</div></div>
  <section id="coachDetail" class="coach-detail" hidden></section>
</section>

<div class="coach-modal-backdrop" id="coachModal" hidden>
  <div class="coach-modal" role="dialog" aria-modal="true" aria-labelledby="coachModalTitle">
    <div class="coach-modal-header">
      <div><span class="coaches-kicker">ENTRENADORES</span><h3 id="coachModalTitle">Nuevo entrenador</h3></div>
      <button class="coach-close" id="closeCoachModal" type="button" aria-label="Cerrar">×</button>
    </div>
    <form id="coachForm">
      <div class="coach-form-section"><span class="coaches-kicker">DATOS PERSONALES</span></div>
      <div class="coach-form-grid">
        <label>Nombre<input id="coachFirstName" type="text" maxlength="100" required></label>
        <label>Apellidos<input id="coachLastName" type="text" maxlength="160" required></label>
      </div>
      <div class="coach-form-grid">
        <label>Fecha de nacimiento<input id="coachBirthDate" type="date"></label>
        <label>Teléfono<input id="coachPhone" type="tel" maxlength="40"></label>
      </div>
      <label>Email<input id="coachEmail" type="email" maxlength="180" placeholder="correo@ejemplo.com"></label>

      <div class="coach-form-section"><span class="coaches-kicker">DATOS PROFESIONALES</span></div>
      <div class="coach-form-grid">
        <label>Licencia federativa<input id="coachLicense" type="text" maxlength="100"></label>
        <label>Cualificación<input id="coachQualification" type="text" maxlength="120" placeholder="Nivel, titulación…"></label>
      </div>
      <label>Notas<textarea id="coachNotes" rows="3" maxlength="1000"></textarea></label>

      <div class="coach-form-section"><span class="coaches-kicker">ASIGNACIÓN INICIAL</span></div>
      <div class="coach-form-grid">
        <label>Temporada<select id="coachSeason" required><option value="">Selecciona una temporada</option></select></label>
        <label>Equipo<select id="coachTeamSeason" required><option value="">Selecciona una temporada primero</option></select></label>
      </div>
      <div class="coach-form-grid">
        <label>Rol<select id="coachRole"><option value="principal">Primer entrenador</option><option value="second">Segundo entrenador</option><option value="assistant">Ayudante</option></select></label>
      </div>
      <p class="coach-form-hint">Si la persona ya existe en ADLSM, se reutilizará su ficha. Así puede ser jugador y entrenador sin duplicarse.</p>
      <div class="coach-modal-actions">
        <button type="button" class="coach-secondary" id="cancelCoach">Cancelar</button>
        <button type="submit" class="coaches-primary" id="saveCoach">Crear entrenador</button>
      </div>
    </form>
  </div>
</div>`;
