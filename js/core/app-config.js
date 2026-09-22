export const APP_CONFIG = {
  name: 'ADLSM',
  fullName: 'ADLSM · Herramientas internas',
  version: '0.18.0',
  build: '2026.09.22.10',
  season: '2026/27',
  fab: {
    schedulesUrl: 'https://fabasket.com/horarios/',
    resultsPageUrl: 'https://fabasket.com/resultados/',
    competitions: {
      aragon: 'https://competiciones.feb.es/autonomicas/?a=3&c=23460&med=0',
      zaragoza: 'https://competiciones.feb.es/autonomicas/?a=32&c=23063&med=0'
    }
  },
  routes: {
    home: './',
    horarios: 'horarios/',
    resultados: 'resultados/'
  }
};

export const APP_VERSION_LABEL = `v${APP_CONFIG.version} · build ${APP_CONFIG.build}`;
