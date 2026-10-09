# 012 · Escritorio compacto y aprovechamiento del espacio

**Estado:** cerrada.

## Qué hace

- **Escritorio compacto**, desde 1200px hasta el punto de corte de columnas: el mapa primero, con sus temperaturas; la atribución de los datos justo debajo; la leyenda debajo, como la banda de la composición apilada; la lista después.
- **Dos columnas** solo desde el primer ancho en que caben juntas la leyenda y un mapa con temperaturas. El punto de corte sale del ancho de la leyenda, del umbral de las temperaturas y de un margen para la barra de desplazamiento: con la base de texto de 16px, 1372px.
- **En todo el escritorio, el mapa no baja del umbral de las temperaturas** (`$map-temperature-threshold`, 1063px). Cabe entero bajo la cabecera cuando la ventana lo permite; si no, mide lo justo para sus temperaturas, y su parte baja queda bajo el pliegue.
- **En todo el escritorio, el mapa va pegado a la derecha**: el corte recto del contexto norteafricano coincide con el borde de la ventana. El ancho que sobra queda del lado del Atlántico. Por encima de 1600px, el mapa sale del contenido hasta el borde, sin cambiar de tamaño, hasta las pantallas anchas: desde 2090px con la base de 16px, el mar junto a la leyenda pasaría del que ya deja la composición de dos columnas, y el mapa vuelve al contenido.
- **En dos columnas, mapa y leyenda acaban juntos**, justo donde empieza la lista. Si la leyenda es más alta, el mapa sigue empezando bajo la cabecera y acompaña al scroll dentro de su celda hasta apoyarse al final de la fila.
- **Con la leyenda en una sola columna, el aire que deja el mapa va a la izquierda.** La leyenda queda junto al mapa, y el título y la leyenda se separan del borde izquierdo lo mismo, hasta 18rem.
- **Leyenda partida**, desde 1916px con la base de 16px hasta las pantallas anchas. El encabezado y la indicación siguen bajo el título, más grandes, y la indicación en una línea. Las entradas van en dos columnas, con sprites de 7rem, desde el borde izquierdo de la ventana, y se reparten el alto junto al mapa. Con un número impar de entradas, la columna derecha baja media fila.
- **Los sprites del mapa, en una capa propia** por debajo de los marcadores: ningún sprite se pinta encima de las cifras ni del aro de foco de un vecino.
- **Escritorio grande:** el contenido sigue con su máximo de 1600px y centrado. Hasta las pantallas anchas, salen de él el mapa, las entradas de la leyenda partida y la lista, que llega a los dos bordes de la ventana y se ve como a 1600px, más grande. El título pasa a 6,4rem sin que crezca la cabecera. Los fondos de la lista y la línea del pie llegan a los bordes de la ventana.
- Por debajo de 1200px no cambia nada.

## Por qué

En escritorio, las temperaturas del mapa tienen que verse. Solo se pintan cuando la caja del mapa llega a 1063px, el ancho en el que las cifras miden 12px (`tech-stack.md` → Composición y puntos de corte). Con la leyenda al lado desde 1200px y el mapa acotado por el alto de la ventana, eso pedía una ventana de al menos 1371px de ancho y 799px de alto, que la mayoría de portátiles no tiene: a 1366×768 o a 1536×864, con las barras del navegador, no se veían.

- Entre 1200px y el punto de corte de columnas, la leyenda y un mapa de 1063px no caben juntos. La leyenda pasa debajo del mapa.
- Las cifras no se pueden agrandar en unidades del dibujo: con las cadenas más anchas posibles, a 14 unidades ya se tocan dos pares de lugares vecinos. El umbral se mantiene.
- Cada marcador se pintaba entero en el orden del DOM: su sprite, sus cifras y su aro de foco. El sprite de un lugar quedaba encima de las cifras y del aro de los vecinos anteriores, y según el Pokémon del día podía tapar un dígito. Por ejemplo, la hoja de un Hoppip en Zaragoza tapaba el primer «1» de los 11° de Huesca.
- Por encima de 1600px, la lista y la línea del pie quedaban como una isla de 1600px entre dos franjas de mar. A sangre, los laterales se leen como parte del diseño.
- Con el mapa centrado, el corte recto del contexto norteafricano quedaba en mitad del mar, con 152px de mar a su derecha a 1366×768 y 39px a 1536×864. La 004 lo dejó recto, sin degradado, porque coincidía con el borde del lienzo y se leía como el final del mapa. Por encima de 1600px, con el mapa dentro del contenido, el corte quedaba igual en mitad del mar: 152px a 1920×1080.
- En dos columnas, la leyenda suele ser más alta que el mapa: 863px con las 12 condiciones del 8 de octubre, frente a 762–809px de mapa y atribución. Con el mapa arriba, entre la atribución y la lista quedaba una franja de mar de hasta 101px, que crece con cada condición.
- En dos columnas, el ancho que el mapa no ocupa quedaba entero entre la leyenda y el mapa, con el título y la leyenda pegados a la izquierda: 166px a 1536×730.
- Por encima de 1600px, con el mapa al borde, junto a la leyenda quedaban hasta 245px de mar, y la lista dejaba unos 160px vacíos a cada lado a 1920px.

**Prioridad en escritorio.** Sustituye a la regla de que el mapa entero quepa siempre en la primera pantalla (010):

1. Temperaturas legibles.
2. Sin solapes.
3. Composición estable.
4. El mapa dentro de la primera pantalla cuando sea posible.

En una ventana baja, la parte inferior del mapa puede pedir scroll: hasta 142px a 1366×657.

## Criterios de aceptación

- [x] Desde 1200px, las temperaturas del mapa se ven siempre, y nunca a menos de 12px CSS.
- [x] Las temperaturas no se solapan entre sí, y ningún sprite puede pintarse encima de una cifra ni de un aro de foco. Los sprites se pintan en una capa decorativa propia, por debajo de los marcadores, sin cambiar su tamaño ni su posición.
- [x] Entre 1200px y el punto de corte de columnas, el orden visual es mapa, atribución, leyenda y lista.
- [x] Desde el punto de corte de columnas, la leyenda va al lado del mapa y el mapa mide al menos 1063px.
- [x] En escritorio, el dibujo acaba en el borde derecho de la ventana, sin cambiar el tamaño del mapa ni dar scroll horizontal; desde el punto de corte de pantallas anchas, en el del contenido.
- [x] En dos columnas, al llegar a la lista, la atribución y la leyenda acaban donde empieza la lista, también con el aviso de frescura. En ningún punto del scroll el mapa sube sobre la cabecera ni sobre el aviso, y si cabía entero en la primera pantalla, sigue cabiendo.
- [x] El punto de corte de columnas se deriva en SCSS del ancho de la leyenda, del umbral del mapa y del margen de la barra. Ninguno de los tres se escribe como literal en más de un sitio.
- [x] En dos columnas, la leyenda muestra las 25 etiquetas posibles sin partir ninguna palabra, también con el espaciado de 1.4.12.
- [x] Con la leyenda en una sola columna, el título y la leyenda se separan del borde izquierdo lo mismo, sin que el mapa cambie de tamaño ni de sitio y sin que la cabecera crezca, también con la previsión más larga de un día normal.
- [x] Con la leyenda partida, sus entradas no pisan el mapa, se reparten el alto junto a él y se leen y se recorren con Tab en el orden del DOM. La indicación cabe en una línea y, con el espaciado de 1.4.12, se parte sin pisar el mapa.
- [x] Por encima de 1600px, el título es más grande y la cabecera no crece.
- [x] Entre 1600 y 2089px, la lista llega a los dos bordes de la ventana con la composición de 1600px ampliada, sin scroll horizontal, y la barra de la fila elegida y el anillo de foco se ven enteros.
- [x] La atribución de los datos sigue justo debajo del mapa y con su ancho, en las tres composiciones.
- [x] La tarjeta sigue anclada junto a su marcador, también en los bordes del mapa y, en ventanas bajas, en los marcadores de abajo (2.4.11). Con el mapa acompañando al scroll, por Tab los 74 marcadores quedan enteros a la vista.
- [x] El orden del foco, los nombres accesibles, `aria-pressed` y la interacción de los marcadores no cambian. La única modificación estructural del SVG es que los sprites decorativos salen de cada marcador y se pintan en una capa propia.
- [x] A 320, 480 y 768px, nada cambia.
- [x] No hay scroll horizontal: ni con la barra clásica ni con la superpuesta, ni al 200 % o al 400 %, ni con el espaciado de 1.4.12.
- [x] El contenido conserva su máximo de 1600px, centrado; solo salen de él el mapa, sin cambiar de tamaño, las entradas de la leyenda partida y la lista. El fondo a sangre es solo visual: no cambia el ancho de nada.
- [x] Junto a las bandas a sangre, la línea oscura del anillo de foco (`#111`, 18,88:1 sobre el blanco de la lista y de su banda) se ve entera. Su halo blanco exterior no se distingue de la banda blanca, igual que dentro de la propia lista.
- [x] Con `forced-colors`, ninguna banda de color queda fuera del contenido.

## Fuera de alcance

- La geometría del mapa: `map-geometry.ts`, `build-map.ts`, la proporción del dibujo, las posiciones, los sprites y el tamaño de las temperaturas. El mar al este de Baleares se valorará después, como decisión aparte.
- La composición por debajo de 1200px.
- Ajustar medidas para que un ancho concreto, como 1366px, entre en dos columnas.
- Contenido decorativo en los laterales.
