export const CALENDARIO_VIEW = `<section class="calendar-tool">
  <div class="calendar-tool-intro"><span class="calendar-tool-eyebrow">HERRAMIENTA TEMPORAL</span><h2>Calendario conjunto</h2><p>Sube los calendarios PDF de FAB/FEB y obtén todos los partidos de La Salle Montemolín agrupados por fin de semana. No se guardará ningún documento ni resultado.</p></div>
  <label class="calendar-upload" for="calendarPdfInput"><span class="calendar-upload-icon">↑</span><strong>Seleccionar documentos PDF</strong><span>También puedes seleccionar varios archivos a la vez.</span><input id="calendarPdfInput" type="file" accept="application/pdf,.pdf" multiple></label>
  <div id="calendarStatus" class="calendar-status" aria-live="polite"></div>
  <div id="calendarResults" class="calendar-results"></div>
</section>`;
