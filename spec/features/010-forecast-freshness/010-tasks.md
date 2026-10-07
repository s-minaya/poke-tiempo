# 010 · Frescura y contexto temporal de la previsión — Tareas

_Checklist derivada de `010-plan.md`, agrupada en bloques. Se implementa un bloque, se para y se enseña al usuario antes de pasar al siguiente (`AGENTS.md`, paso 5)._

**Estado.** Feature cerrada.

## Bloque 1 — Dominio temporal

_Frontera: funciones puras en `src/domain/`, sin React ni DOM. Ningún componente cambia._

- [x] `src/domain/madrid-calendar.ts` — `madridDateOf` con `formatToParts` (`timeZone: 'Europe/Madrid'`, `calendar: 'gregory'`, `numberingSystem: 'latn'`), componiendo `YYYY-MM-DD` a partir de `year`, `month` y `day`; `addCalendarDays` y `calendarDaysBetween` sobre `Date.UTC`.
- [x] `src/domain/target-date.ts` — `computeTargetDate` pasa a `addCalendarDays(madridDateOf(now), 1)`. `target-date.test.ts` sigue en verde sin cambiar ningún caso.
- [x] `src/domain/forecast-freshness.ts` — `FreshnessStatus`, `ForecastFreshness`, `CLOCK_DRIFT_TOLERANCE_MS`, `resolveFreshness` (primero las dos comprobaciones de `unknown`), `isFresh`, `canShowOak` y `shouldOfferReload`.
- [x] Tests de calendario, por tablas (`it.each`): forma `YYYY-MM-DD`; justo antes y después de la medianoche de Madrid en invierno y en verano; 00:00, 02:00 y 03:00 de Madrid el 25 de octubre de 2026 y el 28 de marzo de 2027; cambio de mes y de año.
- [x] Tests de frescura, por tablas:
  - los cinco estados, con `daysLate`;
  - reloj: 14 min 59 s y 15 min antes de `generatedAt` dan el estado normal, 15 min y 1 ms antes da `unknown`, y un instante posterior a `generatedAt` nunca da `unknown` por deriva;
  - fecha del dataset +2 y +3 respecto a Madrid, `unknown`; +1, `tomorrow`;
  - `canShowOak` con los cinco estados;
  - `shouldOfferReload` con `freshAtLoad` verdadero y falso frente a los cinco estados.
- [x] Ningún test usa la hora real: fechas e instantes explícitos.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 2 — Cabecera y aviso de frescura

_Frontera: componentes que pintan una frescura recibida por props. `App` la calcula una sola vez al cargar; el recálculo con la pestaña abierta llega en el bloque 4._

- [x] `Header/format-forecast-headline.ts` — «Previsión para el lunes 5 de octubre», en minúsculas, desde `forecast.date` con `timeZone: 'UTC'`. La mayúscula la pone el CSS.
- [x] `Header/format-generated-at.ts` — «Previsión generada el domingo 4 de octubre a las 13:34 (hora peninsular)», desde `forecast.generatedAt` en `Europe/Madrid`.
- [x] `Header.tsx` / `.scss`:
  - la etiqueta HOY, MAÑANA o ATRASADA con su icono, en el mismo párrafo que la fecha, con el separador oculto; ninguna con `unknown`;
  - la línea de generación, en todos los estados;
  - con `late`, «Esta previsión corresponde al [fecha] y lleva 1 día de retraso.»;
  - la fecha conserva el mood; la etiqueta, la marca y las frases usan `$ui-ink`, `$ui-surface` y `$color-white`.
- [x] `FreshnessNotice/FreshnessNotice.tsx` / `.scss` — montado solo con `very-late` o con `offerReload`:
  - con `very-late`, el bloque fuerte con icono: «Esta previsión lleva [N] días de retraso.» y «Corresponde al [fecha].»;
  - con `offerReload`, el texto de recarga y un `<button>` «Recargar» de al menos 44 × 44 px que llama a `location.reload()`;
  - los dos a la vez, en un mismo bloque.
- [x] `WeatherApp.tsx` / `.scss` — área `notice` entre `header` y el contenido, en las dos plantillas; la frescura y `offerReload` llegan como props.
- [x] `App.tsx` — calcula la frescura una vez al cargar con `resolveFreshness` y la pasa con `offerReload` falso.
- [x] `LocationCard/location-summary.ts` — «Sin previsión para hoy.» pasa a «Sin previsión.».
- [x] Tests de la cabecera en los cinco estados:
  - la fecha sale de `forecast.date`: con el reloj en cinco días distintos, no cambia;
  - la etiqueta que toca y la línea de generación;
  - la frase de `late`.
- [x] Tests de lo que no se puede decir, en los cinco estados y con y sin oferta de recarga:
  - fuera de las etiquetas, ni «hoy», ni «mañana», ni «ayer»;
  - ni «más reciente publicada», ni «era la más reciente», ni «versión nueva», ni «hay una nueva».
- [x] Tests del aviso:
  - no está en el DOM salvo con `very-late` o con la oferta de recarga;
  - «Recargar» llama a `location.reload()` solo al pulsarlo.
- [x] Los tests que montan la app con el `forecast.json` real fijan el reloj con `vi.setSystemTime` a partir de su `generatedAt`, para no depender del día en que se ejecute la suite.
- [x] Revisar uno a uno los tests existentes que cambian: el titular de la cabecera y «Sin previsión para hoy.». Ninguna otra aserción cambia.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 3 — Oak sin expresiones relativas al momento de lectura

_Frontera: el generador de Oak y la lectura de `oak-today.json`. No toca la frescura ni la entrada de la escena._

- [x] `src/domain/oak/relative-time-expressions.ts` — `RELATIVE_DAY_WORDS`, `RELATIVE_TIME_PHRASES`, la regla de «estamos a» seguido de un día de la semana o de «N de [mes]», y `findRelativeTimeExpression` con `kind: 'word' | 'phrase' | 'reading-date'` y la expresión encontrada. Antes de detectar, la normalización quita tildes, pasa a minúsculas y colapsa los espacios consecutivos en uno; la detección exige límite de palabra a los dos lados.
- [x] Tests por tablas de `findRelativeTimeExpression`, comprobando qué coincidencia informa:
  - las cinco palabras, con mayúsculas, sin tilde y como franja («por la mañana»);
  - las cuatro frases, con mayúsculas, sin tildes y con espacios dobles; «esta mañana», como frase;
  - «estamos a» con los siete días de la semana, con y sin tilde, y con «5 de octubre»;
  - espacios consecutivos, como parte del contrato: «Esta  tarde», «Estamos  a   lunes» y «estamos a 5  de  octubre» se detectan igual que con un solo espacio;
  - rechazados: «Esta tarde», «Esta noche», «Estamos a lunes.», «Estamos a martes.»;
  - permitidos: «el lunes», «el lunes 5 de octubre», «La tarde del lunes.», «durante la tarde del lunes», «La noche del lunes.», «Estamos a 30 grados.», «Estamos a 1000 metros.»;
  - sin falsos positivos: «hoyo», «mañanero», «ayerbe», «estamos ante», «tardeo».
- [x] `src/domain/oak/claims.ts` — `calendarClaims` y `dayShapeClaims` sin «Hoy».
- [x] `src/domain/oak/fallback-dialogues.ts` — los 15 fragmentos y la frase épica, con el día de la semana, la fecha o formas ancladas a ella.
- [x] Test del respaldo: generado para un conjunto amplio de hechos y fechas, no contiene ninguna expresión prohibida.
- [x] `scripts/oak/oak-prompt.ts` — el ejemplo sin «hoy», y la regla con las listas y la regla importadas, más ejemplos de formas ancladas permitidas.
- [x] `scripts/oak/factual-guard.ts` — rechaza el texto con una expresión prohibida y anota cuál en el motivo; tests con cada palabra, cada frase y la regla de «estamos a».
- [x] `ProfessorOak/read-oak-today.ts` — `null` si algún diálogo contiene una expresión prohibida; tests con cada tipo.
- [x] `App.test.tsx`:
  - los textos de prueba de Oak, sin expresiones prohibidas;
  - un test nuevo: con un `oak-today.json` que contiene una, EMPEZAR lleva directo al mapa.
- [x] Revisar uno a uno los tests existentes que cambian (claims, guarda factual, `readOakToday`, `ProfessorOak`, `LocationCard`, `SpainMap`): solo cambian las frases, no lo que comprueban.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 4 — Pestaña viva e integración en `App`

_Frontera: el recálculo en el tiempo y su efecto en la página y en Oak. Ningún texto nuevo._

- [x] `FreshnessNotice/use-forecast-freshness.ts`:
  - calcula el estado al cargar y guarda `freshAtLoad`, inmutable durante esa carga;
  - recalcula con `visibilitychange` al volver a ser visible, con `pageshow` y con un intervalo de 60 s que solo corre con la pestaña visible;
  - retira escuchas e intervalo al desmontarse;
  - devuelve el estado y `offerReload`.
- [x] `App.tsx`:
  - usa el hook en lugar del cálculo único del bloque 2;
  - la escena de Oak sale solo si `readOakToday` lo permite y `canShowOak` también;
  - si la frescura deja de ser `today` o `tomorrow` con la escena abierta, la escena se cierra y queda el mapa.
- [x] Región viva educada, montada siempre en `App`, fuera de `FreshnessNotice`, que se desmonta, y de cualquier subárbol `inert` o `aria-hidden`. Vacía al cargar; anuncia una vez cada cambio de estado, también con Oak en escena, sin mover el foco. Su anuncio es el equivalente accesible de las etiquetas HOY y MAÑANA: la única excepción a la regla de «hoy», «mañana» y «ayer».
- [x] Tests con `vi.useFakeTimers` y `vi.setSystemTime`, nunca la hora real:
  - cargada el domingo por la tarde con la previsión del lunes: de MAÑANA a HOY a la medianoche de Madrid y de HOY a `late` a la siguiente, por el intervalo, por `visibilitychange` y por `pageshow`; el intervalo no corre con la pestaña oculta;
  - cargada fresca y después `late` o `very-late`: ofrece recargar;
  - cargada en `late`, `very-late` o `unknown`: no lo ofrece, ni al volver a la pestaña ni tras horas abierta;
  - cargada fresca y después `unknown`: no lo ofrece;
  - cargada en `unknown`, después `today` y después `late`: no lo ofrece;
  - la región viva anuncia el cambio una vez y no anuncia la carga; con Oak en escena, fuera del nodo `inert`, anuncia MAÑANA → HOY y el paso a `late`, `very-late` o `unknown`;
  - fuera de las etiquetas HOY y MAÑANA y de su anuncio en la región viva, ningún texto de la página dice «hoy», «mañana» ni «ayer»;
  - Oak sale con `today` y `tomorrow`, no con `late`, `very-late` ni `unknown`; con la escena abierta, si la frescura deja de ser `today` o `tomorrow` —pasa a `late`, `very-late` o `unknown`—, Oak se cierra y queda el mapa;
  - sin red: con `fetch` y `XMLHttpRequest` espiados, montar la app y recorrer los cinco estados no hace ninguna petición.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 5 — Portada y documentación

_Frontera: el botón EMPEZAR y los documentos que la 010 cambia por su contrato temporal. Ningún otro documento._

- [x] `src/styles/abstracts/_variables.scss` — `$landing-button-fill: #0f3a32`.
- [x] `Landing.scss` — el botón con ese fondo y `$color-white` como texto. El borde `#111` y el anillo de foco de dos tonos no cambian.
- [x] Contraste del texto medido con números (12,56:1) y anillo de foco comprobado sobre las dos ilustraciones de portada.
- [x] `spec/constitution/mission.md` — las tres frases que prometen «hoy» pasan a describir la fecha de la previsión publicada, con el pipeline D+1 como contrato vigente. Sobre la versión reconciliada por la auditoría, sin hunks del `documentation.patch` original.
- [x] `spec/constitution/tech-stack.md` — `Europe/Madrid` como referencia temporal canónica y la fila de `$landing-button-fill` en la paleta, sobre su versión reconciliada.
- [x] Ningún documento de features anteriores se reescribe; `spec/maintenance/audit-follow-up.md` no cambia.
- [x] `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 6 — Cierre y verificación

_Frontera: verificar, documentar lo verificado y publicar. Ningún comportamiento nuevo. Los únicos cambios visuales son el halo de EMPEZAR, por 1.4.11, y la etiqueta en línea con la fecha, para que un lector de pantalla las lea como una frase._

- [x] `Landing.scss` — EMPEZAR con un halo blanco de 2 px en reposo, `box-shadow: 0 0 0 2px $color-white`, decidido por el usuario. Borde `#111`, relleno, texto y anillo de foco sin cambios; el foco sustituye el halo por su anillo. Medir de nuevo 1.4.11 sobre las dos ilustraciones, también con hover, active y foco.
- [x] `Header.tsx` y `Header.scss` — la fecha y la etiqueta, texto en línea dentro del párrafo y no una fila flex, con un espacio real entre las dos; el párrafo al tamaño de la fecha y la etiqueta con su propio interlineado. Comprobar el árbol de accesibilidad de Chromium, el aspecto en las 5 anchuras, 1.4.12 y, con Narrador, que fecha y HOY o MAÑANA se oyen como una frase.

- [x] `npx tsc -b`, `npm run lint`, la suite varias veces, `npm run build`, `git diff --check` y `git status --short`.
- [x] En navegador, en HOY, MAÑANA, un día, dos días o más, pestaña que se queda antigua y `unknown`:
  - las 5 anchuras de verificación (320 / 480 / 768 / 1200 / 1600px), en las dos composiciones y con zoom al 200 %;
  - **1.4.10** a 320 CSS px y **1.4.12** con los cuatro valores, con el aviso y «Recargar» montados;
  - **2.4.11**: «Recargar» con el foco no queda tapado, tampoco con la tarjeta abierta como hoja inferior;
  - foco visible en «Recargar» y en EMPEZAR; «Recargar» de al menos 44 × 44 px;
  - **1.4.1**: ningún estado comunicado solo con color, también en escala de grises;
  - **4.1.3**: la región viva no duplica el anuncio inicial.
- [x] **Obligatorio, con lector de pantalla real** —al menos los disponibles en el entorno de prueba—: con Oak abierto (`aria-modal="true"`) y la región viva fuera del diálogo, MAÑANA → HOY se anuncia, y el paso a `late`, `very-late` o `unknown` se anuncia antes de que Oak desaparezca o a la vez. Estar fuera de `inert` no basta por sí solo con un diálogo `aria-modal`: si no se anuncia, es un bloqueo para cerrar la 010 y se replantea la semántica entonces.
- [x] Contrastes medidos en navegador y anotados en el plan; rellenar «Verificación» en el plan.
- [x] Comparar el tamaño del bundle JS con el de antes de la 010: 536,65 kB (176,05 kB gzip).
- [x] `008-plan.md` — poner al día las filas de la matriz WCAG que cambian: 1.4.1, 1.4.3, 1.4.10, 1.4.11, 1.4.12, 2.4.11, 2.5.8 y 4.1.3.
- [x] Ampliar el smoke test de producción, que vive fuera del repo, con el titular nuevo, la etiqueta relativa, la hora de generación y el halo de EMPEZAR.
- [x] Barrer la narración del proceso de comentarios, `010-spec.md`, `010-plan.md` y este archivo (`AGENTS.md`, paso 7).
- [x] Validar contra los criterios de aceptación de `010-spec.md`.
- [ ] Tras el push autorizado:
  - CI y deploy en verde;
  - Pages sirve el bundle nuevo;
  - smoke test en producción.
- [x] Estado de `010-spec.md`, `010-plan.md` y este archivo, a cerrada; `../../constitution/roadmap.md`, la feature a «Hecho».

## Bloque 7 — Pie de página

_Frontera: dónde y cómo se pintan los créditos. Su contenido y su semántica no cambian, ni el resto de la composición. Se publica con el resto de la 010: los pasos tras el push del bloque 6 lo cubren._

- [x] `WeatherApp.scss` — en dos columnas, la rejilla en `.app__layout` (`<main>`), con las mismas áreas y columnas, y sin `subgrid`. Los créditos, en flujo normal tras `<main>`.
- [x] `Credits.scss` — sin pastilla y sin bloque propio de dos columnas: a todo el ancho de `.app`, sobre el fondo de la página, texto `$ui-ink`, línea `0.2rem solid $ui-ink` encima, relleno `1.6rem 2rem`, centrado.
- [x] `_variables.scss` — el comentario de las capas, sin el `z-index` de los créditos.
- [x] Test: el `<footer>` es lo último de `.app` y queda fuera de `<main>`.
- [x] `tech-stack.md` → Composición: los créditos, al final de la página en las dos composiciones. Composición y puntos de corte: las plantillas de grid, en `<main>` y sin `subgrid`; `subgrid` sale de la lista de CSS por verificar.
- [x] En navegador:
  - la composición de dos columnas antes y después, a 1200, 1600 y 1920px, igual salvo los créditos;
  - las 5 anchuras (320 / 480 / 768 / 1200 / 1600px) y zoom al 200 %, sin scroll horizontal;
  - **1.4.12** con los cuatro valores, sin recortes;
  - contraste del texto de los créditos medido y anotado en el plan.
- [x] `npx tsc -b`, `npm run lint`, `npm run test` y `npm run build` sin errores.

## Bloque 8 — Favicon

_Frontera: el icono de la pestaña. Nada de la página cambia._

- [x] Del icono original, el blanco exterior a transparente, con el alfa del borde recuperado contra el azul; el blanco de dentro se conserva.
- [x] `public/favicon-32.png` (1,3 kB) y `public/favicon-192.png` (18,0 kB), PNG indexados. El original, fuera del repositorio.
- [x] `index.html` los declara con `type` y `sizes`, y `public/favicon.svg`, el de Vite, se elimina.
- [x] En la build, las rutas con la base `/poke-tiempo/` y servidas como `image/png`. Sin halo a 16 y 32px sobre la pestaña clara, la oscura y blanco.
- [x] `tech-stack.md` → Estilo visual: el favicon, con su origen y condiciones.

## Bloque 9 — Escritorio: mapa, cifras y leyenda

_Frontera: el tamaño del mapa, el de sus cifras y el reparto de la leyenda, solo en la composición de dos columnas. La apilada, la lista y el contenido de la leyenda no cambian._

- [x] `SpainMap.scss` — en dos columnas, `--map-max-block` es el alto de la ventana menos el de la cabecera (12,8rem), con `svh` y respaldo en `vh`.
- [x] `LocationMarker.tsx` — `TEMPERATURE_FONT_SIZE = 14`. `_breakpoints.scss` — `$map-temperature-threshold: 1063px`. Comentarios de los dos y de `LocationMarker.scss` con las cifras nuevas.
- [x] `Legend.scss` y `Legend.tsx` — en dos columnas, la lista como columna flex: entradas (`legend__item`) que parten de 5rem y crecen hasta 7,8rem, el sprite fijo de 4,4rem, el texto a su tamaño y sin `min-height` propio en la entrada.
- [x] `WeatherApp.scss` — el comentario de `align-items: stretch`, con su papel nuevo.
- [x] `tech-stack.md` → Composición y puntos de corte: la leyenda de escritorio con el alto del mapa y el tope del mapa bajo la cabecera; `$map-temperature-threshold: 1063px`.
- [x] En navegador:
  - el hueco entre mapa y lista, con la leyenda real y con 5, 8, 11 y 13 entradas, en siete ventanas de 1200×800 a 1920×1080: cero si caben juntas; si no, lo que sobresale la leyenda compacta;
  - ninguna entrada por debajo de 44px, recortada o solapada, también con etiquetas de dos líneas y con las 25 posibles;
  - ancho del mapa y tamaño de las cifras en esas ventanas, y ningún par de cifras pisado;
  - las 5 anchuras, zoom al 200 %, 1280×1024 al 400 % y **1.4.12**, sin recortes ni scroll horizontal;
  - la composición apilada, igual que antes.
- [x] `010-plan.md` → Verificación, con las medidas.
- [x] `npx tsc -b`, `npm run lint`, `npm run test` y `npm run build` sin errores.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ningún dato nuevo se pide a AEMET ni a ningún otro servidor en runtime: la frescura no hace ninguna petición de red.
- [x] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token para ese valor. El único color nuevo es `$landing-button-fill`, decidido por el usuario.
- [x] Grep de variables SCSS tocadas en esta feature: 0 quedan sin uso.
- [x] Ninguna lista con interacción por fila queda sin memoizar. La 010 no añade listas ni sprites; los `loading="lazy"` existentes no cambian.
- [x] Ningún test usa la hora real.
- [x] Ningún estado de frescura se comunica solo con color.
- [x] Fuera de la 010 y sin tocar: T05–T13, los tres huecos críticos y C1–C3 de `spec/maintenance/audit-follow-up.md`, la optimización de la suite, y el cron y el workflow.

## Mantenimiento

- [ ] Añadir o quitar una expresión prohibida a Oak solo con decisión del usuario, y solo en `relative-time-expressions.ts`.
- [ ] Si el pipeline deja de publicar D+1, revisar los estados de `resolveFreshness`, el umbral +2 de `unknown` y `mission.md`.
- [ ] En las ejecuciones diarias, desde la primera tras el despliegue de la 010, comprobar que `oak-today.json` no contiene ninguna expresión prohibida y vigilar su `source`: si sale a menudo el respaldo, la IA está tropezando con la regla (`010-plan.md` → Riesgos).
