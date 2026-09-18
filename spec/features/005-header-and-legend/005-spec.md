# 005 · Cabecera y leyenda

**Estado:** implementado ✅

## Qué hace

Sustituye el `<h1>Poketiempo</h1>` provisional por la identidad visual real de la página:

1. **Cabecera** — el split ya fijado en `mission.md`/`tech-stack.md`: "POKETIEMPO" a la izquierda y "PREVISIÓN · [día de la semana] [día] DE [mes]" a la derecha en desktop (fecha tomada de `forecast.date`, sin recalcular "mañana" en React). El aspecto de los dos elementos (color de relleno y, en dos de las cinco categorías, borde) cambia igual, según la misma franja de temperatura máxima que predomina ese día entre los 74 lugares — comparten un único mood térmico dinámico.
2. **Leyenda dinámica** — únicamente los Pokémon que de verdad aparecen hoy en el mapa (después de `assignPokemon` → `pickMapPokemon`), sin duplicados, cada uno con su sprite y la descripción real de la condición que le corresponde según el motor de asignación.
3. **Créditos** — cita a AEMET/IPMA/Open-Meteo y al autor de la cuenta original, en HTML semántico bajo el bloque de mapa/leyenda.
4. **Ajustes visuales del mapa** que esta información necesita para leerse: paleta de color real por territorio (mar, España, Portugal, Andorra, contexto norteafricano, marco de Canarias), silueta de España/Portugal/Andorra/Baleares/Ceuta/Melilla como paths independientes (ya no una única silueta combinada), y la temperatura mínima/máxima de cada lugar sobre su sprite.

No cambia ninguna regla de asignación de Pokémon ni de selección del único visible: `assignPokemon()` (003) y `pickMapPokemon()` (004) siguen siendo la única fuente de verdad, sin tocar.

## Por qué

Cierra la identidad visual descrita en `constitution/mission.md`: cabecera, previsión, leyenda y mapa son las cuatro piezas de la página única. Sin esto, la leyenda no existe (nadie puede confirmar por qué le ha tocado ese Pokémon a su ciudad) y el mapa, con el mismo tono para tierra y mar, no comunica ni territorio ni temperatura por lugar — la broma pierde parte de su lectura inmediata (`mission.md` → "la broma se entiende sin explicación").

## Catálogo de Pokémon

Se usan los `PokedexId` que produce `assign-pokemon.ts` (003) — 25 en total, Moltres incluido. Ningún Pokémon inventado sin pasar por una decisión explícita de producto (ni Gastrodon, ni "lluvia con barro", ni DANA). La leyenda es puramente derivada de lo que el motor ya decide.

## Piezas del motor de asignación que necesita la leyenda

La leyenda necesita que `assignPokemon()` cubra `'despejado'` (castform-sun por cielo), el segundo camino físico de Mega Gyarados y "viento cálido" (Moltres) — las reglas completas, sus umbrales y el orden de `MAP_PRIORITY` resultante viven en `003-plan.md`, fuente de verdad del dominio; esta feature no las repite, solo depende de ellas.

**Moltres, 25º `PokedexId`.** Sprite provisto por el propietario del producto, misma fuente/licencia que el resto de sprites (pendiente de documentar en `tech-stack.md` junto con los otros 24, `roadmap.md` → Decisiones pendientes).

## Criterios de aceptación

**Cabecera**

- [x] "POKETIEMPO" queda a la izquierda y "PREVISIÓN · [DÍA DE LA SEMANA] [DÍA] DE [MES]" a la derecha, en mayúsculas, con la fecha de `forecast.date` (sin calcular ningún día en el componente) — el split que ya fija `mission.md`/`tech-stack.md`.
- [x] "POKETIEMPO" usa la fuente propia Poketiempo Unown (`src/assets/fonts/poketiempo-unown.woff2`); la línea de previsión usa Pixelify Sans (Google Fonts); leyenda, créditos y las temperaturas mínima/máxima del mapa usan Nunito Sans (Google Fonts). Ninguna de las dos fuentes de Google Fonts se añade como dependencia JS — solo `<link>` en `index.html`.
- [x] El color de relleno de "POKETIEMPO" y de la línea de previsión cambia igual entre los dos, según la categoría térmica que predomina entre los 74 `temperature.maxC` del forecast: gelid (`< 0`), cold (`0–<10`), neutral (`10–<26`), heat (`26–<35`), sweltering (`>= 35`). Empate en el recuento se resuelve con la categoría en la que cae la mediana de las 74 máximas — determinista, no depende del orden del array.
- [x] "POKETIEMPO" lleva borde negro fijo en las cinco categorías (`$color-near-black`) con `font-weight: 700` (negrita sintética), stroke CSS real (`-webkit-text-stroke`), nunca una pila de `text-shadow`. La línea de previsión, mucho más pequeña, lleva su propio borde de mood (`--mood-border`, un matiz del relleno, no negro) y su propio grosor, más fino que el del título.
- [x] La composición es una réplica fija que escala como una sola unidad a cualquier tamaño de pantalla, sin reorganizarse por breakpoint — resuelto en la 008 (`mission.md` → "Réplica fija, no una app adaptativa"); no queda pendiente aquí.

**Mapa — paleta y territorios**

- [x] El mar (`#B9FFFD`) rellena el fondo completo del mapa principal y del recuadro de Canarias.
- [x] España, Baleares, Ceuta, Melilla y Canarias comparten el mismo color (`#FFEBF6`); Portugal (`#F6FFEC`) y Andorra (`#FFF3B0`) llevan el suyo propio; el contexto de Marruecos/Argelia reutiliza el color de España, visiblemente más tenue (opacidad reducida); el marco de Canarias usa `#42C7EC`.
- [x] España, Portugal, Andorra, Baleares, Ceuta y Melilla son paths SVG independientes (generados en `scripts/build-map.ts` con la misma proyección de la 004) — no una única silueta combinada resuelta con hacks de CSS.
- [x] `locations.ts` y las coordenadas de los 74 lugares no cambian.

**Mapa — temperaturas por marcador**

- [x] Cada `LocationMarker` con forecast muestra su mínima y máxima, en ese orden, superpuestas en la zona inferior del sprite, centradas horizontalmente, con el símbolo `°`, redondeadas al entero (el redondeo es solo de presentación).
- [x] Cada número se colorea de forma independiente según su propio valor, en sus seis franjas (`< 0`, `0–<10`, `10–20`, `21–25`, `26–34`, `>= 35`), con `paint-order: stroke fill` cuando lleva borde.
- [x] El nombre accesible del marcador incluye las temperaturas cuando están disponibles (ej. "Granada, mínima 12 grados, máxima 24 grados"); un marcador sin forecast sigue tolerado (solo nombre, sin temperatura ni sprite).
- [x] El mapa sigue mostrando exactamente 74 `LocationMarker`.

**Leyenda**

- [x] Muestra el encabezado visible "Leyenda" (fuente Poketiempo Unown), que además da el nombre accesible a la sección vía `aria-labelledby` (sin `aria-label` redundante).
- [x] Muestra únicamente los `PokedexId` que `pickMapPokemon(assignPokemon(...))` produce para al menos uno de los 74 lugares ese día — nunca los 25 fijos.
- [x] Sin duplicados: un Pokémon que aparece en varios lugares sale una sola vez.
- [x] Orden coherente con `MAP_PRIORITY` (exportada desde `pick-map-pokemon.ts`, sin copiarla).
- [x] Cada entrada muestra sprite (mismo `spriteSources` del mapa) + la descripción real de la condición que le corresponde (metadata fija, no inferida por sprite — `castform-sun` nunca dice "soleado": sigue asignándose por temperatura sola además de por cielo despejado, así que puede tocarle a un día nublado a esa temperatura).
- [x] HTML, no SVG.

**Créditos**

- [x] "Datos meteorológicos: AEMET · IPMA · Open-Meteo" y "PokéTiempo original: Gabriel Ortega Díaz", en HTML semántico (`<footer>`), sin URLs inventadas, fuera del SVG del mapa.

**Generales**

- [x] Los 25 `PokedexId` tienen metadata de leyenda.
- [x] `assignPokemon()` y `MAP_PRIORITY` solo cambian en lo descrito en "Piezas del motor de asignación que necesita la leyenda" (arriba) — ningún otro eje, franja ni prioridad se toca.
- [x] Ningún significado se comunica solo por color (el texto de la leyenda y el nombre accesible de cada marcador siguen siendo la fuente de verdad, el color es refuerzo).
- [x] `sky === 'despejado'` asigna `castform-sun` (además de la franja 15–25°C, que sigue igual); `assignPokemon` no devuelve el mismo `PokedexId` dos veces cuando dos ejes coinciden.
- [x] `waveHeightM >= 2,5` asigna Mega Gyarados aunque no haya aviso rojo costero activo; con aviso, sigue disparando igual que antes.
- [x] Un día despejado con temperatura fuera de 15–25°C sigue mostrando en el mapa el Pokémon de su temperatura real, no `castform-sun` (verifica el ajuste de `MAP_PRIORITY`).
- [x] `wind.speedKmh >= 40` y `temperature.maxC >= 30` a la vez asignan Moltres; si falta cualquiera de los dos, no.

## Fuera de alcance

- Loader, landing, Profesor Oak, audio.
- Pokémon nuevos o reglas meteorológicas inferidas más allá de las descritas en `003-plan.md` (castform-sun por cielo, Mega Gyarados por dato físico, Moltres por viento cálido).
- Responsive exhaustivo por breakpoint (queda para la 008) — esta feature entrega un layout limpio en grid/flex, no el ajuste fino de los 5 anchos.
- Auditoría completa de accesibilidad (008).
- Cambios en la 002 (pipeline de datos) o en las reglas de `assignPokemon`/`pickMapPokemon`.
- Refactors de arquitectura no necesarios para lo anterior.
