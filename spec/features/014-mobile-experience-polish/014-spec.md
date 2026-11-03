# 014 · Pulido de la experiencia móvil

**Estado:** completada. Verificada en Chromium (440 comprobaciones) y en Safari de iPhone SE (2022) real, con VoiceOver. El teclado externo en Safari real no se ha verificado y sus criterios siguen sin marcar (ver «Validación»).

## Qué hace

### Leyenda

- En la **composición apilada** —por debajo de `$breakpoint-desktop-columns`, incluido el escritorio compacto—, la leyenda deja el azul del mar y usa la misma banda clara que la atribución de los datos (`$map-attribution`).
- En **dos columnas**, desde `$breakpoint-desktop-columns`, recupera `$map-sea`.

### Detalle de una ubicación

- En la composición apilada, el detalle forma parte del **flujo del documento, justo debajo del mapa**. No flota sobre la página ni tapa nada.
- El botón **Cerrar (X) va al principio** de la fila del título, en la columna en la que se empieza a leer.
- Al seleccionar un lugar —desde su Pokémon en el mapa o desde su fila en «Todos los lugares»— la página **se desplaza hasta el comienzo del detalle**.
- Al cerrar el detalle desde la propia tarjeta, la vista **vuelve al elemento desde el que se abrió**: al marcador si se abrió desde el mapa, a la fila si se abrió desde la lista.
- El zoom del usuario —pinch o zoom del navegador— **no se cambia nunca**. El detalle no depende de `VisualViewport` ni de ningún ajuste especial para el pinch.
- En escritorio, la **tarjeta anclada** junto al marcador conserva su comportamiento: no se desplaza la página al abrirla.

### Selección visual

- Con un lugar seleccionado, **su Pokémon conserva los colores** y **todos los demás aparecen en silueta**, con el filtro SVG que el mapa ya usa para los lugares excluidos por filtros.
- Al seleccionar otro lugar, este recupera los colores y el anterior pasa a silueta.
- Al cerrar el detalle, todos recuperan los colores, salvo los que siguen excluidos por filtros.
- Las dos causas de silueta se distinguen en la interacción, no en el aspecto:
  - **Excluido por filtro:** silueta y sin marcador; ni se pulsa ni se enfoca, como hasta ahora.
  - **No seleccionado:** silueta, pero el marcador sigue montado, operable y enfocable si cumple los filtros.
- El comportamiento es el mismo seleccionando desde el mapa o desde la lista.

## Por qué

**Leyenda.** La atribución bajo el mapa ya es una banda clara sobre el mar. En la composición apilada, la leyenda volvía inmediatamente al azul y parecía empezar una superficie distinta de la que introduce la atribución. Unificarlas da continuidad a la banda que explica los datos y sus Pokémon.

**Detalle.** Una hoja inferior `position: fixed` está anclada al layout viewport. Con pinch-to-zoom puede quedar fuera de la vista, y si se la obliga a seguir al viewport visual, su capacidad en píxeles CSS se reduce con el cuadrado del zoom mientras su contenido no encoge: al 400 % queda una ventana de unos 94×116 px CSS que tapa tres cuartos de la pantalla, con el título partido a mitad de palabra. En el flujo del documento, el detalle mide lo que la página, se lee y se recorre como el resto del contenido ampliado, y el navegador lo lleva a la vista con un desplazamiento normal, sin tocar el zoom.

**Selección visual.** En un mapa con 74 Pokémon, el seleccionado se pierde entre los demás. Dejarlo como único en color lo localiza de un vistazo, también con zoom, y reutiliza un efecto que el mapa ya tiene.

## Decisiones de producto

- **Leyenda:** `$map-attribution` en toda la composición apilada; `$map-sea` desde `$breakpoint-desktop-columns`. Sin breakpoints nuevos, sin cambios de ancho, estructura ni DOM. El estado seleccionado conserva el borde `$ui-accent`, la caja blanca y el ✓.
- **Detalle en el flujo** bajo el mapa en la composición apilada, reutilizando el mismo componente `LocationCard` y la misma selección compartida. No hay una segunda interfaz.
- **X al principio** en la composición apilada. En escritorio, la tarjeta anclada mantiene la X al final.
- **Navegación:** desde marcador o fila, desplazamiento al comienzo del detalle; al cerrar desde la tarjeta, vuelta al origen. El origen pertenece al estado de React, no a variables globales.
- **Zoom:** nunca se desactiva, reinicia, reduce ni compensa.
- **Escritorio anclado:** sin cambios.
- **Selección visual:** seleccionado en color, resto en silueta con el filtro existente; excluidos por filtro sin marcador; no seleccionados operables.
- **Sin cambios** en la lógica de filtrado, los datos, la selección compartida, `aria-pressed`, la región viva ni la semántica de región de la tarjeta. Sin adornos, bordes ni animaciones nuevos.
- **Foco por teclado:**
  - **Puntero o toque** (incluido VoiceOver en iOS, que activa con un toque): la página se desplaza al detalle y el foco no se mueve.
  - **Teclado** (Intro o Espacio en el marcador; Intro o Espacio en la fila, es decir, la tecla seguida de su clic), solo cuando el detalle está en el flujo: la página se desplaza al detalle y el foco pasa a Cerrar. La tarjeta no es modal: no atrapa el foco, Tab y Mayús+Tab salen libremente, y Escape o Cerrar la cierran, devuelven el foco al origen y llevan la vista a él.
  - **Un clic sin esa tecla previa** —puntero, toque o una tecnología de asistencia que activa el botón— cuenta como puntero: el foco no se mueve. `click.detail` no se usa para distinguirlos, porque también es 0 cuando una tecnología de asistencia activa el botón.
  - **Tecla mantenida:** si el foco llega a Cerrar con la tecla aún pulsada, sus repeticiones no cierran la tarjeta.
  - **Escritorio anclado:** el foco se queda en el marcador, como ahora.
  - Motivo: sin esto, con teclado el foco queda en la fila, fuera de la vista, mientras la página muestra el detalle.

## Alcance

### 1. Leyenda

- El fondo de `.legend` es `$map-attribution` en la composición apilada y `$map-sea` desde `respond-from($breakpoint-desktop-columns)`, con tokens existentes.
- No cambian el ancho, el padding, las columnas, el orden, las etiquetas, los sprites ni el DOM de la leyenda, ni los fondos de cabecera, atribución, créditos o lista.
- Contrastes: `$ui-ink` sobre `$map-attribution` `11,28:1`; halo de mood mínimo `4,01:1`; `$ui-accent` `6,17:1`. El relleno blanco de la entrada pulsada queda en `1,14:1` y la distinguen el borde y el ✓.

### 2. Detalle en el flujo y navegación

- En la composición apilada, la tarjeta ocupa su lugar en el flujo, bajo el dibujo del mapa y antes de la atribución, con el ancho del mapa. No hay reserva de espacio en el documento ni `scroll-padding` para ella.
- La rejilla de la tarjeta coloca Cerrar antes del título en la composición apilada; el orden del DOM no cambia.
- Seleccionar desde un marcador o desde una fila desplaza la página hasta el comienzo del detalle. El desplazamiento ocurre una vez por cambio de selección y antes de pintar.
- Cerrar desde la tarjeta (Cerrar o Escape dentro de ella) vuelve al origen de la selección vigente. Si la selección cambió de vía (abierta desde una fila y después desde un marcador), manda la última.
- Cerrar desde fuera de la tarjeta (pulsando otra vez la fila o el marcador, Escape sobre ellos, o un filtro que excluye el lugar) no desplaza a ningún sitio. Si el detalle desaparece por encima de lo que el usuario está viendo, la posición de lo que ve se mantiene; Safari no ofrece scroll anchoring y la compensación es explícita.
- Escape, o Intro, en la fila con el detalle abierto lo cierra y deja el foco en esa fila. Si la fila quedó fuera de la vista al ir al detalle, se lleva a ella una vez compensado lo de debajo. Escape en el marcador hace lo mismo con el marcador; otros cierres desde el marcador (Intro, clic) no lo mueven. Con la tarjeta anclada no se mueve nada.
- Los filtros activos se conservan al abrir, cambiar y cerrar.
- En escritorio, la tarjeta anclada no desplaza la página al abrirse ni al cerrarse.

### 3. Selección visual

- Silueta = excluido por filtro **o** hay un lugar seleccionado y no es este.
- Marcador montado = no excluido por filtro. La selección no desmonta ni desactiva marcadores.
- Mismo filtro SVG que la sombra por filtros; sin colores, bordes ni animaciones nuevos.

### 4. Accesibilidad y compatibilidad

- La tarjeta sigue siendo una región con título accesible, no un diálogo. No se añade `role="dialog"` ni se atrapa el foco.
- Se mantienen los nombres accesibles, `aria-pressed`, la región viva, Escape y el orden de foco.
- El foco nunca queda oculto por contenido del autor. Con la política de teclado, tampoco queda fuera de la vista tras un desplazamiento programático.
- El zoom de navegador al 200 % y al 400 % es usable por reflow, sin scroll horizontal.
- No hay dependencias nuevas, ni cambios de datos, pipeline, geometría del mapa o asignación de Pokémon.
- No se usa `VisualViewport`. Leer qué presentación eligió el CSS para la tarjeta (anclada o en el flujo) decide si desplazar, no la maquetación.

## Criterios de aceptación

### Leyenda

- [x] En la composición apilada, incluido el escritorio compacto, a 320, 480, 768, 1200 y 1360 px, el fondo computado de `.legend` es `$map-attribution`.
- [x] En dos columnas, desde el corte real de `$breakpoint-desktop-columns` y a 1600 px, es `$map-sea`.
- [x] Sin breakpoints nuevos, sin cambios de ancho o estructura, sin literales de color.
- [x] La entrada seleccionada se distingue por el borde azul y el ✓.
- [x] Capturas de 667×375, 844×390, 768×500 y 1180×820 revisadas; sin recortes, solapes ni scroll horizontal.

### Detalle y navegación

- [x] En la composición apilada, el detalle aparece en el flujo bajo el mapa, sin `position: fixed`, sin reserva de espacio y con Cerrar al principio.
- [x] En escritorio, la tarjeta anclada, su X al final y su comportamiento no cambian.
- [x] Desde un marcador, a 100 % y con pinch al 400 %, la página se desplaza al comienzo del detalle y el zoom no cambia.
- [x] Desde una fila, a 100 % y con pinch al 400 %, la página se desplaza al comienzo del detalle; marcador y fila quedan pulsados.
- [x] Cerrar desde la tarjeta tras abrir desde una fila devuelve la vista a esa fila; tras abrir desde un marcador, a ese marcador; en ambos casos con el mismo zoom y los mismos filtros.
- [x] Cambiar de lugar entre vías muestra el nuevo lugar y el cierre vuelve al último origen.
- [ ] Pulsar otra vez la fila, Escape sobre ella o un filtro que excluye el lugar abierto no producen saltos en lo que el usuario ve, en Chromium con y sin `overflow-anchor` y en Safari.
  _Verificado en Chromium con y sin `overflow-anchor`, y en Safari pulsar otra vez la fila y los filtros. Sin confirmar: Escape sobre la fila en Safari real (requiere teclado externo)._
- [x] Ningún desplazamiento inesperado ni error de consola.

### Selección visual

- [x] Con un lugar seleccionado, solo su Pokémon está en color; los demás, en silueta.
- [x] Cambiar de lugar intercambia color y silueta; cerrar devuelve los colores, salvo a los excluidos por filtro.
- [x] Los marcadores en silueta por selección siguen montados, enfocables y operables; los excluidos por filtro no tienen marcador.
- [x] `aria-pressed`, la selección compartida y el filtrado no cambian.

### Teclado y accesibilidad

- [x] El comportamiento de foco por teclado coincide con la política aprobada.
- [x] Escape en una fila o en un marcador con el detalle abierto lo cierra y deja esa fila o ese marcador a la vista y enfocado, sin alterar la compensación de scroll de los filtros.
- [x] Una activación sin teclas (puntero, toque, tecnología de asistencia) no mueve el foco.
  _Verificada en Chromium, en los tests y con VoiceOver real en iPhone SE (2022)._
- [x] Tab y Mayús+Tab nunca quedan atrapados; Escape cierra y devuelve el foco al origen; el foco nunca queda oculto.
- [x] La región, su título, la región viva y el orden de foco se mantienen.
- [x] El zoom de navegador al 200 % y 400 % mantiene la tarjeta usable, sin scroll horizontal.

### Compatibilidad y validación

- [x] Funciona en 320, 480, 768, 1200 y 1600 px sin scroll horizontal, y con el espaciado de texto de 1.4.12.
- [x] No se añaden dependencias, no cambian los datos y no se llama a AEMET en runtime.
- [x] La validación automatizada en Chromium y la validación real en Safari de iPhone se registran por separado.

## Decisiones sustituidas

- **Hoja inferior `position: fixed` que seguía al viewport visual, con excepción de `VisualViewport` en `tech-stack.md`.** Sustituida: en Safari de iPhone con pinch al 400 % la hoja quedaba reducida a una ventana estrecha y alta, con el título partido a mitad de palabra y el cierre ocupando media tarjeta. Al no usarse `VisualViewport`, la excepción en la constitución deja de ser necesaria.
- **Hoja a escala de página anclada a lo visible (C) y su variante con un cierre que seguía al borde visible (C′).** Descartadas: en C, el cierre quedaba a unas tres pantallas en horizontal al 400 %; en C′, abrir desde el este del mapa mostraba la tarjeta vacía.
- **Al seleccionar desde la lista, la fila se queda quieta.** Sustituida por desplazarse al detalle y volver a la fila al cerrar.

## Fuera de alcance

- Convertir la tarjeta en diálogo modal o atrapar el foco.
- Cierres flotantes, contraescalado o cualquier uso de `VisualViewport`.
- Desactivar, reiniciar, reducir o compensar el zoom.
- Cambiar la tarjeta anclada de escritorio.
- Cambiar la lógica de filtrado, los datos, la geometría del mapa o la asignación de Pokémon.
- Modificar `tech-stack.md`, `mission.md` o `roadmap.md`.

## Validación

### Chromium (automatizada, sobre el build de producción)

440 comprobaciones, todas correctas y sin avisos de consola. El pinch es la emulación de Chromium (`Emulation.setPageScaleFactor`), no Safari.

| Área | Comprobaciones |
|---|---:|
| Leyenda: fondos computados, capturas, entrada seleccionada | 21 |
| Anchuras (320 a 1600, retrato y paisaje), pinch al 400 %, zoom de navegador al 200 y 400 %, espaciado de texto | 95 |
| Navegación marcador y fila ↔ detalle, cambio de vía, escritorio | 134 |
| Filtros con el detalle abierto, con y sin `overflow-anchor` | 52 |
| Siluetas, con y sin filtros | 20 |
| Teclado, escritorio y consola | 118 |

### Safari de iPhone real (build del repositorio principal, servido por la red local)

- **Dispositivo:** iPhone SE (2022), con la última versión de iOS disponible (el número de versión no se facilitó).
- **Pasos propuestos:**
  1. Apertura desde la lista, a 100 % y con pinch alto, en retrato y en paisaje.
  2. Apertura desde un marcador, con el mismo recorrido.
  3. Cerrar vuelve al origen con el mismo zoom y los mismos filtros; cambiar de lugar entre mapa y lista.
  4. Filtros que excluyen el lugar abierto (búsqueda, zona, condición de la leyenda, «Limpiar filtros») y pulsar otra vez la fila.
  5. Siluetas: seleccionado en color, cambio de lugar, cierre, silueta operable, excluidos sin marcador.
  6. VoiceOver, si está disponible.
  7. Teclado externo, si está disponible.
- **Resultado comunicado por el usuario:** todas las comprobaciones realizadas pasaron, sin incidencias, incluido VoiceOver (paso 6). No se comunicó ninguna diferencia respecto a Chromium.
- **Sin confirmar:** el paso 7 (teclado externo) y, con él, Escape sobre una fila y sobre un marcador en Safari real; la versión exacta de iOS. Mientras no se confirmen no se dan por superados.
