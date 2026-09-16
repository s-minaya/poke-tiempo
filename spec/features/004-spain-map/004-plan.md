# 004 · Mapa de España — Plan

**Estado:** implementado ✅

## Enfoque

Un único componente `SpainMap` que renderiza un SVG con `viewBox` fijo (escala vía CSS, sin JS de resize) a partir de datos ya calculados en build time: la silueta geográfica (proyectada con `d3-geo`, ejecutado solo en un script de Node — nunca en el navegador, tal y como fija `tech-stack.md`) y la posición `[x, y]` de cada uno de los 74 lugares. El componente no calcula geometría en runtime: solo combina esos datos generados con `forecast.json` y `assignPokemon()` para decidir qué sprites pintar en cada punto.

## 1 — GeoJSON: fuente y filtrado

**Fuente:** [Natural Earth](https://www.naturalearthdata.com/) — capa *Admin 0 – Map Subunits*, escala 1:10m, distribuida ya en GeoJSON por [martynafford/natural-earth-geojson](https://github.com/martynafford/natural-earth-geojson) (conversión directa de los shapefiles oficiales, sin alterar geometría). **Dominio público** (Natural Earth no exige atribución; el repo de conversión es CC0).

De esa capa se filtran por `SUBUNIT` las nueve featuras necesarias:

| `SUBUNIT` | Uso | Notas |
|---|---|---|
| Spain (península), Portugal (continental), Andorra, Balearic Islands, Ceuta, Melilla | mapa principal | Todas proyectadas con el mismo `fitExtent` |
| Canary Islands | inset (`TerritoryInset`) | |
| Morocco | contexto decorativo, no dominio | Se limita lo visible con `clip-path` de SVG, ver punto 3 |
| Algeria | contexto decorativo, no dominio | Mismo tratamiento que Marruecos |

Se usa la capa de *subunits* y no la de *countries* porque Ceuta y Melilla no existen como polígono propio en la capa de países a ninguna escala razonable para este mapa.

Además, un archivo aparte — `scripts/config/spain-provinces.geo.json` — con las fronteras internas de comunidad autónoma/distrito de España y Portugal: Natural Earth, capa *Admin 1 – States/Provinces (lines)* 1:10m, filtrada por `adm0_a3` (`ESP`/`PRT`) — 192 tramos de los ~10 000 de la capa mundial. Es una capa de líneas (`LineString`/`MultiLineString`), no de polígonos: no hay relleno que gestionar, solo el trazo.

`scripts/config/spain-map.geo.json` tiene 9 featuras, cada una redondeada a 4 decimales con las mismas dos propiedades (`id`, `name`). Morocco (~18 KB) y Algeria (~21 KB) no requieren tocar el pipeline de descarga: es el mismo proceso manual de "se descarga y filtra una vez, se commitea" usado para el resto de featuras.

## 2 — Proyección

**`d3.geoMercator()`**, ajustada con `.fitExtent(...)` (Mercator sobre cónica conforme, por sobriedad técnica).

- **Mapa principal** — incluye Ceuta y Melilla en el mismo grupo que se ajusta con `fitExtent` (junto a Spain, Portugal, Andorra, Balearic Islands). `MAIN_TARGET_WIDTH = 960`. El padding es asimétrico:
  - `LEFT_PADDING = 128` — la columna que libera es donde vive el recuadro de Canarias, en toda la altura del mapa.
  - `RIGHT_PADDING = 44`, `TOP_PADDING = 44`.
  - `BOTTOM_BAND = 250` — banda inferior reservada para el remate del recuadro de Canarias y de la franja de contexto norteafricano.
  - `ROOT_VIEW_BOX = { width: 960, height: TOP_PADDING + contentHeight + BOTTOM_BAND }` (≈ 960×932 con la geometría actual).
- **Canarias** — no una proyección Mercator fiel a la escala (que preserva aspecto), sino una proyección Mercator en crudo (`scale(1)`) con dos factores de escala independientes por eje (`fitCanaryAnisotropic`): los 6 lugares reales quedan repartidos en `CANARY_CONTENT_WIDTH × CANARY_CONTENT_HEIGHT` = 249×90 unidades — el archipiélago real es muy plano (~2.8:1 entre los 6 lugares), y una proyección de aspecto fiel lo dejaría como una tira más estrecha (~4:1). Recuadro final con `POINT_PADDING` de margen: 325×166.
- **Marruecos y Argelia** — **no llevan proyección propia ni `fitExtent`**: reutilizan tal cual la instancia ya ajustada del mapa principal (`main.projection`). Se proyectan en su posición geográfica real relativa a la península, y lo que cae fuera del recuadro de recorte sencillamente no se pinta — ver punto 3.

`d3.geoPath(proyección)` genera el atributo `d` de cada silueta (incluidas Marruecos y Argelia, con la proyección del mapa principal), y las mismas instancias de proyección se reutilizan para proyectar `[longitude, latitude]` de cada lugar de `locations.ts` a `[x, y]`.

Todo esto corre en `scripts/build-map.ts` (Node, vía `tsx`), nunca en `src/`. `d3-geo` es la única dependencia de geometría (ver "Reglas explícitas" en `004-spec.md`): el contexto norteafricano no necesita turf.js ni ninguna librería de recorte de polígonos porque no se recorta ningún polígono — se limita lo que se ve con una primitiva nativa de SVG (`clip-path`).

## 3 — Canarias, Ceuta, Melilla y contexto norteafricano

- **Ceuta y Melilla no tienen recuadro propio.** Entran en el mismo grupo que se ajusta con `fitExtent` del mapa principal (punto 2) y se renderizan como `LocationMarker` normales, en su posición geográfica real — justo al sur del estrecho, pegadas a la propia costa peninsular. No existe la región `'ceuta'` ni `'melilla'` en `map-geometry.ts`: su `region` es `'main'`, igual que cualquier otro lugar peninsular.
- **Contexto norteafricano — Marruecos y Argelia, geometría puramente decorativa.** Reutilizan la proyección del mapa principal sin participar en su `fitExtent` (punto 2), y se pintan en un único grupo `<g>` con:
  - **`clip-path`** — un rectángulo: `x` empieza a la derecha del recuadro de Canarias (`CANARY_BOX_X + canary.width + 30`), `y` arranca en `500` (por encima del punto más al norte de la costa real de Argelia, `y≈546`, confirmado muestreando el polígono punto a punto), llega hasta el borde derecho del `viewBox` raíz (`mainWidth + CANVAS_RIGHT_EXTENSION`, no un rectángulo interior más estrecho) y remata por abajo a la altura del recuadro de Canarias (`CANARY_BOTTOM`). Un borde que coincide con el límite real del lienzo, o que no llega a tocar tierra, se lee como el borde natural del mapa — no como un recorte arbitrario a media silueta.
  - **Sin trazo, solo relleno** (`fill-opacity: 0.06`, sin `stroke`): Marruecos y Argelia son dos polígonos de Natural Earth digitalizados por separado y su frontera compartida no encaja pixel a pixel (confirmado coloreando cada país por separado); sin trazo, el relleno tenue disuelve esa costura en vez de marcarla.
  - **Sin recorte del polígono**: ninguna coordenada de Marruecos/Argelia se toca. `clip-path` es una primitiva de SVG, no geometría — cero riesgo de topología inválida, cero dependencia nueva.
  - **`aria-hidden="true"`**, sin `LocationMarker`, sin nombre accesible: es fondo, no un lugar (ver "Reglas explícitas" en `004-spec.md`).
- **Fronteras internas (comunidades autónomas / distritos) de España y Portugal.** Natural Earth, capa *Admin 1 – States/Provinces (lines)* 1:10m, filtrada por `adm0_a3` a `ESP`/`PRT` (192 tramos de los ~10 000 de la capa mundial) — `scripts/config/spain-provinces.geo.json`, mismo patrón de "se descarga y filtra una vez, se commitea" que el resto. Se proyecta con la misma instancia que la silueta principal (es un detalle de la misma geometría, no un territorio aparte) y se pinta como trazo fino sin relleno, por debajo de los sprites en z-order — es contexto para leer a qué región corresponde cada punto, sin competir visualmente con el Pokémon. Puramente visual: no genera lugares nuevos, `aria-hidden="true"`.
- **Canarias se mantiene como `TerritoryInset`**, reposicionado:
  - Se desplaza a la izquierda, fuera del ancho que ocupa la península — vive en una extensión pura del `viewBox` (`CANVAS_LEFT_EXTENSION = 130`, con origen de `viewBox` en `x = -130`), no en una ampliación de la escala del mapa principal. Su posición (`x = -118, y = BAND_Y0 - 65`) queda descentrada respecto a la península a propósito. El límite real de cuánto puede subir es la costa de Portugal (Faro cae en el mismo rango horizontal que el recuadro) — comprobado que deja margen seguro.
  - **Borde grueso** (`stroke-width: 2.5`) y **esquina superior derecha achaflanada** — convención habitual en los mapas políticos de España — con el `frame` de `TerritoryInset` como un `<path>` con un corte a 45° de tamaño fijo (26 unidades) en esa esquina, en vez de un `<rect>` simple.
- **El `viewBox` raíz crece con dos extensiones puras** (izquierda para Canarias, derecha para el margen del contexto norteafricano antes del borde del lienzo) — ninguna de las dos amplía ni reescala el mapa principal, que conserva exactamente los mismos `LEFT/RIGHT/TOP_PADDING` en toda su superficie.
- **Las coordenadas de `locations.ts` no cambian** en ningún punto de este diseño — toda la transformación vive en `scripts/build-map.ts` (parámetros de la proyección) y en los componentes de presentación.

## 4 — Selección del único Pokémon visible

`pickMapPokemon(pokemonIds: PokedexId[]): PokedexId | null` — una tabla de prioridad fija (`MAP_PRIORITY`), sin scoring. `assignPokemon()` (003) no cambia: sigue devolviendo todos los Pokémon aplicables, `pickMapPokemon` solo decide cuál de esos se dibuja.

Orden de más a menos "noticia": un aviso rojo costero oficial (Mega Gyarados) por delante de fenómenos severos sin aviso detrás (tormenta, nieve, calima, niebla), estos por delante de lo frecuente (lluvia, oleaje sin aviso, viento, cielo), y la temperatura la última porque es el único eje que siempre asigna algo — si fuera la primera, taparía cualquier fenómeno más singular todos los días. Gyarados (sin aviso rojo) va detrás de la lluvia a propósito: `waveHeightM >= 1,25` se da con bastante frecuencia en costa y no debe tapar fenómenos más significativos.

## 5 — Sprites y jerarquía visual

**Tamaño de render en el SVG: 62 unidades.** Con `MAIN_TARGET_WIDTH` en 960 y una composición despejada (punto 2), el Pokémon tiene presencia real frente a la silueta que lo rodea. No lleva ningún fondo/halo detrás — se probó un halo circular de contraste y se descartó porque no hacía falta con este tamaño.

El sprite no se reduce para evitar los solapamientos ya documentados (ver Riesgos): la legibilidad del Pokémon (protagonista real del proyecto) pesa más que evitar por completo el solapamiento puntual entre lugares próximos.

La distinción de a qué lugar corresponde cada Pokémon en zonas densas se resuelve con las fronteras internas de comunidades autónomas/distritos (punto 3), no con un marcador propio por punto (un anillo por lugar se probó y se descartó: no aportaba sobre las fronteras).

## 6 — Responsive

Un único `viewBox` fijo con el SVG a `width: 100%; height: auto` — el aspecto no cambia nunca. El `viewBox` raíz lleva las dos extensiones del punto 3 (origen en `x = -130`, ancho total `960 + 130 + 150`, alto `932`), como un único valor fijo, sin recálculo en JS.

**Sin `max-width` propio del mapa** — el tope de ancho de toda la composición vive en el contenedor (`app__layout`, `005-plan.md` → punto 7), no en `SpainMap.scss`: desde la 006, la página entera es una réplica fija de escala fluida (`mission.md`), no un mapa que cambia de tamaño por su cuenta en distintos breakpoints.

## Sprites — resolución de archivo

PNG indexado a 160px de lado máximo. Se comparó contra WebP (mismo redimensionado) y PNG quedó por debajo en peso para este conjunto de sprites — WebP se descartó por no ganar. Redimensionado hecho como operación puntual (sin añadir una dependencia permanente al proyecto); los originales de alta resolución no se commitean.

## Implementación

1. `scripts/config/spain-map.geo.json` — 9 featuras (Natural Earth, filtradas y redondeadas a 4 decimales). `scripts/config/spain-provinces.geo.json` — 192 tramos de frontera de comunidad autónoma/distrito (España + Portugal), Natural Earth *Admin 1 – States/Provinces (lines)*.
2. `scripts/build-map.ts` — proyección del mapa principal con padding asimétrico (`LEFT/RIGHT/TOP_PADDING` + `BOTTOM_BAND`), Ceuta/Melilla en el grupo que se ajusta con `fitExtent`, fronteras internas proyectadas con la misma proyección principal, recorte de contexto norteafricano (`clip-path`, borde derecho/inferior igual al del `viewBox` raíz) reutilizando la proyección principal para Marruecos/Argelia, recuadro de Canarias reposicionado con extensión de `viewBox` (`CANVAS_LEFT_EXTENSION`, `CANVAS_RIGHT_EXTENSION = 150`), `path` con esquina achaflanada del `frame`.
3. `src/data/map-geometry.ts` (generado, `npm run build:map`) — `mapPoints[...].region` es `'main' | 'canary'` (sin `'ceuta'`/`'melilla'`); incluye `provinceBoundariesPath`, `northAfricaContext` (`moroccoPath`, `algeriaPath`, `clip: {x,y,width,height}`), y `viewBox` con `x`/`y` de origen además de `width`/`height`. No hay `ceutaBox`/`melillaBox`.
4. `src/components/SpainMap/components/TerritoryInset.tsx` (+ `.scss`) — el `frame` es un `<path>` con esquina achaflanada cuando `frame` es `true` (solo Canarias lo usa).
5. `src/components/SpainMap/SpainMap.tsx` (+ `.scss`) — no renderiza `TerritoryInset` para Ceuta/Melilla; incluye el grupo decorativo de Marruecos/Argelia (`clip-path`, `aria-hidden`) y el trazo de fronteras internas (`aria-hidden`, sin relleno); renderiza Canarias como único `TerritoryInset`.
6. `src/components/SpainMap/location-views.ts` — el tipo `LocationView['region']` es `'main' | 'canary'`.
7. `src/components/SpainMap/components/LocationMarker.tsx` — `SPRITE_SIZE = 62`.
8. Tests: `map-geometry.test.ts` (estructura: sin `ceutaBox`/`melillaBox`, `region` de Ceuta/Melilla es `'main'`, existe `provinceBoundariesPath` y la geometría de contexto, el recorte de contexto se queda antes de la frontera real con Túnez, viewBox con origen negativo), `location-views.test.ts` (Ceuta/Melilla en `'main'`), `SpainMap.test.tsx` (Marruecos/Argelia no generan lugares accesibles — ningún `role="img"` nuevo, sigue habiendo exactamente 74).
9. `spec/constitution/tech-stack.md` — Marruecos/Argelia/fronteras internas son la misma fuente (Natural Earth, dominio público) ya anotada para el resto de `spain-map.geo.json`.

## Accesibilidad

`role="group"` en el `<svg>` raíz y en `TerritoryInset` (Canarias); `role="img"` solo en `LocationMarker` (nivel hoja) — un contenedor con `role="img"` trataría a sus descendientes como parte de una única imagen y ocultaría los 74 marcadores individuales de la tecnología de asistencia. El grupo decorativo de Marruecos/Argelia no lleva ningún `role`: `aria-hidden="true"` ya lo saca del árbol de accesibilidad por completo, coherente con que no es un lugar.

## Decisiones

- **Ceuta y Melilla se integran en el `fitExtent` del mapa principal, no en un recuadro propio** — se leen como territorios de la costa norteafricana, no como islas sueltas, y geográficamente son casi contiguas a la propia costa peninsular, así que apenas mueven la escala del grupo principal.
- **Marruecos/Argelia se recortan visualmente con `clip-path`, nunca recortando sus coordenadas** — la primitiva de SVG resuelve el contexto geográfico sin riesgo de topología inválida ni dependencia nueva.
- **Canarias se desplaza con una extensión pura de `viewBox`, no ampliando el `fitExtent` del mapa principal** — mantiene intacta la escala/posición de la península mientras da a Canarias todo el espacio a la izquierda que necesita, incluso descentrada respecto al resto.
- **El contexto norteafricano usa un `clip-path` limpio, sin degradado** — un borde recto que coincide con el propio borde del `viewBox` se lee como el límite natural del mapa; un rectángulo interior más estrecho se leía como un recorte arbitrario del país.
- **Fronteras internas de comunidades autónomas/distritos** — es la solución real a "qué región corresponde a cada Pokémon" en zonas densas, no un marcador por punto (que se probó y se descartó por no aportar sobre las fronteras).
- **Canarias con escala X/Y independiente, calibrada contra las posiciones reales de los 74 lugares** — ajustada por mínimos cuadrados, no a ojo. El mapa principal y Ceuta/Melilla quedan validados sin cambios frente a esa calibración (residuo compatible con ruido de trazado); Canarias mostró una proporción real distinta (~2.8:1 entre los 6 lugares, no ~4:1) — se implementa con una proyección Mercator en crudo reescalada por eje, deliberadamente no conforme, en vez de forzar una fidelidad de aspecto que no aporta nada aquí.
- **Sprite a 62 unidades, sin halo/fondo** — con este tamaño, un halo de contraste no aporta nada.
- **Sin dependencias nuevas** — `clip-path` de SVG y la reutilización de una proyección ya ajustada bastan para todo el contexto norteafricano; no hace falta turf.js en ningún punto del diseño.
- `d3-geo` solo en `scripts/`, silueta y puntos como datos generados (no SVG estático), fuente de Canarias/Ceuta/Melilla (*Admin 0 – Map Subunits*), `pickMapPokemon` como presentación (no dominio), PNG sobre WebP para sprites, `role="group"`/`role="img"`.

## Riesgos

- **Legibilidad en móvil estrecho** — fuera de alcance de la 004 (`roadmap.md` lo asigna a la 006).
- **Solapamientos a 62u** — con el sprite a su tamaño final, es esperable solapamiento puntual entre lugares muy próximos (ej. Oviedo/Gijón). Medido con Playwright; no se reduce el sprite para evitarlo — es una decisión de producto: la legibilidad del Pokémon pesa más que el solapamiento puntual, documentado aquí como límite conocido para la 006.
- **Ceuta/Melilla muy cerca de la costa peninsular en el mapa principal** — al integrarse en el mismo `fitExtent`, su separación visual respecto a la costa de Cádiz/Málaga es pequeña (geografía real). Es el efecto buscado ("costa norteafricana", no aislados); el contexto de Marruecos/Argelia detrás refuerza la lectura en vez de depender solo de la distancia entre puntos.
- **`forecast.json` cambia a diario** — cualquier captura o test que dependa de su contenido concreto (no de su forma) puede quedar desactualizado sin que sea un fallo de la 004. Los tests de esta feature comprueban estructura y comportamiento (un lugar sin forecast no rompe nada, la región es la esperada), nunca qué Pokémon exacto le toca hoy a un lugar real.
