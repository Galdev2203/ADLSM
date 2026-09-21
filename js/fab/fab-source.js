const FAB_BASE = 'https://fabasket.com/wp-content/uploads';

function dateParts(isoDate) {
  const [year, month, day] = isoDate.split('-');
  return { year, month, ddmmyy: `${day}${month}${year.slice(2)}` };
}

function candidateUrls(isoDate) {
  const { year, month, ddmmyy } = dateParts(isoDate);
  const folder = `${year}/${month}`;
  const base = `${FAB_BASE}/${folder}/HORARIOS-FAB-${ddmmyy}`;
  return [
    `${base}.pdf`,
    `${base}J.pdf`,
    `${base}X.pdf`,
    `${base}M.pdf`,
    `${base}A.pdf`
  ];
}

export async function findFabDocuments(isoDate) {
  const urls = candidateUrls(isoDate);
  let lastError = null;

  for (const url of urls) {
    try {
      const response = await fetch(url, { method: 'GET', mode: 'cors', cache: 'no-store' });
      if (!response.ok) {
        lastError = new Error(`${response.status} al consultar ${url}`);
        continue;
      }
      const bytes = await response.arrayBuffer();
      if (bytes.byteLength < 1000) continue;
      return { url, bytes };
    } catch (error) {
      lastError = error;
    }
  }

  throw new Error('FAB no permite recuperar el documento directamente desde GitHub Pages (CORS) o no se encontró una de las variantes conocidas.');
}

export { candidateUrls };
