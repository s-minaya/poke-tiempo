# 010 · Frescura y contexto temporal de la previsión

**Estado:** cerrada.

## Qué hace

La página dice siempre **qué fecha muestra el mapa y cuán fresca es**, sin prometer «hoy» ni «mañana» como concepto fijo:

- La cabecera dice **«Previsión para el lunes 5 de octubre»**: la fecha del dataset, no la del calendario del usuario.
- Junto a ella, una **etiqueta relativa** —**HOY** o **MAÑANA**— cuando la previsión está al día. La etiqueta se calcula comparando la fecha del dataset con la fecha actual en `Europe/Madrid`.
- Debajo de la fecha, como información secundaria, **cuándo se generó la previsión**, en hora peninsular: «Previsión generada el domingo 4 de octubre a las 13:34 (hora peninsular)». Las fuentes siguen en los créditos.
- Con **un día de retraso**, el mapa sigue visible, la cabecera lo dice con texto, el Profesor Oak no aparece y ningún aviso oficial se presenta como vigente.
- Con **dos días de retraso o más**, lo mismo, con un aviso de frescura más fuerte antes del mapa.
- Si una página que **estaba al día al cargarse** pasa después a estar atrasada mientras sigue abierta o se restaura, se ofrece **recargar**.
- Si la relación entre el reloj del dispositivo y el dataset **no es fiable**, la página muestra la fecha y la hora de generación, y nada más sobre su frescura.
- **Oak no usa expresiones cuyo significado dependa del momento de lectura**: ni «hoy», «mañana», «ayer», «anoche» o «anteayer», ni frases como «esta tarde» o «estamos a lunes». Sitúa el día anclado a la fecha de la previsión —«el lunes», «el lunes 5 de octubre», «durante la tarde del lunes», «la noche del lunes»—. Y solo aparece con la previsión al día.
- El botón **EMPEZAR** de la portada tiene fondo `rgb(15, 58, 50)` con texto blanco, y un halo blanco por fuera de su borde que lo distingue sobre cualquier zona de la ilustración.
- Los **créditos** son un pie de página simple, lo último de la página en las dos composiciones: a todo el ancho, sobre el fondo de la página y separados de la lista por una línea, sin esquinas redondeadas.
- El **favicon** es el icono de Poketiempo —una Poké Ball con el sol y las nubes—, sin fondo alrededor de su cuadrado redondeado.
- En escritorio, el **mapa** crece hasta caber entero bajo la cabecera, y sus **cifras de temperatura** son algo mayores y aparecen con mapas más pequeños.
- En escritorio, la **leyenda** mide lo mismo que el mapa: sus entradas se reparten ese alto, sin scroll, y la lista de lugares empieza justo debajo del mapa. Solo cuando ni con las entradas juntas caben todas, la leyenda sobresale lo justo y la lista empieza tras ella.

**Regla central:** la fecha del dataset manda. La interfaz explica qué fecha está mostrando y cuán fresca es; nunca intenta fingir que unos datos antiguos son actuales.

## Por qué

El pipeline publica cada día la previsión del día siguiente (D+1), y la publicación no tiene hora garantizada:

- La ejecución programada para las 06:00 UTC arranca horas después: medida entre el 25 de septiembre y el 5 de octubre de 2026, el mapa nuevo se publica entre las 12:34 y las 14:19 de Madrid. Cada día el mapa enseña la previsión de hoy durante unas 13 horas y la de mañana durante unas 11.
- Si una ejecución falla, sigue en línea la previsión de un día anterior, con sus avisos ya caducados.
- Una pestaña puede quedarse abierta de un día para otro.

Un texto que dijera «hoy» sería falso buena parte del tiempo, y una previsión atrasada parecería actual.

`mission.md` pide que la broma se entienda sin explicación: no puede apoyarse en una fecha engañosa. Y un fallo del pipeline deja en línea la previsión anterior (`tech-stack.md`): la página la presenta como lo que es.

## Qué sabe la página

La página no consulta la red, así que solo conoce cuatro cosas, y solo describe esas:

- el dataset que contiene;
- su fecha, `forecast.date`;
- su instante de generación, `forecast.generatedAt`;
- el instante actual que da el reloj del dispositivo.

No sabe qué hay publicado en el servidor. Ningún texto afirma que su dataset sea, o fuera al cargarse, el más reciente publicado, ni que exista uno más nuevo.

## Estados de frescura

Todos se calculan con el calendario de `Europe/Madrid`. «Hoy» es la fecha de Madrid del instante actual. La diferencia se cuenta en días de calendario —fecha del dataset menos fecha de hoy—, nunca en horas, para que los días de 23 y 25 horas del cambio de hora no la alteren.

| Estado | Cuándo | Etiqueta | Texto en la cabecera | Aviso antes del mapa | Oak |
|---|---|---|---|---|---|
| `tomorrow` | Diferencia +1 | MAÑANA | — | No | Puede aparecer |
| `today` | Diferencia 0 | HOY | — | No | Puede aparecer |
| `late` | Diferencia −1 | ATRASADA | Sí | No | No aparece |
| `very-late` | Diferencia −2 o menos | ATRASADA | — | Sí | No aparece |
| `unknown` | Diferencia +2 o más, o el instante actual más de 15 minutos anterior a la generación | Ninguna | — | No | No aparece |

- **Al día** significa `today` o `tomorrow`, y no depende de la hora de generación: una previsión para hoy generada ayer a mediodía está al día.
- **`unknown`** significa que no se puede confiar en la relación entre el reloj del dispositivo y el dataset. El pipeline nunca publica una fecha más allá de mañana, y ningún dataset puede haberse generado después del instante actual: si el reloj dice lo contrario, el reloj está mal. La página muestra la fecha absoluta y la hora de generación, sin etiqueta, sin aviso de retraso y sin Oak; el mapa, la leyenda, la lista y la tarjeta funcionan con normalidad. Un reloj adelantado no se puede detectar sin red, y no se intenta.
- **Fresca al cargar** significa que el estado en el momento de cargar la página era `today` o `tomorrow`. Es lo único que habilita la oferta de recargar, y no cambia durante la vida de esa carga: una página que carga en `unknown`, pasa después a estar al día y luego a atrasada no ofrece recargar, porque no estuvo fresca al cargar.
- La hora de generación se muestra en todos los estados.

### Textos

| Situación | Texto |
|---|---|
| Fecha, en cualquier estado | «Previsión para el sábado 3 de octubre» |
| Hora de generación, en cualquier estado | «Previsión generada el viernes 2 de octubre a las 13:38 (hora peninsular)» |
| `late`, en la cabecera | «Esta previsión corresponde al sábado 3 de octubre y lleva 1 día de retraso.» |
| `very-late`, aviso antes del mapa | «Esta previsión lleva 3 días de retraso. Corresponde al sábado 3 de octubre.» |
| Página fresca al cargar que pasa a `late` o `very-late` | «Esta página sigue mostrando la previsión del lunes 5 de octubre. Recarga para comprobar si hay una más reciente.» y el botón «Recargar» |

Fuera de las etiquetas HOY y MAÑANA y de su anuncio accesible equivalente en la región viva, ningún otro texto de la interfaz usa «hoy», «mañana» ni «ayer» como referencia relativa: el retraso se explica con la fecha absoluta y el número de días.

## Decisiones

- **El pipeline sigue publicando D+1.** Publicar hoy, mañana y pasado queda fuera de esta feature: cambia el contrato de la 002, el motor de la 003 y Oak, y merece la suya.
- **`Europe/Madrid` es la única referencia temporal del producto.** El pipeline decide el día con ella. La página convierte el instante actual a la fecha de Madrid sin usar la zona horaria del dispositivo. En Canarias y Portugal, entre las 23:00 y las 24:00 locales, la etiqueta ya habla del día siguiente: es el precio de una referencia única.
- **La fecha del dataset es la fuente de verdad.** La página nunca deduce qué día «debería» mostrar ni oculta un dataset por antiguo.
- **El mapa nunca se oculta por estar atrasado ni por un reloj en el que no se puede confiar.** Sigue siendo la previsión correcta de su fecha.
- **La hora secundaria es la de generación del forecast**: `generatedAt`, el instante de generación del forecast, fijado justo antes de escribir `forecast.json`, después de obtener y validar el dataset. No es la hora en que se consultó cada proveedor. Va en la cabecera, debajo de la fecha, porque sirve para interpretar su frescura. Las fuentes siguen en los créditos.
- **Ninguna petición de red nueva, y ninguna afirmación sobre lo publicado.** Ver «Qué sabe la página». Solo se sugiere recargar «para comprobar».
- **Recargar se ofrece por un cambio de estado, no por tiempo.** La oferta aparece cuando una página fresca al cargar pasa a `late` o `very-late` mientras sigue abierta o se restaura: el día ha cambiado con la pestaña abierta, y recargar es la forma de comprobar qué hay. Una página que ya carga en `late`, `very-late` o `unknown` no la ofrece, por mucho tiempo que lleve abierta. No hay umbral de minutos.
- **Oak solo con la previsión al día.** Aparece con `today` o `tomorrow`. Con `late`, `very-late` o `unknown` no aparece: la capa narrativa y sus avisos no se presentan cuando la previsión está atrasada o su frescura no se puede establecer.
- **Los avisos oficiales solo se presentan a través de Oak.** Ningún otro componente los nombra: los Pokémon que dependen de un aviso —Hippowdon por calima y Mega-Gyarados por aviso rojo costero— se etiquetan por su condición, «Calima» y «Oleaje muy fuerte», como parte de la previsión de esa fecha. Sin Oak, ningún aviso se presenta como vigente.
- **Oak no usa expresiones relativas al momento de lectura: dos listas y una regla, un solo contrato.**
  - **Palabras**, exactamente cinco: «hoy», «mañana», «ayer», «anoche» y «anteayer». «Mañana» se rechaza también cuando significa la franja del día: es una restricción intencionada para evitar ambigüedad.
  - **Frases relativas inequívocas**, exactamente cuatro: «esta mañana», «esta tarde», «esta noche» y «esta madrugada».
  - **«Estamos a» seguido de una fecha**: un día de la semana («estamos a lunes») o un día y un mes («estamos a 5 de octubre»). «Estamos a» solo no se rechaza: «estamos a 30 grados» o «estamos a 1000 metros» no hablan del momento de lectura.
  - Se detectan por palabra o frase completa, sin distinguir mayúsculas ni tildes, y la detección dice qué expresión encontró. No se incluyen palabras genéricas como «esta», «este» o «ahora», que darían falsos positivos.
  - Están permitidas las expresiones ancladas a la fecha de la previsión: «el lunes», «el lunes 5 de octubre», «durante la tarde del lunes», «la noche del lunes». «La mañana del lunes» sigue rechazada por la palabra «mañana».
  - Los claims, el respaldo local, el prompt, la guarda factual y `readOakToday` usan las mismas listas y la misma regla. No se añade ninguna palabra, frase ni regla sin decisión del usuario.
- **Un `oak-today.json` con una expresión prohibida no se muestra.** La página se salta la escena de Oak y entra directa al mapa: es una degradación segura.
- **Sin colores nuevos en la frescura.** La etiqueta relativa, la marca de atrasada y los avisos usan la paleta de interfaz —tinta, nube, blanco—. Al día la etiqueta es clara; atrasada, invertida y con un icono de reloj. La fuerza del aviso de dos días o más la dan su posición, su tamaño, su icono y su texto, sin rojo ni naranja. La fecha conserva el color de mood. El mapa no se oculta ni se desatura.
- **EMPEZAR, en `rgb(15, 58, 50)` con texto blanco.** Es un color de identidad de la portada decidido por el usuario, no un color del tiempo ni de estado. El blanco es de la paleta y da 12,56:1 sobre ese fondo; el casi negro se quedaría en 1,50:1. La ilustración tiene zonas claras y oscuras, y el borde #111 se pierde sobre las oscuras: un halo blanco de 2 px por fuera del borde, con el que contrasta a 18,88:1, mantiene el contorno visible en todas (1.4.11). El foco lo sustituye por el anillo de la portada.
- **Créditos al final de la página, sin pastilla.** Decidido por el usuario. En las dos composiciones van bajo la lista: el orden visual coincide con el del documento, donde son lo último. Un pie simple a todo el ancho de la composición: el texto en `$ui-ink` sobre el fondo de la página, `$map-sea`, con una línea de `$ui-ink` encima. Sin colores nuevos. Siguen siendo el `<footer>` fuera de `<main>`, el `contentinfo` de la página, con el mismo contenido.
- **El favicon, el icono de Poketiempo.** Decidido por el usuario. Fuera de su cuadrado redondeado es transparente; el blanco de dentro —el aro, el botón y las nubes— se conserva.
- **El mapa de escritorio, entero bajo la cabecera.** Decidido por el usuario. Su tope de alto es la ventana menos la cabecera, así que se ve entero en la primera pantalla; con el 80 % de la ventana de la composición apilada, en los portátiles habituales mediría un 4–7 % menos. A 1200px lo limita el ancho que deja la leyenda. En la composición apilada el tope es el 80 %.
- **Cifras del mapa a 14 unidades de `viewBox`.** Decidido por el usuario. Con los datos medidos, ningún par de cifras vecinas se pisa; a 15 ya se tocan las de Cuenca y Tarancón. Con el suelo de 12px de la 008, aparecen con un mapa de 1063px, y en desktop large miden 14,6px.
- **La leyenda de escritorio, con el alto del mapa y sin scroll.** Decidido por el usuario. La lista conserva su banda a todo el ancho. Las entradas se reparten el alto del mapa con el aire entre ellas, desde la separación habitual hasta ninguna, y el texto conserva su tamaño. Los días en que ni así caben todas, la leyenda sobresale lo que piden sus entradas juntas y la lista empieza tras ella. Ninguna entrada se oculta.
- **Los Pokémon de la leyenda de escritorio, a 44px y todos iguales.** Decidido por el usuario. Es el tamaño de los del mapa a 1200px y el objetivo de diseño de la 008. Un sprite que siguiera el alto de su entrada saldría mayor en las de etiqueta de dos líneas, más altas, cuando la leyenda va justa.
- **`mission.md` describe la fecha de la previsión publicada**, sin promesa fija de hoy, con el pipeline D+1 como contrato vigente. Los documentos de features anteriores no se reescriben.

## Criterios de aceptación

### Fecha, etiqueta y hora de generación

- [x] La cabecera dice «Previsión para el [día de la semana] [día] de [mes]» con la fecha de `forecast.date`, en cualquier estado y sea cual sea el reloj del dispositivo.
- [x] Con `today` aparece la etiqueta HOY; con `tomorrow`, MAÑANA; con `late` o `very-late`, ATRASADA; con `unknown`, ninguna.
- [x] La etiqueta se lee junto a la fecha con lector de pantalla, como parte de la misma frase.
- [x] Debajo de la fecha, en cualquier estado, «Previsión generada el [día de la semana] [día] de [mes] a las [HH:MM] (hora peninsular)», calculada en `Europe/Madrid` a partir de `forecast.generatedAt`.
- [x] Fuera de las etiquetas HOY y MAÑANA y de su anuncio accesible equivalente en la región viva, ningún otro texto de la interfaz usa «hoy», «mañana» ni «ayer» como referencia relativa.
- [x] Ningún texto afirma que el dataset de la página sea o fuera el más reciente publicado, ni que exista uno más nuevo.

### Retraso

- [x] Con `late`, la cabecera dice «Esta previsión corresponde al [fecha] y lleva 1 día de retraso.».
- [x] Con `very-late`, un aviso antes del mapa dice «Esta previsión lleva [N] días de retraso. Corresponde al [fecha].». Con cualquier otro estado, ese aviso no está en el DOM salvo para ofrecer recargar.
- [x] Con `late`, `very-late` o `unknown`, EMPEZAR lleva directo al mapa, sin la escena de Oak.
- [x] El mapa, la leyenda, la lista y la tarjeta funcionan igual en todos los estados.

### Reloj no fiable

- [x] Con el instante actual más de 15 minutos anterior a `forecast.generatedAt`, o con la fecha del dataset dos días o más por delante de la de Madrid, el estado es `unknown`.
- [x] Con `unknown` se ven la fecha absoluta y la hora de generación, sin HOY, MAÑANA ni ATRASADA, sin aviso de retraso y sin Oak.

### Pestaña abierta

- [x] La frescura se recalcula al volver a la pestaña (`visibilitychange`), al restaurarla desde la caché del navegador (`pageshow`) y, mientras está visible, al menos una vez por minuto. Una pestaña visible que cruza la medianoche de Madrid pasa de MAÑANA a HOY, o de HOY a ATRASADA, sin recargar.
- [x] Una página fresca al cargar que pasa a `late` o `very-late` muestra «Esta página sigue mostrando la previsión del [fecha]. Recarga para comprobar si hay una más reciente.» y un botón «Recargar».
- [x] Una página que ya carga en `late`, `very-late` o `unknown` no ofrece recargar, por mucho tiempo que lleve abierta, ni aunque después pase por `today` o `tomorrow` antes de quedar atrasada.
- [x] Un cambio de estado con la página abierta se anuncia una vez por la región viva, sin mover el foco. La carga inicial no se anuncia por ella.
- [x] Si la frescura deja de ser `today` o `tomorrow` mientras Oak está en escena, la escena se cierra y queda el mapa.

### Oak

- [x] Ningún texto de Oak —de la IA o del respaldo local— contiene una de las cinco palabras, una de las cuatro frases relativas ni «estamos a» seguido de una fecha, sin distinguir mayúsculas ni tildes.
- [x] La guarda factual rechaza el texto de la IA que contenga una de esas expresiones, dice cuál encontró, y se publica el respaldo.
- [x] La página no muestra un `oak-today.json` cuyos diálogos contengan una de ellas: entra directa al mapa.
- [x] «Esta tarde», «esta noche», «Estamos a lunes.» y «Estamos a martes.» se rechazan; «el lunes», «La tarde del lunes.», «La noche del lunes.», «Estamos a 30 grados.» y «Estamos a 1000 metros.» se aceptan.
- [x] Oak sitúa el día por su nombre o su fecha cuando necesita situarlo.

### Calendario

- [x] Las fechas se calculan bien en los dos cambios de hora —25 de octubre de 2026 y 28 de marzo de 2027—, alrededor de la medianoche de Madrid en invierno y en verano, y en los cambios de mes y de año.

### Portada

- [x] EMPEZAR tiene fondo `rgb(15, 58, 50)` y texto blanco, con su contraste comprobado con números y el anillo de foco visible.
- [x] **1.4.11:** en reposo, el contorno de EMPEZAR se distingue sobre las dos ilustraciones en todo su perímetro, también con el puntero encima o pulsado.

### Pie de página

- [x] En las dos composiciones, los créditos son lo último de la página, bajo la lista, a todo el ancho de la composición y sin esquinas redondeadas.
- [x] Siguen siendo un `<footer>` fuera de `<main>` —el `contentinfo` de la página— con las fuentes de datos y la autoría original.
- [x] Los créditos no ocupan ningún área de la rejilla, y no mueven ni cambian de tamaño la cabecera, el aviso, la leyenda, el mapa ni la lista.
- [x] El texto contrasta al menos 4,5:1 con su fondo, comprobado con números. Sin scroll horizontal en las 5 anchuras ni con zoom al 200 %, y sin recortes con el espaciado de texto de 1.4.12.

### Favicon

- [x] La pestaña muestra el icono de Poketiempo, sin fondo blanco alrededor del cuadrado redondeado ni halo claro, también sobre una pestaña oscura.
- [x] Se sirve bajo la base del sitio, `/poke-tiempo/`, y es el único favicon del proyecto.

### Escritorio: mapa y leyenda

- [x] En dos columnas, el mapa mide lo menor entre el ancho de su columna y el alto de la ventana menos la cabecera. En la composición apilada, su tope sigue siendo el 80 % del alto de la ventana.
- [x] Las cifras de temperatura miden 14 unidades de `viewBox`, aparecen cuando la caja del mapa alcanza 1063px y ahí miden al menos 12px. Ningún par de cifras vecinas se pisa.
- [x] En dos columnas, si las entradas de la leyenda caben juntas junto al mapa, la leyenda mide lo mismo que el mapa y la lista empieza justo bajo el mapa, sin hueco.
- [x] Si no caben, la leyenda sobresale solo lo que piden sus entradas juntas, y la lista empieza tras ella. Ninguna entrada se oculta ni se recorta, y la leyenda no tiene scroll propio.
- [x] Con sitio de sobra, las entradas tienen su separación habitual y el espacio libre queda bajo la última.
- [x] En escritorio, los Pokémon de la leyenda miden 44px y son todos iguales. El texto conserva su tamaño, y ninguna entrada mide menos de 44px de alto (2.5.8, objetivo de diseño).
- [x] Solo cambia la composición de dos columnas: la apilada y la lista quedan como en la 008 y la 009.
- [x] Sin recortes ni solapes en las 5 anchuras, con zoom al 200 %, a 1280×1024 al 400 % y con el espaciado de texto de 1.4.12.

### Accesibilidad y composición

La 010 hereda el listón WCAG 2.2 AA de `mission.md`.

- [x] Funciona en las 5 anchuras de verificación (320 / 480 / 768 / 1200 / 1600px), en las dos composiciones —apilada y de dos columnas— y con zoom al 200 %.
- [x] **1.4.10:** a 320 CSS px, con el aviso y la oferta de recarga montados, sin scroll en los dos ejes a la vez ni pérdida de contenido.
- [x] **1.4.12:** con los cuatro valores del criterio, la etiqueta, la hora de generación, la frase de retraso y el aviso no se recortan ni se solapan.
- [x] **2.4.11:** «Recargar» con el foco nunca queda completamente tapado, tampoco con la tarjeta abierta como hoja inferior.
- [x] El foco es visible en «Recargar» y en EMPEZAR. «Recargar» mide al menos 44 × 44 px como objetivo de diseño.
- [x] Ningún estado se comunica solo con color: cada uno tiene su texto, ATRASADA lleva además su icono y el aviso de dos días o más, el suyo.
- [x] Los avisos son texto real y el botón es un `<button>`. El contraste está comprobado con números.
- [x] Ningún dato nuevo se pide a AEMET ni a ningún otro servidor en runtime: la frescura no hace ninguna petición de red.

## Fuera de alcance

- **Publicar varios días** —hoy, mañana y pasado— y elegir el de hoy en la página. Queda para una feature posterior.
- **El workflow**: reintentos, horario del cron, `concurrency`, separar validación y publicación de datos, `ubuntu-latest` y Node 24. Es un trabajo de infraestructura aparte.
- **El mantenimiento de tests de `spec/maintenance/audit-follow-up.md`**: los bloques T05–T13, los tres huecos críticos, la eliminación de C1–C3 y cualquier otra optimización de la suite. Tienen su propio trabajo.
- **Comprobar por red si hay una versión nueva**, recargar sola o usar un service worker.
- **Detectar un reloj adelantado.** Sin red no se puede.
- **Franjas de mañana y tarde.**
- **Navegar por días anteriores** (histórico de previsiones, en el backlog).

## Preguntas abiertas

Ninguna.
