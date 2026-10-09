# 012 · Escritorio compacto y aprovechamiento del espacio — Plan

**Estado:** cerrada.

## Enfoque

Tres composiciones sobre las mismas áreas de `WeatherApp.scss` (`tech-stack.md` → Composición y puntos de corte):

- **apilada**, por debajo de 1200px, sin cambios;
- **escritorio compacto**, con la plantilla apilada y el mapa de escritorio;
- **dos columnas**.

Todo es CSS salvo el orden de las capas del SVG: los sprites del mapa van en una capa propia, debajo de los marcadores. No cambian la geometría del mapa, el orden del foco ni la semántica de los marcadores.

## Implementación

### Bloque 1 — Composición de escritorio

1. **`_variables.scss` y `_reset.scss`:** la raíz de `62.5%` es un token, `$root-font-size`. Lo usan `_reset.scss` y la conversión del punto 2.
2. **`_breakpoints.scss`:** las tres fuentes de verdad y el punto de corte que sale de ellas.
   - `$legend-column-width: 29.2rem`: la columna de la leyenda en dos columnas. Es una entrada con el sprite de 4,4rem (25,2rem, con los 15,4rem de etiqueta en los que «torrenciales» cabe con 1.4.12), más 2rem de relleno a cada lado.
   - `$map-temperature-threshold: 1063px`: el umbral de las temperaturas (010).
   - `$scrollbar-allowance: 17px`: la barra clásica más ancha. En Chrome y Edge sobre Windows mide 15px; en Firefox, 17px.
   - `$breakpoint-desktop-columns: calc(<leyenda en em> + $map-temperature-threshold + $scrollbar-allowance)`.
     - En una media query, `em` es la base de texto del navegador, no la raíz de la página: 29,2rem sobre una raíz de 62,5% son 18,25em.
     - Mezcla unidades a propósito. El ancho de la leyenda escala con la base de texto que tenga configurada la persona. Los 1063px del umbral son el mínimo físico del dibujo para que sus cifras midan al menos 12px CSS, y no dependen del texto. La barra la pone el sistema.
     - Con 16px de base: `calc(18.25em + 1080px)`, es decir, 1372px.
   - `$breakpoint-desktop`, 1200px: desde ahí empieza el escritorio, con el mapa con suelo, la tarjeta anclada y la cabecera de escritorio. No decide las columnas.
   - `$breakpoint-desktop-wide: calc($breakpoint-desktop-large + 2 * ($breakpoint-desktop-large - <leyenda en em> - $map-temperature-threshold))`: desde ahí, el mapa vuelve al contenido.
     - Lo que está entre paréntesis es el mar que la composición de dos columnas ya deja junto a la leyenda, con el tope y un mapa en el umbral: 245px con 16px de base. Por encima del tope, el mapa pegado al borde suma ahí la mitad de lo que la ventana pasa del tope.
     - Sin la barra: el mapa sale del contenido con `100vw`, que ya la incluye.
     - Con 16px de base: `calc(2674px - 36.5em)`, es decir, 2090px.
   - `$legend-split-sprite: 7rem` y `$legend-split-width: 60.8rem`: el sprite de la leyenda partida, el mayor con el que cabe a 1920px, y lo que ocupa desde el borde izquierdo de la ventana: dos entradas de 27,8rem, el hueco de 1,2rem y 2rem a cada lado.
   - `$breakpoint-legend-split: calc($breakpoint-desktop-large - <leyenda en em> + <leyenda partida en em>)`: el primer ancho en que la leyenda partida y el mapa que llena su celda, el tope menos la columna de la leyenda, caben entre los dos bordes de la ventana. Con 16px de base, 1916px.
   - `$legend-inset-max: 18rem`: lo más que se separan del borde el título y la leyenda, medido con la previsión más larga de un día normal junto al título de 6,4rem a 1600px.
   - `$desktop-header-block: 12.8rem`, el alto de la cabecera en escritorio, sale de `SpainMap.scss`: lo usan el mapa y la rejilla.
   - Mixins y funciones compartidos: `respond-between($from, $to)`; `respond-legend-column` y `respond-legend-split`, la leyenda en una sola columna junto al mapa y partida; `desktop-map-max-block` y `desktop-map-width($available)`, el tope de alto y el ancho del mapa en escritorio; `legend-inset($free)`, el margen del título y la leyenda; y `desktop-large-zoom`, la ampliación de la lista.
3. **`WeatherApp.scss` y `WeatherApp.tsx`:**
   - La plantilla de dos columnas, desde `$breakpoint-desktop-columns`, con la leyenda en `$legend-column-width`.
   - Con la leyenda en una sola columna, `minmax($legend-column-width, 1fr) desktop-map-width(calc(100% - $legend-column-width))`: la columna del mapa mide lo que el mapa, y el resto es de la leyenda.
   - `WeatherApp.tsx` pone `--map-aspect` en `<main>`, de `map-frame.ts`, el mismo valor que lee el mapa.
   - Entre 1200px y ese punto, la plantilla apilada.
4. **`Legend.scss` y `Header.scss`:**
   - Las reglas de leyenda en columna, desde `$breakpoint-desktop-columns`: la columna flex y la lista que ocupa el alto que dejan el encabezado y la indicación. En escritorio compacto, la leyenda es la banda de la composición apilada.
   - En una sola columna (`respond-legend-column`): las entradas que se reparten el alto y el sprite de 4,4rem. La leyenda va al inicio de su columna con `margin-inline-start: legend-inset(calc(100% - $legend-column-width))`, y la cabecera suma lo mismo a su relleno izquierdo, calculado con el ancho del mapa.
   - Partida (`respond-legend-split`): la lista en `$legend-split-width` menos el relleno, con `margin-inline-start: calc(($breakpoint-desktop-large - 100vw) / 2)` y filas iguales (`grid-auto-rows: 1fr`); cada entrada centrada en su fila y, con un número impar, las de la columna derecha bajadas media fila (`:nth-child(even):nth-last-child(even)`); el sprite de `$legend-split-sprite`; el encabezado a 4,8rem y la indicación a 1,9rem en una línea, con `inline-size: max-content` y como máximo 41rem.
   - El título, desde `$breakpoint-desktop-large`, a 6,4rem con una línea de 6,2rem.
5. **`SpainMap.scss` y `SpainMap.tsx`:**
   - `map-frame.ts` da `MAP_SEA_BOTTOM` y `MAP_ASPECT`, que leen el mapa y `WeatherApp.tsx`.
   - Desde `$breakpoint-desktop`, el ancho del mapa es `desktop-map-width(100%)`, es decir, `min(100%, max($map-temperature-threshold, alto disponible × proporción))`, pegado a la derecha (`margin-inline: auto 0`).
   - La banda de la atribución, en `$map-attribution`.
   - Desde `$breakpoint-desktop-large`, `margin-inline-end: calc(($breakpoint-desktop-large - 100vw) / 2)`: el mapa sale del contenido hasta el borde de la ventana. Desde `$breakpoint-desktop-wide`, vuelve a `0`.
   - `_reset.scss`: desde `$breakpoint-desktop-large`, `#root` con `overflow-x: clip`, que recorta lo que del dibujo queda bajo la barra clásica.
   - El dibujo y la atribución van en un envoltorio, `spain-map__body`, el único hijo de `.spain-map`.
   - Desde `$breakpoint-desktop-columns`, que es donde hay una leyenda al lado, la celda del mapa mide el alto de la fila y deja el envoltorio al final (flex en columna, `justify-content: flex-end`). El envoltorio es `position: sticky` con `inset-block-end: 0`.
   - Test: el envoltorio es el único hijo de `.spain-map` y contiene el dibujo y la atribución, en ese orden.
6. **Comentarios:** dicen «escritorio» donde algo vale en todo el escritorio, y «dos columnas» solo donde depende de la leyenda al lado: `Header.scss`, `LocationCard.scss` y `LocationCard.tsx`, `SpainMap.scss`, `LocationMarker.scss`, `Legend.scss` y `_breakpoints.scss`.
7. **Test, en Node (`src/styles/abstracts/breakpoints.test.ts`):** compila con Sass un fragmento que usa los módulos reales, `_variables.scss` y `_breakpoints.scss`.
   - Lee de la salida los valores de `$root-font-size`, `$legend-column-width`, `$legend-split-width`, `$map-temperature-threshold`, `$scrollbar-allowance` y `$breakpoint-desktop-large`.
   - Comprueba que las media queries generadas para `$breakpoint-desktop-columns`, `$breakpoint-desktop-wide` y el tramo de `$breakpoint-legend-split` a `$breakpoint-desktop-wide` son su combinación.
   - Si alguien cambia una de esas medidas y el punto de corte no la sigue, o lo escribe como literal, el test falla.
8. **Capa de sprites, en `src/components/SpainMap/components/`:**
   - `MarkerLayers` pinta los lugares de un SVG en dos capas: primero todos los sprites, en un `<g>` con `aria-hidden="true"` y `pointer-events: none`; después, los marcadores.
     - Decide una sola vez, por lugar, si está en sombra.
     - Posición y Pokémon salen de la misma vista del lugar para las dos capas.
     - Lo usan `SpainMap.tsx`, para el mapa principal, y `TerritoryInset.tsx`, para Canarias.
   - `MarkerSprite`, dentro de `MarkerLayers.tsx` y memoizado, como las filas de la leyenda y de la lista: el `<image>` del sprite, centrado en el punto del lugar y del lado de `SPRITE_SIZE`. En sombra, pasa por el filtro de silueta.
   - `LocationMarker` no pinta el sprite ni sabe de la sombra: un lugar en sombra no monta marcador, y su silueta queda en la capa de sprites.
   - Tests:
     - `MarkerLayers`: la capa va antes del primer marcador, oculta y sin nada enfocable; posición, tamaño y silueta de cada sprite; la sombra quita el marcador y deja la silueta; el registro del foco.
     - `SpainMap`: la capa, en el mapa y en Canarias; la sombra, por las siluetas de la capa y los marcadores que quedan.
     - `WeatherApp`: las siluetas que deja una condición de la leyenda.

### Bloque 2 — Fondo a sangre

9. **`src/styles/abstracts/_full-bleed.scss`:** el mixin `full-bleed($image)`.
   - `border-image: $image fill 0 / 0 / 0 100vw` pinta fuera de la caja sin ocupar sitio y sin crear scroll.
   - Con `forced-colors: active`, `border-image-source: none`. La forma abreviada `border-image: none` sale vacía del minificador del build.
10. **`LocationList.scss`:** el fondo a sangre se aplica a cuatro partes de la lista:
   - la lista, en blanco;
   - la barra de título, en tinta;
   - los controles, en nube con su línea de tinta;
   - los encabezados de grupo, en nube con su divisoria.

   Cada grosor de borde va en una variable local, que comparten el borde y el degradado.

   Entre `$breakpoint-desktop-large` y `$breakpoint-desktop-wide`, la lista sale del contenido con `margin-inline: min(0px, calc(($breakpoint-desktop-large - 100vw + $scrollbar-allowance) / 2))`, y la barra de título, los controles, cada grupo y el estado vacío (`EmptyResults.scss`) llevan `desktop-large-zoom`: `zoom: max(1, tan(atan2(calc(100vw - $scrollbar-allowance), $breakpoint-desktop-large)))`.
11. **`Credits.scss`:** la línea de tinta de arriba.
12. **`WeatherApp.scss`:** el comentario de `.app`. El contenido se queda en 1600px; los fondos de la lista y la línea del pie llegan a los bordes, y hasta las pantallas anchas, el mapa al derecho, las entradas de la leyenda partida al izquierdo y la lista, ampliada, a los dos.

### Bloque 3 — Documentación

13. **`tech-stack.md`:**
    - en Archivos y en Unidades: los tokens y el mixin nuevos;
    - en Composición y puntos de corte:
      - las tres composiciones;
      - qué significa 1200px;
      - las temperaturas en escritorio y la prioridad frente a la primera pantalla;
      - el punto de corte de columnas y cómo se deriva;
      - el mapa pegado a la derecha, también fuera del contenido hasta el punto de corte de pantallas anchas, y cómo se deriva este;
      - la leyenda junto al mapa: el margen del título y la leyenda, y la leyenda partida y cómo se deriva su punto de corte;
      - por encima del tope, el título y la leyenda partida más grandes y la lista ampliada;
      - el fondo a sangre;
      - el bloque de `_breakpoints.scss`;
    - en Estilo visual → Composición: la de dos columnas, desde el punto de corte de columnas, y la leyenda partida;
    - en Estilo visual → Paleta: `$map-attribution`;
    - en Baseline de compilación y navegadores: `calc()` en media queries, y `zoom` con `tan(atan2())`.
14. **`008-spec.md` y `008-plan.md`:** lo que la 010 y esta feature dejaron falso.
    - El umbral de 1150px pasa a 1063px (010).
    - Lo que significa 1200px, el punto de corte de columnas y el suelo del mapa en escritorio.
    - La tarjeta anclada «en dos columnas» pasa a «en escritorio».
    - **`009-plan.md`**, paso 6 y su riesgo: la columna de la leyenda en dos columnas es `$legend-column-width`, y de ella se deriva el punto de corte.
    - **`009-plan.md`**, paso 7: un lugar en sombra no monta marcador, y su silueta va en la capa de sprites.
15. **`008-plan.md`, matriz WCAG:** solo las filas afectadas.
    - **1.3.2:** el escritorio compacto pinta el mapa antes que la leyenda, como la composición apilada; la capa de sprites queda fuera del árbol accesible; la leyenda partida se lee en el orden del DOM.
    - **1.4.10:** sin scroll horizontal con el fondo a sangre, ni con el mapa, la leyenda partida y la lista fuera del contenido por encima del tope.
    - **1.4.12:** la leyenda de dos columnas a 29,2rem; la indicación de la leyenda partida y la lista ampliada.
    - **2.4.11:** el mapa bajo el pliegue en ventanas bajas, la tarjeta anclada en escritorio y el aro de foco por encima de todos los sprites.

## Decisiones

- **La leyenda va debajo del mapa en escritorio compacto.**
  - La banda mide 365px (11 entradas, en 4 columnas). Encima del mapa, lo empujaría hacia abajo: lo que queda bajo el pliegue pasaría de 0, 79, 31 y 142px a 365, 444, 396 y 507px (1200×800, 1280×720, 1366×768 y 1366×657).
  - Debajo, el orden es el mismo que por debajo de 1200px, que la 008 ya justifica (1.3.2 y 2.4.3).
  - La leyenda queda entre las dos cosas que explica y filtra: el mapa y la lista.
- **El mapa no llena el ancho.** Llenarlo dejaría entre 207 y 324px bajo el pliegue, más allá del margen aceptado y en contra de la prioridad 4.
- **El mapa va pegado a la derecha.** Ahí el corte recto del contexto norteafricano coincide con el borde de la ventana y se lee como el final del mapa, que es la premisa con la que la 004 lo dejó sin degradado. El ancho que sobra queda del lado del Atlántico, junto a Canarias.
  - Descartado degradar el contexto norteafricano hacia sus bordes: lo descartó la 004, y pegar el mapa resuelve lo mismo sin tocar el dibujo.
- **Por encima del tope, el mapa sale del contenido hasta el borde de la ventana**, sin cambiar de tamaño; la cabecera, la leyenda y la lista siguen en sus 1600px. El ancho que sobra suma mar del lado del Atlántico, junto a la leyenda, así que solo llega hasta `$breakpoint-desktop-wide`, donde ese mar alcanza el que ya deja la composición de dos columnas. Por encima, el mapa vuelve al contenido centrado.
  - Sale con `100vw`, que incluye la barra clásica: el dibujo sigue media barra bajo ella, y `#root` lo recorta con `overflow-x: clip`. `clip` no crea un contenedor de scroll, así que lo pegajoso sigue refiriéndose a la ventana, ni contiene a los descendientes `fixed`. Solo desde el tope: por debajo, nada de la página se recorta en lugar de desplazarse (1.4.10).
  - Descartado restar `$scrollbar-allowance`: con las barras superpuestas, el dibujo se quedaría 8,5px antes del borde y el corte volvería a verse.
  - Descartado quitar el tope de 1600px: se estirarían la cabecera y la lista, y en pantallas muy anchas seguiría quedando mar a los lados, porque el mapa no pasa del alto de la ventana.
  - Descartado que el mapa siga al borde en pantallas muy anchas: a 2560px quedarían unos 470px de mar entre la leyenda y el mapa, y a 3440px, unos 910px.
- **En dos columnas, el mapa acaba con la leyenda.** Cuando la leyenda es más alta, el dibujo y su atribución se apoyan al final de la fila, y el aire queda arriba, sobre el mar del propio dibujo, que en su borde superior no corta tierra. El envoltorio es pegajoso hacia abajo para no sacrificar la prioridad 4: sin scroll, el mapa empieza bajo la cabecera; al bajar, acompaña a la ventana hasta el final de la fila.
  - Pegajoso el envoltorio, dentro de la celda, y no `.spain-map`: en Chrome, una celda de rejilla pegajosa se acota a toda la rejilla y no a su fila, y el mapa subía sobre la cabecera.
  - Descartado alinear el mapa abajo sin más: a 1536×864, el dibujo quedaría 90px bajo el pliegue.
  - Descartado comprimir la leyenda hasta el alto del mapa: con las 12 entradas de hoy en una línea mediría unos 800px, más que el mapa a 1536×864, y con 25 condiciones no hay forma.
- **Con la leyenda en una sola columna, el aire va a la izquierda.** La columna del mapa mide lo que el mapa, con la misma función que el propio mapa, y la leyenda va junto a él. El título se separa del borde lo mismo que la leyenda, y los dos quedan alineados.
  - El margen tiene tope, `$legend-inset-max`: con más, la previsión más larga de un día normal no cabría junto al título de 6,4rem a 1600px, bajaría de línea y la cabecera crecería. Lo que pase del tope queda entre la leyenda y el mapa: hasta 65px, más lo que el mapa sale del contenido por encima de 1600px.
  - Descartado centrar la leyenda en su columna: el título seguía pegado al borde, y la mitad del aire quedaba entre la leyenda y el mapa.
  - Cuando el mapa llena su celda no hay aire, y el título y la leyenda siguen junto al borde: separarlos encogería el mapa.
- **La leyenda partida, sin encoger el mapa.** Desde `$breakpoint-legend-split`, las entradas van en dos columnas y salen hasta el borde izquierdo de la ventana, como el mapa hasta el derecho: ocupan el lateral y el mar que el mapa al borde deja junto a la leyenda. Ni la rejilla ni el mapa cambian.
  - El encabezado y la indicación siguen bajo el título; solo salen las entradas.
  - El sprite de 7rem es el mayor con el que la leyenda partida cabe a 1920px, la pantalla grande más común.
  - Las filas son iguales y se reparten el alto junto al mapa, así que la última acaba con él.
  - Con un número impar de entradas, la columna derecha baja media fila: cada entrada queda entre dos de la izquierda, en vez de acabar con un hueco. El orden de lectura y de Tab es el del DOM, en zigzag por filas.
  - La indicación va en una línea, sobre el mar a la izquierda del mapa: como máximo 41rem, el ancho hasta 2rem antes del mapa donde más cerca llega, en `$breakpoint-legend-split`.
  - Descartado encoger el mapa para dejar sitio a la leyenda.
- **Por encima del tope, el título más grande sin que crezca la cabecera.** La cabecera alinea el título con la fecha por la línea base, y Poketiempo Unown sube 0,7em sobre ella y no baja nada: el alto de la cabecera lo pone la línea del título. Con 6,2rem, a 6,4rem de letra, mide 12,9rem, menos que con el título de 5rem justo por debajo del tope.
- **La lista, ampliada por encima del tope.** Entre `$breakpoint-desktop-large` y `$breakpoint-desktop-wide`, llega a los dos bordes de la ventana y se ve como a 1600px, más grande, con las mismas cinco columnas.
  - Con `zoom`, que amplía todo de una vez, también las consultas de contenedor de los controles, sin reescribir cada medida.
  - En las partes de la lista y no en `.location-list`: en Chrome, `zoom` amplía también los márgenes en `vw` del propio elemento, los que lo sacan del contenido.
  - `zoom` pide un número, y `tan(atan2(…))` lo da a partir de dos longitudes, sin depender de la aritmética con unidades.
  - Sin la barra más ancha, repartida entre los dos lados: con la clásica de Chrome, la lista queda a 1px de cada borde. Con `100vw` entero, el recorte de `#root` se llevaría la barra de la fila elegida en la primera columna.
  - Desde `$breakpoint-desktop-wide`, como el mapa, vuelve al contenido a su tamaño.
  - Descartado llenar el ancho con más columnas al mismo tamaño: la lista se vería distinta que a 1600px.
- **Una sola regla de tamaño para el mapa en todo el escritorio.** Cabe bajo la cabecera si puede y, si no, mide lo que piden sus temperaturas.
- **El punto de corte se deriva, no se elige.**
  - Con barras superpuestas (macOS, la de Windows 11), entre 1355 y 1371px la página queda en compacto con temperaturas. Es el lado seguro.
  - 1366px queda en compacto: no se ajustan medidas para encajar un ancho concreto.
  - Descartada una consulta de contenedor sobre `.app`. Sería exacta, pero un contenedor de consulta contiene a sus descendientes `fixed` y crea un contexto de apilamiento.
- **Las cifras no se agrandan.** Con las cadenas más anchas posibles, 14 unidades ya es el límite: Cuenca y Tarancón, y Cáceres y Plasencia, se tocan.
- **Los sprites, en una capa propia, debajo de los marcadores.** Ningún sprite puede tapar una cifra ni un aro de foco, sea cual sea el Pokémon del día. Donde una cifra toca un sprite vecino, la cifra queda encima, con su contorno. Los sprites se pisan entre sí en el orden de los lugares.
  - Descartada una capa de cifras por encima de todo: sacaría las cifras del botón y dejaría los aros de foco debajo de los sprites.
  - Descartado reordenar los marcadores: cambiaría el orden del foco.
- **El fondo a sangre se hace con `border-image`.** No cambia el ancho de nada, no crea scroll, porque lo que pinta fuera de la caja no cuenta como desbordamiento, y no recorta nada.
  - Descartado `box-shadow` con `clip-path`: recortaría los anillos de foco en los bordes de la lista.
  - Descartado salir del contenedor con `100vw`: incluye la barra y, sin un recorte, daría scroll horizontal. El `border-image` no necesita ninguno.
- **La geometría del mapa queda fuera:** el mar al este de Baleares se valorará después, como decisión aparte.

## Riesgos

- **`calc()` en media queries.** Si un navegador no lo admite, no aplica las dos columnas y todo el escritorio queda en compacto, con temperaturas. La degradación es segura. Queda por verificar con el resto del CSS (`tech-stack.md` → Baseline de compilación y navegadores).
- **Base de texto muy grande.** Por encima de unos 29px, más allá del «Muy grande» de Chrome (24px), el tope de 1600px deja la columna del mapa por debajo de 1063px en dos columnas. No se cubre.
- **Ventanas bajas.**
  - Hasta 142px del mapa quedan bajo el pliegue (1366×657). Con el aviso de frescura montado, lo que mida el aviso más.
  - En escritorio compacto, la leyenda empieza bajo la primera pantalla.
- **Cifras y sprites vecinos.** Con la capa de sprites, una cifra puede tapar el borde de un sprite vecino, nunca al revés.
- **El mapa acompaña al scroll.** En dos columnas, mientras se baja, el mapa avanza más despacio que la página tantos píxeles como la leyenda mide de más: 90px a 1536×864.
- **Contexto de apilamiento.** El envoltorio pegajoso apila la tarjeta anclada dentro del mapa. La tarjeta no sale del dibujo, así que no compite con nada de fuera.
- **El mapa fuera del contenido, por encima del tope.**
  - En ventanas bajas, entre la leyenda partida y el mapa queda además lo que el mapa mide de menos que su celda: 268px a 1920×800.
  - La fecha de la cabecera acaba en el borde del contenido, no donde acaba el mapa.
  - Con la barra clásica, los últimos 7,5px del dibujo, contexto norteafricano, quedan recortados bajo ella.
  - Desde el tope, `#root` recorta en horizontal: algo que desbordase ahí se cortaría en lugar de desplazarse. Hoy no desborda nada.
- **La cabecera, con el título de 5rem y la fecha de 3rem.**
  - Mide de 12,8 a 13,1rem, y el tope de alto del mapa cuenta con 12,8rem: cuando el mapa se ajusta al alto de la ventana, hasta 3px del borde de abajo del dibujo quedan bajo el pliegue.
  - En escritorio compacto, la previsión más larga de un día normal, «miércoles 30 de septiembre», no cabe junto al título a 1200 ni a 1300px: baja de línea, la cabecera pasa a 193px y el mapa baja 65px esos días.
  - `$legend-inset-max` está medido con esos tamaños: si cambian, hay que volver a medirlo.
- **`zoom` en otros navegadores.** La lista ampliada está comprobada en Chrome. Un navegador sin `zoom` o sin `tan(atan2())` deja la lista en los bordes a su tamaño, con más columnas.
- **Barras superpuestas.** Por encima del tope, la lista queda a 8,5px de cada borde: las divisorias de las filas no llegan a él, y las bandas, a sangre, sí.
- **La indicación de la leyenda partida sale de su columna**, sobre el mar a la izquierda del mapa.

## Verificación

Sobre la build, en Chrome con la barra clásica de Windows y con la superpuesta, con los datos del 8 de octubre de 2026.

- **320, 480 y 768px:** mapa, leyenda, lista y atribución en las mismas cajas que sin esta feature; la capa de sprites y el fondo a sangre no cambian ningún píxel.
- **Escritorio.** Las 74 cifras se ven en todos los anchos:

  | Vista | Composición | Mapa | Cifras | Bajo el pliegue |
  |---|---|---|---|---|
  | 1200×800 | compacto | 1064px | 12,0px | 0 |
  | 1280×720 | compacto | 1063px | 12,0px | 79px |
  | 1366×768 | compacto | 1063px | 12,0px | 31px |
  | 1366×657 | compacto | 1063px | 12,0px | 142px |
  | 1371×800 | compacto | 1064px | 12,0px | 0 |
  | 1372×800 | dos columnas | 1064px | 12,0px | 0 |
  | 1440×900 | dos columnas | 1133px | 12,8px | 0 |
  | 1536×730 | dos columnas | 1063px | 12,0px | 69px |
  | 1600×900 | dos columnas | 1223px | 13,8px | 0 |
  | 1920×1080 y 2560×1440 | dos columnas | 1308px | 14,8px | 0 |

  La atribución empieza donde acaba el dibujo y tiene su ancho, y no hay scroll horizontal, en todas las vistas y con las dos barras.
- **Mapa pegado a la derecha y final común**, frente a la build con el mapa centrado y arriba, en las vistas de la tabla, con las dos barras:
  - el mapa mide lo mismo y se ven las 74 cifras;
  - el dibujo acaba en el borde de la ventana, y a 2560px en el del contenido;
  - en dos columnas, al llegar a la lista, la atribución y la leyenda acaban donde empieza la lista, y en ningún punto del scroll el dibujo sube sobre la cabecera;
  - a 1440×900, sin scroll, el mapa empieza 10px más abajo, 20px con la barra clásica, y la atribución acaba justo en el pliegue;
  - con el aviso de frescura montado, a 1440×900 y 1536×864, el mapa no sube sobre el aviso y acaba con la leyenda;
  - a 320, 480, 768 y 1199px, las mismas cajas y los mismos píxeles.
- **Mapa al borde por encima del tope**, frente a la build con el mapa en el contenido, con las dos barras:
  - a 1601×900, 1617×900, 1680×1050, 1920×1080, 1920×800 y 2089×1200, el dibujo acaba en el borde de la ventana, con la barra clásica 7,5px bajo ella, y mide lo mismo; las 74 cifras a la vista y sin scroll horizontal;
  - el mar junto a la leyenda: 40px a 1680×1050, 160px a 1920×1080 y 244,5px a 2089×1200;
  - a 320, 768, 1200, 1366, 1440, 1600, 2090, 2560 y 3440px, los mismos píxeles;
  - las 74 tarjetas se abren enteras dentro de la ventana a 1920×1080 y 2089×1200;
  - al bajar, a 1920×1080 y 1920×800, leyenda, atribución y lista acaban y empiezan en el mismo punto.
- **Leyenda junto al mapa, título y lista ampliada**, frente a la build anterior, en 22 vistas de 1200×800 a 3440×1440, con las dos barras:
  - el mapa, en la misma caja en todas;
  - la cabecera no crece, tampoco con la previsión «miércoles 30 de septiembre» y MAÑANA: mide 12,9rem desde 1600px;
  - sin scroll horizontal, también con 1.4.12;
  - el margen del título y la leyenda, con la barra clásica: 70px a 1440×760, 166px a 1536×730, 180px a 1600×780, el tope, con 50px entre la leyenda y el mapa, y 0 a 1600×1000, donde el mapa llena su celda.
- **Leyenda partida**, de 1916 a 2089px:
  - las entradas, con sprites de 70px, empiezan a 20px del borde izquierdo, 12,5px con la barra clásica, no pisan el mapa ni entre sí y se reparten el alto junto a él, con 12 y con 9 condiciones;
  - la indicación, en una línea de 352px, queda como poco a 78px del mapa (1916×1200); con 1.4.12, en dos líneas de 410px, a 20px.
- **Lista ampliada:** cinco columnas de 1600 a 2089px, con `zoom` de 1,05 a 1700px, 1,19 a 1920px y 1,295 a 2089px. Con la barra clásica, a 1px de cada borde; con la superpuesta, a 8,5px. A 1920px, la barra de la fila elegida y el anillo de foco se ven enteros en la primera columna, la tarjeta se abre desde la fila y el estado vacío sale ampliado. Desde 2090px, en el contenido a su tamaño. Con 1.4.12, las filas quedan como a 1600px.
- **Cifras y sprites.** Ninguna cifra se solapa con otra. En los 21 pares en que la caja de una cifra cruza la de un sprite vecino, ningún píxel opaco de la cifra cambia por el sprite, a 1200, 1372, 1440, 1600 y 1920px. Huesca se lee «11° 18°»; Lanzarote y Fuerteventura, Andorra y Lleida, y Évora y Beja solo se rozan en el borde, con la cifra encima.
- **Capa de sprites.**
  - Ningún sprite tapa el aro de foco de ninguno de los 74 marcadores.
  - Puntero: en 5.994 puntos de los cuadrados de los marcadores, 432 de ellos donde dos se pisan, el punto llega al mismo marcador que con los sprites dentro de cada uno, y ninguno a un sprite. Un clic o un toque en zonas comunes (Huesca y Zaragoza, Cáceres y Plasencia, Tenerife y La Gomera, Lanzarote y Fuerteventura) activa el mismo marcador.
  - El orden de Tab y el árbol accesible del mapa no cambian: 74 botones con nombre único y ninguna imagen.
  - Sin filtros, con una condición de la leyenda, con una búsqueda y con las zonas de Aragón y de Canarias, los marcadores y las siluetas son los mismos y el mapa solo cambia donde un sprite tapaba una cifra.
- **Leyenda:** en dos columnas a 1372px, «Lluvias torrenciales» deja 33,5px de holgura, y 1,8px con 1.4.12; en compacto a 1200px, 42,5 y 10,8px.
- **Zoom:** a 1280×1024 al 200 y al 400 %, apilada y sin scroll horizontal; a 2560 al 200 % y a 1920 al 150 %, compacto con las 74 cifras.
- **2.4.11:** a 1366×657, 1200×800, 1372×800 y 1536×730, las tarjetas de los bordes (A Coruña, Girona, Menorca, Faro, Cádiz, Melilla, La Palma, Lanzarote) quedan dentro del mapa y no tapan su marcador; el foco del siguiente marcador queda a la vista, con la tarjeta transparente si está debajo. A 1366×657, la tarjeta de Cádiz queda en parte bajo el pliegue. Con el mapa pegado a la derecha, las ocho tarjetas, también a 1536×864, quedan en el mismo sitio respecto al dibujo, y por Tab los 74 marcadores quedan enteros a la vista a 1440×900, 1536×864 y 1536×730.
- **Fondo a sangre.**
  - A 1920 y 2560px las bandas llegan a los dos bordes de la ventana, en los mismos colores y alturas que dentro de `.app`, también al 125 y al 150 %. Dentro de `.app` no cambia ningún píxel. Por debajo de 1600px, y a 1600px con la barra clásica, no cambia ningún píxel.
  - Sin scroll horizontal ni recortes a 1920 y 2560px, al 100, 125, 150 y 200 % y con 1.4.12.
  - Anillos de foco del buscador, de «Ordenar», de las dos filas de los extremos de la lista y de los dos enlaces de la atribución: la línea oscura (`#111`) se ve entera, a 18,88:1 sobre el blanco de la lista y de su banda y a 17,32:1 sobre la nube de los controles. En las filas de los extremos, su halo blanco exterior cae sobre la banda blanca y no se distingue de ella, como dentro de la lista; sobre el mar tampoco destaca (1,12:1).
  - Con `forced-colors`, ninguna banda fuera del contenido: la página coincide con la que no tiene fondo a sangre, salvo un píxel suelto a 2560px.
