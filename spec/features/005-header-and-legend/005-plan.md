# 005 · Cabecera y leyenda — Plan

**Estado:** implementado ✅

## Enfoque

Cuatro piezas de presentación nuevas (`Header`, `Legend`, `Credits`, y los ajustes de `SpainMap`/`TerritoryInset`/`LocationMarker`), cada una con su propia lógica pequeña y testeable colocada junto al componente que la usa — nunca en `src/domain/`, porque ninguna de las dos clasificaciones nuevas (mood térmico de cabecera, franja de color por temperatura de marcador) es una regla meteorológica: son puro criterio de presentación sobre datos que el dominio ya da (`temperature.maxC/minC`). `assignPokemon()`, `pickMapPokemon()` y `MAP_PRIORITY` no se tocan; la leyenda y el mapa solo consumen lo que ya producen.

La paleta de color (pendiente en `roadmap.md`) se fija aquí y se centraliza en `src/styles/abstracts/_variables.scss` — primera feature que puebla ese archivo. Un mismo hex reutilizado en dos sitios (ej. `#42C7EC` en el marco de Canarias y en la categoría "cold" de cabecera; `#09E230` en la categoría "neutral" de cabecera y en dos franjas de marcador) usa una única variable, no dos con el mismo valor (`tech-stack.md` → convenciones de variables SCSS).

## 1 — Paleta y tipografía (fundamentos)

**`src/styles/abstracts/_variables.scss`** — tokens nuevos, agrupados por uso:

```scss
// Compartidos (mismo hex, más de un consumidor)
$color-white: #ffffff;
$color-near-black: #111111;
$color-green: #09e230; // mood neutral (relleno) + marker mild (borde) + marker pleasant (relleno)
$color-sky-blue: #42c7ec; // mood cold + marco de Canarias

// Cabecera y leyenda — mood térmico (relleno). "cold"/"neutral" reutilizan
// $color-sky-blue/$color-green de arriba; el resto son variables propias.
$header-mood-gelid: #3f6fe0;
$header-mood-heat: #eb6b59; // rojo-anaranjado de verano
$header-mood-sweltering-fill: #e54343; // rojo más puro e intenso que "heat": ola de calor, no solo verano

// Cabecera y leyenda — mood térmico (borde de previsión/"Leyenda"/
// etiquetas, nunca del título grande, que lleva $color-near-black — ver
// Decisiones). Cada tono es el mismo matiz que su relleno, un 25% más
// oscuro (HSL, mismo h/s, -0.25 de lightness) — un matiz, no un contorno
// negro plano.
$header-mood-gelid-border: #163989;
$header-mood-cold-border: #10809f;
$header-mood-neutral-border: #046716;
$header-mood-heat-border: #af2815;
$header-mood-sweltering-border: #941414;

// Mapa
$map-sea: #b9fffd;
$map-spain: #ffebf6; // España, Baleares, Ceuta, Melilla, Canarias
$map-portugal: #f6ffec;
$map-andorra: #fff3b0;
$map-north-africa-opacity: 0.5; // mismo color que España, más tenue

// Temperatura por marcador (las que no comparten hex con lo de arriba)
$marker-temp-freezing-stroke: #7b2cbf;
$marker-temp-cool: #848dee;
$marker-temp-hot: #e53935;
$marker-temp-hot-stroke: #ffd54f;
$marker-temp-scorching: #9b1c31;
$marker-temp-scorching-stroke: #c69214;

// Tipografía
$font-title: 'Poketiempo Unown', sans-serif; // cabecera (POKETIEMPO) + encabezado de la leyenda
$font-heading: 'Pixelify Sans', monospace; // línea de previsión de la cabecera
$font-body: 'Nunito Sans', sans-serif; // leyenda + créditos + temperaturas del mapa (prioriza legibilidad)
```

**`index.html`** — `<link>` de Google Fonts para Pixelify Sans y Nunito Sans (con `preconnect`), sin ninguna dependencia JS:

```html
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link
  href="https://fonts.googleapis.com/css2?family=Nunito+Sans:wght@400;600;700&family=Pixelify+Sans:wght@400;500;600;700&display=swap"
  rel="stylesheet"
/>
```

**`src/components/Header/Header.scss`** — `@font-face` de Poketiempo Unown (fuente propia, vectorizada del alfabeto Unown; ver tech-stack.md → Identidad visual). Declarada aquí porque `Header.scss` siempre se carga; también la consume `Legend` para su encabezado:

```scss
@font-face {
  font-family: 'Poketiempo Unown';
  src: url('../../assets/fonts/poketiempo-unown.woff2') format('woff2');
  font-display: swap;
}
```

## 2 — Cabecera

- **`src/components/Header/thermal-mood.ts`** — capa de presentación, no dominio:
  - `type ThermalMoodCategory = 'gelid' | 'cold' | 'neutral' | 'heat' | 'sweltering'`
  - `classifyTemperatureMood(maxC: number): ThermalMoodCategory` — los 5 cortes del enunciado (`< 0`, `< 10`, `< 26`, `< 35`, resto).
  - `resolveThermalMood(maxCValues: readonly number[]): ThermalMoodCategory` — cuenta apariciones por categoría; si una sola tiene el máximo, esa gana; en empate, se usa la categoría de `classifyTemperatureMood(median)` sobre el array completo ordenado (mediana determinista, no depende del orden de entrada). Array vacío → `'neutral'` como respaldo explícito (no se espera en producción — el pipeline garantiza 74/74 — pero la función no lo asume, mismo criterio de "caso de respaldo explícito" que usa `src/domain/`).
- **`src/components/Header/format-forecast-headline.ts`** — `formatForecastHeadline(date: string): string`, devuelve la línea completa ("PREVISIÓN · VIERNES 12 DE SEPTIEMBRE"). Parsea `date` (`YYYY-MM-DD`) a sus tres componentes numéricos y construye un `Date.UTC(...)` solo para pasarlo por `Intl.DateTimeFormat('es-ES', { timeZone: 'UTC', weekday: 'long' | month: 'long' })` — mismo patrón que `target-date.ts` para no depender de la zona horaria del entorno de ejecución. No suma ni resta ningún día: `forecast.date` ya es la fecha final.
- **`src/components/Header/Header.tsx`** — recibe `forecast: Forecast`; calcula `mood` (`resolveThermalMood` sobre `forecast.locations.map(l => l.temperature.maxC)`) y `headline` (`formatForecastHeadline(forecast.date)`) memoizados. Renderiza el split ya fijado en `mission.md`/`tech-stack.md`:
  ```html
  <header class="app-header app-header--{mood}">
    <h1 class="app-header__title">POKETIEMPO</h1>
    <p class="app-header__forecast">{headline}</p>
  </header>
  ```
- **`Header.scss`** — dos custom properties (`--mood-fill`, `--mood-border`) redefinidas por cada modificador `--gelid/--cold/--neutral/--heat/--sweltering` (patrón ya fijado en `tech-stack.md` para modificadores BEM que cambian el color de varios hijos). El título y la previsión leen ambos `--mood-fill` para su color, pero el borde de cada uno es distinto (ver Decisiones): el título lleva `$color-near-black` fijo (no varía por mood) con `font-weight: 700` (negrita sintética — Poketiempo Unown solo trae un peso propio); la previsión lleva `--mood-border` (un matiz del propio relleno, no un contorno negro — a los glifos finos de Pixelify Sans un borde negro se ve como un contorno duro). Layout con `display: flex; justify-content: space-between; align-items: baseline` (título a la izquierda, previsión a la derecha) — sin quiebre por breakpoint, a cualquier ancho: la composición es una réplica fija que escala como una sola unidad (`006-plan.md`), nunca se reorganiza.

## 3 — Mapa: paleta y territorios independientes

**`scripts/build-map.ts`** — mismo `mainProjection` (`fitExtent` sobre el grupo de las 6 features), pero en vez de un único `geoPath(mainProjection)(mainCollection)` se genera un `geoPath(mainProjection)(single(feature))` por cada una de las 6 (reutilizando el helper `single()` ya existente, el mismo patrón que ya usan Marruecos/Argelia). Se elimina `mainMapPath`; se añade:

```ts
export const territoryPaths: Record<'spain' | 'portugal' | 'andorra' | 'balearic-islands' | 'ceuta' | 'melilla', string> = { ... }
```

Se regenera `src/data/map-geometry.ts` con `npm run build:map` — archivo generado, no se edita a mano.

**`src/components/SpainMap/SpainMap.tsx`**:
- `<rect>` de fondo como primer hijo del `<svg>`, clase `spain-map__sea`, `aria-hidden="true"`. **No cubre todo `ROOT_VIEW_BOX`**: su altura para en `seaBottom = canaryBox.y + canaryBox.height` (el punto más bajo del contenido real — coincide con el borde inferior tanto de Canarias como del contexto norteafricano), no en el borde inferior del `viewBox`. Por debajo de `seaBottom`, el `viewBox` solo reserva aire (`BOTTOM_BAND`, 004-plan.md) — rellenarlo de azul dejaría un bloque de mar vacío y desproporcionado. No toca `ROOT_VIEW_BOX` ni ninguna coordenada de `map-geometry.ts` — la 004 queda intacta, es solo cuánto de ese lienzo pinta el `<rect>` nuevo de la 005.
- **La cabecera comparte el mismo fondo de mar que el mapa.** El azul (`$map-sea`) vive en `Header.scss` (`grid-area: header`), no en un `<div>` contenedor — sin eso, "POKETIEMPO" quedaba sobre fondo blanco mientras el mapa ya usaba el azul del mar. `App.tsx`/`App.scss` (el grid `app__layout`, ver punto 7) son la primera pieza de la composición final; se amplían, no se repiten, cuando se añada `Credits` en el bloque 6.
- Sustituye el único `<path className="spain-map__landmass">` por 6 `<path>` (uno por `territoryPaths[id]`), cada uno con la clase de su país (`spain-map__territory--es|--pt|--ad`, vía una tabla `{spain: 'es', 'balearic-islands': 'es', ceuta: 'es', melilla: 'es', portugal: 'pt', andorra: 'ad'}`) — España/Baleares/Ceuta/Melilla comparten estilo visual, cada uno su propio `<path>` (así las fronteras entre países quedan marcadas por el propio trazo, sin trucos de CSS).
- El contexto norteafricano pasa de `fill: currentcolor` a `fill: $map-spain` con `fill-opacity: $map-north-africa-opacity` (mismo color que España, la mitad de intensidad — "visiblemente más tenue").

**`src/components/SpainMap/components/TerritoryInset.tsx`** (Canarias) — mismo `<rect>` de fondo (`$map-sea`) antes de la silueta; `__landmass` pasa a `fill: $map-spain` (Canarias es España); `__frame` pasa de `stroke: currentcolor` a `stroke: $color-sky-blue`.

**SCSS** — `SpainMap.scss` y `TerritoryInset.scss` actualizados con los tokens nuevos; el trazo de `__landmass`/`__province-boundaries`/fronteras se mantiene en `currentcolor` (detalle secundario, fuera del alcance de esta paleta — sigue sin competir con los sprites).

## 4 — Temperaturas sobre cada marcador

- **`src/components/SpainMap/components/marker-temperature.ts`** — presentación, no dominio:
  - `type MarkerTemperatureBand = 'freezing' | 'cool' | 'mild' | 'pleasant' | 'hot' | 'scorching'`
  - `classifyMarkerTemperature(celsius: number): MarkerTemperatureBand` — los 6 cortes del enunciado, aplicados sobre el valor ya redondeado al entero. **Decisión:** la clasificación usa el mismo entero que se muestra (`Math.round`), no el valor crudo — así el color de "21°" nunca corresponde a la franja de al lado por culpa de un decimal invisible en pantalla; el redondeo sigue siendo "solo de presentación" en el sentido de que no se propaga a ningún otro sitio (dominio, ordenación, tests de 003).
- **`src/components/SpainMap/location-views.ts`** — `LocationView` añade `minC: number | null` y `maxC: number | null`, tomados de `locationForecast.temperature` cuando existe (`null` si el lugar no tiene forecast, igual que `pokemonId`).
- **`src/components/SpainMap/components/LocationMarker.tsx`**:
  - Props nuevas `minC?: number | null` y `maxC?: number | null` (opcionales — un marcador sin forecast sigue siendo válido para tests/robustez, criterio ya usado con `pokemonId`).
  - Cuando ambas son no nulas, `<text>` centrado (`text-anchor: middle`) superpuesto en la zona inferior del sprite, con dos `<tspan>`: mínima primero, máxima después, cada uno con su propia clase de franja (`location-marker__temp-value--{band}`) y `paint-order: stroke fill` vía CSS.
  - Nombre accesible: `"{name}, mínima {round(minC)} grados, máxima {round(maxC)} grados"` cuando hay temperatura; si no, se mantiene el nombre solo (comportamiento actual).
- **`LocationMarker.scss`** — igual que la cabecera, custom properties por modificador de franja (`--freezing/--cool/--mild/--pleasant/--hot/--scorching`) para `fill`/`stroke`/`stroke-width` del `tspan`, `font-family: $font-body` (Nunito Sans — aquí prima la legibilidad sobre la estética pixel; Pixelify Sans queda reservada a la línea de previsión de la cabecera).
- **`SpainMap.tsx`/`TerritoryInset.tsx`** — pasan `minC`/`maxC` de cada `LocationView` al `LocationMarker` correspondiente (ambos puntos de uso).

## 5 — Leyenda dinámica

- **`src/components/SpainMap/pick-map-pokemon.ts`** — se exporta `MAP_PRIORITY` (ya existe, solo se le quita `const` interno por `export const`).
- **`src/components/Legend/visible-map-pokemon.ts`** — `getVisibleMapPokemonIds(forecast: Forecast): PokedexId[]`: reutiliza `buildLocationViews(locations, forecast)` (la misma función que ya usa `SpainMap`, ninguna lógica duplicada), junta los `pokemonId` no nulos en un `Set` (deduplicación) y filtra `MAP_PRIORITY` por ese `Set` (orden de leyenda = orden de prioridad del mapa, sin copiar el array).
- **`src/components/Legend/legend-metadata.ts`** — `LEGEND_METADATA: Record<PokedexId, string>` con las 25 etiquetas literales del enunciado (`castform-sun` describe su franja de temperatura, nunca "soleado").
- **`src/components/Legend/Legend.tsx`** — recibe `forecast: Forecast`; `visibleIds = useMemo(() => getVisibleMapPokemonIds(forecast), [forecast])`; `<section aria-labelledby="legend-heading">` con un `<h2 id="legend-heading">Leyenda</h2>` visible (fuente Poketiempo Unown) seguido de un `<ul>` de `<li>` (sprite `spriteSources[id]` reutilizado de `SpainMap/sprite-sources.ts` + `LEGEND_METADATA[id]`). El nombre accesible de la sección viene del propio encabezado, no de un `aria-label` redundante. HTML, no SVG; sin `loading="lazy"` en los sprites (la leyenda está por encima del pliegue, igual que el mapa).
- **`Legend.scss`** — columna simple (`flex-direction: column`), `font-family: $font-body`. Fondo `$map-sea` (mismo azul que cabecera y mapa); `--mood-fill`/`--mood-border` (misma paleta que `Header.scss`) para el color de "Leyenda" y de cada etiqueta — ambos con negrita (sintética en "Leyenda", real en las etiquetas — Nunito Sans sí trae ese peso) y con el trazo de mood fino (`--mood-border`, un matiz del propio relleno) para que el texto se separe del mar en las categorías más claras (`cold`/`neutral`). El sprite lleva `object-fit: contain` dentro de una caja fija — los 24 sprites no son todos cuadrados (redimensionados a 160px de **lado máximo**, no 160×160, `tech-stack.md`), así que forzar el mismo ancho y alto sin esto los deforma.

## 6 — Créditos

- **`src/components/Credits/Credits.tsx`** — componente propio, pequeño y sin estado, coherente con el resto (`Loader` también vive en su propia carpeta aunque hoy se use una sola vez). `<footer className="credits">` con las dos líneas literales del enunciado, HTML semántico, sin URLs inventadas.
- **`Credits.scss`** — `font-family: $font-body`, tipografía discreta pero legible (tamaño reducido respecto al cuerpo, contraste suficiente).

## 7 — Composición en `App.tsx`

**CSS Grid con áreas con nombre** — el orden visual lo decide `grid-template-areas`, no el orden en el DOM, así que cada componente sigue siendo un elemento independiente (nada de anidar `Legend`/`SpainMap` dentro de un wrapper del fondo de mar), y la leyenda queda bajo el título (`mission.md`), no bajo el mapa:

```tsx
<main>
  <div className="app__layout">
    <Header forecast={forecastData} />
    <Legend forecast={forecastData} />
    <SpainMap forecast={forecastData} />
    <Credits />
  </div>
</main>
```

**`src/App.scss`** — el contenedor define la plantilla; cada componente fija su propio `grid-area` en su propio `.scss` (`Header.scss` → `header`, `Legend.scss` → `legend`, `SpainMap.scss` → `map`, `Credits.scss` → `credits`, bloque 6). Una única plantilla de grid a cualquier ancho (`"header header" "legend map" "credits credits"`, dos columnas `minmax(22rem, 26rem) 1fr`) — sin cambio de columnas por breakpoint: la composición es una réplica fija que escala como una sola unidad (`mission.md` → "Réplica fija, no una app adaptativa", `006-plan.md`), nunca se reorganiza. Lo que hace que quepa en cualquier tamaño de pantalla es la raíz fluida (`html { font-size }`, `_reset.scss`), no un cambio de plantilla.

El azul del mar vive en `Header.scss` (`grid-area: header` ocupa toda la fila superior, columnas incluidas) — no en el contenedor: así la leyenda, que comparte columna con el título pero está en una fila aparte, no hereda el fondo azul. El mapa no necesita fondo azul del contenedor porque ya pinta el suyo (`spain-map__sea`, punto 3).

## 8 — Motor de asignación: piezas que necesita la leyenda

La leyenda necesita que el motor de asignación (003) cubra `'despejado'`
(castform-sun por cielo), el segundo camino físico de Mega Gyarados
(`waveHeightM >= 2,5`) y "viento cálido" (Moltres) — las reglas completas,
sus umbrales y el orden de `MAP_PRIORITY` resultante son responsabilidad
de `003-plan.md` (`assignBySky`, `assignByMarine`,
`assignByWarmWind`, "Prioridad de presentación"), no se repiten aquí.

- **`domain/pokedex.ts`**: `PokedexId` incluye `'moltres'` — 25 en total.
- **`sprite-sources.ts`**: import de `moltres.png`, redimensionado a 160px de lado máximo con `sharp-cli`, mismo criterio que el resto de sprites (004-plan.md).
- **`legend-metadata.ts`**: las 25 etiquetas son palabras, ninguna lleva número (ver `005-tasks.md` para el texto exacto de cada una); Moltres → "Viento cálido".

**Origen/licencia del sprite de Moltres**: misma entrada pendiente que el resto de sprites, sin documentar todavía en `tech-stack.md` (`roadmap.md` → Decisiones pendientes).

## Implementación (orden de archivos)

1. `_variables.scss`, `index.html` — paleta y fuentes.
2. `Header/` (`thermal-mood.ts`, `format-forecast-headline.ts`, `Header.tsx/.scss`) + montaje mínimo en `App.tsx`.
3. `scripts/build-map.ts` → `npm run build:map` → `src/data/map-geometry.ts`; `SpainMap.tsx/.scss`, `TerritoryInset.tsx/.scss`.
4. `pick-map-pokemon.ts` (export), `marker-temperature.ts`, `location-views.ts`, `LocationMarker.tsx/.scss`; wiring en `SpainMap.tsx`/`TerritoryInset.tsx`.
5. `Legend/` (`visible-map-pokemon.ts`, `legend-metadata.ts`, `Legend.tsx/.scss`) + `App.tsx`/`App.scss` reescritos como grid con áreas con nombre (`app__layout` — leyenda bajo el título, ver punto 7).
6. `Credits/` + ampliar `App.scss` (área `credits`) + composición final de `App.tsx`.
7. `assign-pokemon.ts`/`.test.ts`, `pick-map-pokemon.ts`/`.test.ts`, `003-plan.md`, `legend-metadata.ts`/`.test.ts` — ampliación de alcance (punto 8).
8. Cierre: comentarios "hoy" obsoletos, constitución, barrido de narración.

## Decisiones

- **Mood térmico y franja de marcador viven en la capa de presentación (`src/components/`), no en `src/domain/`** — controlan solo aspecto visual, no qué Pokémon corresponde a nadie; `assignPokemon()` sigue siendo la única regla meteorológica.
- **Clasificación de color del marcador sobre el valor ya redondeado**, no el crudo — coherencia visual entre el número mostrado y su propio color (ver punto 4).
- **`getVisibleMapPokemonIds` reutiliza `buildLocationViews`** en vez de reimplementar el cruce `location → forecast → assignPokemon → pickMapPokemon` — una sola fuente de verdad, cero duplicación de las reglas de la 003/004.
- **Un hex repetido en la spec usa una única variable SCSS** (`$color-green`, `$color-sky-blue`) — cumple la convención de no duplicar valores ya tokenizados.
- **`-webkit-text-stroke` para la cabecera (HTML), `stroke`/`paint-order` real para las temperaturas del marcador (SVG)** — cada contexto usa el mecanismo de borde de texto que le corresponde; ninguno usa `text-shadow`.
- **Fuente de los números de temperatura: Nunito Sans** — misma familia que leyenda y créditos, prioriza legibilidad sobre estética pixel; Pixelify Sans queda reservada a la línea de previsión de la cabecera.
- **Sin pastilla/fondo detrás de las temperaturas** salvo que la comprobación visual (Playwright) muestre que no se lee sobre algún sprite — condición explícita del enunciado, se revisa en el cierre antes de añadir nada.
- **Composición de cabecera: se mantiene el split izquierda/derecha ya fijado en `mission.md`/`tech-stack.md`** — ninguno de los dos documentos se toca en esta feature.
- **Título a un único tamaño fijo, `4.8rem`, sin pasos por breakpoint** — "POKETIEMPO" (una palabra sin espacios, no puede partirse en dos líneas) cabe en cualquier ancho porque la composición entera escala mediante la raíz fluida (`006-plan.md`), no porque el título cambie de tamaño por su cuenta.
- **Las cinco categorías llevan el mismo borde en el título: negro (`$color-near-black`), `0.9px`, más `font-weight: 700` (negrita sintética — Poketiempo Unown solo trae un peso propio)** — un borde de color por mood no aporta frente al negro simple en un texto tan grande, y uno blanco deja "cold" casi ilegible contra el mar. La previsión y la leyenda, mucho más pequeñas, sí usan un borde de mood (`--mood-border`, un matiz del propio relleno un 25% más oscuro) en vez de negro plano — a ese tamaño un contorno negro se ve como un trazo duro, no como parte del propio color.
- **"heat" es un rojo-anaranjado de verano (`#EB6B59`), "sweltering" un rojo más puro e intenso (`#E54343`)** — ninguno reutiliza `$color-green`/`$color-sky-blue`: son las dos categorías que de verdad debían leerse "calor", y las etiquetas de la leyenda reutilizan el mismo relleno, así que además de la temática hace falta que ninguno de los dos sea tan oscuro que apague el tono ni tan intenso que se vea agresivo.
- **La franja "pleasant" del marcador (21–25 °C, verde) lleva borde blanco** — la spec original solo le daba relleno, sin borde; pedido explícito para mejorar su contraste sobre el rosa/verde pálido del mapa. Mismo grosor (`0.8`) que el resto de franjas con borde.
- **`Credits` como componente propio** aunque se monte una sola vez — mismo criterio que `Loader`, ya existente en el repo.
- **Composición con CSS Grid + `grid-template-areas` con nombre, no `flex` anidado** — el orden visual lo decide la plantilla del grid, no el anidado en el DOM: cada componente sigue siendo un hijo directo e independiente de `app__layout`, y cada uno fija su propio `grid-area` en su propio `.scss`. Con esto, la leyenda queda bajo el título en vez de bajo el mapa (`mission.md`).
- **Cabecera y mapa comparten un único fondo de mar (`Header.scss`, `grid-area: header`), pero el `<rect>` del mar dentro del SVG no cubre todo `ROOT_VIEW_BOX`** — se detiene en `seaBottom` (borde inferior de Canarias/contexto norteafricano), no en el borde inferior del `viewBox`: por debajo de ese punto el `viewBox` solo reserva aire (`BOTTOM_BAND`, 004-plan.md). No se toca `ROOT_VIEW_BOX` ni ninguna coordenada de `map-geometry.ts`.

## Riesgos

- **Solapamiento de la temperatura con el sprite o con marcadores vecinos** — a 62u de sprite ya hay solapamiento puntual documentado en la 004 (Oviedo/Gijón); añadir texto debajo puede agravarlo en zonas densas. Se comprueba con Playwright en el cierre; si el texto queda ilegible en algún punto concreto, es el caso ya previsto para valorar una pastilla de fondo (ver Decisiones), no para reducir el sprite.
- **`forecast.json` cambia a diario** — ningún test de esta feature depende de qué categoría térmica o qué Pokémon le toca hoy a un lugar real; los tests de mood/leyenda/marcador usan `Forecast` construidos a mano (mismo patrón que `SpainMap.test.tsx`).
- **Regenerar `map-geometry.ts` es un paso manual (`npm run build:map`)** — si se edita `build-map.ts` sin re-ejecutar el script, el archivo generado queda desincronizado; se verifica en el cierre de cada bloque que lo toque.
- **`npm run build:map` ya NO reproduce las coordenadas commiteadas de `mapPoints`** (48 de los 74 lugares salen con `x`/`y` distintos), aunque `build-map.ts`, `locations.ts` y `spain-map.geo.json` están todos sin cambios respecto al commit que introdujo la 004 — confirmado ejecutando el `build-map.ts` de ese mismo commit, sin ninguna modificación de la 005, contra los datos actuales: produce las mismas coordenadas "nuevas", no las commiteadas. Es una inconsistencia previa a la 005 entre el archivo generado y su propio generador, de causa no investigada (candidatos: ajuste manual posterior a la generación, o una dependencia que cambió de versión sin recommitear el resultado). **`territoryPaths` (005) se añadió empalmando el resultado fresco sobre el `map-geometry.ts` ya commiteado, sin regenerar `mapPoints`/`canaryBox`/`provinceBoundariesPath`/`northAfricaContext`** — para no alterar las posiciones reales de los 74 lugares, que es geometría de la 004 y está fuera de alcance de la 005. Pendiente de anotar en `roadmap.md` como hallazgo para quien retome la 004/el pipeline de mapa.
