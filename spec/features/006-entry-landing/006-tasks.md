# 006 · Portada de entrada (Loader + Landing) — Tareas

_Checklist derivada de `006-plan.md`, agrupada en bloques. Se implementa un bloque, se para y se enseña al usuario antes de pasar al siguiente._

## Bloque 1 — Assets y extracción de `WeatherApp`

- [x] Recomprimir `background-desktop.png`/`background-mobile.png` a JPEG en `src/assets/shared/` (comparado visualmente contra el PNG original antes de confirmar).
- [x] Copiar `game-start.mp3` a `src/assets/shared/`.
- [x] Crear `src/components/WeatherApp/WeatherApp.tsx` con el JSX que hoy tiene `App.tsx` (Header, Legend, SpainMap, Credits), recibiendo `forecast` por prop.
- [x] Mover `App.scss` → `WeatherApp.scss` tal cual, sin renombrar el bloque BEM `.app`.
- [x] Mover las aserciones de `App.test.tsx` a `WeatherApp.test.tsx`.

## Bloque 2 — `Loader` con precarga

- [x] Añadir prop `onReady` a `Loader`.
- [x] `<picture>` oculto visualmente (no `display:none`) con las dos fuentes de portada.
- [x] Duración mínima + `imageReady` (`onLoad`/`onError`/`img.complete`) → `onReady()` una sola vez.
- [x] `prefers-reduced-motion` detiene o reduce el spin del pokéball.
- [x] Tests de `Loader`.

## Bloque 3 — `Landing` y botón EMPEZAR

- [x] Crear `src/components/Landing/Landing.tsx` con `<picture>` visible (mismas fuentes) + `<button>EMPEZAR</button>`.
- [x] Estilo Game Boy/Pokédex del botón (tipografía, borde, paleta existentes) con animación discreta de invitación.
- [x] Click reproduce `game-start.mp3` y llama a `onStart`.
- [x] `prefers-reduced-motion` reduce/elimina animaciones de `Landing`.
- [x] Tests de `Landing`.

## Bloque 4 — Orquestación en `App.tsx` y transiciones

- [x] `EntryStage` y el `useState` en `App.tsx`.
- [x] Render condicional por stage (`loading` / `landing` / `entering` / `app`).
- [x] Transición `entering → app` con `setTimeout` limpiado en cleanup.
- [x] `App.scss` mínimo para apilar loader/portada/app a viewport completo sin parpadeo blanco — resultó innecesario: `Loader`/`Landing` son overlays `position: fixed` autosuficientes, así que `App.scss` se eliminó en vez de rellenarlo.
- [x] Test de flujo completo en `App.test.tsx` (loader inicial, llega a portada, EMPEZAR lleva a la app, portada no queda montada/interactiva al final).

## Bloque 5 — cierre

- [x] Comprobar los 5 breakpoints (320 / 480 / 768 / 1200 / 1600px) — verificado visualmente con Playwright, sin scroll horizontal en ninguno.
- [x] Revisar accesibilidad (semántica, foco visible en el botón, `alt=""` en la imagen decorativa).
- [x] `npm run lint`, `npm run test`, `npm run build`.
- [x] Barrer la narración del proceso de comentarios, `006-spec.md`, `006-plan.md` y este archivo.
- [x] Validar contra los criterios de aceptación de `006-spec.md`.
- [x] Mover la feature a "Hecho" en `../../constitution/roadmap.md`.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ningún dato nuevo se pide a AEMET en runtime.
- [x] Ningún valor de color nuevo se escribe como literal si ya existe una variable con ese valor.
- [x] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso.
