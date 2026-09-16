# 005 · Cabecera y leyenda — Tareas

_Un bloque por turno: se implementa, se para y se enseña al usuario antes de pasar al siguiente (`AGENTS.md`, paso 5)._

## Bloque 1 — Paleta y tipografía ✅

- [x] `src/styles/abstracts/_variables.scss` — todos los tokens de `005-plan.md` → punto 1 (compartidos, cabecera, mapa, marcador, tipografía).
- [x] `index.html` — `<link>` de Google Fonts (Pixelify Sans + Nunito Sans) con `preconnect`.
- [x] `npm run lint` limpio tras el cambio (Stylelint sobre `_variables.scss`).

## Bloque 2 — Cabecera ✅

- [x] `src/components/Header/thermal-mood.ts` — `classifyTemperatureMood`, `resolveThermalMood`.
- [x] `src/components/Header/thermal-mood.test.ts` — table-driven: las cinco categorías (límites incluidos), desempate por mediana, array vacío.
- [x] `src/components/Header/format-forecast-headline.ts` — `formatForecastHeadline(date)`.
- [x] `src/components/Header/format-forecast-headline.test.ts` — formato exacto, mayúsculas, ningún cálculo de "mañana".
- [x] `src/components/Header/Header.tsx` + `.scss` (incluye `@font-face` de Poketiempo Unown) — split izquierda/derecha (título/previsión), mood aplicado como modificador BEM vía dos custom properties (`--mood-fill`, `--mood-border`), título con borde negro fijo + `font-weight: 700` (negrita sintética) en las cinco categorías, previsión con su propio borde de mood (matiz del relleno, más fino que el del título), tamaño de título responsivo (`3rem`→`3.6rem`→`4.8rem`) para no desbordar en 320px.
- [x] `src/components/Header/Header.test.tsx` — título y línea de previsión presentes, clase de mood correcta según el `Forecast` de prueba.
- [x] `App.tsx` monta `<Header forecast={forecastData} />` en lugar del `<h1>` provisional; `App.test.tsx` actualizado.

## Bloque 3 — Mapa: paleta y territorios independientes ✅

- [x] `scripts/build-map.ts` — `territoryPaths` (España, Portugal, Andorra, Baleares, Ceuta, Melilla) sustituye a `mainMapPath`.
- [x] `src/data/map-geometry.ts` — `territoryPaths` empalmado sobre el archivo ya commiteado, **sin regenerar `mapPoints`/`canaryBox`/`provinceBoundariesPath`/`northAfricaContext`**: `npm run build:map` ya no reproduce las coordenadas commiteadas de los 74 lugares (48 distintas) aunque nada de lo que usa como entrada cambió — inconsistencia previa a la 005, documentada en `005-plan.md` → Riesgos, no se toca aquí (fuera de alcance, geometría de la 004).
- [x] `src/data/map-geometry.test.ts` — `territoryPaths` con las 6 claves, cada `d` no vacío; España y Portugal generan paths distintos entre sí (criterio de la spec: "paths de España/Portugal quedan separados").
- [x] `src/components/SpainMap/SpainMap.tsx` + `.scss` — `<rect>` de mar de fondo (recortado a `seaBottom`, no a todo `ROOT_VIEW_BOX` — ver Decisiones en `005-plan.md`), 6 `<path>` de territorio con su color por país, contexto norteafricano con el color de España más tenue.
- [x] `src/components/SpainMap/components/TerritoryInset.tsx` + `.scss` — `<rect>` de mar, `__landmass` con el color de España, `__frame` con `$color-sky-blue`.
- [x] `src/components/SpainMap/SpainMap.test.tsx` — sin referencias a `mainMapPath` (no las tenía; sigue habiendo 74 `LocationMarker`).
- [x] `src/App.tsx` + `src/App.scss` (nuevo) — `app__sea-backdrop` envolviendo `Header` + `SpainMap` con el mismo `$map-sea`, para que la cabecera no quede sobre fondo blanco mientras el mapa ya usa el azul del mar.
- [x] Comprobación visual (Playwright): mar de fondo completo sin extenderse por debajo de Canarias/contexto norteafricano, transición sin costura entre cabecera y mapa, España/Portugal/Andorra distinguibles, marco de Canarias con su color, Ceuta/Melilla coloreadas (tapadas por su propio sprite en vista normal — límite ya documentado en la 004).

## Bloque 4 — Temperaturas sobre cada marcador ✅

- [x] `src/components/SpainMap/components/marker-temperature.ts` — `classifyMarkerTemperature`.
- [x] `src/components/SpainMap/components/marker-temperature.test.ts` — table-driven, las seis franjas con sus límites.
- [x] `src/components/SpainMap/location-views.ts` — `LocationView.minC`/`.maxC`; `src/components/SpainMap/location-views.test.ts` actualizado (valores correctos con forecast, `null` sin forecast).
- [x] `src/components/SpainMap/components/LocationMarker.tsx` + `.scss` — `<text>`/`<tspan>` mínima/máxima, color por franja, `paint-order: stroke fill`, nombre accesible ampliado.
- [x] `src/components/SpainMap/components/LocationMarker.test.tsx` — con y sin `minC`/`maxC`, color de cada `tspan`, nombre accesible con y sin temperatura.
- [x] `SpainMap.tsx`/`TerritoryInset.tsx` pasan `minC`/`maxC` al `LocationMarker`.
- [x] Comprobación visual (Playwright, resolución alta): temperaturas legibles sobre el sprite, colores independientes por cifra correctos; sin necesidad de pastilla de fondo.

## Bloque 5 — Leyenda dinámica ✅

- [x] `src/components/SpainMap/pick-map-pokemon.ts` — `export const MAP_PRIORITY`.
- [x] `src/components/Legend/visible-map-pokemon.ts` — `getVisibleMapPokemonIds(forecast)`.
- [x] `src/components/Legend/visible-map-pokemon.test.ts` — deduplica, respeta el orden de `MAP_PRIORITY`, solo incluye lo realmente visible (no los 24).
- [x] `src/components/Legend/legend-metadata.ts` — `LEGEND_METADATA`.
- [x] `src/components/Legend/legend-metadata.test.ts` — las 24 claves de `PokedexId` cubiertas, ninguna vacía.
- [x] `src/components/Legend/Legend.tsx` + `.scss` — encabezado visible "Leyenda" (fuente Poketiempo Unown, da el nombre accesible a la sección vía `aria-labelledby`) + lista HTML, sprite + descripción.
- [x] `src/components/Legend/Legend.test.tsx` — renderiza el encabezado "Leyenda" y solo los Pokémon visibles de un `Forecast` de prueba, sin duplicados, con su descripción.
- [x] `App.tsx`/`App.scss` reescritos como grid con áreas con nombre (`app__layout`) — la leyenda queda bajo el título en tablet+ (mission.md), apilada en el ancho base sin overflow. El fondo de mar vive en `Header.scss` (`grid-area: header`). El título de la cabecera lleva tamaño responsivo (`3rem`→`3.6rem`→`4.8rem`) — a `4.8rem` fijo desborda en 320px.
- [x] `src/components/Legend/Legend.scss` — `object-fit: contain` en el sprite (no todos son cuadrados, se deformaban); "Leyenda" y las etiquetas comparten `--mood-fill`/`--mood-border` con `Header.scss`, ambos en negrita y con un borde fino de mood (matiz del propio relleno) para separarse del mar.

## Bloque 6 — Ampliación de alcance: revisión de `assignPokemon()` ✅

_Ver `005-spec.md` → "Ampliación de alcance" y `005-plan.md` → punto 8._

- [x] `src/domain/assign-pokemon.ts` → `assignBySky`: `'despejado'` asigna `castform-sun` (además de la franja de temperatura, que no cambia).
- [x] `src/domain/assign-pokemon.ts` → `assignPokemon`: deduplica la salida (`[...new Set(ids)]`).
- [x] `src/domain/assign-pokemon.ts` → `assignByMarine`: nueva constante `GYARADOS_MEGA_WAVE_HEIGHT_THRESHOLD_M = 2.5`; Mega Gyarados dispara por aviso rojo costero **o** por `waveHeightM >= 2.5`.
- [x] `src/domain/assign-pokemon.test.ts` — tests actualizados/nuevos: `assignBySky('despejado')`, dedup en `assignPokemon` (mismo día, dos ejes → un valor; ejes distintos → sin pérdida), franja 2,49/2,5/5 m en `assignByMarine`.
- [x] `src/components/SpainMap/pick-map-pokemon.ts` — `castform-sun` al final de `MAP_PRIORITY` (detrás de `groudon-primal`), para que la temperatura real de un lugar no quede tapada por el disparador de cielo.
- [x] `src/components/SpainMap/pick-map-pokemon.test.ts` — nuevos casos: temperatura real gana sobre `castform-sun` cuando coinciden con otro tramo; `castform-sun` gana cuando es el único candidato de temperatura.
- [x] `spec/features/003-pokemon-assignment-engine/003-plan.md` — tablas de nubes, oleaje, viento cálido y prioridad de presentación actualizadas como fuente de verdad del dominio.
- [x] `constitution/roadmap.md` — resumen de la 003 actualizado; Moltres anotado en "Decisiones pendientes" (bloqueado por sprite/licencia y por no existir "viento cálido" como dato en ninguna fuente).
- [x] `src/components/Legend/legend-metadata.ts` — las 24 etiquetas reescritas sin números:
  - snorunt: Helado · solrock: Despejado y frío · castform-sun: Templado · charmander: Caluroso · charmeleon: Muy caluroso · magmar: Sofocante · groudon: Volcánico · groudon-primal: Infernal
  - castform-rain: Lluvia moderada · kyogre: Lluvia intensa · kyogre-primal: Lluvias torrenciales · cryogonal: Nevadas · abomasnow: Nevadas intensas
  - hoppip: Viento moderado · dragonite: Viento intenso · rayquaza: Vendaval · tornadus: Viento extremo
  - gyarados: Oleaje · gyarados-mega: Oleaje muy fuerte
  - Sin cambios: altaria (Poco nuboso), castform (Nuboso o cubierto), hippowdon (Calima), zapdos (Tormenta), castform-ice (Niebla).
- [x] `src/components/Legend/legend-metadata.test.ts` y `src/components/Legend/Legend.test.tsx` — actualizados a las nuevas etiquetas.
- [x] **Moltres, 25º `PokedexId`** — sprite provisto por el propietario del producto, redimensionado a 160×69 (PNG indexado, `sharp-cli` vía `npx`, sin dependencia nueva) y colocado en `src/assets/sprites/moltres.png`.
  - [x] `src/domain/pokedex.ts` — `'moltres'` añadido al tipo `PokedexId`.
  - [x] `src/domain/assign-pokemon.ts` → `assignByWarmWind` (nuevo eje): `WARM_WIND_SPEED_THRESHOLD_KMH = 40`, `WARM_WIND_TEMPERATURE_THRESHOLD_C = 30`; `wind.speedKmh >= 40` **y** `temperature.maxC >= 30` → `'moltres'`; cableado en `assignPokemon`.
  - [x] `src/domain/assign-pokemon.test.ts` — tests de `assignByWarmWind` (fronteras de los dos umbrales, `wind === null`, ignora `gustKmh`).
  - [x] `src/components/SpainMap/sprite-sources.ts` — import de `moltres.png`.
  - [x] `src/components/SpainMap/pick-map-pokemon.ts` — `'moltres'` en `MAP_PRIORITY`, detrás de `gyarados`, delante de `hoppip`; `pick-map-pokemon.test.ts` con los nuevos casos de prioridad.
  - [x] `src/components/Legend/legend-metadata.ts` — `moltres: 'Viento cálido'`; `legend-metadata.test.ts`/`visible-map-pokemon.test.ts` actualizados a 25 `PokedexId`.
  - [x] `003-plan.md`, `roadmap.md`, `005-spec.md`, `005-plan.md` — documentación actualizada (tabla de viento cálido, resumen de 003, catálogo ya no "cerrado a 24", sprite de Moltres añadido a la entrada pendiente de licencia de sprites en `roadmap.md`).
- [x] `npm run lint` (limpio), `npm run test` (318/318), `npm run build` sin errores. Comprobación visual: leyenda con las 24 etiquetas nuevas, sin números.

## Bloque 7 — Créditos y composición final ✅

- [x] `src/components/Credits/Credits.tsx` + `.scss` + `.test.tsx` — las dos líneas de crédito, HTML semántico (`<footer>`), `grid-area: credits` en su propio `.scss`.
- [x] `src/App.scss` — amplía (no repite) el grid del bloque 5 (`app__layout`): añade `credits` a `grid-template-areas` (fila propia, a todo el ancho, bajo leyenda/mapa) en la única plantilla del grid (réplica fija, sin plantilla alternativa por breakpoint desde la 006).
- [x] `App.tsx` — monta `<Credits />` junto a `Header`/`Legend`/`SpainMap` dentro de `app__layout`; `App.test.tsx` actualizado (comprueba el `<footer>` con `getByRole('contentinfo')`).
- [x] `npm run lint`, `npm run test` (357/357) y `npm run build` sin errores.
- [ ] Comprobación visual (Playwright) de la fila de créditos añadida al grid — la 006 verificó la composición cabecera/leyenda/mapa antes de que existiera esta fila; pendiente confirmar que no rompe el ajuste de altura (`$legend-max-height`, `$fluid-root-height-divisor`) que la 006 afinó sin ella.

## Bloque 8 — Cierre ✅

- [x] `constitution/roadmap.md` → "Decisiones pendientes" — anotada la inconsistencia de `npm run build:map`/`mapPoints` (ver más abajo).
- [x] Comentarios obsoletos sobre "hoy" corregidos en `src/domain/types.ts`, `src/domain/forecast-readiness.test.ts` (se refieren al día del forecast/a la ejecución, no al día de ejecución del agente). `sprite-sources.ts` no tenía ninguno pendiente al revisar.
- [x] `constitution/tech-stack.md` — paleta ya no "sin definir" (tabla completa añadida); Pixelify Sans/Nunito Sans anotadas; tipografía del título documentada (Poketiempo Unown, fuente propia); sección de breakpoints corregida (ya no describe reorganización mobile-first: la composición es una réplica fija de escala fluida desde la 006). La composición (split izquierda/derecha) no cambia, no se toca `mission.md` (su cambio de principio de mobile-first a réplica fija es de la 006, no de esta feature).
- [x] `constitution/roadmap.md` — 005 movida a "Hecho"; "Paleta de color" retirada de "Decisiones pendientes"; 006 añadida a "Hecho" (con su alcance parcial) y retirada de "Orden previsto".
- [x] Narración del proceso barrida de comentarios y de `005-spec.md`/`005-plan.md`/este archivo.
- [x] Validado contra los criterios de aceptación de `005-spec.md` — todos marcados.
- [x] `npm run lint`, `npm run test` (357/357), `npm run build` sin errores.

## Definición de "hecho" (además de los criterios de la spec)

- [ ] Ninguna lista con interacción por fila queda sin memoizar (`LocationMarker` sigue con `React.memo`; `Legend` no tiene interacción por fila, no aplica).
- [ ] Los sprites de la leyenda y del mapa no llevan `loading="lazy"` (por encima del pliegue).
- [ ] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo en runtime.
- [ ] Ningún valor de color/tipografía nuevo se escribe como literal si ya existe un token para ese valor exacto (`_variables.scss`).
- [ ] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso.
