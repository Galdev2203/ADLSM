import { createSectionToolbar } from '../../components/section-toolbar.js';

export const PERSONAS_VIEW = `
<section class="panel personas-panel">
    ${createSectionToolbar({
    className: 'personas-toolbar',
    id: 'personasToolbar',
    summary: [
      { id: 'peopleCount', label: 'personas' },
      { id: 'peopleActive', label: 'activas' }
    ],
    primaryAction: { id: 'newPerson', label: '+ Nueva persona' },
    search: { id: 'peopleSearch', placeholder: 'Buscar persona…' },
    filters: [
      { id: 'peopleFunctionFilter', label: 'Función', options: [
        { value: '', label: 'Todas las funciones' }, { value: 'player', label: 'Jugador' },
        { value: 'coach', label: 'Entrenador' }, { value: 'responsible', label: 'Responsable' },
        { value: 'coordinator', label: 'Coordinador' }, { value: 'none', label: 'Sin función' }
      ]},
      { id: 'peopleStatusFilter', label: 'Estado', options: [
        { value: '', label: 'Todos los estados' }, { value: 'active', label: 'Activas' },
        { value: 'inactive', label: 'Inactivas' }
      ]}
    ],
    viewToggle: { cardsId: 'peopleCardsView', tableId: 'peopleTableView', label: 'Vista de personas' }
  })}

  <div id="peopleList" class="people-list"></div>
  <div id="peoplePagination" class="list-pagination" hidden></div>
  <section id="personDetail" class="person-detail" hidden></section>
</section>

<div class="person-modal-backdrop" id="personModal" hidden>
  <div class="person-modal" role="dialog" aria-modal="true" aria-labelledby="personModalTitle">
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