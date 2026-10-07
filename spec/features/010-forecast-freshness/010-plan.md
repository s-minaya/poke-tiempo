# 010 · Frescura y contexto temporal de la previsión — Plan

**Estado:** cerrada.

## Contexto técnico

Los datos temporales con los que trabaja la página, y dónde se decide cada fecha.

### Qué fechas e instantes existen

| Dónde | Campo | Qué es |
|---|---|---|
| `forecast.json` | `date` | Fecha de calendario `YYYY-MM-DD` que describe la previsión: el `targetDate` de la ejecución, el día siguiente al de la ejecución en `Europe/Madrid`. |
| `forecast.json` | `generatedAt` | Instante de generación del forecast, fijado justo antes de escribir `forecast.json`, después de obtener y validar el dataset. Lo fija `fetch-forecast.ts` en ISO 8601 UTC con el reloj del runner. No es la hora de adquisición de cada proveedor. |
| `forecast.json` | `locations[].date` | El mismo `targetDate` para los 74 lugares. Es una etiqueta de día, no un intervalo de instantes: en Canarias corresponde a su día local. |
| `forecast.json` | `alerts[].startsAt` / `endsAt` | Instantes reales del aviso. AEMET los da con desfase (`+02:00`); IPMA, sin él. El JSON incluye avisos ya caducados: `isActiveOnDate` los descarta comparando el prefijo de fecha con `date`. |
| `oak-today.json` | `date` | La misma fecha que `forecast.date`. |
| `oak-today.json` | `generatedAt` | Instante en que empieza la generación de Oak, segundos después del de `forecast.json`. |
| `oak-history.json` | `date` por entrada | Fecha de cada generación pasada, solo para la continuidad narrativa. |

Ningún dato dice cuándo se publicó la página. La publicación ocurre alrededor de un minuto después de `generatedAt`. GitHub Pages sirve `index.html` con `Cache-Control: max-age=600`, y el bundle lleva hash: un navegador puede recibir el `index.html` anterior durante hasta 10 minutos después de un deploy.

### Dónde se decide el día

- **Pipeline:** `computeTargetDate(now)` en `src/domain/target-date.ts`, una vez por ejecución, desde `scripts/fetch-forecast.ts`: la fecha de Madrid del instante actual más un día.
- **Oak:** `scripts/oak/build-day-plan.ts` aborta si `forecast.date` no es el `targetDate` del momento. Así Oak siempre se genera para el mismo día que el mapa.
- **Página:** la fecha que muestra es siempre `forecast.date`, formateada con `Intl` y `timeZone: 'UTC'` para que la zona del dispositivo no la desplace. `readOakToday` exige que `oak-today.date` coincida con `forecast.date`. El reloj del dispositivo solo decide la frescura, y nada en `src/` hace peticiones de red: los datos van empaquetados en el bundle.

### Cambios de hora

- `Intl.DateTimeFormat` con `timeZone: 'Europe/Madrid'` da la fecha de Madrid a cualquier lado del cambio, y la suma de un día es aritmética de calendario.
- El cron `0 6 * * *` cae a las 08:00 en verano y a las 07:00 en invierno. Con el retraso medido, la publicación pasa de 12:34–14:19 en verano a 11:34–13:19 en invierno: el cambio de HOY a MAÑANA llega una hora antes, en hora local.
- Los próximos cambios son el 25 de octubre de 2026, un domingo de 25 horas, y el 28 de marzo de 2027, de 23 horas.
- La regla es contar días de calendario, nunca dividir milisegundos entre 86 400 000: en esos dos días esa división se equivoca cerca de la medianoche.

### El reloj del dispositivo

El instante actual sale inevitablemente del dispositivo, y solo su conversión a fecha de Madrid es independiente de la zona configurada. Hay dos señales fiables de un reloj imposible. Ningún dataset puede haberse generado después del instante actual, y el pipeline nunca publica una fecha más allá de mañana. No hay cota por arriba sin pedir la hora a la red: un reloj adelantado hará ver como atrasada una previsión al día. Ver Riesgos.

## Enfoque

Un modelo temporal puro en `src/domain/` decide el estado de frescura a partir de tres datos: la fecha del dataset, su `generatedAt` y el instante actual. Un hook guarda si la página cargó fresca, recalcula el estado cuando hace falta y deriva de los dos si se ofrece recargar. Los componentes solo pintan el estado: la cabecera, un aviso antes del mapa y la puerta de entrada de Oak.

Oak no usa referencias temporales relativas, por construcción: una sola función de detección compartida por el generador, que rechaza el texto de la IA, y por la página, que no muestra un `oak-today.json` que las contenga.

Sin dependencias nuevas ni peticiones de red: `Intl` resuelve la zona horaria, y todo lo demás es aritmética de calendario sobre `Date.UTC`.

## Implementación

1. **Calendario de Madrid** — `src/domain/madrid-calendar.ts`, funciones puras:
   - `madridDateOf(instant: Date): string` — la fecha `YYYY-MM-DD` de ese instante en Madrid. Usa `Intl.DateTimeFormat(…, { timeZone: 'Europe/Madrid', calendar: 'gregory', numberingSystem: 'latn', year: 'numeric', month: 'numeric', day: 'numeric' }).formatToParts()`, toma `year`, `month` y `day` como números y compone `YYYY-MM-DD` con relleno explícito. No depende de que `format()` devuelva un formato concreto en ningún locale ni runtime.
   - `addCalendarDays(date: string, days: number): string` y `calendarDaysBetween(from: string, to: string): number`, sobre `Date.UTC`.
   - `computeTargetDate` es `addCalendarDays(madridDateOf(now), 1)`: una sola implementación de «la fecha en Madrid» para el pipeline y para la página.

2. **Estado de frescura** — `src/domain/forecast-freshness.ts`:
   - `FreshnessStatus = 'tomorrow' | 'today' | 'late' | 'very-late' | 'unknown'` y `ForecastFreshness = { status: FreshnessStatus; daysLate: number }`. `daysLate` es 0 salvo en `late` y `very-late`.
   - `CLOCK_DRIFT_TOLERANCE_MS = 15 * 60 * 1000`.
   - `resolveFreshness({ forecastDate, generatedAt, now }): ForecastFreshness`. Primero las dos comprobaciones de `unknown`: `now < generatedAt − CLOCK_DRIFT_TOLERANCE_MS`, o `calendarDaysBetween(madridDateOf(now), forecastDate) >= 2`. Después, la diferencia de días según la tabla de `010-spec.md`.
   - `isFresh(freshness)`: `today` o `tomorrow`.
   - `canShowOak(freshness)`: exactamente `isFresh(freshness)`. Con `late`, `very-late` y `unknown`, falso.
   - `shouldOfferReload(freshAtLoad: boolean, current: ForecastFreshness)`: verdadero solo si la página cargó fresca y el estado actual es `late` o `very-late`. No depende del tiempo transcurrido.

3. **Recalcular en la página** — `src/components/FreshnessNotice/use-forecast-freshness.ts`:
   - En el primer render calcula el estado y guarda `freshAtLoad = isFresh(estado)`. Es inmutable durante la vida de esa carga: solo cambia con una carga nueva. Una página que carga en `unknown`, pasa a `today` y después a `late` no ofrece recargar.
   - Recalcula con `visibilitychange` al volver a ser visible, con `pageshow` al restaurarse desde la caché del navegador y con un intervalo de 60 s que solo corre mientras la pestaña está visible. El intervalo cubre también la vuelta de una suspensión del equipo, que no siempre dispara eventos.
   - Devuelve el estado actual y `offerReload = shouldOfferReload(freshAtLoad, estado)`.
   - Lo llama `App`, que lo necesita para Oak, y lo pasa a `WeatherApp`.

4. **Cabecera** — `src/components/Header/`:
   - `formatForecastHeadline` devuelve «Previsión para el lunes 5 de octubre» en minúsculas y la mayúscula la pone el CSS (`text-transform`), para que los lectores de pantalla no deletreen palabras en mayúsculas. Formatea `forecast.date` con `timeZone: 'UTC'`, sin mirar el reloj.
   - La etiqueta —HOY, MAÑANA o ATRASADA con su icono— va dentro del mismo párrafo, con una coma oculta visualmente para que se lea «…5 de octubre, hoy». Con `unknown` no hay etiqueta.
   - La fecha y la etiqueta son texto en línea, no una fila flex: un contenedor flex convierte a sus hijos en bloques, y el navegador expone entonces la fecha y la etiqueta como textos sueltos que un lector de pantalla lee por separado. Un espacio real entre las dos es por donde la etiqueta baja de línea si no cabe. El párrafo va al tamaño de la fecha y la etiqueta lleva su propio interlineado, para que al bajar sola de línea no pise la fecha, también con el espaciado de texto de 1.4.12.
   - Debajo, en todos los estados, «Previsión generada el domingo 4 de octubre a las 13:34 (hora peninsular)»: `format-generated-at.ts` formatea `forecast.generatedAt` en `Europe/Madrid`.
   - Con `late`, una frase más: «Esta previsión corresponde al sábado 3 de octubre y lleva 1 día de retraso.».
   - Colores: la línea de la fecha conserva el mood. La etiqueta, la marca y las frases usan `$ui-ink`, `$ui-surface` y blanco.

5. **Aviso antes del mapa** — `src/components/FreshnessNotice/FreshnessNotice.tsx`:
   - Se monta solo con `very-late` o con `offerReload`. En cualquier otro caso no está en el DOM.
   - Con `very-late`, el bloque fuerte, invertido en tinta y blanco y con un icono: «Esta previsión lleva 3 días de retraso.» como título y «Corresponde al sábado 3 de octubre.» debajo.
   - Con `offerReload`, «Esta página sigue mostrando la previsión del lunes 5 de octubre. Recarga para comprobar si hay una más reciente.» y un `<button>` «Recargar», de al menos 44 × 44 px, que llama a `location.reload()`. Si coincide con `very-late`, va dentro del mismo bloque, después del texto de retraso.
   - Un área de rejilla propia, `notice`, entre `header` y el contenido, en las dos plantillas de `WeatherApp.scss`.
   - Una región viva educada, montada siempre en `App`, fuera de todo lo que se vuelve inerte u oculto, anuncia los cambios de estado con la página abierta, también con Oak en escena. Empieza vacía: la carga inicial no se anuncia, porque el texto ya está en la página. Dice la fecha con su etiqueta, como la cabecera: es el equivalente accesible de HOY y MAÑANA.

6. **Oak, sin expresiones relativas al momento de lectura**:
   - `src/domain/oak/relative-time-expressions.ts` — el único sitio donde viven las listas y la regla:
     - `RELATIVE_DAY_WORDS = ['hoy', 'mañana', 'ayer', 'anoche', 'anteayer']`.
     - `RELATIVE_TIME_PHRASES = ['esta mañana', 'esta tarde', 'esta noche', 'esta madrugada']`.
     - La regla de «estamos a»: «estamos a» seguido de un día de la semana (`lunes` … `domingo`) o de un número de día, «de» y un nombre de mes (`enero` … `diciembre`). Es una expresión regular sobre el texto normalizado, no un analizador: «estamos a 30 grados» y «estamos a 1000 metros» no la cumplen.
     - `findRelativeTimeExpression(text): RelativeTimeMatch | null`, con `RelativeTimeMatch = { kind: 'word' | 'phrase' | 'reading-date'; expression: string }`; en `reading-date`, `expression` es el texto encontrado («estamos a lunes»). Normaliza texto y listas sin tildes ni mayúsculas, exige límite de palabra a los dos lados y acepta cualquier espacio entre palabras. Busca primero las frases y la regla, así que «esta mañana» se informa como frase y no como la palabra «mañana».
   - `claims.ts` — `calendarClaims` dice «La previsión es para el lunes.» o «… para el sábado, fin de semana.», y `dayShapeClaims` sitúa los recuentos en el mapa, sin «hoy».
   - `fallback-dialogues.ts` — los fragmentos y la frase épica sitúan el día con su nombre, la fecha o formas ancladas a ella («el lunes», «durante la tarde del lunes»), sin ninguna expresión prohibida.
   - `scripts/oak/oak-prompt.ts` — el ejemplo de buena redacción no usa «hoy», y una regla prohíbe las palabras, las frases y «estamos a» con una fecha, importados de `relative-time-expressions.ts`, con ejemplos de formas ancladas permitidas.
   - `scripts/oak/factual-guard.ts` — rechaza el texto que contenga una de esas expresiones y anota en el motivo cuál encontró; se publica el respaldo.
   - `src/components/ProfessorOak/read-oak-today.ts` — devuelve `null` si algún diálogo contiene una de ellas.
   - `App.tsx` — la escena de Oak sale solo si `readOakToday` lo permite y `canShowOak` también. Si la frescura deja de ser `today` o `tomorrow` con Oak en escena, la escena se cierra y queda el mapa.

7. **Resto de la interfaz** — el anuncio accesible de la tarjeta sin datos dice «Sin previsión.» (`location-summary.ts`).

8. **EMPEZAR** — `src/styles/abstracts/_variables.scss` define `$landing-button-fill: #0f3a32` (`rgb(15, 58, 50)`). En `Landing.scss`, el botón usa ese fondo y `$color-white` como texto: 12,56:1. Conserva el borde `#111`, y por fuera lleva un halo blanco de 2 px, `box-shadow: 0 0 0 2px $color-white`: la ilustración tiene zonas claras y oscuras, y borde y halo contrastan entre sí sea cual sea el píxel de debajo. El foco sustituye el halo por el anillo propio de la portada, de tres bandas, que se pinta fuera del borde, así que el relleno no le afecta.

9. **Documentación**:
   - `mission.md`: «Qué construimos», la leyenda y «Para quién» describen la fecha de la previsión publicada, sin promesa fija de hoy, con el pipeline D+1 como contrato vigente.
   - `tech-stack.md`: la referencia temporal canónica, `Europe/Madrid`; la fila de `$landing-button-fill` en la paleta; en «Composición», los créditos al final de la página en las dos composiciones; y en «Composición y puntos de corte», las dos plantillas de grid en `<main>`; y en la compatibilidad, `inert` y las consultas de contenedor como el CSS por verificar.
   - `008-plan.md`: la matriz WCAG 2.2 A y AA, al día en los criterios que cambian con esta feature: 1.4.1, 1.4.3, 1.4.10, 1.4.11, 1.4.12, 2.4.11, 2.5.8 y 4.1.3.
   - Los documentos de features anteriores no se reescriben para contar que siempre funcionó así.

10. **Pie de página** — los créditos, lo último de la página en las dos composiciones:
    - `WeatherApp.scss`: en las dos composiciones, la rejilla es la de `.app__layout`, `<main>`. En la de dos columnas, con las áreas `header`, `notice`, `legend`, `map` y `list`. Los créditos van en flujo normal tras `<main>`, dentro de `.app`, que limita la composición a `$breakpoint-desktop-large`.
    - `Credits.scss`: el mismo pie en las dos composiciones. A todo el ancho de `.app`, sin fondo propio —el de la página, `$map-sea`—, texto `$ui-ink`, una línea `0.2rem solid $ui-ink` encima, relleno de `1.6rem 2rem`, centrado.
    - `Credits.tsx`: un `<footer>` fuera de `<main>`, con las fuentes de datos y la autoría original.

11. **Favicon** — `public/favicon-32.png` y `public/favicon-192.png`, declarados en `index.html` con `rel="icon"`, `type="image/png"` y `sizes`; Vite les antepone la base al construir. La pestaña usa el de 32px; el de 192px, las pantallas de alta densidad y los accesos directos. No hay `favicon.svg`: el de la plantilla de Vite no forma parte del proyecto.
    - Salen del icono original, de 1254 × 1254 px. El blanco exterior —el que se alcanza desde las esquinas sin cruzar el azul del icono— pasa a transparente. En el borde suavizado, el alfa se recupera de la mezcla entre ese blanco y el azul vecino, así que no queda halo claro sobre una pestaña oscura. El blanco de dentro no se toca.
    - Reducción por mitades con suavizado alto y PNG indexado, con paleta y transparencia: 1,3 kB y 18,0 kB. El original no se versiona, como los de los sprites.

12. **Escritorio: mapa, cifras y leyenda** — solo en la composición de dos columnas:
    - `SpainMap.scss`: `--map-max-block` es el alto de la ventana (`svh`, con `vh` de respaldo) menos el de la cabecera de escritorio, 12,8rem, una variable con su comentario. Con el aviso de frescura montado, el mapa puede quedar algo por debajo de la primera pantalla.
    - `LocationMarker.tsx`: `TEMPERATURE_FONT_SIZE = 14`. `_breakpoints.scss`: `$map-temperature-threshold: 1063px` (12 × 1240 / 14). Los comentarios de `LocationMarker.scss` y `_breakpoints.scss`, con las cifras nuevas.
    - `Legend.scss`: la lista de entradas, una columna flex. Cada entrada (`legend__item`, la clase nueva de su `<li>` en `Legend.tsx`) parte de 5rem —el sprite de 4,4rem y el borde del botón— y crece hasta 7,8rem, un botón de 7rem y 0,8rem de aire: con el hueco fijo de 0,4rem, la misma separación que la rejilla de la composición apilada. Así la leyenda aporta a la fila de la rejilla solo su alto compacto, y se estira hasta el de la fila: el del mapa, o el suyo compacto si es mayor. El sprite, 4,4rem fijos en todas las entradas, y su columna, también de 4,4rem. La etiqueta conserva su tamaño, así que una de dos líneas pide 6,3rem: la entrada no lleva `min-height` propio, que anularía el mínimo por contenido de flex y dejaría salirse el texto.
    - `WeatherApp.scss`: las áreas y `align-items: stretch` no cambian.
    - `tech-stack.md`: en «Composición y puntos de corte», la leyenda de escritorio con el alto del mapa y el tope del mapa bajo la cabecera; en el bloque de `_breakpoints.scss`, `$map-temperature-threshold: 1063px`.

## Decisiones

- **Estado por diferencia de fechas, no por horas transcurridas.** Una previsión para hoy está al día aunque se generara ayer. Contar horas desde `generatedAt` daría «antigua» cada tarde a una previsión correcta.
- **El reloj del dispositivo, con dos comprobaciones.** Pedir la hora a un servidor sería una petición de red nueva y no resolvería el caso de fondo. Se usan las dos cotas seguras —el dataset no es del futuro y nunca es de pasado mañana— con 15 minutos de tolerancia para la deriva normal de un reloj, y lo demás se acepta. Un reloj adelantado no se intenta detectar.
- **Recargar, por un cambio de estado.** `freshAtLoad` modela explícitamente si la página empezó al día. Ofrecer recargar a una página que ya cargó atrasada no tiene base: nada indica que recargar cambie el dataset. Se descarta un umbral de tiempo abierto.
- **Oak, solo al día.** `unknown` no es «quizá al día»: es no poder establecer la frescura, y la capa narrativa con sus avisos no se presenta en ese caso.
- **Un intervalo de 60 s y no un temporizador a la medianoche siguiente.** Calcular la próxima medianoche de Madrid es posible, pero un temporizador largo se retrasa con la suspensión del equipo. El intervalo es barato, solo corre con la pestaña visible y se corrige solo.
- **El aviso fuerte, en su propia área de la rejilla**, a todo el ancho y antes del mapa, en las dos composiciones. Dentro de la cabecera competiría con el título y la fecha.
- **La hora de generación, en la cabecera.** Sirve para interpretar la frescura de la fecha que tiene encima. Las fuentes siguen en los créditos.
- **El hook vive con el aviso** (`FreshnessNotice/`), igual que `readOakToday` vive con `ProfessorOak/` y lo importa `App`.
- **Dos listas, una regla y una sola función de detección**, en el dominio, importadas por el prompt, la guarda, los tests del respaldo y `readOakToday`. Palabras y frases se separan para que la lista de palabras siga siendo exactamente la decidida y las frases no obliguen a prohibir palabras genéricas como «esta» o «ahora». «Estamos a» solo cuenta seguido de una fecha, para no rechazar «estamos a 30 grados».
- **La rejilla de dos columnas, en `<main>` y sin `subgrid`.** Con los créditos al final, ningún elemento de fuera de `<main>` comparte rejilla con su contenido; la rejilla vive donde vive en la composición apilada.
- **Un `oak-today.json` con una expresión prohibida no se muestra.** `readOakToday` lo descarta y EMPEZAR lleva directo al mapa.
- **Favicon en PNG, a 32 y 192px, sin `.ico`.** Los navegadores actuales aceptan PNG con `sizes` y eligen el más cercano; el sitio vive bajo `/poke-tiempo/`, así que el `/favicon.ico` de la raíz del dominio no es suyo. PNG indexado y no de color real: el original trae un grano fino en las zonas lisas que la paleta aplana, y el de 192px pesa 18,0 kB, frente a 41,8 kB en color real, sin diferencia visible.
- **La leyenda se ajusta al mapa solo con CSS.** Medir con JS y decidir la maquetación iría contra `tech-stack.md`. El tamaño intrínseco de una columna flex es la suma de los tamaños de partida de sus entradas, así que la fila de la rejilla lo toma compacto y el reparto ocurre después, dentro del alto ya fijado.
- **Lo que se reparte es el aire, no el sprite.** Con etiquetas de una y de dos líneas, las entradas no crecen por igual: las de dos líneas parten ya de más alto. Un sprite que siguiera el alto de su entrada saldría mayor en esas, y CSS no puede igualarlo sin estimar el reparto. El sprite de ancho variable tampoco sirve: al crecer, estrecharía la etiqueta, que podría pasar a dos líneas y salirse de una entrada ya medida.
- **El alto de la cabecera, fijo en `rem`.** La cabecera de escritorio mide 12,7rem de 1200 a 1920px, y en `rem` sigue a la base de letra del usuario. Medirla en runtime sería maquetar en JS.
- **Descartado:** ocultar o desaturar el mapa con datos atrasados, porque sigue siendo correcto para su fecha y la desaturación comunicaría con color; un banner rojo o naranja, porque repite el color de los avisos; decir que hay una versión nueva o que la cargada era la última, porque no se puede comprobar sin red.

## Pruebas

Ningún test usa la hora real: todos fijan el instante con fechas explícitas, y los de componentes, con `vi.useFakeTimers` y `vi.setSystemTime`.

- **Estados**, por tablas (`it.each`) sobre `resolveFreshness`: `today`, `tomorrow`, `late` (−1), `very-late` (−2 y −3) y `unknown`, con `daysLate` en cada caso.
- **Reloj**:
  - Justo dentro de la tolerancia: `now` 14 min 59 s y exactamente 15 min antes de `generatedAt` dan el estado normal. Justo fuera: 15 min y 1 ms antes da `unknown`. Un `now` posterior a `generatedAt` nunca da `unknown` por deriva.
  - La fecha del dataset +2 y +3 días respecto a la de Madrid da `unknown`; +1, `tomorrow`.
- **Calendario**, por tablas sobre `madridDateOf` y `resolveFreshness`:
  - El resultado de `madridDateOf` tiene siempre la forma `YYYY-MM-DD` (`^\d{4}-\d{2}-\d{2}$`).
  - Justo antes y después de la medianoche de Madrid, en invierno y en verano.
  - Alrededor de las 00:00, 02:00 y 03:00 de Madrid el 25 de octubre de 2026 y el 28 de marzo de 2027.
  - Cambio de mes (30 de septiembre → 1 de octubre) y de año (31 de diciembre → 1 de enero).
  - `computeTargetDate` conserva todos sus casos.
- **Pestaña**:
  - Una página cargada el domingo por la tarde con la previsión del lunes pasa de MAÑANA a HOY a la medianoche de Madrid, y de HOY a `late` a la siguiente, por el intervalo con la pestaña visible, por `visibilitychange` y por `pageshow`.
  - Cargada fresca y después atrasada: ofrece recargar, en `late` y en `very-late`.
  - Cargada ya en `late`, `very-late` o `unknown`: no ofrece recargar, ni al volver a la pestaña ni tras horas abierta.
  - Cargada fresca y después `unknown`: no ofrece recargar.
  - Cargada en `unknown`, después `today` y después `late`: no ofrece recargar, porque no estuvo fresca al cargar.
  - El cambio de estado se anuncia una vez por la región viva, y la carga inicial no.
- **Oak**: aparece con `today` y `tomorrow`; no aparece con `late`, `very-late` ni `unknown`; si con la escena abierta la frescura pasa a `late`, `very-late` o `unknown`, la escena se cierra y queda el mapa. `canShowOak` se prueba por tabla con los cinco estados.
- **Lenguaje**, por tabla sobre `findRelativeTimeExpression`, comprobando también qué coincidencia informa:
  - Las cinco palabras, en mayúsculas, sin tilde («manana», «Mañana», «MAÑANA») y como franja («por la mañana»): `{ kind: 'word' }` con la palabra.
  - Las cuatro frases, con mayúsculas, sin tildes y con espacios dobles: `{ kind: 'phrase' }` con la frase. «Esta mañana» se informa como frase.
  - «Estamos a» con fecha: `{ kind: 'reading-date' }` con el texto encontrado, para los siete días de la semana, con y sin tilde («miercoles», «sabado»), y para «estamos a 5 de octubre».
  - Rechazados, como mínimo: «Esta tarde», «Esta noche», «Estamos a lunes.», «Estamos a martes.».
  - Permitidos, como mínimo: «el lunes», «el lunes 5 de octubre», «La tarde del lunes.», «durante la tarde del lunes», «La noche del lunes.», «Estamos a 30 grados.», «Estamos a 1000 metros.».
  - Sin falsos positivos por palabra parcial: «hoyo», «mañanero», «ayerbe», «estamos ante» y «tardeo» no activan ninguna.
  - La guarda factual y `readOakToday` rechazan un texto con cada palabra, cada frase y la regla de «estamos a».
  - El respaldo local, generado para un conjunto amplio de hechos y fechas, no contiene ninguna.
- **Contrato**:
  - La fecha de la cabecera sale de `forecast.date`: con el reloj en cinco días distintos, la fecha no cambia.
  - La hora secundaria sale de `forecast.generatedAt`, formateada en `Europe/Madrid`, también en los días de cambio de hora.
  - Ningún texto renderizado, en los cinco estados y con y sin oferta de recarga, contiene «más reciente publicada», «era la más reciente», «versión nueva» ni «hay una nueva». La única frase con «más reciente» es la de recargar, y dice «comprobar si hay».
  - Fuera de las etiquetas HOY y MAÑANA y de su anuncio equivalente en la región viva, ningún texto contiene «hoy», «mañana» ni «ayer».
  - Sin red: con `fetch` y `XMLHttpRequest` espiados, montar la app y avanzar el reloj a través de los cinco estados no hace ninguna petición. «Recargar» solo llama a `location.reload()`, y solo al pulsarlo.
  - El aviso no está en el DOM salvo con `very-late` o con la oferta de recarga.
- **EMPEZAR**: el contraste del texto sobre el nuevo fondo y el de su contorno sobre las dos ilustraciones, medidos con números.
- **La fecha y su etiqueta, una frase**: en el árbol de accesibilidad de Chromium, un solo párrafo con la fecha y la etiqueta como texto seguido; con Narrador, en HOY y MAÑANA, se oyen como una frase.
- **Pie de página**: el `<footer>` es lo último de `.app` y queda fuera de `<main>`. En navegador, los créditos no mueven ni cambian de tamaño la cabecera, el aviso, la leyenda, el mapa ni la lista.
- **Escritorio**: la maquetación no se puede probar en jsdom; se comprueba en navegador. Con la leyenda real y con 5, 8, 11 y 13 entradas simuladas, en siete ventanas de 1200×800 a 1920×1080: el hueco entre el mapa y la lista es cero cuando las entradas caben juntas, y si no, igual a lo que sobresale la leyenda compacta. Ninguna entrada mide menos de 44px, ni se recorta o solapa.
- **Producción**: ampliar el smoke test de 008/009 con la etiqueta relativa y la hora de generación.

## Contrastes medidos

Calculados por el navegador sobre la build de producción, con la fórmula WCAG 2.x de luminancia relativa.

**Texto (1.4.3).**

| Texto | Colores | Contraste |
| --- | --- | --- |
| HOY y MAÑANA | `$ui-ink` sobre blanco | 12,82:1 |
| ATRASADA | blanco sobre `$ui-ink` | 12,82:1 |
| Frase de un día de retraso y hora de generación | `$ui-ink` sobre `$map-sea` | 11,47:1 |
| Aviso claro, la oferta de recargar | `$ui-ink` sobre `$ui-surface` | 11,76:1 |
| Aviso invertido, dos días o más | blanco sobre `$ui-ink` | 12,82:1 |
| «Recargar» | `$ui-ink` sobre blanco; `$ui-accent` en hover | 12,82:1; 7,02:1 |
| EMPEZAR | blanco sobre `$landing-button-fill` | 12,56:1 |
| Créditos | `$ui-ink` sobre `$map-sea`, el fondo de la página | 11,47:1 |

**No textual (1.4.11).**

- La etiqueta HOY y MAÑANA, por su borde `$ui-ink`, y ATRASADA, por su relleno: 11,47:1 contra el mar.
- El aviso claro, por su borde, y el invertido, por su relleno: 11,47:1 contra el mar.
- «Recargar»: su borde a 11,76:1 contra el aviso claro; en el invertido lo delimita su relleno blanco, a 12,82:1.
- La línea sobre los créditos, `$ui-ink`: 11,47:1 contra el mar y 12,82:1 contra la lista. Es un separador, no un componente que haya que identificar.
- El anillo de foco de «Recargar», el de `_reset.scss`: #111 a 17,32:1 contra el aviso claro; contra el invertido lo marca su núcleo blanco, a 12,82:1.
- **EMPEZAR**, sobre una ilustración con zonas claras y oscuras. Medido en los píxeles pintados de la build, a densidad 1 y sin animación, en diez viewports de 320×568 a 1920×1080 y en las dos ilustraciones:
  - **En reposo, el borde #111 contra el halo blanco: 18,88:1.** Llega a 3:1 en el 100 % del perímetro recto, con 18,88:1 en cada punto, y en el 100 % de los puntos medidos en las esquinas, con un mínimo de 9,44:1 por el suavizado. Así el contorno se distingue también donde el halo se confunde con una zona clara de la ilustración. Donde es oscura, el halo contrasta además 3:1 con ella en el 67–97 % del perímetro.
  - El borde solo, contra la ilustración, llegaría a 3:1 en el 49–85 % del perímetro, con un mínimo de 1,00:1; el relleno, en el 30–69 %. Por eso el halo.
  - **Hover y active** no cambian borde ni halo: los mismos estilos calculados, y el par borde y halo, en el 100 % del perímetro con el puntero encima y pulsado.
  - **Foco**: el anillo de tres bandas de la portada —#111, blanco y #111, 9 px— sustituye al halo. Respecto al reposo, todo el perímetro cambia al menos 3:1 —la franja del halo pasa de blanco a #111, 18,88:1—, y el 69–88 % de los píxeles del anillo.

## Verificación

Sobre la build de producción (`vite preview`), en Chromium con Playwright y el reloj del navegador fijado en cada estado: MAÑANA, HOY, un día, dos días, `unknown`, y una página cargada al día que pasa a un día y a dos días, con la oferta de recargar. El zoom se emula dividiendo el viewport en CSS px y multiplicando la densidad.

- **Las 5 anchuras** (320 / 480 / 768 / 1200 / 1600px) en los siete estados: sin scroll horizontal, sin recortes y sin solapes entre título, fecha, frase de retraso, hora de generación, aviso, leyenda y mapa. Apilada hasta 1199px y de dos columnas en 1200 y 1600.
- **Zoom al 200 %** en las mismas anchuras y estados: lo mismo a 384, 600 y 800 CSS px. A 160 y 240 CSS px —320 y 480px al 200 %, por debajo de lo que mide 1.4.10— solo el título POKETIEMPO, una palabra, pide scroll horizontal, como en la 008; el aviso y «Recargar» caben enteros.
- **1.4.10**, a 1280×1024 al 400 % y a 320×568: en los siete estados, sin scroll horizontal ni recortes.
- **1.4.12**, con los cuatro valores a 320, 768, 1200, 1600 y 1280×1024 al 400 %, en los siete estados: la etiqueta, la frase de retraso, la hora de generación, el aviso y «Recargar» no se recortan ni se solapan, y no hay scroll horizontal.
- **2.4.11**: con la tarjeta abierta desde la última fila de la lista o desde un marcador —hoja inferior en la apilada, anclada en dos columnas—, «Recargar» con el foco de teclado queda entero a la vista, también en el aviso de dos días o más: 32 casos, en 320, 480, 768, 1200 y 1600 px, 390 y 1280 al 200 % y 1280×1024 al 400 %.
- **Foco visible**: «Recargar» con el anillo de `_reset.scss` sobre los dos avisos, y EMPEZAR con el anillo de la portada, que sustituye a su halo, sobre las dos ilustraciones.
- **2.5.8**: «Recargar» mide 115×44, y 130×44 con el espaciado de 1.4.12.
- **1.4.1**: los siete estados, en escala de grises, se distinguen por su texto; ATRASADA lleva además su icono de reloj, y el aviso de dos días o más, el suyo.
- **Región viva**: una sola, montada desde la carga en todas las etapas, vacía al cargar y fuera de todo subárbol `inert` o `aria-hidden`. Con Oak abierto, MAÑANA → HOY cambia su contenido una vez y Oak sigue; el paso a un día, dos días o `unknown` lo cambia una vez y Oak se cierra. `visibilitychange` y `pageshow` repetidos sobre el mismo estado no lo vuelven a cambiar. Es una comprobación del DOM, no de lo que dice un lector de pantalla.
- **La fecha y su etiqueta, una frase**: en el árbol de accesibilidad de Chromium, la línea de la fecha es un solo `paragraph` con la fecha y la etiqueta como texto seguido, en HOY, MAÑANA y ATRASADA. La etiqueta queda centrada con la fecha y a 11–12 px de ella; cuando baja sola de línea, con 8 px por encima. Con el espaciado de 1.4.12 no se solapa con nada, de 320 a 1600px. Con Narrador y Edge, en HOY, MAÑANA y ATRASADA, la fecha y la etiqueta se oyen como una sola frase, sin repeticiones y sin leer el icono.
- **Pie de página**: los créditos no mueven ni cambian de tamaño la cabecera, el aviso, la leyenda, el mapa, la lista ni `<main>`, en seis anchuras de 320 a 1920px, con y sin aviso. Los créditos son lo último de la página, a todo el ancho de `.app`. Sin scroll horizontal ni recortes a las 5 anchuras al 100 % y al 200 % ni a 1280×1024 al 400 %, también con el espaciado de 1.4.12; a 160 y 240 CSS px, el scroll es el del título, no el de los créditos.
- **Favicon**: en la build, las dos rutas llevan la base `/poke-tiempo/` y se sirven como `image/png`, y no hay `favicon.svg`. A 16 y 32 px, sobre la pestaña clara y la oscura de Chrome y sobre blanco, el contorno no deja halo.
- **Escritorio: mapa y cifras.** Ancho del mapa con el tope de la composición apilada (80 % del alto de la ventana) y con el de escritorio, y tamaño de las cifras con este:

  | Ventana | Mapa con el 80 % | Mapa bajo la cabecera | Cifras |
  |---|---|---|---|
  | 1200×800 | 892px | 892px | 10,1px, no se pintan |
  | 1280×720 | 912px | 938px | 10,6px, no se pintan |
  | 1366×768 | 973px | 1014px | 11,4px, no se pintan |
  | 1440×900 | 1132px | 1132px | 12,8px |
  | 1536×864 | 1095px | 1166px | 13,2px |
  | 1600×900 | 1140px | 1223px | 13,8px |
  | 1920×1080 | 1292px | 1292px | 14,6px |

  Con 13 unidades y el tope del 80 %, de esas ventanas solo 1920×1080 pintaría las cifras, a 13,5px. El mapa entero queda en la primera pantalla en las siete. Con las 74 cifras a la vista, a 1440×900 y a 1920×1080, ningún par se pisa.
- **Escritorio: leyenda.** Hueco entre el mapa y la lista con la leyenda de 2026-10-07, de 11 entradas, cuatro de ellas de dos líneas:

  | Ventana | Leyenda a su tamaño habitual | Leyenda con el alto del mapa |
  |---|---|---|
  | 1200×800 | 480px | 233px |
  | 1280×720 | 467px | 204px |
  | 1366×768 | 429px | 156px |
  | 1440×900 | 328px | 81px |
  | 1536×864 | 352px | 60px |
  | 1600×900 | 323px | 24px |
  | 1920×1080 | 227px | 0 |

  Con 5 entradas no hay hueco en ninguna ventana; con 8, desde 1366×768 tampoco; con 13, el máximo publicado, la leyenda sobresale en todas, 101px a 1920×1080. En todos los casos el hueco es justo lo que sobresale la leyenda con sus entradas juntas: las de una línea miden 50px, y las de dos, 63px. Los sprites, 44px en todas.
- **Escritorio: sin regresiones.** La composición apilada, píxel a píxel igual con y sin el bloque de escritorio, a 320, 480 y 768px. En dos columnas, a 1200, 1366, 1600 y 1920px, al 200 % en 2560×1440 y con el espaciado de 1.4.12, también con las 25 etiquetas posibles: ninguna entrada recorta su etiqueta ni la saca de su caja, la leyenda no pisa la lista y no hay scroll horizontal. Al 200 % en las 5 anchuras y a 1280×1024 al 400 %, la composición es la apilada, sin cambios; a 160 y 240 CSS px, el scroll es el del título.
- **Lector de pantalla**, con Narrador y Edge sobre la build candidata, con Oak abierto (`aria-modal="true"`) y la región viva fuera del diálogo: MAÑANA → HOY se anuncia una vez y Oak sigue; el paso a `late`, `very-late` y `unknown` se anuncia una vez cada uno, en el mismo cambio que cierra Oak. Al cerrarse Oak, por la frescura o al terminar sus bocadillos, el foco queda en el documento y el siguiente Tab lleva a «Saltar al buscador»; con Narrador, también.
- **Sin red**: la página hace cero peticiones fetch o XHR, también al recorrer los cinco estados.
- **Suite**: verde en varias ejecuciones seguidas, también con el proceso en `Pacific/Kiritimati` (UTC+14) y `America/Los_Angeles`.
- **Bundle**: el JS pasa de 536,65 kB (176,05 kB gzip) a 543,35 kB (177,84 kB gzip), +6,70 kB (+1,79 kB gzip). La leyenda y el mapa de escritorio suman 0,02 kB de JS y 0,55 kB de CSS (de 26,01 a 26,56 kB).
- **Smoke test** de 008/009, ampliado con el titular, la etiqueta relativa coherente con la fecha de Madrid, la hora de generación, la región viva, EMPEZAR —relleno, texto, borde y halo— y ninguna petición fetch o XHR: 39 de 39 sobre la build local.

## Riesgos

- **Reloj del dispositivo adelantado.** Muestra como atrasada una previsión al día. No hay forma de detectarlo sin red. Mitigación: los textos dan la fecha del dataset como hecho y el retraso respecto a ella, sin afirmar nada sobre lo publicado, y el mapa sigue completo.
- **Más textos de la IA rechazados.** Prohibir expresiones frecuentes puede hacer que se publique más el respaldo local. Se vigila con el `source` de `oak-today.json`.
- **La caché de 10 minutos de `index.html`.** Recargar justo después de un deploy puede devolver la misma página. Por eso el texto dice «comprobar» y no promete nada.
- **El área propia de la rejilla.** Toca las dos plantillas de `WeatherApp.scss`: comprobada con el aviso montado (ver «Verificación»).
- **Tests dependientes de la hora.** Cualquier test que use la hora real fallaría según el día. Todos fijan el instante.
