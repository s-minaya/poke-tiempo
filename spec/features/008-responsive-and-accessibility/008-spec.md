# 008 · Responsive, accesibilidad y cierre

**Estado:** cerrada.

## Qué hace

La composición se **reorganiza** con el tamaño de pantalla en vez de escalarse entera. El texto tiene tamaños absolutos legibles en cualquier pantalla, y **lo único que se ajusta al hueco disponible es la caja del mapa**.

Eso se traduce en dos composiciones:

- **Apilada** (por debajo de 1200px): cabecera, mapa a todo el ancho, leyenda en banda bajo el mapa, lista de los 74 lugares y créditos. El mapa ocupa proporcionalmente más pantalla que en escritorio, no menos.
- **Dos columnas** (a partir de 1200px): la composición de la cuenta original — título y previsión arriba, leyenda en columna a la izquierda, mapa como cuerpo, créditos sobre el mar — con la lista de lugares en una banda debajo.

**Cada uno de los 74 lugares del mapa se puede seleccionar** con ratón, dedo o teclado, y al hacerlo aparece de qué lugar se trata, a qué área administrativa pertenece, qué Pokémon le ha tocado, su condición y sus temperaturas. La **lista de lugares** ofrece exactamente la misma función con áreas táctiles holgadas, y es también la alternativa textual completa del mapa que exige `mission.md`.

`administrativeArea` es un dato real del modelo de lugares, no algo inferido del nombre. Se llama así y no `province` porque su valor real es una provincia, una comunidad o área, una isla, un distrito portugués o un país, según el lugar. La interfaz lo omite cuando coincide con `name`.

## Por qué

Escalar la composición entera como una sola unidad —la raíz atada al viewport— la encoge en vez de reorganizarla. Medido sobre una implementación que lo hacía:

| Viewport | `1rem` | Etiqueta de leyenda | Créditos | Pantalla vacía |
|---|---|---|---|---|
| 320 × 568 | 2,00px | 4,4px | 2,4px | 376px |
| 375 × 667 | 2,34px | 5,2px | 2,8px | 442px |
| 768 × 1024 | 4,80px | 10,6px | 5,8px | 563px |
| 1366 × 768 | 8,08px | 17,8px | 9,7px | −9px (desborda) |

En un iPhone SE la interfaz se dibujaba al 23 % de su tamaño de diseño, y ni siquiera evitaba el scroll: 1366 × 768 y 667 × 375 desbordaban.

Ese enfoque arrastra además tres problemas de accesibilidad que no se pueden resolver conservándolo:

1. **Anula el zoom del navegador.** Al 200 % el viewport CSS se reduce a la mitad y la raíz se reduce con él: el tamaño visual final no cambia (WCAG 1.4.4).
2. **Deja texto por debajo de lo legible**, incluida la cita a AEMET, que su licencia exige mostrar *de forma visible*.
3. **Deja los 74 lugares consultables sólo con ratón y al pasar por encima** (`<title>` de SVG, sin foco ni activación) — WCAG 2.1.1.

`mission.md` recoge la alternativa: una sola composición, que se adapta en vez de encogerse.

## Decisiones

- **Umbrales táctiles.** 24 × 24 px es el mínimo AA (WCAG 2.5.8). **44 × 44 px es objetivo de diseño** (equivale al criterio AAA 2.5.5), y así se documenta en todas partes: nunca como requisito de conformidad.
- **Marcadores por debajo de 24px.** Los marcadores miden 62 unidades de `viewBox` sobre 1240, así que no cruzan los 24px hasta que el mapa mide 480px. W3C pone los pines de un mapa como ejemplo de posible excepción **«Essential»** de 2.5.8, así que apoyarse en ella sería defendible. **Elegimos no hacerlo**: nos acogemos a **«Equivalent»** y ofrecemos la misma función en la lista, con filas de al menos 56px. Es una decisión más exigente que el mínimo, y además la alternativa textual del mapa ya es requisito propio de `mission.md`, no una concesión que hagamos para conformar. Para que «Equivalent» se sostenga, la lista debe **seleccionar el lugar y llegar al mismo resultado** que el marcador, no limitarse a mostrar los mismos datos.
- **Tokens de mood intactos.** Ningún color de mood cambia ni se añade. El tono oscuro de cada mood es el halo de la línea de previsión y de las etiquetas de la leyenda.
- **Unown sin halo, en la paleta de interfaz.** El título y «Leyenda» van en Poketiempo Unown, de trazo fino y con un ojo en cada letra: cualquier borde alrededor de esos glifos los empasta y los hace difíciles de leer. Se pintan sin trazo y en dos colores fijos de la paleta de interfaz (`tech-stack.md` → Estilo visual): el título en azul `#1B53BA`, que es la marca, y «Leyenda» en tinta `#323232`, la de los controles que encabeza desde la 009. No siguen el mood, y en eso sustituyen a la 005: el mood está en la previsión y en las etiquetas, en Pixelify Sans y Nunito Sans, con su relleno y su halo.
- **Texto grande como umbral aplicable al texto de mood.** La previsión y las etiquetas miden **≥19px y son bold**: son "texto grande" de WCAG 1.4.3 y les corresponde 3:1 en vez de 4,5:1. Su halo da 4,07–9,48:1 contra el mar; los rellenos por sí solos no llegan (1,57–4,12:1). El título y «Leyenda» no dependen de ese umbral: 6,28:1 y 11,47:1 superan también el 4,5:1 del texto normal.
- **El marcador seleccionado no dibuja disco.** La selección la muestran la tarjeta —anclada junto al Pokémon en dos columnas, hoja inferior con el nombre del lugar en la composición apilada— y la barra de su fila. El marcador expone su estado con `aria-pressed`, y solo el foco de teclado le dibuja su anillo: un clic no deja ningún contorno.
- **Temperaturas del mapa.** Llevan un **contorno exterior `$color-near-black`** (16,6–18,4:1 contra los cuatro fondos del mapa), conservando por dentro el relleno y el trazo de su franja. Hace falta porque tres de las seis franjas tienen el trazo *claro* (blanco, verde, amarillo) y engrosarlo no aporta contraste.
- **Visibilidad de esas temperaturas.** Sólo se pintan cuando la caja del mapa alcanza **1150px**, punto en el que las cifras llegan a 12px. Por debajo miden entre 3,9 y 10,7px. No se agrandan en unidades de `viewBox` porque a 768px de mapa harían falta 19,4u y el texto sería más ancho que la separación entre lugares vecinos (61u). El suelo de 12px se mantiene aunque eso deje fuera anchos de 1366px: no se baja la legibilidad para encajar una resolución concreta.
- **`administrativeArea` como dato del modelo**, en el generador de lugares, no inferido de `name`.

## Criterios de aceptación

### Layout y escala

- [x] `html { font-size }` no depende del viewport. Ningún tamaño de la interfaz se deriva de `100vw` o `100vh`.
- [x] Ningún texto de la interfaz baja de 12px en ninguno de los ocho rangos verificados.
- [x] En los ocho rangos no hay scroll horizontal ni contenido cortado, y no queda una zona vacía por debajo de la composición.
- [x] Por debajo de 1200px la composición es de una columna; a partir de 1200px es la de dos columnas de la cuenta original, con título, previsión, leyenda y mapa en su sitio de siempre.
- [x] El mapa se ajusta al menor de su ancho disponible y su alto disponible, sin ninguna media query de orientación.
- [x] A partir de 1600px la composición deja de crecer y queda centrada.
- [x] El número de columnas de la leyenda y de la lista lo resuelve `auto-fit`, sin un breakpoint propio.

### Mapa y lugares

- [x] Los 74 lugares son alcanzables con el tabulador y se activan con Intro y con Espacio. Su orden es el del DOM, y es lógico —agrupados por comunidad o región, en el orden del catálogo—, estable —no cambia con la composición, el tamaño de pantalla ni la selección— y operable —se recorre entero, en los dos sentidos y sin trampas—.
- [x] **WCAG 4.1.2.** Cada marcador expone un **nombre accesible único que identifica el lugar** (`aria-label` o equivalente), además de su rol y su estado. Rol, `tabindex` y manejadores de Intro/Espacio no bastan por sí solos: sin nombre accesible, un lector de pantalla anuncia 74 botones indistinguibles.
- [x] Activar un marcador (clic, toque o teclado) muestra lugar, área administrativa, Pokémon, condición y mínima/máxima.
- [x] Una fila de la lista **selecciona el mismo lugar y produce el mismo resultado** que su marcador: mismo estado seleccionado —`aria-pressed` en la fila y en el marcador— y misma tarjeta. Verificado con un test que ejerce los dos caminos y compara el resultado.
- [x] El marcador seleccionado no dibuja disco ni ninguna otra marca propia; su estado está en `aria-pressed`.
- [x] Las filas de la lista miden al menos 56px de alto.
- [x] Las temperaturas sobre el sprite aparecen sólo cuando la caja del mapa alcanza 1150px, y en ese punto miden al menos 12px.
- [x] Ni `ROOT_VIEW_BOX` ni ninguna coordenada de `map-geometry.ts` cambia.
- [x] El contexto norteafricano muestra el mismo trazo que el resto de siluetas, sin costura visible entre Marruecos y Argelia.
- [x] Ningún `LocationMarker` de los 74 queda completamente oculto por otro, verificado con datos reales.

### Accesibilidad

- [x] **WCAG 1.4.4.** Al 200 % de zoom el contenido aumenta realmente de tamaño y no se pierde información ni funcionalidad. La ausencia de scroll bidimensional se verifica conforme a 1.4.10 hasta una anchura equivalente de 320 CSS px.
- [x] **WCAG 1.4.10 (Reflow).** A 400 % de zoom sobre 1280px —prueba equivalente a un ancho de 320 CSS px— el contenido sigue siendo utilizable en una sola columna, sin scroll en los dos ejes a la vez y sin pérdida de información ni de funcionalidad.
- [x] **WCAG 1.4.12 (Text Spacing).** Aplicando los overrides del criterio (interlineado 1,5×, espaciado entre párrafos 2×, entre letras 0,12em y entre palabras 0,16em) no hay pérdida de contenido, recortes ni solapes en ninguna de las dos composiciones.
- [x] **WCAG 2.4.11 (Focus Not Obscured, Minimum).** El elemento con el foco nunca queda completamente tapado por otro contenido. Se comprueba específicamente con `LocationCard` abierta —anclada junto al marcador en dos columnas y como hoja inferior en apilado— recorriendo los marcadores con el tabulador.
- [x] Todo elemento enfocable tiene un indicador de foco visible sobre mar, tierra clara y la ilustración de portada.
- [x] Ningún subárbol con el foco dentro queda marcado `aria-hidden`; la portada usa `inert` al salir.
- [x] El título «POKETIEMPO» se pinta en azul `#1B53BA` y el encabezado «Leyenda» en tinta `#323232`, sin halo ni trazo e iguales en los cinco moods: 6,28:1 y 11,47:1 contra el mar.
- [x] La línea de previsión y las etiquetas de la leyenda miden ≥19px, son bold, y su halo alcanza al menos 3:1 contra el fondo.
- [x] Las temperaturas del mapa alcanzan al menos 3:1 contra el mar, España, Portugal y Andorra.
- [x] **Validación visual al tamaño mínimo real** de que el halo de la previsión y de las etiquetas se percibe como contorno y no degrada el glifo. W3C contempla el halo o borde alrededor del texto como mecanismo válido de contraste; esta comprobación existe para confirmar que el grosor elegido lo consigue de hecho.
- [x] **Validación visual del título y «Leyenda» en los cinco moods**, en móvil y en escritorio: los glifos Unown se leen limpios, sin borde.
- [x] Los créditos (fuentes de datos y autoría original) son legibles sin zoom en los ocho rangos.
- [x] `Credits` queda fuera de `<main>` y expone el landmark `contentinfo` en un navegador real, no sólo en jsdom.
- [x] No se añade ARIA donde el HTML semántico ya resuelve. La única excepción admitida es el marcador, porque dentro de un SVG no existe `<button>`.
- [x] No hay trampas de teclado en ninguna escena del flujo.
- [x] Ninguna condición meteorológica se distingue sólo por color.

### Rangos verificados

- [x] Verificado en los ocho rangos — móvil pequeño vertical, móvil vertical, móvil horizontal, tablet vertical, tablet horizontal, portátil, escritorio y ultrawide — contra: overflow horizontal, overflow vertical, zoom al 200 %, navegación completa por teclado y tamaño de las áreas táctiles.

### Auditoría de conformidad

- [x] **Auditoría de todos los criterios A y AA de WCAG 2.2**, el listón que fija `mission.md`. El resultado se deja escrito en `008-plan.md`: criterio por criterio, cumple o no cumple, y **los no aplicables documentados uno a uno con su motivo** (por ejemplo, no hay vídeo, ni audio, ni formularios de entrada de datos, ni sesión con tiempo límite). Sin esta lista, "WCAG 2.2 AA" no es verificable.

### Higiene

- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.
- [x] `tech-stack.md` refleja lo que fija esta feature: la raíz fija, las dos composiciones con sus puntos de corte, y dónde se admiten `em` y `px`.
- [x] Ninguna aserción ni comportamiento esperado de `src/domain/` cambia; los fixtures de `Location` pueden incorporar `administrativeArea` para satisfacer el nuevo contrato obligatorio.

## Fuera de alcance

- **Disclaimer de Pokémon** — sigue pendiente en `roadmap.md`.
- **Búsqueda, filtros o agrupación de lugares** — `administrativeArea` deja la estructura preparada, pero no se construye ninguna de las tres aquí.
- **Criterios AAA de WCAG 2.2** — sólo se persigue el nivel AA. Los 44 × 44 px de 2.5.5 son la única meta de nivel AAA que el proyecto adopta, y lo hace como objetivo de diseño, no como compromiso de conformidad.
- **Zoom o desplazamiento dentro del mapa** — evaluado y descartado: alcanza los 44px pero impide ver la península entera, que es el primer requisito del mapa en móvil.
- **Leyenda colapsable** — descartada: es lo que hace que el chiste se entienda (`mission.md`), sólo tiene entre 6 y 10 entradas al día, y no hay un problema de espacio que justifique el patrón.
- **Cualquier cambio en reglas de asignación, pipeline, dominio meteorológico o contratos de datos meteorológicos.** `administrativeArea` es un campo descriptivo del lugar; ni un solo dato de previsión cambia.
