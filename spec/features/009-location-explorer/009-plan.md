# 009 · Exploración de los 74 lugares — Plan

**Estado:** cerrada.

## Enfoque

Un solo estado de filtro, en `WeatherApp`, del que salen tres vistas: la leyenda (qué condiciones están pulsadas), el mapa (qué marcadores quedan activos) y la lista (qué filas se muestran). El orden solo afecta a la lista y vive en ella.

Filtrar, ordenar y agrupar son funciones puras, testeadas con tablas; los componentes solo las pintan. Se filtra sobre lo que ya calculan `buildLocationViews` y `summarizeView`, así que nada toca el dominio meteorológico. El único dato nuevo es la zona de cada lugar, en el modelo de lugares.

Sin dependencias nuevas: 74 lugares se filtran en cada tecla sin librería de búsqueda, y todos los controles son HTML nativo.

## Implementación

1. **La zona en el modelo de lugares**
   - `src/domain/location-zones.ts` — `LOCATION_ZONES`, las 21 zonas en el orden en que se agrupan: las 19 comunidades y ciudades autónomas por orden alfabético, `'Portugal'` y `'Andorra'`. De ahí sale `LocationZone`. Son literales en español porque se muestran tal cual (excepción de `AGENTS.md`).
   - `src/domain/types.ts` — `zone: LocationZone` en `Location`.
   - `scripts/config/locations.manual.ts` — `zone` en `LocationManualConfig`, rellenado a mano para los 74. `build-locations.ts` ya copia cada campo de la configuración, así que no cambia.
   - `npm run build:locations` y revisar el `src/data/locations.ts` generado entero: 74 líneas añadidas y ninguna borrada.
   - Los fixtures de `Location` en los tests de `scripts/` y `src/domain/` incorporan `zone` para cumplir el tipo, sin cambiar ninguna aserción.

2. **Las franjas de temperatura como datos** — `src/components/SpainMap/components/marker-temperature.ts` expone los límites de cada franja y `classifyMarkerTemperature` los usa. Los encabezados de grupo de la lista se construyen con esos mismos límites: si una franja cambia, cambian a la vez el color de la cifra y el título del grupo.

3. **Filtrar** — `src/components/WeatherApp/location-filters.ts`, funciones puras:
   - `LocationFilters { query: string; zone: ZoneFilter; conditions: readonly PokedexId[] }`, con `ZoneFilter = 'ES' | LocationZone | null`.
   - `normalizeForSearch(text)`: descomposición Unicode, sin diacríticos y en minúsculas; «Coruña» pasa a «coruna».
   - Un índice por forecast con el texto buscable de cada lugar: nombre, `administrativeArea`, zona, nombre del Pokémon (`POKEMON_NAMES`) y su condición (`POKEMON_LABELS`).
   - `matchingLocationIds(index, filters)`: `null` si no hay ningún filtro activo; si no, el conjunto de ids que cumplen los tres criterios. En la búsqueda, todas las palabras deben aparecer; en la condición, basta una de las pulsadas.

4. **Ordenar y agrupar** — `src/components/LocationList/location-groups.ts`, funciones puras:
   - `LocationOrder = 'zone' | 'name' | 'warmest' | 'coldest'`.
   - `groupLocations(summaries, order, zoneById)` devuelve grupos `{ key, title, band, rows }`. `zone`: en el orden de `LOCATION_ZONES`, con las filas alfabéticas (`localeCompare('es')`). `name`: un solo grupo sin título. `warmest` y `coldest`: por máxima descendente o mínima ascendente, desempate alfabético, un grupo por franja y los lugares sin previsión al final.
   - Títulos «Máxima de 35° o más», «Máxima entre 26° y 34°»… «Mínima bajo cero», construidos con los límites del punto 2.

5. **El estado compartido** — `src/components/WeatherApp/WeatherApp.tsx`:
   - Filtros y selección en un solo `useState` (`ExplorationState`), para que un cambio de filtros y el cierre de la tarjeta que provoca sean la misma actualización. El índice de búsqueda y `matchingIds` se derivan con `useMemo`.
   - Manejadores estables con `useCallback`: alternar una condición, cambiar la búsqueda, cambiar la zona y limpiar los filtros. Todos pasan por `applyFilters`, que anula la selección si el lugar seleccionado deja de coincidir.
   - `matchingIds`, los filtros y sus manejadores se reparten a `Legend`, `SpainMap` y `LocationList`. Cada uno deriva sus propias vistas del `forecast`, como en la 008.
   - Enlace «Saltar al buscador» (`<a href="#location-search">`) como primer elemento de `.app`, fuera de la vista hasta que recibe el foco.

6. **La leyenda como filtro** — `src/components/Legend/`:
   - Cada entrada es un `<li>` con un `<button type="button" aria-pressed>` en rejilla de tres columnas: el sprite, decorativo; la etiqueta, que es su nombre accesible; y el estado. Fila memoizada, con callback estable que recibe el id.
   - El borde de 0,3rem y la columna de estado existen también en reposo, con el borde transparente y la columna vacía: pulsar o soltar no mueve ni ensancha nada.
   - Pulsada: borde `$ui-accent`, fondo blanco y un ✓ en la columna de estado. El ✓ es un SVG decorativo de 8 × 5 celdas cuadradas de 0,2rem (`shape-rendering: crispEdges`), relleno de `$ui-accent` y sin fondo. En hover, el borde azul sin la caja blanca. Con alguna pulsada, el sprite del resto pasa a silueta (`filter: brightness(0)` y opacidad); su etiqueta no cambia.
   - La columna mínima de `__list` es de 26,8rem: borde (0,6rem), relleno (0,8rem), sprite (6rem), dos huecos (2,4rem), columna de estado (1,6rem) y 15,4rem de etiqueta, en los que «torrenciales» cabe entera también con el espaciado de letra de 1.4.12. En dos columnas, la leyenda mide `$legend-column-width` (`_breakpoints.scss`), con la misma columna de estado y los mismos 15,4rem de etiqueta, y de esa medida se deriva el punto de corte de dos columnas (012).
   - Bajo «Leyenda», «Pulsa un Pokémon para verlo en el mapa», en `$ui-ink`.

7. **El mapa responde** — `src/components/SpainMap/`:
   - `SpainMap` recibe `matchingIds` y lo pasa, también a través de `TerritoryInset`, a `MarkerLayers` (012), que decide una vez por lugar si está en sombra, para la capa de sprites y para los marcadores.
   - Un lugar en sombra no monta marcador: ni `role`, `tabIndex`, `aria-label`, `<title>`, manejadores ni temperaturas. Solo queda su sprite, en la capa de sprites (`aria-hidden="true"` y `pointer-events: none`, 012), y pasa por un filtro SVG de silueta (`feColorMatrix`) definido una vez en el `<defs>` del mapa, y no por `filter` de CSS, que no se aplica igual a los elementos SVG en todos los navegadores.
   - Sin animación: el cambio es instantáneo, así que no hay movimiento que `prefers-reduced-motion` tenga que quitar.

8. **La barra y la lista** — `src/components/LocationList/`:
   - `LocationList.tsx` coordina. La barra y el estado vacío van en `components/`: `LocationFilters` (buscar, zona y ordenar), `ActiveFilters` (recuento, filtros activos y «Limpiar filtros») y `EmptyResults`.
   - Barra de título: «Todos los lugares» en `$font-heading` (Pixelify Sans), blanco sobre `$ui-ink`, en mayúsculas por CSS para que el lector de pantalla no lo deletree. Delante, una Poké Ball decorativa en trazo blanco, un SVG en línea de tres formas —círculo, franja y botón— dibujado para el proyecto: no es un asset nuevo.
   - Zona de controles —buscar, zona, ordenar, recuento y filtros activos— sobre `$ui-surface`, separada de los grupos por una línea de tinta de 2px. Los campos son blancos, con borde de tinta de 2px.
   - Buscar: `<label>` visible y `<input type="search" id="location-search">`, con una lupa decorativa. Marcador de posición en `$ui-ink` al 75 %. Escape lo vacía si tiene texto. Un margen superior de desplazamiento (`scroll-margin-block-start`) hace que el enlace de salto lo deje con su etiqueta y su anillo de foco a la vista.
   - Zona: `<label>` y `<select>` nativo, con «Todas las zonas», un `<optgroup label="España">` que empieza por «Toda España», Portugal y Andorra. Su campo mide al menos 26,4rem: lo que ocupa cerrado con su opción más larga, «Comunidad Valenciana», también con el espaciado de 1.4.12.
   - En hover, buscador y selector llevan el borde y el icono en `$ui-accent`; el texto escrito sigue en tinta.
   - Ordenar: `<fieldset>` con `<legend>` y cuatro `<input type="radio">` presentados como botones segmentados. El elegido se rellena de `$ui-accent`, con texto blanco y un ▸. Dos por fila en un control estrecho y los cuatro en fila, cada uno a la medida de su texto, cuando el control mide 38rem o más: una consulta de contenedor sobre el propio control, nunca tres y uno. Los cuatro en fila piden unos 30rem; el resto es sitio para el espaciado de 1.4.12.
   - El recuento a la vista, y una región viva visualmente oculta que lo repite con un retardo de 500 ms, para no anunciar cada tecla.
   - Filtros activos: un botón por filtro —«Caluroso ✕», «Zona: Andalucía ✕», «“texto” ✕»—, con un `aria-label` que empieza por su texto visible (2.5.3). Son pastillas `$ui-accent` con texto blanco y al menos 44px de alto; la de una condición lleva su sprite en un disco blanco, para que un Pokémon azul no desaparezca sobre el azul. En hover pasan a blanco con borde y texto azules. Al quitar uno, el foco pasa al siguiente si existe; si no, al anterior; si no queda ninguno, al buscador.
   - «Limpiar filtros» solo existe si hay filtros; al usarlo, el foco va al buscador. Es un botón secundario: blanco con borde de tinta.
   - Grupos: un `<h3>` sobre `$ui-surface`, con su número de lugares en una insignia de tinta y, en los órdenes de temperatura, una muestra decorativa del color de la franja. Cada grupo es su propia `<ul>` con las filas de la 008: el mismo `LocationRow`, la misma memoización y el mismo `loading="lazy"`. En los órdenes de temperatura se destaca la cifra por la que se ordena.
   - Filas: la seleccionada lleva la barra de 0,4rem y el fondo al 12 % en `$ui-accent`, y la de debajo del puntero, el fondo al 6 %; el celeste del mood frío (`$color-sky-blue`) queda para el tiempo. El anillo de foco va por dentro de la fila, justo después de la barra, así que una fila seleccionada con el foco muestra las dos señales.
   - `EmptyResults`, montado solo cuando no queda ningún lugar: el sprite de Castform en silueta sobre un disco `$ui-surface`, con un «?» en Pixelify Sans en `$ui-accent`, «Ni rastro por aquí», «Ningún lugar cumple a la vez estos filtros. Quita alguno o empieza de cero.» y el botón «Limpiar filtros», aquí principal: relleno azul y texto blanco.

9. **Estilos compartidos**
   - `src/styles/abstracts/_accessibility.scss` con el mixin `visually-hidden`, para la región viva, el enlace de salto y los dos sitios de la 008 con el mismo patrón: el anuncio del mapa y el texto completo de Oak. Un parcial sin salida CSS, como `_breakpoints.scss`: `_reset.scss` no puede alojar mixins, porque cada componente que lo usara volvería a emitir el reseteo.
   - Un mapa SCSS de franjas —relleno y trazo— en `_variables.scss`, del que leen `LocationMarker.scss` y la muestra de color de los grupos.
   - `$ui-surface` en `_variables.scss`, el tercer token de la paleta de interfaz, junto a `$ui-ink` y `$ui-accent` (008).

10. **Verificación en navegador** con Playwright sobre `vite preview`, como en la 008.

## Zonas

Asignadas manualmente en `locations.manual.ts`, tomando como referencia la provincia o el distrito de cada lugar (`administrativeArea`); no se infieren en runtime:

| Zona | Lugares | | Zona | Lugares |
| --- | --- | --- | --- | --- |
| Andalucía | 9 | | Comunidad de Madrid | 1 |
| Aragón | 6 | | Comunidad Valenciana | 3 |
| Asturias | 2 | | Extremadura | 4 |
| Baleares | 3 | | Galicia | 4 |
| Canarias | 6 | | La Rioja | 1 |
| Cantabria | 1 | | Melilla | 1 |
| Castilla y León | 9 | | Navarra | 1 |
| Castilla-La Mancha | 7 | | País Vasco | 1 |
| Cataluña | 4 | | Región de Murcia | 1 |
| Ceuta | 1 | | Portugal | 8 |
| | | | Andorra | 1 |

## Paleta de interfaz

Tres colores de la paleta de pokemon.com, cada uno con un solo papel, más el blanco que ya existe. El mood y las franjas de temperatura no se tocan: son significado meteorológico.

| Token | Color | Papel |
| --- | --- | --- |
| `$ui-ink` | `#323232` | Texto de la interfaz, bordes de campos y controles, banda «Todos los lugares», insignias de recuento y «Leyenda» (008). |
| `$ui-surface` | `#F5F5F5` | Zona de controles, encabezados de grupo y disco del estado vacío. Separa por plano, nunca como borde: con el blanco da 1,09:1. |
| `$color-white` | `#FFFFFF` | Campos, filas y botones en reposo, y la caja de la entrada pulsada de la leyenda. |
| `$ui-accent` | `#1B53BA` | Lo elegido: orden, filtros activos, entrada pulsada, fila seleccionada y botón principal; el hover de los controles; y el título POKETIEMPO (008). |

**La regla de estado.** Reposo: blanco con borde de tinta. Hover: el control toma el azul sin rellenarse. Elegido: azul con una señal que no es color —▸, ✕, ✓ o la barra de la fila—. Foco: el anillo de la 008.

**Descartados**, porque repiten un color que ya significa algo:

- `#2F2F2F` — 1,04:1 contra la tinta: el mismo gris.
- `#30A7D7` — 1,39:1 contra el relleno del mood frío, y 2,75:1 sobre blanco, que no vale ni para texto ni para bordes.
- `#B89355` — 1,02:1 contra el trazo de la franja de 35° o más; con la tinta da 4,48:1 y no sostiene texto.
- `#B32A0A` — 1,04:1 contra el tono oscuro de `heat`; «rojo» es además un nivel de aviso de AEMET (`AlertLevel`).
- `#FD7D24` — 1,20:1 contra el relleno de `heat`, y «naranja» es otro nivel de aviso; sobre blanco da 2,58:1.
- `#734BB2` — 1,14:1 contra el trazo de la franja bajo cero.

## Decisiones

- **El estado de los filtros en `WeatherApp`; el orden, en la lista.** Filtros y selección los comparten leyenda, mapa y lista; el orden solo lo ve la lista.
- **`matchingIds` en vez de filtrar los datos del mapa.** El mapa sigue recibiendo los 74 lugares, así que el dibujo no cambia de número de elementos ni de orden de foco: solo decide cuáles se apagan.
- **La regla de equivalencia es la condición de diseño, no un efecto secundario.** Mapa y lista leen el mismo `matchingIds`, así que un marcador operable siempre tiene su fila a la vista. El test de equivalencia compara ambos conjuntos con varias combinaciones de filtros.
- **`zone` y no `region`.** `LocationView.region` ya existe y significa otra cosa: si el lugar se dibuja en el mapa principal o en el recuadro de Canarias. `zone` es además el nombre del control. No tiene relación con las zonas de aviso (`alertZoneIds`), y el comentario del tipo lo dice.
- **Tipo cerrado para la zona.** `LocationZone` sale de `LOCATION_ZONES`: una errata en `locations.manual.ts` no compila, y las opciones del selector y el orden de los grupos salen de esa misma lista.
- **«Toda España» en el selector.** Separa los 65 lugares de AEMET de Portugal y Andorra sin crear una zona que no existe en los datos: es un filtro por país.
- **La búsqueda también entiende condiciones.** Quien escribe «lluvia» o «calor» encuentra lo que busca aunque la condición también se pueda pulsar en la leyenda. Todas las palabras deben aparecer, y sin búsqueda difusa: con 74 nombres, un resultado inesperado confunde más que ayuda.
- **La selección se anula en el manejador, no en un efecto.** Así no queda en el estado una selección invisible que reaparecería al limpiar los filtros.
- **Silueta con filtro SVG en el mapa y con CSS en la leyenda.** La leyenda es HTML, donde `filter` de CSS es universal; en SVG, el filtro por referencia es lo que se comporta igual en todos los navegadores.
- **Una región viva aparte del recuento visible.** Si el propio recuento fuera la región viva, se anunciaría a cada tecla.
- **«Saltar al buscador».** 2.4.1 no aplica a una página única, pero el buscador queda detrás de hasta 74 marcadores y de los botones de la leyenda en el orden de tabulación. «Ordenar» es una sola parada por la misma razón.
- **Sin barra fija al desplazar.** Taparía el foco de las filas (2.4.11) y robaría alto en móvil horizontal y con zoom (1.4.10). El recuento y «Limpiar filtros» están en la cabecera de la lista, y la lista filtrada es corta.
- **Tres colores de la paleta, no nueve.** Los seis descartados chocan con el significado (ver «Paleta de interfaz»). Con un solo acento, «azul» quiere decir siempre lo mismo: elegido.
- **El foco no es azul.** Es el anillo de la 008, igual en toda la app: un anillo azul se confundiría con un control elegido. Su hueco blanco lo separa de los controles rellenos de azul.
- **La columna del ✓ se reserva siempre.** Un ✓ que apareciera al pulsar desplazaría la etiqueta o ensancharía la entrada. Reservarlo cuesta ancho de leyenda, no movimiento.
- **El Pokémon de un filtro activo, en un disco blanco.** Sobre el azul de la pastilla, Kyogre o Gyarados desaparecerían.
- **Los criterios de WCAG siguen en `008-plan.md`.** Esa matriz es la declaración de conformidad del proyecto: al cerrar la 009 se ponen al día en ella las filas que cambian (ver más abajo), en vez de repartir la conformidad entre dos documentos.

## Contrastes medidos

Medidos en Chromium sobre el build de producción, con los colores que calcula el navegador y los fondos compuestos, alfa incluido. Fórmula WCAG 2.x de luminancia relativa.

**Texto** (umbral 4,5:1; 3:1 en texto grande):

- Banda «Todos los lugares», insignias de recuento y enlace de salto, blanco sobre `$ui-ink`: 12,82:1.
- Texto de la interfaz en `$ui-ink`: 12,82:1 sobre blanco —campos, orden sin elegir, filas, «Limpiar filtros» y estado vacío— y 11,76:1 sobre `$ui-surface` —etiquetas, recuento y títulos de grupo—. La ayuda de la leyenda, 11,47:1 sobre el mar.
- Orden elegido, pastillas y «Limpiar filtros» del estado vacío, blanco sobre `$ui-accent`: 7,02:1.
- Texto azul del hover —orden, pastillas y «Limpiar filtros»—, `$ui-accent` sobre blanco: 7,02:1. El «?» del estado vacío, sobre su disco `$ui-surface`: 6,44:1.
- Marcador de posición del buscador, `$ui-ink` al 75 % sobre blanco: 5,81:1. El gris por defecto de los navegadores no llega a 4,5:1.
- Fila seleccionada y fila bajo el puntero, `$ui-ink` sobre `$ui-accent` al 12 % y al 6 %: 10,65:1 y 11,70:1.
- Etiquetas de una entrada pulsada de la leyenda sobre su caja blanca, en los cinco moods: el halo, de 4,55:1 (`cold`) a 10,60:1 (`gelid`), sobre el 3:1 del texto grande; el relleno va de 1,76 a 4,60:1 y no es lo que da el contraste, como en la 008.

**Bordes e indicadores** (1.4.11, umbral 3:1):

- Bordes de campos, del grupo «Ordenar» y de «Limpiar filtros», `$ui-ink`: 11,76:1 contra `$ui-surface` y 12,82:1 contra el blanco del campo.
- Borde en hover, `$ui-accent`: 6,44:1 contra `$ui-surface`. Pastillas contra `$ui-surface`: 6,44:1.
- Borde de la entrada pulsada de la leyenda o en hover: 6,28:1 contra el mar y 7,02:1 contra su caja; ✓ sobre la caja, 7,02:1.
- Barra de la fila seleccionada: 7,02:1 contra la lista y 5,83:1 contra el fondo de su fila.
- Anillo de foco: #111 a 17,32:1 contra `$ui-surface`, y su hueco blanco a 7,02:1 contra los controles azules.

`$ui-accent` sobre `$ui-ink` da 1,83:1: el azul nunca va sobre la tinta.

Las siluetas no llevan umbral: en la leyenda son decorativas (la etiqueta nombra al botón), y en el mapa marcan elementos inactivos, que 1.4.11 excluye.

## Criterios de WCAG que cambian

| Criterio | Antes | Después |
| --- | --- | --- |
| 1.3.1 Información y relaciones | Cumple | Cumple: encabezados de grupo, `fieldset`/`legend`, etiquetas asociadas y estado pulsado en la leyenda. |
| 1.4.1 Uso del color | Cumple | Cumple: pulsado con caja blanca y ✓, orden elegido con ▸, filtros activos con ✕, fila seleccionada con barra, sombra como silueta. |
| 1.4.3 y 1.4.11 | Cumple | Cumple, con las cifras medidas de arriba. |
| 2.1.1 Teclado | Cumple | Cumple: buscador, selector, orden con flechas, botones de filtro y de la leyenda. |
| 2.4.3 Orden del foco | Cumple | Cumple: salto → leyenda → marcadores activos → cerrar, si hay tarjeta → buscar, zona, ordenar → filtros → limpiar → filas, en el orden del DOM. |
| 2.4.4 Propósito de los enlaces | No aplica | Cumple: el enlace de salto dice adónde lleva. |
| 2.4.6 Encabezados y etiquetas | Cumple | Cumple, con las etiquetas nuevas. |
| 2.4.11 Foco no oculto | Cumple | Cumple: con la tarjeta abierta, ningún control con el foco queda tapado, en las dos composiciones, al 100 % y al 200 %, tampoco cuando el foco se mueve por programa. |
| 2.5.3 Etiqueta en el nombre | Cumple | Cumple: los botones de filtro empiezan su nombre por su texto visible. |
| 2.5.8 Tamaño del objetivo | Cumple | Cumple: controles nuevos de al menos 44 × 44px; «Equivalent» se mantiene con filtros. El ✕ nativo del buscador lo dibuja el navegador («User agent control»), y Escape hace lo mismo. |
| 3.2.2 Al recibir entradas | Cumple | Cumple: filtrar y ordenar cambian el contenido, no el contexto. El foco solo se mueve cuando desaparece el control que lo tenía —un filtro activo que se quita, «Limpiar filtros»—, al siguiente filtro o al buscador. |
| 3.3.2 Etiquetas o instrucciones | No aplica | Cumple: buscador, zona y orden tienen etiqueta visible. |
| 4.1.2 Nombre, función, valor | Cumple | Cumple: controles nativos, `aria-pressed` en la leyenda, marcadores en sombra fuera del árbol. |
| 4.1.3 Mensajes de estado | Cumple | Cumple: el recuento se anuncia en una región viva. |

El recuento pasa de 31 criterios que se cumplen y 24 que no aplican a 33 y 22. Cambia además la justificación, no el resultado, de 1.1.1, 1.3.2, 1.3.5, 1.4.10, 1.4.12, 1.4.13, 2.4.1, 2.4.7, 3.3.1 y 3.3.3. Todo ello está al día en la matriz de `008-plan.md`.

## Riesgos

- **La zona se mantiene a mano**, como `administrativeArea`. El tipo impide erratas y el test comprueba el conjunto, no que cada lugar esté en la zona correcta: un lugar nuevo exige revisarla.
- **Más paradas de tabulación.** Los botones de la leyenda —entre 6 y 10 al día— y la barra se suman a las 148 de la 008: con la previsión del día son 160. Lo compensan el enlace de salto y que «Ordenar» sea una sola parada; con filtros, además, los marcadores apagados salen del recorrido.
- **Rendimiento al escribir.** Filtrar 74 lugares por tecla es trivial; lo que cuesta es repintar, y marcadores y filas están memoizados, así que solo cambian los que pasan de encendidos a apagados o al revés.
- **Una silueta pequeña no se reconoce.** No hace falta: la sombra dice «no coincide», y la lista dice cuáles sí.
- **Días con una sola condición.** La leyenda sigue funcionando como filtro, pero sirve de poco; la búsqueda y la zona siguen siendo útiles.
- **`<select>` con estilo propio.** `appearance: none` y una flecha propia; al abrirlo se usa la lista nativa de cada sistema, que es lo accesible.
- **La columna del ✓ ensancha la leyenda.** En dos columnas el mapa pierde ese ancho, y el punto de corte de dos columnas sube en la misma medida (012).
- **Anchos calculados para el texto más largo.** La columna de la leyenda está calculada para «torrenciales» y el campo de zona para «Comunidad Valenciana», las dos con el espaciado de 1.4.12. Una etiqueta o una zona más largas piden revisar esas medidas.
- **El azul tiene pariente en el significado.** Los moods gélido y frío también son azules (1,51–1,54:1 contra sus tonos oscuros). En la interfaz, el azul nunca pinta un dato del tiempo y siempre va con una señal que no es color.
- **La suite no mide layout.** jsdom no calcula geometría: plantillas, desbordamientos, zoom y foco tapado se verifican en navegador.
- **Bundle por encima del umbral de aviso de Vite (no bloqueante).** El JS de producción mide 517,5 kB (175,0 kB con gzip), 14,7 kB más que al cerrar la 008, y Vite avisa por encima de 500 kB. El build termina; la configuración de Vite no se toca en esta feature.

## Verificación

Sobre el build de producción (`vite preview`), en Chromium con Playwright y con la previsión real del día, que pone 8 Pokémon en la leyenda.

| Rango | Viewport | Composición | Mapa | Columnas leyenda / lista | «Ordenar» |
| --- | --- | --- | --- | --- | --- |
| móvil pequeño vertical | 320×568 | apilada | 320×202 | 1 / 1 | 2 × 2 |
| móvil vertical | 390×844 | apilada | 390×246 | 1 / 1 | 2 × 2 |
| breakpoint de referencia | 480×854 | apilada | 480×303 | 1 / 1 | 1 × 4 |
| móvil horizontal | 667×375 | apilada | 475×300 | 2 / 2 | 1 × 4 |
| tablet vertical | 768×1024 | apilada | 768×485 | 2 / 2 | 1 × 4 |
| tablet horizontal | 1180×820 | apilada | 1039×656 | 4 / 3 | 1 × 4 |
| breakpoint de referencia | 1200×800 | dos columnas | 892×563 | 1 / 3 | 1 × 4 |
| portátil | 1366×768 | dos columnas | 973×614 | 1 / 4 | 1 × 4 |
| breakpoint de referencia | 1600×900 | dos columnas | 1140×720 | 1 / 5 | 1 × 4 |
| escritorio | 1920×1080 | dos columnas | 1292×816 | 1 / 5 | 1 × 4 |
| ultrawide | 2560×1440 | dos columnas | 1292×816 | 1 / 5 | 1 × 4 |

- **Cinco recorridos completos con el tabulador en cada ancho**: en reposo; con filtros (una condición, «Toda España» y la búsqueda «a»); con esos filtros y la tarjeta abierta; sin resultados; y con la tarjeta abierta sin filtros. En reposo hay 160 paradas: el enlace de salto, las 8 entradas de la leyenda, los 74 marcadores, buscar, zona, «Ordenar» y las 74 filas. Con la tarjeta abierta son 161. Con filtros son 20: 2 marcadores, 3 filtros activos, «Limpiar filtros» y 2 filas. Sin resultados, 17. En todos los recorridos las paradas siguen el orden del DOM, tienen indicador de foco visible y ninguna queda tapada. No hay scroll horizontal en ningún estado.
- **Objetivos**: entradas de la leyenda de 70px de alto como mínimo; buscar y zona, de 48px; caras de «Ordenar», de 75×44 como mínimo; filtros activos, de 70×44; «Limpiar filtros», de 134×44, y de 148×48 en el estado vacío; enlace de salto, de 167×44; filas, de 62px.
- **Enlace de salto**: es la primera parada y se ve al recibir el foco. Intro lleva el foco al buscador, con su etiqueta y su anillo a la vista, en los once anchos, al 200 % y al 400 %.
- **Zoom al 200 %** en los ocho rangos de la 008: todo alcanzable y operable, con los mismos cinco recorridos. No hay scroll horizontal desde 334 CSS px. Por debajo de 320 CSS px (el móvil de 320px al 200 % queda en 160, y el de 390 en 195) siguen pidiéndolo el título y las filas, como en la 008. A 160 CSS px lo piden también las caras de «Ordenar», que no parten su texto. Con la tarjeta abierta a 160×284, algunas paradas quedan en parte bajo la hoja, pero ninguna entera.
- **1.4.10, a 1280×1024 al 400 %** (320×256 CSS px): sin scroll horizontal en reposo, con filtros, con la zona más larga elegida, en «Más calor» y «Más frío», sin resultados y con la tarjeta abierta. La hoja inferior, de 128px, se desplaza por dentro, como en la 008. Las 25 etiquetas posibles de la leyenda, en una entrada pulsada, no parten ninguna palabra.
- **1.4.12**, con los cuatro valores del criterio: comprobado a 320, 390, 480, 667, 768, 1180, 1200, 1366, 1600 y 1920px, y en esos mismos estados. No hay recortes, solapes, texto que se salga de su control, palabras partidas ni scroll horizontal. Lo comprobado: las 25 etiquetas posibles de la leyenda, las caras de «Ordenar», los filtros activos, los títulos de grupo por franja y el estado vacío. El selector de zona muestra entera su opción más larga. A 667×375 la hoja inferior se desplaza por dentro, como en la 008.
- **2.4.11**: con la tarjeta abierta, con y sin filtros, en las dos composiciones y al 100 % y al 200 %, ninguna parada queda tapada. Con la hoja inferior abierta, quitar un filtro activo deja el foco en el siguiente, y «Limpiar filtros» lo lleva al buscador; los dos quedan enteros a la vista.
- **Los tres estados de `matchingIds`**, a 1920×1080:
  - Sin filtros: 74 marcadores operables, 148 cifras y 74 botones en el árbol de accesibilidad.
  - Conjunto vacío («zzz»): ningún marcador operable y 74 en sombra, sin cifras ni botones en el árbol, y ningún clic llega a un marcador en sombra.
  - Un solo lugar («gijon»): Gijón operable y 73 en sombra.

  Las posiciones de los marcadores y la caja del mapa son idénticas en los tres estados. Al quitar los filtros, el marcado del SVG es idéntico, carácter por carácter, al de reposo.
- **Encabezados**: h1 «POKETIEMPO», h2 «Leyenda», el h2 del lugar en la tarjeta, h2 «Todos los lugares» y un h3 por grupo, o «Ni rastro por aquí» sin resultados. Ningún salto de nivel en los cuatro órdenes, con la tarjeta abierta ni sin resultados. «A–Z» no lleva h3.
- **Foco y selección a la vez**, por teclado a 390 y 1366px:
  - Entrada pulsada de la leyenda: el anillo por fuera del borde azul, con su ✓.
  - Orden elegido: el anillo y su hueco blanco sobre la cara azul, con el ▸.
  - Filtro activo: igual que el orden elegido.
  - Fila seleccionada: la barra entera y el anillo por dentro de ella.
  - Marcador seleccionado: solo su anillo.
- **Leyenda**, de 320 a 1920px:
  - Pulsar y soltar no mueve nada.
  - A 1200px el mapa mide 892px, y sus cifras aparecen desde 1458px de viewport.
  - Siluetas sobre el mar y sobre tierra.
  - Entrada pulsada en los cinco moods y en las dos composiciones.
- **Sin maquetación en JS**: `src/` solo consulta `matchMedia` para `prefers-reduced-motion`, en la portada y en Oak. No hay `innerWidth`, ni `ResizeObserver`, ni medidas de geometría.
