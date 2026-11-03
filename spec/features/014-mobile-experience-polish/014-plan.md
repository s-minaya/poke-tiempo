# 014 · Pulido de la experiencia móvil — Plan

**Estado:** completado. §1–§7 verificados en Chromium y en Safari de iPhone SE (2022) real, con VoiceOver; el teclado externo en Safari real no se ha verificado (`014-spec.md` → Validación).

## Enfoque

- **Leyenda.** Una regla de fondo: `$map-attribution` en la composición apilada, `$map-sea` desde `$breakpoint-desktop-columns`.
- **Detalle.** El DOM ya coloca `LocationCard` dentro de `SpainMap`, justo bajo el dibujo y antes de la atribución. En la composición apilada basta con que la tarjeta esté en el flujo en lugar de `position: fixed`: no se mueve JSX y el escritorio anclado no cambia.
- **Navegación.** `WeatherApp` guarda por dónde se abrió la selección. `SpainMap` lleva al detalle al seleccionar y, al cerrar desde la tarjeta, devuelve la vista y el foco al origen.
- **Selección visual.** `MarkerLayers` separa la causa «excluido por filtro» (sin marcador) del aspecto «silueta» (excluido o no seleccionado).
- **Retirada.** Sale la hoja inferior `position: fixed` con la reserva del documento y el `scroll-padding` que dejaba para ella, y `useRevealWhenSelected`.

Sin dependencias nuevas, sin componentes nuevos y sin estado global.

## Arquitectura

### 1. Leyenda

En `Legend.scss`, el fondo base de `.legend` es `$map-attribution` y `respond-from($breakpoint-desktop-columns)` restituye `$map-sea`. Ya implementado, con su contrato en `Legend.styles.test.ts`.

### 2. Detalle en el flujo (`LocationCard.scss`, `LocationCard.tsx`)

**Composición apilada (regla base):**
- La tarjeta es un bloque en el flujo, `position: relative`, con un margen superior que la separa del dibujo. Mide lo que el mapa.
- Rejilla con `grid-template-areas: 'close heading' 'weather weather' 'temperatures temperatures'` y columnas `auto minmax(0, 1fr)`: Cerrar precede al título en la vista, con el mismo DOM.
- Bordes y radios completos del cuadro de texto; sin `max-block-size` ni scroll interno.

**Escritorio (`respond-from($breakpoint-desktop)`):** `'heading close'`, columnas `minmax(0, 1fr) auto` y todo lo anclado sin cambios (`position: absolute`, `--anchor-*`, `--east`/`--west`, sombra y apartado con foco de teclado en otro marcador).

**Se elimina:**
- la hoja inferior de la regla base: `position: fixed`, `inset-*`, `max-inline-size`, `max-block-size` y `overflow-y: auto`, el relleno de área segura, y el borde y las esquinas inferiores rectos;
- `html:has(.location-card)`: `--location-sheet-max`, la reserva en el `body` y `scroll-padding-block-end`.

**`LocationCard.tsx`:**
- conserva la prop `ref` y añade `closeRef` (el botón Cerrar, para el foco por teclado de §6);
- añade `onRemove?: () => void`, que se llama desde la limpieza de un `useLayoutEffect`, cuando el nodo aún está en el DOM (§5). No pasa el nodo: `SpainMap` ya tiene su `ref` de la tarjeta, que sigue puesta durante esa limpieza.

### 3. Origen de la selección (`WeatherApp.tsx`, `location-filters.ts`)

- Tipo `SelectionOrigin = { via: 'map' | 'list'; keyboard: boolean }`, junto a `ExplorationState` en `location-filters.ts`. `applyFilters` no cambia.
- `WeatherApp` guarda el origen en un `useState` y expone dos manejadores estables, `toggleFromMap(id, keyboard)` y `toggleFromList(id, keyboard)`. Cada uno fija el origen y llama a `toggleLocation`; las dos actualizaciones se agrupan en el mismo render.
- **Registro de filas:** `useRef(new Map<string, HTMLElement>())`, con `registerRow` estable que se pasa a `LocationList`, y `findRow(id)` estable que se pasa a `SpainMap`. Es el mismo patrón que `SpainMap` ya usa con los marcadores.
- `LocationMarker` informa de `keyboard: true` cuando activa con Intro o Espacio. `LocationRow` lo deduce de la tecla que precede al `click` (Intro o Espacio): se olvida tras un uso, con un `pointerdown` y al perder el foco. No usa `event.detail`, que también es 0 cuando una tecnología de asistencia activa el botón; un `click` sin tecla previa cuenta como puntero.
- Se elimina `use-reveal-when-selected.ts` y sus usos en `LocationMarker` y `LocationList`. Servía para que lo activado no quedara bajo la hoja; ya no hay hoja y competiría con el desplazamiento al detalle.

### 4. Ir al detalle y volver al origen (`SpainMap.tsx`)

- **`isInFlow(card)`:** `getComputedStyle(card).position !== 'absolute'`. Lee qué presentación eligió el CSS; decide si desplazar, no la maquetación. Es compatible con la regla de `tech-stack.md` de no tomar decisiones de maquetación en JS a partir del viewport.
- **Al seleccionar:** un `useLayoutEffect` que depende de `selectedLocationId` y del origen. Si la tarjeta está en el flujo, una única llamada `card.scrollIntoView({ block, inline: 'start' })`, con `block: 'nearest'` si se abrió desde un marcador y `block: 'start'` si se abrió desde una fila. Corre una vez por cambio de selección y antes de pintar.
  - Desde el mapa, que está encima del detalle, basta el desplazamiento mínimo.
  - Desde la lista, que está debajo, `nearest` con una tarjeta más alta que la ventana visual (pinch al 400 % en 375×667 o 320×568) alinea su borde inferior y recorta el comienzo, con Cerrar fuera de la vista. `start` alinea siempre el superior. No se mide el viewport ni se encadena una segunda llamada.
- **`closeCard`** (Cerrar o Escape dentro de la tarjeta):
  - el destino es la fila (`findRow`) si `via === 'list'` y existe, o el marcador del lugar si no;
  - si la tarjeta está en el flujo, se guarda el destino en una `ref` y, tras desmontar, `scrollIntoView` con `block: 'center'`: `inline: 'start'` para la fila y `inline: 'center'` para el marcador.
- **Foco al cerrar:** si estaba dentro de la tarjeta, vuelve al mismo destino. Lleva `preventScroll` cuando hay vuelta, para no desplazar dos veces. Desaparece el `opener` basado en `document.activeElement`: el origen sale del estado.
- **Escritorio anclado:** sin desplazamientos y con el retorno de foco de siempre.

### 5. Conservar la posición al quitar el detalle (`SpainMap.tsx`)

Cerrar desde fuera de la tarjeta (otra pulsación en la fila o el marcador, Escape sobre ellos, un filtro que excluye el lugar) quita el detalle sin vuelta al origen. Si el usuario mira algo que está debajo (lista, leyenda), todo sube lo que medía el detalle; Safari no tiene scroll anchoring.

Para evitarlo:
1. **Antes de quitar el nodo:** `onRemove` anota, con el nodo aún montado, la posición en pantalla de la atribución que va justo debajo y si la tarjeta empezaba por encima de la vista (`top < 0`).
2. **Después de desmontar:** si la tarjeta empezaba por encima y no hay vuelta al origen, `window.scrollBy(0, delta)` con el desplazamiento medido de la atribución.

En los navegadores con scroll anchoring el delta medido ya es cero. Un solo mecanismo cubre la lista, la leyenda, el buscador y la zona.

### 6. Foco por teclado

- **Puntero o toque**, incluido VoiceOver en iOS: el foco no se mueve.
- **Teclado, con la tarjeta en el flujo:** tras el desplazamiento al detalle, `focus({ preventScroll: true })` en Cerrar (`closeRef` de `LocationCard`), dentro del mismo efecto de §4. Ese efecto lee el origen de una referencia, para repetirse solo al cambiar la selección.
- **Tecla mantenida:** el foco puede llegar a Cerrar con Intro o Espacio aún pulsados. `LocationCard` impide la acción por defecto de sus repeticiones (`event.repeat`); sin esto, la tarjeta se abriría y se cerraría sola.
- **Sin trampa de foco:** Tab y Mayús+Tab siguen el orden del documento. Escape y Cerrar usan `closeCard`, que devuelve foco y vista al origen.
- **Escape o Intro en la fila con el detalle abierto:** cierra, compensa como en §5 y, si el foco sigue en la fila del lugar cerrado y esta no está entera en la ventana, `scrollIntoView({ block: 'center', inline: 'start' })` sobre ella. Solo si la tarjeta iba en el flujo.
- **Escape en el marcador con el detalle abierto:** lo mismo con el marcador y `{ block: 'center', inline: 'center' }`. `SpainMap` lo sabe porque Escape en un marcador pasa por un manejador estable propio (`dismissFromMarker`), que marca el cierre; Intro y el clic en el marcador no lo marcan y no lo mueven.
- **Escritorio anclado:** sin cambios.

### 7. Selección visual (`MarkerLayers.tsx`)

- Por lugar: `excluded = matchingIds !== null && !matchingIds.has(id)`; `silhouette = excluded || (selectedLocationId !== null && id !== selectedLocationId)`.
- `MarkerSprite` recibe `silhouette` y aplica el filtro existente `MARKER_SILHOUETTE_FILTER_ID`.
- El `LocationMarker` se monta si `!excluded`, como hoy.
- Ningún cambio en `LocationMarker`, en `aria-pressed` ni en el filtrado.
- `MarkerSprite` sigue memoizado: al cambiar la selección se repintan los sprites, y su coste medido con la CPU a ×4 está dentro del ruido del render de selección.

## Alternativas descartadas

- **Hoja inferior `position: fixed` que sigue al viewport visual (`VisualViewport`).** Su capacidad cae con el cuadrado del zoom mientras el contenido no encoge: ilegible al 400 % en Safari real, con el título partido y el cierre ocupando media tarjeta.
- **C, hoja a escala de página anclada a lo visible.** El cierre quedaba a unas tres pantallas en horizontal al 400 %.
- **C′, igual que C pero con un cierre que sigue al borde visible.** Abrir desde el este mostraba la tarjeta vacía, porque una tarjeta ancha no puede salir del layout viewport.
- **Contraescalar la tarjeta o el cierre.** Anula la ampliación del usuario y deja el cierre por debajo de 2.5.8 en píxeles CSS.
- **Reiniciar, limitar o desactivar el zoom.** Contrario a la spec y a WCAG.
- **Diálogo modal.** Cambiaría la semántica no modal y la relación con mapa y lista.
- **Guardar el origen en una variable de módulo.** Estado fuera de React, difícil de probar y compartido entre montajes.
- **Mantener la fila quieta al seleccionar desde la lista.** El detalle queda fuera de la vista; sustituido por ir al detalle y volver.

## Tests

### Retirados

- En `WeatherApp.test.tsx`: «al seleccionar, lleva a la vista lo que se activó y conserva el foco», que comprobaba `useRevealWhenSelected`. Lo sustituyen los tests (a)–(g) de más abajo.

### Nuevos o reescritos

- **`LocationCard.styles.test.ts` (Node, Sass real):**
  - en la regla base no aparece `position: fixed`, ni `html:has(.location-card)`, ni `@container`;
  - las áreas son `'close heading'`;
  - en `respond-from($breakpoint-desktop)` vuelven `'heading close'` y `position: absolute`.
- **`MarkerLayers.test.tsx`, table-driven (`it.each`):** casos sin selección, seleccionado, otro seleccionado, excluido, y excluido con otro seleccionado. En cada uno se comprueba el filtro del sprite, si el marcador está montado y que un marcador en silueta por selección se puede activar.
- **`WeatherApp.test.tsx`:**
  - (a) marcador por puntero → `scrollIntoView` sobre la tarjeta con `{ block: 'nearest', inline: 'start' }`, sin mover el foco;
  - (b) fila por puntero → lo mismo con `{ block: 'start', inline: 'start' }`;
  - (c) Cerrar tras abrir desde una fila → `scrollIntoView` sobre esa fila, con la búsqueda conservada;
  - (d) Cerrar tras abrir desde un marcador → sobre el marcador;
  - (e) con la tarjeta anclada (`getComputedStyle` simulado a `absolute`) → sin desplazamiento;
  - (f) un filtro que excluye el lugar abierto con la tarjeta por encima de la vista (`getBoundingClientRect` simulado) → `scrollBy(0, delta)`; con la tarjeta a la vista, nada;
  - (g) teclado según la política aprobada: foco en Cerrar, Escape devuelve el foco al origen, Tab no queda atrapado.
- **`SpainMap.test.tsx`:** se conserva la restauración de foco al cerrar, ahora con el origen en lugar de `document.activeElement`. Table-driven: la alineación del desplazamiento al abrir según el origen (una sola llamada, con y sin teclado), que un cambio de origen sin cambio de selección no desplaza de nuevo y que con la tarjeta anclada no desplaza.

### Navegador real, Chromium

Scripts temporales fuera del repositorio, sin dependencias nuevas, sobre el build de producción:

- **Anchuras:** 320/375/390/430 en retrato, 667×375 y 844×390 en paisaje, 768×500, 1180×820, 1200 y 1600.
- **Zoom:** pinch emulado al 400 % y zoom de navegador al 200 y 400 %.
- **Navegación:** marcador → detalle → Cerrar → marcador; fila → detalle → Cerrar → fila; cambio de lugar entre vías.
- **Filtros:** búsqueda, zona y condición de la leyenda que excluyen el lugar abierto con la vista en la lista, con y sin `overflow-anchor`.
- **Siluetas:** con y sin filtros, y operabilidad de los marcadores en silueta.
- **Teclado, escritorio y consola:** la política de §6; escritorio sin desplazamientos; consola limpia.

### Safari de iPhone real

- Sobre el build del repositorio principal servido por la red local: marcador y fila a 100 y 400 %, en retrato y en paisaje; vuelta al origen y zoom intacto; filtros que excluyen el lugar abierto; siluetas; VoiceOver y teclado externo si están disponibles.
- Los resultados se registran aparte de los de Chromium (`014-spec.md` → Validación).

### Comandos de cierre de cada bloque

`npm run test`, `npm run lint` y `npm run build`. Sin despliegue.

## Riesgos

- **Orden de la limpieza de `useLayoutEffect` al desmontar.** §5 necesita que la limpieza corra con el nodo aún en el DOM, como ocurre en React. Si no se cumpliera, el test (f) lo detecta; la alternativa es medir la tarjeta en cada render mientras está abierta.
- **Lectores de pantalla con la política de teclado.** El detalle puede anunciarse dos veces: por la región viva y por el nombre de la región al recibir el foco Cerrar. Se acepta si no confunde; con VoiceOver real en iPhone SE (2022) funcionó correctamente.
- **`scrollIntoView` en Safari con pinch.** Desde el marcador se usa `nearest` y desde la fila `start` (ver §4). Chromium confirma `start` en 375×667 y 320×568 a 400 %, donde la ventana visual es más baja que la tarjeta. En Safari de iPhone real, la apertura desde la lista con pinch alto, en retrato y en paisaje, pasa; el dispositivo, un iPhone SE (2022) de 375×667, es una pantalla pequeña como la de ese caso.
- **Coste de la selección.** Ronda los 280–300 ms con la CPU a ×4 y no cambia con las siluetas. Es el coste ya conocido del render de selección y queda fuera de esta feature.
- **Escalón de anchura de la leyenda en paisaje.** Se revisa visualmente; no se corrige cambiando el ancho ni la estructura.

## Bloques de implementación

Cada bloque termina con tests, lint, build y una parada para confirmación.

1. **Bloque 1 — Leyenda.** Hecho.
2. **R1 — Retirada de la hoja.** Reglas, archivos y tests de la sección «Retirados». Hecho.
3. **R2 — Detalle en el flujo y navegación.** SCSS de §2, origen de §3, ir y volver de §4, conservación de §5, tests (a)–(f). Hecho.
4. **R3 — Selección visual.** §7 y `MarkerLayers.test.tsx`. Hecho.
5. **R4 — Foco por teclado.** §6 y el test (g). Hecho.
6. **R5 — Validación en Chromium.** Matriz completa, capturas y resultados aparte. Hecho.
7. **R6 — Safari de iPhone real y cierre.** Validación real, barrido de narración y definición de hecho de `AGENTS.md`. Hecho, con el teclado externo sin confirmar. El roadmap solo se toca con la aprobación del usuario.
