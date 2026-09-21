# ADLSM · Herramientas internas

Aplicación web estática para uso interno de la red de entrenadores y responsables de ADLSM. La aplicación reúne herramientas para consultar actividad deportiva, preparar publicaciones y, progresivamente, centralizar recursos de la agrupación.

## Estructura actual

```text
/
├── index.html                 # Panel principal
├── horarios/
│   └── index.html             # Generador de horarios FAB
├── css/
│   ├── styles.css             # Estilos compartidos de la aplicación
│   └── home.css               # Estilos del panel principal
├── js/
│   ├── app.js                 # Controlador actual de Horarios FAB
│   ├── fab/
│   │   ├── fab-source.js      # Localización/obtención de documentos FAB
│   │   ├── fab-parser.js      # Extracción y normalización de partidos
│   │   └── fab-normalizer.js  # Normalización de nombres
│   └── ui/
│       ├── renderer.js        # Resultados, filtros y paginación
│       └── instagram-template.js # Generador de imágenes
└── assets/
    ├── background.svg
    └── logos/
        ├── ADLSM.jpg
        └── manifest.json
```

## Herramientas

### Horarios FAB

- Localiza la jornada correspondiente en la página oficial de horarios de FAB.
- Recupera el documento mediante Jina Reader cuando GitHub Pages no puede acceder directamente a FAB por CORS.
- Detecta las filas de partidos mediante la presencia conjunta de fecha y hora.
- Conserva la categoría de la sección del PDF como competición.
- Permite subir un PDF manualmente como alternativa.
- Filtra por equipo/club, competición y fecha.
- Permite vista de tarjetas o tabla y selección múltiple.
- Permite crear publicaciones manualmente cuando un partido no aparece en FAB.
- Genera plantillas de Instagram de hasta 8 partidos por imagen, con ordenación, edición, distribución y logos.

## Publicación

El sitio está preparado para GitHub Pages mediante **Deploy from a branch**, usando la rama `main` y la carpeta raíz.

No se depende de un build local para publicar la aplicación: los archivos HTML, CSS y JavaScript se sirven directamente.

## Principios de mantenimiento

- No romper las herramientas existentes al añadir nuevas secciones.
- Mantener las páginas desacopladas de forma progresiva.
- Reutilizar componentes y estilos compartidos.
- Mantener un fallback manual cuando una fuente externa no esté disponible.
- Evitar dependencias innecesarias y servicios externos adicionales.
- Versionar los cambios visibles en el pie de página cuando afecten al usuario.

## Próximas áreas previstas

- Resultados y clasificaciones.
- Gestión de equipos y responsables.
- Calendario común.
- Recursos internos para entrenadores.
- Biblioteca de publicaciones.
- Autenticación y permisos cuando exista contenido que deba quedar restringido.
