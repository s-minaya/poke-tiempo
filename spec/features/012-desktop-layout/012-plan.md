# 012 · Escritorio compacto y aprovechamiento del espacio — Plan

**Estado:** implementada; pendiente de la comprobación en producción.

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
3. **`WeatherApp.scss`:**
   - La plantilla de dos columnas, desde `$breakpoint-desktop-columns`, con la leyenda en `$legend-column-width`.
   - Entre 1200px y ese punto, la plantilla apilada.
4. **`Legend.scss`:** sus cinco reglas de leyenda en columna, desde `$breakpoint-desktop-columns`: la columna flex, las entradas que se reparten el alto y el sprite de 4,4rem. En escritorio compacto, la leyenda es la banda de la composición apilada.
5. **`SpainMap.scss`:**
   - Desde `$breakpoint-desktop`, el ancho del mapa es `min(100%, max($map-temperature-threshold, alto disponible × proporción))`.
   - `align-self: start`, desde `$breakpoint-desktop-columns`, que es donde hay una leyenda al lado.
6. **Comentarios:** dicen «escritorio» donde algo vale en todo el escritorio, y «dos columnas» solo donde depende de la leyenda al lado: `Header.scss`, `LocationCard.scss` y `LocationCard.tsx`, `SpainMap.scss`, `LocationMarker.scss`, `Legend.scss` y `_breakpoints.scss`.
7. **Test, en Node (`src/styles/abstracts/breakpoints.test.ts`):** compila con Sass un fragmento que usa los módulos reales, `_variables.scss` y `_breakpoints.scss`.
   - Lee de la salida los valores de `$root-font-size`, `$legend-column-width`, `$map-temperature-threshold` y `$scrollbar-allowance`.
   - Comprueba que la media query generada para `$breakpoint-desktop-columns` es su combinación.
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
11. **`Credits.scss`:** la línea de tinta de arriba.
12. **`WeatherApp.scss`:** el comentario de `.app`. El contenido se queda en 1600px; los fondos de la lista y la línea del pie llegan a los bordes.

### Bloque 3 — Documentación

13. **`tech-stack.md`:**
    - en Archivos y en Unidades: los tokens y el mixin nuevos;
    - en Composición y puntos de corte:
      - las tres composiciones;
      - qué significa 1200px;
      - las temperaturas en escritorio y la prioridad frente a la primera pantalla;
      - el punto de corte de columnas y cómo se deriva;
      - el fondo a sangre;
      - el bloque de `_breakpoints.scss`;
    - en Estilo visual → Composición: la de dos columnas, desde el punto de corte de columnas;
    - en Baseline de compilación y navegadores: `calc()` en media queries.
14. **`008-spec.md` y `008-plan.md`:** lo que la 010 y esta feature dejaron falso.
    - El umbral de 1150px pasa a 1063px (010).
    - Lo que significa 1200px, el punto de corte de columnas y el suelo del mapa en escritorio.
    - La tarjeta anclada «en dos columnas» pasa a «en escritorio».
    - **`009-plan.md`**, paso 6 y su riesgo: la columna de la leyenda en dos columnas es `$legend-column-width`, y de ella se deriva el punto de corte.
    - **`009-plan.md`**, paso 7: un lugar en sombra no monta marcador, y su silueta va en la capa de sprites.
15. **`008-plan.md`, matriz WCAG:** solo las filas afectadas.
    - **1.3.2:** el escritorio compacto pinta el mapa antes que la leyenda, como la composición apilada; la capa de sprites queda fuera del árbol accesible.
    - **1.4.10:** sin scroll horizontal con el fondo a sangre.
    - **1.4.12:** la leyenda de dos columnas a 29,2rem.
    - **2.4.11:** el mapa bajo el pliegue en ventanas bajas, la tarjeta anclada en escritorio y el aro de foco por encima de todos los sprites.

## Decisiones

- **La leyenda va debajo del mapa en escritorio compacto.**
  - La banda mide 365px (11 entradas, en 4 columnas). Encima del mapa, lo empujaría hacia abajo: lo que queda bajo el pliegue pasaría de 0, 79, 31 y 142px a 365, 444, 396 y 507px (1200×800, 1280×720, 1366×768 y 1366×657).
  - Debajo, el orden es el mismo que por debajo de 1200px, que la 008 ya justifica (1.3.2 y 2.4.3).
  - La leyenda queda entre las dos cosas que explica y filtra: el mapa y la lista.
- **El mapa va centrado y no llena el ancho.** Llenarlo dejaría entre 207 y 324px bajo el pliegue, más allá del margen aceptado y en contra de la prioridad 4. A los lados queda el mismo mar que la cabecera y la leyenda.
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
  - Descartado salir del contenedor con `100vw`: incluye la barra y daría scroll horizontal.
- **La geometría del mapa queda fuera:** el mar al este de Baleares se valorará cuando esta composición esté en producción.

## Riesgos

- **`calc()` en media queries.** Si un navegador no lo admite, no aplica las dos columnas y todo el escritorio queda en compacto, con temperaturas. La degradación es segura. Queda por verificar con el resto del CSS (`tech-stack.md` → Baseline de compilación y navegadores).
- **Base de texto muy grande.** Por encima de unos 29px, más allá del «Muy grande» de Chrome (24px), el tope de 1600px deja la columna del mapa por debajo de 1063px en dos columnas. No se cubre.
- **Ventanas bajas.**
  - Hasta 142px del mapa quedan bajo el pliegue (1366×657). Con el aviso de frescura montado, lo que mida el aviso más.
  - En escritorio compacto, la leyenda empieza bajo la primera pantalla.
- **Cifras y sprites vecinos.** Con la capa de sprites, una cifra puede tapar el borde de un sprite vecino, nunca al revés.

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
- **Cifras y sprites.** Ninguna cifra se solapa con otra. En los 21 pares en que la caja de una cifra cruza la de un sprite vecino, ningún píxel opaco de la cifra cambia por el sprite, a 1200, 1372, 1440, 1600 y 1920px. Huesca se lee «11° 18°»; Lanzarote y Fuerteventura, Andorra y Lleida, y Évora y Beja solo se rozan en el borde, con la cifra encima.
- **Capa de sprites.**
  - Ningún sprite tapa el aro de foco de ninguno de los 74 marcadores.
  - Puntero: en 5.994 puntos de los cuadrados de los marcadores, 432 de ellos donde dos se pisan, el punto llega al mismo marcador que con los sprites dentro de cada uno, y ninguno a un sprite. Un clic o un toque en zonas comunes (Huesca y Zaragoza, Cáceres y Plasencia, Tenerife y La Gomera, Lanzarote y Fuerteventura) activa el mismo marcador.
  - El orden de Tab y el árbol accesible del mapa no cambian: 74 botones con nombre único y ninguna imagen.
  - Sin filtros, con una condición de la leyenda, con una búsqueda y con las zonas de Aragón y de Canarias, los marcadores y las siluetas son los mismos y el mapa solo cambia donde un sprite tapaba una cifra.
- **Leyenda:** en dos columnas a 1372px, «Lluvias torrenciales» deja 33,5px de holgura, y 1,8px con 1.4.12; en compacto a 1200px, 42,5 y 10,8px.
- **Zoom:** a 1280×1024 al 200 y al 400 %, apilada y sin scroll horizontal; a 2560 al 200 % y a 1920 al 150 %, compacto con las 74 cifras.
- **2.4.11:** a 1366×657, 1200×800, 1372×800 y 1536×730, las tarjetas de los bordes (A Coruña, Girona, Menorca, Faro, Cádiz, Melilla, La Palma, Lanzarote) quedan dentro del mapa y no tapan su marcador; el foco del siguiente marcador queda a la vista, con la tarjeta transparente si está debajo. A 1366×657, la tarjeta de Cádiz queda en parte bajo el pliegue.
- **Fondo a sangre.**
  - A 1920 y 2560px las bandas llegan a los dos bordes de la ventana, en los mismos colores y alturas que dentro de `.app`, también al 125 y al 150 %. Dentro de `.app` no cambia ningún píxel. Por debajo de 1600px, y a 1600px con la barra clásica, no cambia ningún píxel.
  - Sin scroll horizontal ni recortes a 1920 y 2560px, al 100, 125, 150 y 200 % y con 1.4.12.
  - Anillos de foco del buscador, de «Ordenar», de las dos filas de los extremos de la lista y de los dos enlaces de la atribución: la línea oscura (`#111`) se ve entera, a 18,88:1 sobre el blanco de la lista y de su banda y a 17,32:1 sobre la nube de los controles. En las filas de los extremos, su halo blanco exterior cae sobre la banda blanca y no se distingue de ella, como dentro de la lista; sobre el mar tampoco destaca (1,12:1).
  - Con `forced-colors`, ninguna banda fuera del contenido: la página coincide con la que no tiene fondo a sangre, salvo un píxel suelto a 2560px.
