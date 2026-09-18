# 006 · Portada de entrada (Loader + Landing)

**Estado:** implementado ✅

## Qué hace

Al cargar Poketiempo, antes de ver la composición (cabecera, leyenda, mapa), el usuario pasa por dos pantallas a viewport completo:

1. **Loader** — un `Loader` (ya existe como pieza aislada en `src/components/Loader/`) mientras se prepara la imagen de la portada.
2. **Landing** — una portada fullscreen con una ilustración de fondo (una para desktop/tablet, otra para móvil, elegida con `<picture>` nativo, sin JS) y un botón **EMPEZAR**.

Al pulsar EMPEZAR suena un efecto (`game-start.mp3`) y, con una transición breve, aparece la aplicación ya existente (cabecera + leyenda + mapa + créditos).

Recargar la página vuelve a mostrar el loader y la portada desde el principio — no hay memoria de haberla visto ya.

## Por qué

Es la primera impresión de Poketiempo y hoy no existe: se entra directo a la composición. Una portada al estilo "pantalla de título" de un juego de Game Boy/Pokémon refuerza la identidad visual del proyecto (`tech-stack.md` → Identidad visual) antes de mostrar el contenido real, y da un lugar natural para preparar los assets pesados de la portada sin que el usuario vea el mapa "montándose" a medio cargar.

El botón EMPEZAR es además un gesto de usuario real (click), el tipo de interacción que los navegadores suelen exigir para reproducir audio — útil de cara a Profesor Oak (007), aunque esa feature resolverá su propia política de reproducción; aquí no se implementa nada para ella.

## Criterios de aceptación

- [x] Al cargar la página se ve primero el `Loader` a viewport completo, no la composición existente.
- [x] El loader no pasa a la portada solo por haber transcurrido un tiempo fijo si la imagen de portada todavía no está lista; puede tener una duración mínima corta para evitar un parpadeo instantáneo, pero su salida depende de que la imagen esté cargada (o de que ya estuviera en caché).
- [x] Tras el loader aparece la portada fullscreen con la imagen correspondiente al dispositivo (`<picture>` con `<source>`/`<img>`, sin listeners de `resize` ni `window.innerWidth`), cubriendo el viewport sin deformarse.
- [x] La portada muestra un `<button>` real con el texto "EMPEZAR", alcanzable y activable con Tab/Enter/Espacio de forma nativa (sin `role="button"` sobre un `div`).
- [x] Al pulsar EMPEZAR suena `game-start.mp3` y, tras una transición breve (~300–500ms), se muestra la aplicación existente (cabecera, leyenda, mapa, créditos).
- [x] Ninguna transición dentro del flujo (loader→portada, portada→aplicación) produce un parpadeo en blanco.
- [x] Con `prefers-reduced-motion: reduce`, las animaciones/transiciones del flujo se eliminan o se reducen a un cambio prácticamente instantáneo.
- [x] Una vez completada la transición portada→aplicación, la portada ya no está montada en el DOM (no queda oculta con CSS) y no es interactiva durante la transición.
- [x] Recargar la página reinicia el flujo completo (loader → portada → aplicación) — comportamiento intencionado, no hay persistencia de "ya la vi".
- [x] Funciona correctamente en los 5 breakpoints (320 / 480 / 768 / 1200 / 1600px): la portada y el botón se ven bien en móvil y en desktop.
- [x] HTML semántico y accesible: `<button>` real, texto alternativo vacío (`alt=""`) en la imagen decorativa de portada, foco visible en el botón.

## Fuera de alcance

- Profesor Oak (007) y cualquier lógica de audio narrado — el click de EMPEZAR solo reproduce el efecto sonoro puntual `game-start.mp3`, no habilita ningún sistema de audio general.
- Cambios en el mapa, la cabecera o la leyenda ya existentes.
- Nuevas reglas meteorológicas o de asignación de Pokémon.
- Persistencia de "portada ya vista" (`localStorage`/`sessionStorage`) — recargar siempre vuelve a mostrarla, es intencionado.
- Precarga genérica de todos los assets del proyecto (sprites, mapa) — solo se precarga la imagen de portada, que es el asset nuevo que introduce esta feature.
- Router, gestor de estado externo o cualquier dependencia nueva.
