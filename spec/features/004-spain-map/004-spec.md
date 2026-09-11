# 004 · Mapa de España

**Estado:** implementado ✅

## Qué hace

El SVG base del mapa — España peninsular, Portugal, Andorra, Baleares, Ceuta y Melilla como silueta principal, todas en su posición geográfica real dentro del mismo `fitExtent`, con sus fronteras internas de comunidad autónoma/distrito trazadas encima. Detrás de Ceuta/Melilla, una franja del norte de Marruecos y Argelia da contexto geográfico ("costa norteafricana", no dos islas sueltas) — es geometría puramente decorativa, sin ningún lugar del dominio asociado. Canarias, mucho más lejos en la realidad, se mantiene como un recuadro aparte (`TerritoryInset`), desplazado a la izquierda fuera del ancho que ocupa la península, con borde grueso y esquina superior derecha achaflanada (convención habitual en los mapas políticos de España). Los 74 lugares de `locations.ts` están colocados en su posición geográfica correcta. Sobre cada lugar se muestra **un único sprite**: el Pokémon más representativo del día para ese lugar, elegido con una prioridad de producto fija (`pickMapPokemon`, ver `004-plan.md`) entre los que devuelve `assignPokemon()`.

`assignPokemon()` (003) no cambia: sigue devolviendo todos los Pokémon aplicables ese día, sin ranking. 004 solo añade el criterio de **qué uno de esos se dibuja en el mapa** — la lista completa sigue disponible para quien la necesite (p. ej. Profesor Oak, 007).

## Por qué

Es la primera feature que produce algo visible del proyecto (`roadmap.md`): sin mapa no hay chiste que contar, porque la gracia de Poketiempo está en ver qué Pokémon le ha tocado hoy a cada sitio. 004 es pura presentación geográfica — consume sin duplicar la lógica ya cerrada en la 002 (`forecast.json`, `locations.ts`) y la 003 (`assignPokemon`).

## Reglas explícitas

Tres límites que gobiernan la geometría de contexto y su relación con el resto del proyecto:

1. **La geometría contextual de Marruecos/Argelia es puramente visual.** No entra en `locations.ts`, no tiene entrada en `forecast`, no se le asigna Pokémon, no participa en la accesibilidad de ubicaciones (ningún `LocationMarker`, ningún nombre accesible propio) ni en ninguna lógica meteorológica. Es una silueta de fondo con `aria-hidden="true"`, nada más.
2. **004 no toca nada de la 002** — ni `scripts/fetch-forecast.ts`, `scripts/orchestrate-location.ts`, los clientes de fuentes, `fault-tolerance.ts`, `target-date.ts`, `src/data/forecast.json` ni su documentación. El mapa consume `forecast.json` tal cual llega; `forecast.date` es la fuente de verdad, sin calcular "hoy"/"mañana" en React.
3. **Sin dependencias nuevas salvo bloqueo real.** `d3-geo` (ya instalada) basta para proyectar y recortar visualmente la geometría de contexto — el recorte es con `clip-path` de SVG, no con una librería de geometría (turf.js u otra).

## Criterios de aceptación

- [x] El mapa muestra los 74 lugares de `locations.ts`, cada uno en su posición geográfica proyectada correctamente.
- [x] Cada lugar con forecast disponible muestra exactamente un sprite: el `PokedexId` que la prioridad de selección elige entre los que devuelve `assignPokemon(forecast)` para ese lugar y ese día.
- [x] Un lugar sin entrada en `forecast.locations` no rompe el mapa: no muestra ningún Pokémon, el resto se renderiza igual. El pipeline (002) garantiza 74/74 (fallback a Open-Meteo o aborto conservando el forecast anterior); este criterio es la red de seguridad de presentación, no algo que 004 deba fabricar.
- [x] La silueta del mapa proviene de datos geográficos reales (GeoJSON), no de trazos dibujados a mano — Marruecos y Argelia incluidos.
- [x] Ceuta y Melilla aparecen en su posición geográfica real dentro del mapa principal, no en un recuadro aparte, con una franja de contexto norteafricano (Marruecos + norte de Argelia) detrás — decorativa, sin lugares propios.
- [x] Canarias aparece en su propio recuadro (`TerritoryInset`) dentro del mismo SVG, sin invadir visualmente la península ni ampliar el `fitExtent` del mapa principal — la extensión de lienzo que necesita para desplazarse a la izquierda es una extensión pura del `viewBox`, no una ampliación de la escala del mapa principal. Las coordenadas de dominio (`locations.ts`) no se alteran para conseguir nada de esto — toda la transformación es visual, del mapa.
- [x] Sin scroll horizontal, sin recortar ningún territorio ni sprite, en los 5 breakpoints (320/480/768/1200/1600px). El responsive se resuelve con `viewBox` + SCSS, sin JS de recálculo de layout en resize.
- [x] Cada punto lleva un nombre accesible (`<title>`/`aria-label` con el nombre del lugar), expuesto individualmente a tecnología de asistencia (ningún contenedor ancestro usa `role="img"`) — la geometría de Marruecos/Argelia, al no ser un lugar, no lleva nombre accesible ni marcador.
- [x] España y Portugal muestran sus fronteras internas de comunidad autónoma/distrito — ayuda a distinguir a qué región corresponde cada Pokémon; es geometría visual, no genera lugares nuevos ni afecta a la accesibilidad de los 74 existentes.
- [x] Tests: proyección/coordenadas, asociación `location → forecast → assignPokemon`, prioridad de selección del único Pokémon visible, región de Canarias, el caso de lugar sin forecast, y que Marruecos/Argelia no aparecen como `mapPoints` ni generan lugares accesibles.

## Fuera de alcance

- Cabecera, fecha de previsión y leyenda — 005.
- Alternativa textual completa del mapa, cita a AEMET/IPMA, disclaimer de Pokémon — 006. La legibilidad fina en móvil estrecho (320–375px) sigue siendo de la 006; 004 solo garantiza que el mapa no se rompe en ese ancho.
- Diálogos de Profesor Oak — 007.
- Zoom, pan o clustering automático de puntos.
- Paleta de color final (pendiente en `roadmap.md`).
- Cualquier cambio en la 002 (pipeline de datos, fuentes, `forecast.json`).
- Un componente de "hero" o cabecera de Pokémon del día por encima del mapa — la jerarquía "Pokémon antes que cartografía" se resuelve aquí solo con tamaño de sprite y composición del propio mapa, no añadiendo una pieza de UI nueva (eso, si se quiere, es decisión de la 005).
