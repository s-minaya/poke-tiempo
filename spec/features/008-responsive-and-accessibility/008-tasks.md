# 008 · Responsive, accesibilidad y cierre — Tareas

_Esta ronda cubre solo lo descrito en `008-spec.md`; el resto de "Responsive, accesibilidad y cierre" (alternativa textual, créditos AEMET, disclaimer, bloque 7/8 de la 005) queda fuera de alcance — ver `008-spec.md` → "Fuera de alcance"._

## Bloque 1 — Escala fluida de la composición ✅

- [x] `src/styles/abstracts/_reset.scss` — `html { font-size }` fluido: `min()` de un término de ancho, uno de alto y el tope fijo `62.5%`.
- [x] `src/components/Header/Header.scss` — título a un único tamaño (`4.8rem`); línea de previsión a `2.4rem`, con peso visual comparable al título.
- [x] `src/App.scss` — `app__layout` con una única plantilla de grid (dos columnas siempre); `max-width: 160rem` + `margin-inline: auto` en el contenedor.
- [x] `src/components/SpainMap/SpainMap.scss` — sin `max-width` propio (el tope de ancho vive en el contenedor).
- [x] `src/components/Legend/Legend.scss` — sprite, etiqueta y encabezado a juego con la escala real del mapa y del título.
- [x] `npm run lint`, `npm run test` y `npm run build` limpios.
- [x] Comprobación visual en un barrido amplio de anchos (320 a 3000px) y altos de viewport típicos de escritorio: sin scroll horizontal ni vertical en ninguno, la composición mantiene siempre la misma forma (dos columnas, Canarias siempre visible), centrada con margen simétrico cuando el viewport sobra por ancho o por alto.

## Bloque 2 — Borde del contexto norteafricano ✅

- [x] `src/components/SpainMap/SpainMap.scss` — mismo trazo que el resto de territorios (`stroke: currentcolor; stroke-width: 1`) directamente sobre `__north-africa-context`, más `fill-opacity: $map-north-africa-opacity` (variable ya existente en `_variables.scss` desde la 005, sin aplicar hasta ahora).
- [x] `npm run lint`, `npm run test` y `npm run build` limpios.
- [x] Comprobación visual: el trazo sigue la costa real de Marruecos/Argelia, a juego con el resto del mapa, sin costura visible en su frontera compartida.

## Bloque 3 — Solape de marcadores, salvaguarda de la leyenda y recorte del mapa ✅

- [x] Comprobación con `forecast.json` real (bounding box de cada sprite, solape por pares) en los 5 anchos de referencia: ningún `LocationMarker` queda completamente tapado por otro. No hizo falta ninguna corrección puntual.
- [x] `src/components/Legend/Legend.scss` — `.legend` con `display: flex; flex-direction: column` y `max-height` fija (`$legend-max-height`); `.legend__list` con `flex: 1; min-height: 0; overflow-y: auto`, para que un día con más Pokémon visibles de los habituales deslice la lista dentro de su propio hueco en vez de estirar la fila del grid (y con ella el mapa).
- [x] `src/components/Legend/Legend.tsx` — atributos `width`/`height` del `<img>` del sprite a juego con el tamaño real (`60`).
- [x] `src/components/SpainMap/SpainMap.tsx` — la caja del `<svg>` se recorta a la altura real y visible del mapa (`aspect-ratio` + `preserveAspectRatio="xMidYMin slice"`, sin tocar `ROOT_VIEW_BOX` ni ninguna coordenada de `map-geometry.ts`), para que `align-items: stretch` iguale la leyenda a esa altura visible y no a una caja con aire de más por debajo de Canarias.
- [x] `$fluid-root-height-divisor` (`_reset.scss`) y `$legend-max-height` (`Legend.scss`) remedidos con Playwright tras el recorte anterior.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] Comprobación visual con datos reales en un barrido amplio de anchos y altos: la leyenda termina siempre exactamente a la misma altura visible que el mapa, sin scroll de página en ningún caso.
- [x] Validado contra los criterios de aceptación de `008-spec.md`.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ningún valor de espaciado/color/tamaño nuevo se escribe como literal si ya existe un token para ese valor.
- [x] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso (`$map-north-africa-opacity` pasa de definida-sin-usar a aplicada).
- [x] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo en runtime.
- [x] No se toca `ROOT_VIEW_BOX` ni ninguna coordenada real de los 74 lugares en `map-geometry.ts`.
