# 009 · Exploración de los 74 lugares

**Estado:** cerrada.

## Qué hace

La lista de los 74 lugares es la forma de explorar el mapa:

- **Buscar** escribiendo parte del nombre del lugar, de su provincia o distrito, de su zona, de su Pokémon o de su condición, sin preocuparse de tildes, eñes ni mayúsculas.
- **Filtrar por zona**: una comunidad o ciudad autónoma, toda España, Portugal o Andorra.
- **Filtrar por condición desde la propia leyenda**: cada Pokémon de la leyenda se puede pulsar, y se pueden pulsar varios a la vez.
- **Ordenar** por zona, alfabéticamente, por la máxima más alta o por la mínima más baja. Los dos órdenes de temperatura agrupan los lugares por las mismas franjas que colorean las cifras del mapa.
- Ver **cuántos lugares quedan**, qué filtros hay activos —cada uno se quita por separado— y **limpiarlos todos** de una vez.
- Un **estado sin resultados** propio: la silueta de Castform con un «?», «Ni rastro por aquí» y un botón para empezar de cero.

**El mapa responde al filtro.** Los lugares que coinciden se quedan como siempre; el resto pasa a sombra —la silueta de su Pokémon, apagada— y deja de poder seleccionarse. Sin ningún filtro activo, el mapa es exactamente el de la 008.

**La exploración tiene color propio.** Barra, controles, filtros, grupos, filas y estado vacío usan tres colores de la paleta de pokemon.com —tinta, nube y azul— y ninguno de los del tiempo: el mood y las franjas siguen significando lo mismo que antes.

## Por qué

Con 74 filas seguidas, la lista cumple como alternativa textual del mapa y como segunda vía de selección (008), pero no sirve para explorar: encontrar un lugar concreto exige recorrerla entera, y preguntas como «¿dónde hace más calor?» o «¿dónde hay oleaje?» no tienen respuesta directa ni en la lista ni en el mapa.

Que el filtro se vea también en el mapa responde a esas preguntas donde el usuario ya está mirando, y convierte la leyenda, que explica qué significa cada Pokémon, en el control natural de la condición, sin repetirla en ningún otro sitio. `mission.md` pide respetar la idea de la cuenta original: en reposo el mapa sigue siendo el del post, y solo cambia mientras el usuario filtra.

## Decisiones

- **El filtro se refleja en el mapa**, frente a filtrar solo la lista y dejar el mapa intacto. Esa alternativa obligaba a una fila de chips de condición que, en móvil, repite la leyenda que queda justo encima; dejaba al mapa y a la lista contando cosas distintas a la vez; y rompía la equivalencia de la 008 (ver la regla siguiente).
- **Un marcador está activo si y solo si su fila está en la lista.** Es lo que mantiene en pie la excepción «Equivalent» de WCAG 2.5.8, en la que se apoyan los marcadores de menos de 24px (008): con cualquier combinación de filtros, cada marcador operable tiene a la vista una fila que hace lo mismo. Los que no coinciden pasan a sombra y salen del orden de tabulación y del árbol de accesibilidad.
- **La leyenda es el filtro de condición.** Cada entrada es un botón con estado pulsado, y varias pulsadas suman: un lugar aparece si tiene cualquiera de ellas. La leyenda muestra solo los Pokémon del día, en el mismo orden que en la 005, y sin nada pulsado solo se nota el hueco reservado para el ✓.
- **La entrada pulsada, en tres columnas: sprite, etiqueta y estado.** Pulsada lleva borde azul, caja blanca y un ✓ azul pixelado, sin fondo, en su propia columna. Esa columna y el borde se reservan también en reposo, así que pulsar o soltar no mueve ni ensancha nada. La reserva ensancha la columna de la leyenda.
- **Dos sistemas de color.** El mood y las franjas de temperatura son significado meteorológico y no cambian. La interfaz —lo que se escribe, se pulsa o se elige— usa tres colores de la paleta de pokemon.com: tinta `#323232`, nube `#F5F5F5` y azul `#1B53BA`, además del blanco. Los otros seis se descartan porque repiten un color que ya significa algo: el rojo y el naranja son calor y niveles de aviso, el dorado y el morado son trazos de franja, el celeste es el mood frío y el segundo gris es la misma tinta.
- **Una regla de estado para todos los controles.** Reposo: blanco con borde de tinta. Hover: el control toma el azul sin rellenarse. Elegido: azul con una señal que no es color —▸ en el orden, ✕ en los filtros activos, ✓ en la leyenda, la barra en la fila—. Foco: el anillo de la 008, el mismo en toda la app, que por eso no es azul.
- **La fila seleccionada, en azul**, y no en el celeste del mood frío, que es significado meteorológico. El marcador seleccionado no lleva disco (008): la selección la muestran su fila y la tarjeta.
- **Zona: comunidad o ciudad autónoma en España; el país entero en Portugal y Andorra.** Es un dato nuevo del modelo de lugares, rellenado a mano como `administrativeArea` (008) y no inferido. Filtrar solo por país dejaría grupos de 65, 8 y 1 lugares: no ayuda a explorar.
- **Temperatura por agrupación, no por rango.** Ordenar por máxima o por mínima agrupa por franja. No hay deslizadores ni campos de rango, que convertirían la lista en un panel de control.
- **La selección no sobrevive a un filtro que la excluye.** Si el lugar seleccionado deja de coincidir, la tarjeta se cierra: su marcador pasa a sombra y su fila desaparece.
- **Nada se guarda**, ni en la URL ni en el navegador: cada visita empieza con los 74 lugares. `mission.md` descarta favoritos y cuentas, y la página no tiene routing.

## Criterios de aceptación

### Búsqueda y filtros

- [x] La búsqueda encuentra un lugar por su nombre, su provincia o distrito, su zona, su Pokémon o su condición, sin distinguir tildes, eñes ni mayúsculas: «coruna», «AVILA», «charmander» y «oleaje» encuentran A Coruña, Ávila, los lugares con Charmander y los lugares con oleaje.
- [x] Una búsqueda de varias palabras exige que aparezcan todas.
- [x] Buscar no selecciona ningún lugar por su cuenta, aunque quede un solo resultado.
- [x] El filtro de zona ofrece «Todas las zonas», «Toda España», las 19 comunidades y ciudades autónomas, Portugal y Andorra.
- [x] Cada Pokémon de la leyenda es un botón con estado pulsado. Con varios pulsados aparecen los lugares de cualquiera de ellos.
- [x] Los filtros se combinan: un lugar aparece si cumple a la vez la búsqueda, la zona y la condición.
- [x] El recuento —«8 de 74 lugares», «74 lugares» sin filtros o «Ningún lugar coincide»— está siempre a la vista y se anuncia a los lectores de pantalla cuando cambia, sin anunciar cada tecla.
- [x] Cada filtro activo aparece como un botón que lo quita. «Limpiar filtros» los quita todos y conserva el orden elegido.
- [x] Sin resultados, la lista muestra la silueta de Castform con «?», el título «Ni rastro por aquí», una frase que invita a quitar filtros y el botón «Limpiar filtros». Con resultados, ese bloque no está en el DOM.

### Orden y grupos

- [x] Cuatro órdenes: Zona (por defecto), A–Z, Más calor y Más frío.
- [x] «Zona» agrupa por zona —las de España en orden alfabético, después Portugal y Andorra— y ordena alfabéticamente dentro de cada grupo.
- [x] «Más calor» ordena por la máxima de mayor a menor y agrupa por las franjas de temperatura del mapa, con su rango escrito («Máxima de 35° o más», «Máxima entre 26° y 34°»…). «Más frío» hace lo mismo con la mínima, de menor a mayor.
- [x] Cada grupo tiene un encabezado real con su número de lugares. «A–Z» es una sola lista, sin encabezados.
- [x] Un lugar sin previsión va al final en los órdenes de temperatura, en su propio grupo.

### El mapa responde

- [x] Sin filtros activos, el mapa y sus 74 marcadores son los de la 008, y la leyenda solo añade el hueco reservado para el ✓.
- [x] Con filtros, los marcadores que coinciden quedan como siempre y el resto se pinta como silueta apagada, sin temperaturas.
- [x] **Equivalencia.** Con cualquier combinación de filtros, los marcadores operables son exactamente los lugares de las filas de la lista. Verificado con un test que recorre varias combinaciones y compara los nombres de ambos.
- [x] Un marcador en sombra no recibe el foco, no se activa con clic ni con toque y no aparece en el árbol de accesibilidad.
- [x] Si el lugar seleccionado deja de coincidir, la selección se anula y la tarjeta se cierra.
- [x] En la leyenda, con algún Pokémon pulsado, el resto pasa a silueta y sigue siendo pulsable.

### Paleta y estados

- [x] Barra, controles, filtros activos, encabezados de grupo, filas y estado vacío usan solo tinta, nube, azul y blanco. Ningún control usa un color de mood ni de franja; en la lista, lo único con color de significado es la muestra de franja de los encabezados.
- [x] La banda «Todos los lugares» va en tinta, con el texto blanco y una Poké Ball dibujada en trazo blanco.
- [x] Cada control distingue reposo, hover, elegido y foco con la regla de estado, y lo elegido lleva siempre una señal que no es color.
- [x] Una entrada pulsada de la leyenda lleva borde azul, caja blanca y el ✓ azul pixelado en su columna de estado. Pulsar y soltar no cambia el ancho ni la posición de nada.
- [x] Con la columna de estado reservada, ninguna de las 25 etiquetas posibles se parte, en las dos composiciones; y a 1200px el mapa sigue midiendo al menos los 880px del objetivo de 44px.
- [x] La fila seleccionada lleva la barra y el fondo azules, y la fila bajo el puntero, el azul al 6 %.

### Teclado y accesibilidad

- [x] Un enlace «Saltar al buscador», visible al recibir el foco, precede a la leyenda y al mapa.
- [x] Los controles son nativos —`input type="search"`, `select`, radios y botones— y todos tienen etiqueta visible.
- [x] «Ordenar» es una sola parada de tabulación y se cambia con las flechas.
- [x] Al quitar un filtro, el foco pasa al siguiente filtro activo si existe; si no, al anterior; si no queda ninguno, al buscador. Tras «Limpiar filtros», al buscador.
- [x] Escape dentro del buscador lo vacía.
- [x] Todos los controles nuevos miden al menos 44 × 44px y muestran el anillo de foco de la 008.
- [x] El estado pulsado de la leyenda y el orden elegido no se distinguen solo por color.
- [x] Contrastes medidos y anotados en el plan: 4,5:1 en el texto nuevo (3:1 si es texto grande) y 3:1 en los bordes de los controles.
- [x] La matriz WCAG 2.2 A y AA de `008-plan.md` queda al día en los criterios que cambian con esta feature.
- [x] HTML semántico: encabezados de grupo, listas reales, `fieldset` con `legend` y etiquetas asociadas.
- [x] La información del mapa sigue disponible en forma textual: la lista muestra siempre exactamente los lugares activos del mapa.

### Responsive

- [x] Sin puntos de corte propios: buscador, zona y orden comparten fila cuando caben y se reparten en varias cuando no. A 320px, uno por fila y el orden en 2 × 2.
- [x] Funciona en los 5 breakpoints (320 / 480 / 768 / 1200 / 1600px) y en los ocho rangos de la 008: sin scroll horizontal ni recortes, zoom al 200 % funcional, 1.4.10 hasta 320 CSS px y 1.4.12 con los cuatro valores del criterio.
- [x] **2.4.11**: con la tarjeta abierta, ningún control nuevo con el foco queda tapado por la hoja inferior.

### Datos e higiene

- [x] Los 74 lugares tienen zona, y el conjunto de zonas es exactamente el de las 19 comunidades y ciudades autónomas, Portugal y Andorra.
- [x] Ningún dato meteorológico, regla de asignación ni contrato de `forecast.json` cambia.
- [x] Ninguna decisión de maquetación se toma en JS a partir del viewport, la orientación o el dispositivo.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Fuera de alcance

- Guardar filtros u orden entre visitas (URL, `localStorage`), favoritos o compartir un filtro.
- Filtros por rango numérico de temperatura, precipitación o viento, y filtros por nivel de aviso.
- Zoom, desplazamiento o encuadre automático del mapa al filtrar.
- Filtrar por los Pokémon que `assignPokemon` asigna a un lugar pero no se dibujan: la condición de un lugar es la de su Pokémon visible, la misma que muestran la leyenda, la fila y la tarjeta.
- Cambios en Oak, la portada, el pipeline, las reglas de asignación o el dominio meteorológico.
