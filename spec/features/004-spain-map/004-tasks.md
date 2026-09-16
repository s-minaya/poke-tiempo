# 004 · Mapa de España — Tareas

## Bloque 1 — Geometría del mapa (datos generados en build) ✅

- [x] `d3-geo` (+ `@types/d3-geo`) como devDependency.
- [x] `scripts/config/spain-map.geo.json` — GeoJSON filtrado (Spain, Portugal, Andorra, Balearic Islands, Ceuta, Melilla, Canary Islands, Morocco, Algeria) desde Natural Earth *Admin 0 – Map Subunits* 1:10m, redondeado a 4 decimales.
- [x] `scripts/config/spain-provinces.geo.json` — fronteras de comunidad autónoma/distrito de España y Portugal, Natural Earth *Admin 1 – States/Provinces (lines)* 1:10m filtrada por `adm0_a3` (192 tramos).
- [x] `scripts/build-map.ts` — proyección `d3.geoMercator().fitExtent(...)` del mapa principal (Spain, Portugal, Andorra, Balearic Islands, Ceuta, Melilla juntos, padding asimétrico), proyección anisotrópica propia para Canarias (`fitCanaryAnisotropic`), reutilización de la proyección principal para Marruecos/Argelia y para las fronteras internas. Genera `d`/`mapPoints` para los 74 lugares de `locations.ts`, el recorte (`clip`) del contexto norteafricano y el recuadro (`canaryBox`) con esquina achaflanada.
- [x] `package.json` — script `build:map`.
- [x] Generar `src/data/map-geometry.ts` (commiteado, no se edita a mano): `POINT_PADDING`, `ROOT_VIEW_BOX` (con origen `x`/`y`), `mainMapPath`, `provinceBoundariesPath`, `canaryBox`, `northAfricaContext`, `mapPoints` (`region: 'main' | 'canary'`).
- [x] Tests (`map-geometry.test.ts`): estructura de `map-geometry.ts` (viewBox, paths no vacíos, 74 `mapPoints`, los 6 lugares de Canarias marcados `region: 'canary'`, Ceuta/Melilla en `region: 'main'`, margen `POINT_PADDING` respetado en los cuatro bordes en mapa principal e inset, el recorte de contexto norteafricano se queda antes de la frontera real con Túnez).

## Bloque 2 — Selección del Pokémon visible y asociación con el forecast ✅

- [x] `src/components/SpainMap/pick-map-pokemon.ts` — `pickMapPokemon`, tabla de prioridad fija (`004-plan.md` → punto 4).
- [x] `src/components/SpainMap/pick-map-pokemon.test.ts` — table-driven, orden completo + lista vacía.
- [x] `src/components/SpainMap/location-views.ts` — `buildLocationViews(locations, forecast)`.
- [x] `src/components/SpainMap/location-views.test.ts` — asociación `location → forecast → assignPokemon → pickMapPokemon`, lugar sin forecast, región de Canarias/Ceuta/Melilla.

## Bloque 3 — Render y composición del mapa ✅

- [x] `src/components/SpainMap/sprite-sources.ts` — imports estáticos de `src/assets/sprites/`.
- [x] `src/components/SpainMap/components/LocationMarker.tsx` + `.scss` + `.test.tsx` — `SPRITE_SIZE = 62`, `role="img"` + `aria-label`/`<title>` con el nombre del lugar, memoizado (`React.memo`).
- [x] `src/components/SpainMap/components/TerritoryInset.tsx` + `.scss` — recuadro reutilizable (hoy solo Canarias): `<svg>` anidado con su propio `viewBox`, `role="group"`, marco opcional (`frame`) como `<path>` con esquina superior derecha achaflanada. Sin `TerritoryInset.test.tsx` propio — cubierto indirectamente por `SpainMap.test.tsx` (rol de grupo, nombre accesible "Canarias", marcadores dentro del recuadro).
- [x] `src/components/SpainMap/SpainMap.tsx` + `.scss` + `.test.tsx` — silueta principal, fronteras internas (trazo fino, `aria-hidden`), grupo decorativo de Marruecos/Argelia (`clip-path`, `aria-hidden`, sin `LocationMarker`), los 74 `LocationMarker` y el `TerritoryInset` de Canarias. `role="group"` en el `<svg>` raíz (nunca `role="img"`, que colapsaría los 74 marcadores como descendientes de una única imagen para tecnología de asistencia).
- [x] Montado en `App.tsx` con `forecast.json` (`resolveJsonModule` en `tsconfig.app.json`).
- [x] Responsive vía `viewBox` fijo + SCSS (`width: 100%; height: auto`) — sin JS de recálculo de layout. (El `max-width` por breakpoint de entonces ya no existe: desde la 006 el tope de ancho vive en el contenedor, `004-plan.md` → punto 6.)
- [x] Sprites: redimensionados a 160px de lado máximo, servidos como PNG (comparado contra WebP, PNG gana en peso para este conjunto — ver `tech-stack.md`).
- [x] Comprobación visual real (Playwright, 320/480/768/1200/1600px y hasta 1920px): sin scroll horizontal en ningún breakpoint, sin territorios ni sprites recortados.
- [x] Tests: `map-geometry.test.ts`, `location-views.test.ts`, `SpainMap.test.tsx` (Marruecos/Argelia no generan lugares accesibles, sigue habiendo exactamente 74 `LocationMarker` expuestos individualmente).
- [x] `npm run lint` y `npm run build` (tsc + vite) sin errores.

**Límite de producto documentado, no un defecto pendiente:** a 62u de sprite hay solapamiento puntual entre lugares muy próximos (p. ej. Oviedo/Gijón) — la legibilidad del Pokémon pesa más que evitarlo por completo; queda anotado en `004-plan.md` → Riesgos como límite conocido para la 006 (responsive/accesibilidad de cierre), no se reduce el sprite para evitarlo.

## Bloque 4 — Cierre ✅

- [x] Foco visible en `LocationMarker`: no aplica todavía — ningún marcador es interactivo en la 004 (sin `tabIndex`, sin `onClick`); se revisa cuando 005/006 añadan interacción real.
- [x] `constitution/tech-stack.md` actualizado: fuente/licencia del GeoJSON (Natural Earth, dominio público), decisión PNG vs WebP y redimensionado de sprites.
- [x] Narración del proceso barrida de comentarios, `004-spec.md`, `004-plan.md` y este archivo (`AGENTS.md`, paso 7).
- [x] Validado contra los criterios de aceptación de `004-spec.md`.
- [x] Feature movida a "Hecho" en `../../constitution/roadmap.md`.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ninguna lista con interacción por fila queda sin memoizar — `LocationMarker` envuelto en `React.memo`.
- [x] Los sprites del mapa no llevan `loading="lazy"` (están por encima del pliegue).
- [x] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo en runtime — el mapa solo consume `forecast.json` ya generado.
- [x] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token para ese valor — los `.scss` de la feature no introdujeron variables nuevas (paleta pendiente en `roadmap.md`; reutilizan `_breakpoints.scss` y `currentcolor`).
- [x] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso (ninguna variable nueva).
