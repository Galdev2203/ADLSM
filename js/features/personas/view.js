export const PERSONAS_VIEW = `
<section class="panel personas-panel">
  <div class="section-toolbar personas-toolbar">
    <div class="toolbar-main">
      <button class="primary-button" id="newPerson">+ Nueva persona</button>
      <div class="toolbar-summary">
        <strong id="peopleCount">0</strong><span>personas</span>
        <strong id="peopleActive">0</strong><span>activas</span>
      </div>
    </div>
    <div class="toolbar-filters">
      <select id="peopleFunctionFilter" aria-label="Filtrar por función">
        <option value="">Todas las funciones</option>
        <option value="player">Jugador</option>
        <option value="coach">Entrenador</option>
        <option value="responsible">Responsable</option>
        <option value="coordinator">Coordinador</option>
        <option value="none">Sin función</option>
      </select>
      <select id="peopleStatusFilter" aria-label="Filtrar por estado">
        <option value="">Todos los estados</option>
        <option value="active">Activas</option>
        <option value="inactive">Inactivas</option>
      </select>
      <input id="peopleSearch" type="search" placeholder="Buscar persona..." autocomplete="off">
    </div>
  </div>

  <div id="peopleList" class="people-list"></div>
  <section id="personDetail" class="person-detail" hidden></section>
</section>

<div class="adlsm-modal-backdrop" id="personModal" hidden>
  <div class="adlsm-modal person-modal" role="dialog" aria-modal="true" aria-labelledby="personModalTitle">
    <div class="modal-header">
      <div>
        <span class="modal-kicker">PERSONAS</span>
        <h2 id="personModalTitle">Nueva persona</h2>
      </div>
      <button class="modal-close" id="closePersonModal" type="button" aria-label="Cerrar">×</button>
    </div>
    <form id="personForm">
      <div class="person-form-grid">
        <label><span>Nombre</span><input id="personFirstName" required maxlength="100"></label>
        <label><span>Apellidos</span><input id="personLastName" required maxlength="150"></label>
        <label><span>Fecha de nacimiento</span><input id="personBirthDate" type="date"></label>
        <label><span>Teléfono</span><input id="personPhone" type="tel" maxlength="40"></label>
        <label class="full"><span>Email</span><input id="personEmail" type="email" maxlength="180"></label>
        <label class="full"><span>Foto (URL)</span><input id="personPhotoUrl" type="url" maxlength="500"></label>
        <label class="full"><span>Notas</span><textarea id="personNotes" rows="3"></textarea></label>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" id="cancelPerson" type="button">Cancelar</button>
        <button class="primary-button" id="savePerson" type="submit">Guardar persona</button>
      </div>
    </form>
  </div>
</div>
`;