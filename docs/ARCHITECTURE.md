# Arquitectura ADLSM

## Objetivo

ADLSM es una herramienta web interna estática publicada con GitHub Pages. La aplicación se divide por funcionalidades para que cada módulo pueda evolucionar sin acoplarse al resto.

## Estructura

```text
/
├── index.html                    # Dashboard
├── horarios/index.html           # Horarios FAB + generador Instagram
├── resultados/index.html         # Resultados y análisis FEB/FAB
├── assets/
│   └── logos/
├── css/
│   ├── styles.css                # Estilos base de Horarios
│   ├── home.css                  # Dashboard
│   ├── site.css                  # Navegación compartida
│   └── results.css               # Resultados
└── js/
    ├── core/
    │   ├── app-config.js         # Configuración y versionado
    │   └── site-shell.js         # Navegación y footer compartidos
    ├── fab/
    │   ├── fab-source.js
    │   ├── fab-parser.js
    │   └── fab-normalizer.js
    ├── horarios/
    │   └── controller.js         # Controlador de Horarios
    ├── resultados/
    │   ├── results-source.js     # Consulta y parser FEB
    │   └── results-app.js        # Dashboard de resultados
    └── ui/
        ├── renderer.js
        └── instagram-template.js
```

## Principios

1. **No romper Horarios.** El parser y el generador de Instagram se mantienen como una funcionalidad independiente.
2. **Una sola configuración.** La versión, build, temporada y URLs principales viven en `js/core/app-config.js`.
3. **Fuentes externas aisladas.** FAB/FEB se consultan desde módulos `source` y el resto de la aplicación trabaja con datos normalizados.
4. **GitHub Pages sin backend.** Cuando una fuente externa no permite CORS, se utiliza Jina Reader como puente de lectura.
5. **Datos reales antes que automatización falsa.** No se inventan categorías, equipos o IDs de competición que la fuente no haya proporcionado.

## Horarios

El antiguo `js/app.js` se ha trasladado a `js/horarios/controller.js`. El cambio es estructural: la página sigue usando el mismo flujo de consulta FAB, PDF, filtros, selección y plantilla.

## Resultados FEB/FAB

La sección `resultados/` consulta las páginas de `competiciones.feb.es/autonomicas/` mediante Reader. La primera versión acepta cualquier URL válida de una competición y analiza:

- temporada y categoría detectadas
- partidos jugados y pendientes
- jornadas
- local y visitante
- marcador
- fecha y hora
- pabellón cuando la fuente lo publica
- clasificación publicada
- estadísticas agregadas de un equipo
- exportación CSV

Las páginas autonómicas observadas exponen navegación de **Resultados y Clasificación, Calendarios, Equipos y Próximos Partidos**. La página de Zaragoza, por ejemplo, también publica PJ, PG, PP, PF, PC, puntos y racha en la clasificación. La selección de categoría/temporada depende de IDs internos (`c`) de FEB; por ello la primera versión permite pegar directamente la URL de la competición para evitar inventar o mantener manualmente un catálogo de IDs.

## Siguiente evolución recomendada

- Descubrir y cachear automáticamente el catálogo de categorías/temporadas de FEB cuando podamos obtener de forma fiable sus valores internos.
- Crear un registro interno de equipos y aliases.
- Permitir comparar temporadas de un mismo equipo.
- Añadir análisis de rachas, local/visitante y evolución por jornadas.
- Integrar Resultados con Equipos cuando exista ese módulo.
