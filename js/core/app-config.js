export const APP_CONFIG = {
  name: 'ADLSM',
  fullName: 'ADLSM · Herramientas internas',
  version: '0.22.0',
  build: '2026.09.23.01',
  season: '',
  fab: {
    schedulesUrl: 'https://fabasket.com/horarios/',
    resultsPageUrl: 'https://fabasket.com/resultados/',
    competitions: {
      aragon: 'https://competiciones.feb.es/autonomicas/?a=3',
      zaragoza: 'https://competiciones.feb.es/autonomicas/?a=32'
    }
  },
  routes: { home: './', horarios: 'horarios/', resultados: 'resultados/' }
};

export const APP_VERSION_LABEL = `v${APP_CONFIG.version} · build ${APP_CONFIG.build}`;
