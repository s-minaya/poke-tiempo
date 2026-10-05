# 008 · Responsive, accesibilidad y cierre — Tareas

_Checklist derivada de `008-plan.md`, agrupada en bloques. Se implementa un bloque, se para y se enseña al usuario antes de pasar al siguiente (`AGENTS.md`, paso 5)._

**Estado.** Feature cerrada. No hay bloque 1: lo formaba una escala de la composición atada al viewport que la raíz fija del bloque 5 dejó sin objeto, junto con el tope de alto de la leyenda y sus cifras medidas del bloque 3.

## Bloque 2 — Borde del contexto norteafricano

- [x] `src/components/SpainMap/SpainMap.scss` — mismo trazo que el resto de territorios (`stroke: currentcolor; stroke-width: 1`) sobre `__north-africa-context`, más `fill-opacity: $map-north-africa-opacity`.
- [x] Comprobación visual: el trazo sigue la costa real de Marruecos/Argelia, sin costura visible en su frontera compartida.

## Bloque 3 — Solape de marcadores y recorte del mapa

- [x] Comprobación con `forecast.json` real: ningún `LocationMarker` queda completamente tapado por otro.
- [x] `src/components/SpainMap/SpainMap.tsx` — la caja del `<svg>` se recorta a la altura visible del mapa (`aspect-ratio` + `preserveAspectRatio="xMidYMin slice"`).

## Bloque 4 — Constitución y spec

- [x] `spec/constitution/mission.md` — principio "Una sola composición, que se adapta en vez de encogerse"; accesibilidad con WCAG 2.2 AA como listón, 24 × 24 px de mínimo táctil y 44 × 44 px como objetivo de diseño.
- [x] `008-spec.md` y `008-plan.md`.
- [x] `spec/constitution/roadmap.md` — la entrada de la 008 describe el enfoque, y la alternativa textual y la auditoría de accesibilidad salen de "Decisiones pendientes" (sólo queda ahí el disclaimer de Pokémon).

## Bloque 5 — Raíz fija, tokens y foco global

- [x] `_reset.scss` — `html { font-size: 62.5% }` fijo.
- [x] `_reset.scss` — `:focus-visible` base con anillo de dos tonos.
- [x] `_reset.scss` — `svh` en lugar de `100vh`; fondo explícito en `body`.
- [x] `_breakpoints.scss` — `$map-temperature-threshold: 1150px`; `$breakpoint-tablet` sólo para el `<picture>` de la portada.
- [x] `npm run lint`, `npm run test` y `npm run build` limpios.

## Bloque 6 — Las dos plantillas y la caja del mapa

- [x] `WeatherApp.scss` — plantilla apilada y plantilla de dos columnas sobre las mismas áreas nombradas; corte en `$breakpoint-desktop`; tope en `$breakpoint-desktop-large` con `margin-inline: auto`.
- [x] `SpainMap.scss` — contenedor de consulta en el envoltorio; caja del mapa limitada por `min(100%, alto disponible × relación de aspecto)`.
- [x] `Legend.scss` — sin tope de alto; columnas con `auto-fit`.
- [x] `WeatherApp.tsx` — `Credits` fuera de `<main>`.
- [x] Tests: `getByRole('contentinfo')` sigue verde. La plantilla de cada rango se comprueba en navegador, porque jsdom no calcula layout.
- [x] Comprobación visual en los ocho rangos: sin overflow, sin zona vacía.

## Bloque 7 — Tipografía, leyenda, créditos y contraste

- [x] `Header.scss`, `Legend.scss`, `Credits.scss` — tamaños absolutos con `clamp()`; nada por debajo de 12px.
- [x] Regla transversal: todo texto en color de mood a ≥19px y bold, línea de previsión incluida.
- [x] `-webkit-text-stroke` en `em`, con el grosor del borde percibido del glifo.
- [x] `LocationMarker.scss` / `.tsx` — contorno exterior `$color-near-black` en las temperaturas, conservando el relleno y el trazo de su franja.
- [x] `LocationMarker` — las temperaturas sólo se pintan por encima de `$map-temperature-threshold`, vía `@container`.
- [x] Medir los contrastes resultantes y dejarlos anotados en el plan.
- [x] **Validación visual al tamaño mínimo real**: el halo se percibe como contorno y no cierra el ojo de los glifos.

## Bloque 8 — Portada y Oak

- [x] `Landing.scss` — botón con `clamp()`, relleno y borde en `em`, `min-height: 48px`; anclaje inferior en `svh`.
- [x] `Landing.scss` — foco visible de dos tonos sobre la ilustración.
- [x] `Landing.tsx` — `inert` al salir.
- [x] `ProfessorOak.scss` / `OakPortrait.scss` / `OakDialogueBox.scss` — topes para pantallas grandes (`720px`, `clamp(880px, 62vw, 1100px)`, fuente hasta 28px).
- [x] Comprobar Oak en móvil pequeño, móvil apaisado y escritorio grande: 160 caracteres caben, no hay overflow, touch y teclado siguen funcionando.

## Bloque 9 — `administrativeArea` en el modelo de lugares

_Antes que la tarjeta y la lista, que son sus consumidores._

- [x] `scripts/config/locations.manual.ts` — `administrativeArea` en `LocationManualConfig`, rellenado para los 74 lugares.
- [x] `src/domain/types.ts` — `administrativeArea` en `Location`.
- [x] `npm run build:locations` y revisar el `src/data/locations.ts` generado entero. Contra los catálogos reales de AEMET e IPMA: 74 líneas añadidas, 0 borradas, los 74 `sourceIds` sin cambios y cada lugar idéntico campo a campo salvo `administrativeArea`.
- [x] Tests de `locations.ts`: los 74 traen `administrativeArea` no vacío.
- [x] Comprobar que ningún dato meteorológico ni ninguna regla de dominio cambia.

## Bloque 10 — Tarjeta de lugar y marcador activable

- [x] `src/components/LocationCard/` — nombre, área administrativa (omitida si coincide con el nombre), Pokémon, condición y mínima/máxima.
- [x] `WeatherApp.tsx` — `selectedLocationId` con `useState`.
- [x] `LocationMarker.tsx` — elemento activable (`role="button"`, `tabIndex`, clic/Intro/Espacio) con `<rect>` transparente de área de toque y estado seleccionado en `aria-pressed`.
- [x] `LocationMarker.tsx` — **nombre accesible único por lugar** (`aria-label` o equivalente), exigido por 4.1.2: el rol y los manejadores por sí solos dejarían 74 botones indistinguibles para un lector de pantalla.
- [x] `SpainMap.tsx` — repartir la selección a los 74 marcadores.
- [x] Tests: activación con ratón y con teclado; **los 74 marcadores tienen nombre accesible y no se repite ninguno**; la tarjeta nombra lugar y área administrativa; el orden de tabulación es el del DOM.
- [x] Comprobar 2.4.11: con la tarjeta abierta —anclada en dos columnas, hoja inferior en apilado— ningún marcador enfocado queda completamente tapado al recorrerlos con el tabulador.

## Bloque 11 — Lista de lugares

- [x] `src/components/LocationList/` — `<ul>` con una fila `<button>` de al menos 56px por lugar; sprite, nombre, área administrativa, condición y mín/máx.
- [x] Reutilizar `buildLocationViews`; memoizar por fila; `loading="lazy"` en los sprites.
- [x] `repeat(auto-fit, minmax(…))` para las columnas; presente en ambas composiciones.
- [x] **Test de equivalencia**: seleccionar desde la fila y desde el marcador produce el mismo estado seleccionado y la misma tarjeta, con el mismo marcador pulsado. Es lo que sostiene la excepción «Equivalent» de 2.5.8.

## Bloque 12 — Cierre y verificación

- [x] Verificación en los ocho rangos: móvil pequeño vertical, móvil vertical, móvil horizontal, tablet vertical, tablet horizontal, portátil, escritorio y ultrawide.
- [x] En cada uno: sin overflow horizontal, sin overflow vertical inesperado, zoom del navegador al 200 % funcional (1.4.4), navegación completa por teclado, áreas táctiles comprobadas.
- [x] **1.4.10 Reflow** — prueba equivalente a 320 CSS px (400 % de zoom sobre 1280px): una sola columna, sin scroll en los dos ejes a la vez, sin pérdida de contenido ni de funcionalidad.
- [x] **1.4.12 Text Spacing** — aplicar los overrides del criterio (línea 1,5×, párrafo 2×, letra 0,12em, palabra 0,16em) y comprobar que no hay recortes, solapes ni pérdida de contenido en ninguna de las dos composiciones.
- [x] **2.4.11 Focus Not Obscured (Minimum)** — recorrer todo el foco con `LocationCard` abierta, en ambas composiciones.
- [x] **Selección desde la lista con el mapa fuera de la vista** — en dos columnas, donde la tarjeta pertenece al mapa sea cual sea la vía de entrada: seleccionar por teclado y por toque una fila situada bastante abajo en la lista, y comprobar feedback visible en la fila, anuncio accesible, estado del marcador, ausencia de saltos inesperados y ningún problema de foco.
- [x] `Legend.scss` — columna mínima calculada para la palabra más larga de las 25 etiquetas posibles (`min(100%, 22rem)`), y etiqueta partible como último recurso (1.4.12).
- [x] `Landing.scss` / `OakDialogueBox.scss` — el rebote de EMPEZAR y el ▼ de Oak se detienen a los 4,8 s (2.2.2).
- [x] `ProfessorOak.scss` — la escena se desplaza en vertical cuando no cabe, en vez de recortarse (1.4.4).
- [x] **Auditoría de todos los criterios A y AA de WCAG 2.2**: cumple / no cumple uno a uno, y los no aplicables documentados con su motivo. El resultado se escribe en `008-plan.md`.
- [x] Revisar uno a uno los tests existentes que cambian: ninguno describía la geometría de la composición, y cada aserción modificada responde a un cambio del contrato.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] Barrer la narración del proceso de comentarios, `008-spec.md`, `008-plan.md` y este archivo (`AGENTS.md`, paso 7).
- [x] Validar contra los criterios de aceptación de `008-spec.md`.
- [x] `../../constitution/roadmap.md` — mover la feature a "Hecho".

## Bloque 13 — Unown sin halo, marcador sin disco y `tech-stack.md` al día

- [x] `_variables.scss` — `$ui-accent` (#1B53BA) y `$ui-ink` (#323232), los dos primeros tokens de la paleta de interfaz (`tech-stack.md` → Estilo visual); `$header-mood-*-border`, halo de la previsión y de las etiquetas.
- [x] `Header.scss` — el título en `$ui-accent`, sin `-webkit-text-stroke`. La previsión no cambia.
- [x] `Legend.scss` — «Leyenda» en `$ui-ink`, sin `-webkit-text-stroke`. Las etiquetas no cambian.
- [x] Contraste del título (6,28:1) y de «Leyenda» (11,47:1) sobre el mar, iguales en los cinco moods.
- [x] Validación visual del título y «Leyenda» en los cinco moods, en móvil y en escritorio.
- [x] `LocationMarker.tsx` / `.scss` — el marcador seleccionado no dibuja nada propio, y el contorno del navegador se anula en `:focus` para que un clic no deje un recuadro; el anillo propio, solo con `:focus-visible`.
- [x] Tests: el marcador seleccionado tiene `aria-pressed="true"` y los mismos nodos y clases que en reposo; el test de equivalencia comprueba que se pulsan la fila y el marcador de ese lugar, y compara la tarjeta y el anuncio.
- [x] `spec/constitution/tech-stack.md` — raíz fija y dos composiciones: la estructura de `abstracts/`, la regla de `loading="lazy"`, las unidades (`em` en halos y rellenos de botón; `px` en suelos duros, portada y Oak), «Composición y puntos de corte» y la composición de «Estilo visual».
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] «Verificación» en `008-plan.md` con el título, «Leyenda» y el marcador seleccionado; narración barrida (`AGENTS.md`, paso 7) y feature cerrada.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ninguna lista con interacción por fila queda sin memoizar.
- [x] Los sprites de listas por debajo del pliegue llevan `loading="lazy"`; los del mapa no.
- [x] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo en runtime.
- [x] Ningún valor de espaciado/color/tamaño nuevo se escribe como literal si ya existe un token.
- [x] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso.
- [x] No se toca `ROOT_VIEW_BOX` ni ninguna coordenada de los 74 lugares en `map-geometry.ts`.
- [x] Ninguna decisión de maquetación se toma en JS a partir del viewport, la orientación o el dispositivo: ni `window.innerWidth`, ni media queries de viewport desde JS, ni detección de dispositivo. `prefers-reduced-motion` sí puede consultarse desde JS para movimiento, sonido y comportamiento.
