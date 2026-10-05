# 009 · Exploración de los 74 lugares — Tareas

_Checklist derivada de `009-plan.md`, agrupada en bloques. Se implementa un bloque, se para y se enseña al usuario antes de pasar al siguiente (`AGENTS.md`, paso 5)._

**Estado.** Feature cerrada.

## Bloque 1 — Constitución y roadmap

- [x] `spec/constitution/roadmap.md` — la 009 en «Siguiente», y `009-location-explorer` en la lista de nombres de carpeta ya fijados.
- [x] `spec/constitution/tech-stack.md` → «Estilo visual» — los dos sistemas de color: la paleta de interfaz con sus tokens y papeles, los colores descartados, el título y «Leyenda» fuera del mood, y la regla de estado de los controles.

## Bloque 2 — La zona en el modelo de lugares

- [x] `src/domain/location-zones.ts` — `LOCATION_ZONES` y `LocationZone`.
- [x] `src/domain/types.ts` — `zone: LocationZone` en `Location`, con un comentario que la distinga de las zonas de aviso.
- [x] `scripts/config/locations.manual.ts` — `zone` en `LocationManualConfig`, rellenado para los 74.
- [x] `npm run build:locations` y revisar el `src/data/locations.ts` generado entero: 74 líneas añadidas, ninguna borrada, cada lugar idéntico salvo `zone`.
- [x] Tests de `locations.ts`: los 74 tienen zona; el conjunto de zonas es exactamente `LOCATION_ZONES`; `PT` va con `'Portugal'`, `AD` con `'Andorra'` y `ES` con las 19 restantes. Y el orden de `LOCATION_ZONES` (`location-zones.test.ts`).
- [x] Fixtures de `Location` con `zone`, sin cambiar ninguna aserción.
- [x] Comprobar que ningún dato meteorológico ni ninguna regla de dominio cambia.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 3 — Filtrar, ordenar y agrupar

- [x] `marker-temperature.ts` — los límites de cada franja como datos; `classifyMarkerTemperature` los usa y sus tests siguen en verde.
- [x] `WeatherApp/location-filters.ts` — normalización, índice de búsqueda y `matchingLocationIds`.
- [x] Tests con tablas (`it.each`): tildes, eñes y mayúsculas; varias palabras; nombre, provincia, zona, Pokémon y condición; «Toda España», una comunidad, Portugal y Andorra; varias condiciones; combinaciones; sin filtros devuelve `null`.
- [x] `LocationList/location-groups.ts` — los cuatro órdenes, los grupos y sus títulos.
- [x] Tests con tablas: orden de zonas, orden alfabético con tildes, empates, límites de cada franja, títulos coherentes con `classifyMarkerTemperature` y lugares sin previsión al final.

## Bloque 4 — El mapa responde

- [x] `WeatherApp.tsx` — filtros y selección en un solo estado (`ExplorationState`); índice y `matchingIds` con `useMemo`; `applyFilters` anula la selección que deja de coincidir en la misma actualización.
- [x] `LocationMarker.tsx` / `.scss` — `dimmed`: sin rol, foco, nombre ni manejadores, `aria-hidden`, sin temperaturas y con la silueta.
- [x] `SpainMap.tsx` — filtro SVG de silueta en `<defs>`; `matchingIds` hasta cada marcador, también a través de `TerritoryInset`.
- [x] Tests: un marcador en sombra no es un botón, no está en el árbol de accesibilidad y no responde a clic ni teclado; con `matchingIds`, solo los que coinciden son botones; sin filtros, los 74.

## Bloque 5 — La leyenda como filtro

- [x] `Legend.tsx` — botones con `aria-pressed` en rejilla de tres columnas (sprite, etiqueta y estado), fila memoizada y texto de ayuda en `$ui-ink`.
- [x] `Legend.scss` — borde de 0,3rem y columna de estado reservados también en reposo; pulsado con borde `$ui-accent`, caja blanca y el ✓ pixelado; hover con el borde azul; siluetas del resto mientras haya alguna pulsada; columna mínima recalculada para «torrenciales».
- [x] `WeatherApp.scss` — en dos columnas, la leyenda crece lo que ocupa la columna de estado.
- [x] `WeatherApp.tsx` — manejadores estables que cambian los filtros a través de `applyFilters`; la leyenda alterna condiciones; la lista ya muestra solo los lugares que coinciden.
- [x] Test de la app entera: excluir el lugar seleccionado cierra su tarjeta y suelta su fila y su marcador en la misma actualización.
- [x] Tests: estado pulsado; el ✓ solo en las entradas pulsadas; alternar; varias condiciones; siluetas solo con alguna pulsada; sin nada pulsado, las mismas entradas que hoy.
- [x] **Test de equivalencia** con condiciones: los lugares de los marcadores operables son exactamente los de las filas.
- [x] Comprobación en navegador (Chromium, 320–1920px): pulsar y soltar no mueve nada; ninguna de las 25 etiquetas parte una palabra, tampoco con el espaciado de 1.4.12 (✓ de celdas de 0,2rem, 15,4rem para la etiqueta); a 1200px el mapa mide 892px y sus cifras aparecen desde 1458px de viewport; siluetas sobre mar y tierra; leyenda pulsada en los cinco moods, en las dos composiciones, con el halo de las etiquetas a 4,55–10,6:1 sobre la caja blanca.

## Bloque 6 — La barra de la lista

- [x] `_accessibility.scss` — mixin `visually-hidden`; lo usan también el anuncio del mapa y el texto completo de Oak.
- [x] `_variables.scss` — `$ui-surface`, y el mapa SCSS de franjas del que leen `LocationMarker.scss` y la muestra de color de los grupos.
- [x] `LocationList/components/LocationFilters` — buscar (con Escape), zona y ordenar, sobre `$ui-surface`; el orden elegido en `$ui-accent` con ▸.
- [x] `LocationList/components/ActiveFilters` — recuento, región viva con retardo, pastillas azules con el Pokémon en un disco blanco y su gestión del foco, y «Limpiar filtros» como botón secundario.
- [x] `LocationList/components/EmptyResults` — Castform en silueta sobre un disco `$ui-surface`, «?» azul, «Ni rastro por aquí» y «Limpiar filtros» como botón principal.
- [x] `LocationList.tsx` / `.scss` — banda de título en `$ui-ink` con la Poké Ball, grupos con `<h3>`, insignia de recuento y muestra de franja, orden local y cifra destacada según el orden; filas con la selección y el hover en `$ui-accent` en vez del celeste del mood frío.
- [x] `WeatherApp.tsx` / `.scss` — enlace «Saltar al buscador».
- [x] Tests: buscar, zona y orden; encabezados por orden; recuento y anuncio con temporizadores falsos; quitar un filtro y limpiar, con el foco donde debe; estado vacío montado solo sin resultados; el enlace de salto apunta al buscador.
- [x] **Test de equivalencia** ampliado a búsqueda y zona.
- [x] Revisar uno a uno los tests existentes que cambian: «una lista real de los 74 lugares» pasa a recorrer un `<ul>` por grupo, y la equivalencia de condiciones cuenta solo las filas (`.location-list__row`), porque la región tiene ahora también pastillas y «Limpiar filtros». Ninguna otra aserción cambia.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 7 — Cierre y verificación

- [x] Los 5 breakpoints (320 / 480 / 768 / 1200 / 1600px) y los ocho rangos de la 008: sin overflow, zoom al 200 % funcional, teclado completo y áreas táctiles, en reposo, con filtros, sin resultados y con la tarjeta abierta.
- [x] **1.4.10** a 320 CSS px, **1.4.12** con los cuatro valores y **2.4.11** con la tarjeta abierta, en las dos composiciones.
- [x] Los tres estados de `matchingIds` en navegador, encabezados, foco y selección a la vez, y ninguna maquetación en JS.
- [x] `LocationFilters.scss` — el campo de zona, a la medida de su opción más larga con el espaciado de 1.4.12 (26,4rem); margen de desplazamiento del buscador para el enlace de salto; borde azul en hover en buscar y zona.
- [x] `LocationList.scss` — el anillo de foco de la fila, por dentro de la barra.
- [x] Contrastes medidos en navegador y anotados en el plan.
- [x] Poner al día en `008-plan.md` las filas de la matriz WCAG que cambian, y sus contrastes de la lista.
- [x] `spec/constitution/tech-stack.md` — `_accessibility.scss` en la estructura de `abstracts/`.
- [x] Rellenar «Verificación» en el plan.
- [x] Barrer la narración del proceso de comentarios, `009-spec.md`, `009-plan.md` y este archivo (`AGENTS.md`, paso 7).
- [x] Validar contra los criterios de aceptación de `009-spec.md`.
- [x] `../../constitution/roadmap.md` — mover la feature a «Hecho».

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ninguna lista con interacción por fila queda sin memoizar: leyenda, botones de filtro, opciones de orden y filas.
- [x] Los sprites de la lista de lugares llevan `loading="lazy"`; los del mapa y la leyenda no. Los de los filtros activos son los mismos archivos que ya ha cargado el mapa.
- [x] Ningún dato nuevo se pide a AEMET, IPMA ni Open-Meteo en runtime.
- [x] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token para ese valor.
- [x] Ningún control usa un color de mood ni de franja: la interfaz de exploración solo usa `$ui-ink`, `$ui-surface`, `$ui-accent` y `$color-white`.
- [x] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso.
- [x] Ninguna decisión de maquetación se toma en JS a partir del viewport, la orientación o el dispositivo.

## Mantenimiento

- [ ] Al añadir o cambiar un lugar en `locations.manual.ts`, rellenar su `zone` además de su `administrativeArea`.
