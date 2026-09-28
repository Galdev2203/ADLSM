export const CALENDARIO_VIEW = `<section class="calendar-tool">
  <div class="calendar-tool-intro"><span class="calendar-tool-eyebrow">TEMPORADA 2026/27</span><h2>Calendario conjunto</h2><p>Los partidos de La Salle Montemolín se muestran automáticamente a partir de los calendarios FAB/FEB incorporados al repositorio. Puedes cargar otros PDF para hacer una consulta puntual; esos archivos se procesan en tu navegador y no se guardan.</p></div>
  <div class="calendar-data-badge"><span class="calendar-data-dot"></span>Calendario guardado en la web · Sin base de datos</div>
  <details class="calendar-upload-details"><summary>Consultar otros documentos PDF</summary>
    <label class="calendar-upload" for="calendarPdfInput"><span class="calendar-upload-icon">↑</span><strong>Seleccionar documentos PDF</strong><span>También puedes seleccionar varios archivos a la vez.</span><input id="calendarPdfInput" type="file" accept="application/pdf,.pdf" multiple></label>
  </details>
  <div id="calendarStatus" class="calendar-status" aria-live="polite"></div>
  <div id="calendarResults" class="calendar-results"></div>
</section>`;