# 012 · Escritorio compacto y aprovechamiento del espacio — Tareas

**Estado.** Feature cerrada.

## Bloque 1 — Composición de escritorio

- [x] `_variables.scss` y `_reset.scss`: `$root-font-size` (`012-plan.md`, paso 1).
- [x] `_breakpoints.scss`: `$legend-column-width`, `$scrollbar-allowance` y `$breakpoint-desktop-columns`, derivado de ellas y de `$map-temperature-threshold` (paso 2).
- [x] `WeatherApp.scss`: dos columnas desde `$breakpoint-desktop-columns`, con la leyenda en `$legend-column-width` (paso 3).
- [x] `Legend.scss`: la leyenda en columna, desde `$breakpoint-desktop-columns` (paso 4).
- [x] `SpainMap.scss` y `SpainMap.tsx`: el suelo del mapa y el mapa pegado a la derecha desde `$breakpoint-desktop`, y el envoltorio que acaba con la leyenda en dos columnas, con su test (paso 5).
- [x] `_breakpoints.scss`, `SpainMap.scss` y `_reset.scss`: por encima del tope, el mapa al borde de la ventana hasta `$breakpoint-desktop-wide`, con el recorte de `#root` (pasos 2 y 5).
- [x] `map-frame.ts`, `WeatherApp.tsx` y `WeatherApp.scss`: la proporción del mapa en `<main>` y, con la leyenda en una sola columna, la columna del mapa a su ancho (pasos 3 y 5).
- [x] `Legend.scss` y `Header.scss`: el margen común del título y la leyenda, la leyenda partida desde `$breakpoint-legend-split` y, por encima del tope, el título, el encabezado y la indicación más grandes (pasos 2 y 4).
- [x] `$map-attribution` para la banda de la atribución (paso 5).
- [x] Comentarios: «escritorio» o «dos columnas», según dónde vale cada cosa (paso 6).
- [x] Test de la derivación de los puntos de corte de columnas, de leyenda partida y de pantallas anchas, sobre el SCSS compilado (paso 7).
- [x] `MarkerLayers` y `MarkerSprite`: los sprites en una capa propia, en el mapa principal y en Canarias; `LocationMarker` sin sprite (paso 8).
- [x] Tests de la capa de sprites y de la sombra en `MarkerLayers`, `LocationMarker`, `SpainMap` y `WeatherApp` (paso 8).
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] Sobre la build, en Chrome con la barra clásica y con la superpuesta:
  - 320, 480 y 768px, sin cambios;
  - 1200×800, 1280×720, 1366×768, 1366×657, 1371 y 1372, 1440×900, 1536×730, 1600×900, 1920×1080 y 2560×1440: temperaturas y su tamaño, ancho real del mapa, composición, lo que queda bajo el pliegue, atribución y sin scroll horizontal;
  - sin solapes entre cifras, y ningún píxel de cifra tapado por un sprite;
  - la leyenda con las 25 etiquetas, con y sin 1.4.12;
  - 200 % y 400 %;
  - 2.4.11 en ventanas bajas, y las tarjetas en los bordes del mapa;
  - el borde derecho del dibujo, y en dos columnas el final común con la leyenda, sin que el mapa suba sobre la cabecera ni sobre el aviso de frescura en ningún punto del scroll;
  - por Tab, los 74 marcadores enteros a la vista con el mapa acompañando al scroll;
  - por encima del tope, el mapa al borde de la ventana hasta 2089px y en el contenido desde 2090px, sin scroll horizontal, con las 74 tarjetas enteras dentro de la ventana;
  - el mapa en la misma caja y la cabecera sin crecer, también con la previsión más larga, con el margen del título y la leyenda, la leyenda partida y el título más grande;
  - la leyenda partida con 12 y con 9 condiciones, y la indicación con y sin 1.4.12.
- [x] La capa de sprites, sobre la build:
  - Huesca y Zaragoza: «11° 18°» entero y el aro de foco completo;
  - el aro de foco por encima de los sprites vecinos;
  - clic en los marcadores que se pisan;
  - sombra y silueta con los filtros de la lista y con una condición de la leyenda;
  - Canarias;
  - árbol accesible y orden de Tab.

## Bloque 2 — Fondo a sangre

- [x] `_full-bleed.scss`: el mixin, con la adaptación a `forced-colors` (paso 9).
- [x] `LocationList.scss` y `Credits.scss`: la lista, su barra, sus controles, sus encabezados de grupo y la línea del pie (pasos 10 y 11).
- [x] El comentario de `.app` en `WeatherApp.scss` (paso 12).
- [x] `LocationList.scss` y `EmptyResults.scss`: por encima del tope, la lista hasta los bordes de la ventana, ampliada (paso 10).
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] Sobre la build, a 1600, 1920 y 2560px, con la barra clásica:
  - sin scroll horizontal, también con zoom y con 1.4.12;
  - la línea oscura de los anillos de foco, entera junto a las bandas;
  - con `forced-colors`, ninguna banda fuera del contenido;
  - la lista ampliada, de 1600 a 2089px: cinco columnas, la barra de la fila elegida y el anillo de foco enteros, la tarjeta desde una fila y el estado vacío.

## Bloque 3 — Documentación y cierre

- [x] `tech-stack.md` (paso 13).
- [x] `008-spec.md` y `008-plan.md`: el umbral de 1063px, lo que significa 1200px y la tarjeta anclada en escritorio; `009-plan.md`: la columna de la leyenda en dos columnas y la sombra en la capa de sprites (paso 14).
- [x] `008-plan.md`: las filas 1.3.2, 1.4.10, 1.4.12 y 2.4.11 (paso 15).
- [x] Barrer la narración del proceso de comentarios y de los tres archivos de la 012 (`AGENTS.md`, paso 7).
- [x] Validar contra los criterios de aceptación de `012-spec.md`.
- [x] `roadmap.md`: la 012 en «Siguiente», pendiente de la comprobación en producción.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] Tras el push autorizado: el despliegue en verde y, en producción, las temperaturas a 1200 y 1366px, las dos columnas desde el punto de corte y el fondo a sangre a 1920px.
- [x] Con la comprobación en producción hecha: `roadmap.md`, la 012 en «Hecho».
- [ ] Tras el push autorizado, en producción: el mapa pegado a la derecha a 1366, 1536 y 1920px, sin scroll horizontal, y en dos columnas el final común con la leyenda; a 1536px, el margen del título y la leyenda, y a 1920px, la leyenda partida y la lista ampliada.

## Definición de "hecho"

- [x] Las tres medidas del punto de corte y el `62.5%` de la raíz se escriben una sola vez, como tokens.
- [x] Grep de las variables SCSS tocadas: ninguna queda sin uso.
