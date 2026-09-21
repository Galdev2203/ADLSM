# ADLSM · Generador de horarios FAB

Herramienta web estática para obtener y normalizar partidos de la Federación Aragonesa de Baloncesto y preparar los datos para publicaciones del club.

## V1

- Buscar el PDF de horarios FAB a partir de una fecha.
- Intentar descargarlo directamente desde el navegador.
- Permitir subir el PDF manualmente como fallback.
- Extraer texto del PDF en el navegador con PDF.js.
- Convertir los partidos a un modelo común.
- Preparar el filtrado por club/equipo para la siguiente iteración.

## Publicación

El proyecto está preparado para GitHub Pages mediante GitHub Actions.

> Nota: FAB puede bloquear peticiones desde dominios externos mediante CORS. En ese caso el modo de subida manual seguirá funcionando y más adelante añadiremos un pequeño backend/serverless como proxy si resulta necesario.
