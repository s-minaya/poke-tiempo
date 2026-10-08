# 012 · Escritorio compacto y aprovechamiento del espacio

**Estado:** cerrada.

## Qué hace

- **Escritorio compacto**, desde 1200px hasta el punto de corte de columnas: el mapa primero, centrado y con sus temperaturas; la atribución de los datos justo debajo; la leyenda debajo, como la banda de la composición apilada; la lista después.
- **Dos columnas** solo desde el primer ancho en que caben juntas la leyenda y un mapa con temperaturas. El punto de corte sale del ancho de la leyenda, del umbral de las temperaturas y de un margen para la barra de desplazamiento: con la base de texto de 16px, 1372px.
- **En todo el escritorio, el mapa no baja del umbral de las temperaturas** (`$map-temperature-threshold`, 1063px). Cabe entero bajo la cabecera cuando la ventana lo permite; si no, mide lo justo para sus temperaturas, y su parte baja queda bajo el pliegue.
- **Los sprites del mapa, en una capa propia** por debajo de los marcadores: ningún sprite se pinta encima de las cifras ni del aro de foco de un vecino.
- **Escritorio grande:** el contenido sigue con su máximo de 1600px y centrado. Los fondos de la lista y la línea del pie llegan a los bordes de la ventana.
- Por debajo de 1200px no cambia nada.

## Por qué

En escritorio, las temperaturas del mapa tienen que verse. Solo se pintan cuando la caja del mapa llega a 1063px, el ancho en el que las cifras miden 12px (`tech-stack.md` → Composición y puntos de corte). Con la leyenda al lado desde 1200px y el mapa acotado por el alto de la ventana, eso pedía una ventana de al menos 1371px de ancho y 799px de alto, que la mayoría de portátiles no tiene: a 1366×768 o a 1536×864, con las barras del navegador, no se veían.

- Entre 1200px y el punto de corte de columnas, la leyenda y un mapa de 1063px no caben juntos. La leyenda pasa debajo del mapa.
- Las cifras no se pueden agrandar en unidades del dibujo: con las cadenas más anchas posibles, a 14 unidades ya se tocan dos pares de lugares vecinos. El umbral se mantiene.
- Cada marcador se pintaba entero en el orden del DOM: su sprite, sus cifras y su aro de foco. El sprite de un lugar quedaba encima de las cifras y del aro de los vecinos anteriores, y según el Pokémon del día podía tapar un dígito. Por ejemplo, la hoja de un Hoppip en Zaragoza tapaba el primer «1» de los 11° de Huesca.
- Por encima de 1600px, la lista y la línea del pie quedaban como una isla de 1600px entre dos franjas de mar. A sangre, los laterales se leen como parte del diseño.

**Prioridad en escritorio.** Sustituye a la regla de que el mapa entero quepa siempre en la primera pantalla (010):

1. Temperaturas legibles.
2. Sin solapes.
3. Composición estable.
4. El mapa dentro de la primera pantalla cuando sea posible.

En una ventana baja, la parte inferior del mapa puede pedir scroll: hasta 142px a 1366×657.

## Criterios de aceptación

- [x] Desde 1200px, las temperaturas del mapa se ven siempre, y nunca a menos de 12px CSS.
- [x] Las temperaturas no se solapan entre sí, y ningún sprite puede pintarse encima de una cifra ni de un aro de foco. Los sprites se pintan en una capa decorativa propia, por debajo de los marcadores, sin cambiar su tamaño ni su posición.
- [x] Entre 1200px y el punto de corte de columnas, el orden visual es mapa, atribución, leyenda y lista, con el mapa centrado.
- [x] Desde el punto de corte de columnas, la leyenda va al lado del mapa y el mapa mide al menos 1063px.
- [x] El punto de corte de columnas se deriva en SCSS del ancho de la leyenda, del umbral del mapa y del margen de la barra. Ninguno de los tres se escribe como literal en más de un sitio.
- [x] En dos columnas, la leyenda muestra las 25 etiquetas posibles sin partir ninguna palabra, también con el espaciado de 1.4.12.
- [x] La atribución de los datos sigue justo debajo del mapa y con su ancho, en las tres composiciones.
- [x] La tarjeta sigue anclada junto a su marcador, también en los bordes del mapa y, en ventanas bajas, en los marcadores de abajo (2.4.11).
- [x] El orden del foco, los nombres accesibles, `aria-pressed` y la interacción de los marcadores no cambian. La única modificación estructural del SVG es que los sprites decorativos salen de cada marcador y se pintan en una capa propia.
- [x] A 320, 480 y 768px, nada cambia.
- [x] No hay scroll horizontal: ni con la barra clásica ni con la superpuesta, ni al 200 % o al 400 %, ni con el espaciado de 1.4.12.
- [x] El contenido conserva su máximo de 1600px, centrado. El fondo a sangre es solo visual: no cambia el ancho de nada.
- [x] Junto a las bandas a sangre, la línea oscura del anillo de foco (`#111`, 18,88:1 sobre el blanco de la lista y de su banda) se ve entera. Su halo blanco exterior no se distingue de la banda blanca, igual que dentro de la propia lista.
- [x] Con `forced-colors`, ninguna banda de color queda fuera del contenido.

## Fuera de alcance

- La geometría del mapa: `map-geometry.ts`, `build-map.ts`, la proporción del dibujo, las posiciones, los sprites y el tamaño de las temperaturas. El mar al este de Baleares se valorará después, como decisión aparte.
- La composición por debajo de 1200px.
- Ajustar medidas para que un ancho concreto, como 1366px, entre en dos columnas.
- Contenido decorativo en los laterales.
