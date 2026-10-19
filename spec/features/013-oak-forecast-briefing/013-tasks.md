# 013 · Briefing meteorológico para el Profesor Oak — Tareas

_Checklist derivada del `013-plan.md` y de `013-spec.md`, agrupada por bloques._

_Código en inglés, comentarios en español. Sin dependencias nuevas, sin red y sin tocar `forecast.json`, el workflow, el frontend ni el contrato publicado. Tests junto al módulo, `it.each` para motor._

---

## Bloque 1 — Modelo editorial y geografía

**Objetivo:** fijar el modelo de datos del parte (los tres hechos, sus condiciones y sus medidas) y la geografía editorial con sus ámbitos y su ámbito padre, con la elegibilidad y las cinco medidas ya calculables en aislado.

- [x] `src/domain/oak/editorial-regions.ts` (nuevo): `EDITORIAL_REGIONS` con las siete regiones explícitas y sus `locationId` exactos (northwest 6, north 13, northeast 10, meseta 17, southwest 8, southeast 6, mediterranean 9) y los solapes deliberados declarados.
- [x] `DERIVED_REGIONS`: `canarias` (6), `baleares` (3) y `portugal` (8) calculados desde `Location.zone`/`Location.country`; nunca declarados como tabla.
- [x] `SCOPE_MEMBERSHIP`: `map` (74), `spain` (65), `iberian-peninsula` (63, sin Canarias, Baleares, Ceuta ni Melilla) y `region:<id>`.
- [x] `PARENT_SCOPE`: regiones y grupos derivados españoles → `spain`; `portugal` → `iberian-peninsula`; `spain` y `iberian-peninsula` → `map`; `map` → ninguno; el resto de un grupo es su padre menos el propio grupo.
- [x] `scopeLabel(scope)`: única fuente de la etiqueta base en español, **independiente del recuento**; Portugal como "los lugares de Portugal representados en el mapa" (el `N/M` vive solo en el claim de apoyo opcional).
- [x] `src/domain/oak/types.ts`: `PatternScope` (13 ámbitos), `OccurrencePhenomenon` (7), `PatternCondition` con sus **tres familias** (`occurrence` con polaridad, `sky` con una de las cuatro categorías, `temperature` con `highest`/`lowest`), `PatternMeasures` (cinco) y `PatternFact`; se añade a la unión `NarrativeFact`.
- [x] `src/domain/oak/facts.ts`: exportar `buildEntries` y `LocationEntry` (hoy privados) para reutilizar el mismo universo que los hechos.
- [x] `src/domain/oak/briefing.ts` (nuevo): elegibilidad por eje reutilizando las reglas existentes (`mm`, `snow.cm`, `assignByWind`, `storm`, `fog`, `assignByCalima`, `marine.status`/`waveHeightM`, `sky`, `maxC`); `viento` y `olas` sin polaridad ausente; un `null` de calima sin aviso no es elegible; un aviso costero sin altura no es elegible.
- [x] Medidas sobre recuentos exactos (`prevalenceInternal`, `prevalenceRest`, `contrast`, `concentration`, `overRepresentation`), calculadas contra `parentScope`, con las medidas sin base a 0.
- [x] Tests: `editorial-regions.test.ts` (composición, recuentos, solapes, ámbitos 74/65/63, `PARENT_SCOPE`, validación de `locationId` contra `src/data/locations.ts`).
- [x] Tests: `briefing.test.ts` (elegibilidad por eje, `affectedCount` por polaridad, valores exactos de las cinco medidas para las tres familias, casos sin base).

---

## Bloque 2 — Motor de briefing

**Objetivo:** generar los candidatos, filtrar los informativos, aplicar compuertas y elegir los tres roles con degradación y deduplicación, todo determinista.

- [x] Materialización de candidatos: una ocurrencia por `(fenómeno × polaridad admitida × ámbito)`, una categoría de cielo por `(categoría × ámbito)`, dos bandas térmicas por ámbito (y solo si el universo global tiene más de una banda ocupada).
- [x] Filtro de informatividad: presencia siempre informativa (incluida la uniforme); ausencia trivial solo si uniforme en el ámbito y sin contraste con el padre; cielo siempre informativo; banda térmica solo si localiza (`contrast > 0`), nunca en `map`.
- [x] Compuertas de tamaño: 6+ → `overview`, 3–5 → `secondary`, 2 o menos → sin afirmación agregada; compuerta `spain` con las tres condiciones medidas con `Location.zone` (cobertura ≥ 2/3, ≥ 3 zonas, ninguna zona > 2/3); `iberian-peninsula` sin compuerta.
- [x] `MATERIAL_CONTRAST_MIN_OVER_REPRESENTATION = 2` con nombre semántico, única constante numérica de la selección (valor confirmado con datos reales).
- [x] Selección de `highlight` por orden lexicográfico: aviso naranja/rojo (`decision.trigger` de la 007) → patrones informativos por contraste/cobertura/concentración → hechos locales como degradación con reducción **intra-fenómeno** por severidad ya existente de la 003 → orden de declaración.
- [x] Selección de `overview` (A4): mayor extensión entre los informativos, después `prevalenceInternal`, después orden de declaración; nunca una ausencia trivial; una `occurrence/ausente` con ámbito `map`, `spain` o `iberian-peninsula` **no compite por el rol**; una regional solo con `contrast > 0` y compuertas superadas. No añadir umbral nuevo.
- [x] Selección de `secondary` (B): patrón regional con `contrast > 0` y `overRepresentation ≥ 2`, el más alto por contraste/cobertura/concentración; `occurrence/olas/presente` **no compite por el rol** y, si era el mejor, se toma el siguiente `PatternFact` regional material; `olas` sigue elegible para los demás roles; si no hay ninguno, degrada al siguiente candidato del orden de `highlight`.
- [x] Degradación fina: ningún rol se queda sin candidato; un día degenerado (sin cielo y todos los ejes a `null`) rellena los tres roles sin abortar.
- [x] Deduplicación durante la selección, expresada por el **mismo eje semántico**: `occurrence` → mismo `phenomenon` (**ignora la polaridad**: presente y ausente son el mismo fenómeno); `sky` → misma `SkyCondition`; `temperature` → el mismo eje térmico (**ignora `highest`/`lowest`**). Ninguna afirmación del mismo eje sobre el mismo conjunto/denominador que otra, y como máximo una afirmación regional por fenómeno y día; comparación por conjuntos y denominadores, nunca por texto.
- [x] Salida `DayBriefing = { overview; highlight; secondary }` con `BriefingItem = { role; fact: NarrativeFact }`; referencia hechos, no copia campos.
- [x] Tests `briefing.test.ts`: compuertas, condición informativa, selección (incluido el límite de sobre-representación por debajo/en/en-cima), no repetición, día degenerado y determinismo (misma entrada → mismo parte).
- [x] Tests A4: `map + occurrence/ausente` nunca puede ser `overview`; `spain + occurrence/ausente` nunca; `iberian-peninsula + occurrence/ausente` nunca; una ausencia regional con `contrast > 0` y tamaño suficiente sí; una ausencia regional sin contraste no; occurrence presente, `sky` y `temperature` no cambian por A4.
- [x] Tests B: `olas/presente` nunca puede ser `secondary`; si olas era el mejor `secondary`, se elige el siguiente `PatternFact` material; olas sigue pudiendo participar en otros roles según las reglas existentes; ningún otro fenómeno recibe trato especial.

---

## Bloque 3 — Integración con `DayPlan`

**Objetivo:** que el parte mande sobre el reparto: cada rol entra en su hueco y lo narrativo solo ocupa lo que sobra.

- [x] `DayPlanInput` y `DayPlan` ganan `briefing: DayBriefing`.
- [x] `buildOpening`, `buildFocus` y `buildClosing` empiezan con el hecho de su rol (`overview` → apertura, `highlight` → foco, `secondary` → cierre) y lo marcan como usado.
- [x] El hecho del rol no se repite en otro hueco; la lógica actual ocupa el resto (acompañante del aviso, protagonista, gag), sin que el `DayShapeFact` entre como relleno automático (ver la tarea siguiente).
- [x] `DayShapeFact` **permanece en el inventario** porque otras decisiones de la 007 lo necesitan, pero **no** se añade automáticamente como relleno narrativo cuando existe `overview`: la apertura ya tiene su panorama. No es el mismo hecho que `CalendarFact`; `CalendarFact` **sí** puede acompañar la apertura cuando corresponda y no sea redundante.
- [x] En modo `alerta`, el foco recibe el aviso (mismo hecho que el `highlight` por el escalón 1) sin conflicto; un protagonista, un leitmotiv o un tono añaden texto pero nunca desplazan ni eliminan un hecho del parte.
- [x] Tests `plan-dialogues.test.ts`: cada hueco contiene el hecho de su rol; protagonista/modo/leitmotiv no eliminan ningún hecho; sin repetición entre huecos; sin `DayShapeFact` redundante.

---

## Bloque 4 — Claims y Groq

**Objetivo:** convertir los patrones en claims (obligatorio mínimo + apoyo opcional) y cerrar la frontera con la IA por tokens, dejando el dominio sin conocer la sintaxis de token.

- [x] `src/domain/oak/claims.ts`: `patternClaims(fact)` produce el **claim obligatorio semántico** mínimo (sin `N/M` forzado; nieve negativa como "sin acumulación de nieve"; Portugal sin N forzado) y, cuando aporta, un **claim de apoyo opcional** con el recuento; añadir la rama `pattern` al `switch` exhaustivo.
- [x] `DialogueClaims` gana la lista de claims **obligatorios** (subconjunto textual, sin sintaxis de marcador); `buildDayClaims(dayPlan)` marca como obligatorio solo el claim derivado del hecho del rol (identidad de objeto contra `dayPlan.briefing`).
- [x] `AllowedEntities.numbers` sigue derivándose de los números presentes en los claims; no se acumulan `N/M` a mano.
- [x] `scripts/oak/`: el adapter convierte los obligatorios en **tokens estables** (`[[CLAIM_D<diálogo>_<n>]]`) y una única función los valida (cada token exactamente una vez, ninguno ausente/repetido/desconocido, sin restos de sintaxis) y los expande; los tokens se colocan **a nivel de frase**.
- [x] Orden de la aduana solo en la vía IA: parseo/esquema básico (sin medir 20–160) → comprobación de tokens → expansión → sobre el texto final: factual fit, temporales, frases de ámbito, emoji y límites 20–160.
- [x] `scripts/oak/oak-prompt.ts`: `requiredClaims: { token; claim }[]` por hueco y regla en `TU TAREA` (cada token una vez a nivel de frase, ninguno inventado); el prompt lee el enumerado temporal del módulo único.
- [x] Tests `claims.test.ts` (redacción por familia y ámbito, obligatorio vs apoyo, Portugal, `AllowedEntities.numbers`), `groq-adapter.test.ts` (creación/validación/expansión de tokens, orden de validación, texto contrario sin token rechazado) y `oak-prompt` (payload y regla).

---

## Bloque 5 — Fallback y guardas

**Objetivo:** verbalizar los patrones localmente **sin tokens**, ampliar las restricciones temporales y cerrar las guardas (frases de ámbito, emoji, límites sobre el texto final).

- [x] `src/domain/oak/fallback-dialogues.ts`: `clauseFor` gana la rama `pattern` con `patternClause(fact)` para las tres familias; `placeNamesOf` devuelve `[]` para un patrón; el fallback **no usa tokens** ni `buildDayClaims()` para redactar ni ninguna expansión.
- [x] Garantía por construcción: el hecho obligatorio del parte está en `slot.facts` y `composeBody` recorre todos los hechos del slot; un test lo demuestra para las tres familias.
- [x] `src/domain/oak/relative-time-expressions.ts`: añadir las familias de la spec (semana, mes, varios días, desplazamientos con patrón cerrado, temporada, estaciones, fin de semana como periodo, "más adelante"/"en adelante"); "fin de semana" suelto sigue permitido; sin duplicar entradas.
- [x] `scripts/oak/factual-guard.ts`: `checkFactualFit` gana las frases de ámbito prohibidas ("gran parte del territorio", "el país", "gran parte del país") y el helper pequeño de emoji (pictográfico simple, símbolo meteorológico, ZWJ, tono de piel, bandera, keycap), sin dependencia nueva ni subarquitectura de Unicode.
- [x] `scripts/oak/validate.ts`: los límites 20–160 se miden sobre el texto final; `assertValidOakToday` rechaza emoji en el texto propio y mide la longitud final.
- [x] Tests: `fallback-dialogues.test.ts`, `relative-time-expressions.test.ts`, `factual-guard.test.ts` (frases y emoji), `validate.test.ts` (emoji propio lanza; límites finales) y `generate.test.ts` (fallback sin tokens, sin marcadores en lo publicado, contrato de roles/fuente intacto).

---

## Bloque 6 — Validación editorial con datos reales

**Objetivo:** comprobar el comportamiento del motor contra previsiones reales/versionadas disponibles y revisar si `MATERIAL_CONTRAST_MIN_OVER_REPRESENTATION = 2` se ajusta.

- [x] Ejecutar el briefing contra varios `forecast` reales/versionados disponibles, sin red nueva en runtime y sin pedir nada a AEMET.
- [x] Inspeccionar la selección determinista del dominio (`overview`, `highlight`, `secondary`) por día; **no** se generan snapshots de texto exacto de Groq.
- [x] Comprobar que no produce ausencias triviales como afirmación.
- [x] Comprobar que `secondary` no degrada sistemáticamente y que, cuando degrada, lo hace por falta de contraste real.
- [x] Comprobar que cielo y temperatura no monopolizan el briefing.
- [x] Revisar si el contraste detectado es meteorológicamente razonable y si el valor 2 necesita ajuste.
- [x] Documentar el resultado de la comprobación (días revisados, qué `secondary` produjo, cuántas degradaciones, observaciones).
- [x] Valor 2 revisado con datos reales y mantenido.

---

## Bloque 7 — Revalidación con A4 + B

**Objetivo:** repetir la validación editorial sobre los mismos 27 snapshots reales/versionados con A4 y B implementadas, y comparar contra la línea base anterior.

- [x] Repetir el pipeline `buildEntries → collectFacts → resolveDayMode → buildBriefing` sobre los 27 snapshots, sin red y sin Groq.
- [x] Comparar la distribución de `overview` (familias y ámbitos) antes/después: 0 ausencias globales ganando el rol.
- [x] Comparar la distribución de `secondary` (familias): `olas/presente` 0, reparto entre `sky`, `temperature`, `lluvia`, `viento` y `tormenta`.
- [x] Contar degradaciones: 27/27 con `PatternFact` material, 0 degradaciones.
- [x] Revisar ejemplos problemáticos y confirmar que A4 y B no han introducido un nuevo monopolio ni un overview peor.
- [x] Confirmar que `highlight` no cambia y que ningún otro rol se ve afectado.

---

## Bloque final — Cierre

- [x] Suite completa (`npm test`).
- [x] `npm run lint`.
- [x] `npm run build`.
- [x] `npm run generate:oak`.
- [x] Comprobar que el contrato público de `oak-today.json` sigue intacto (tres diálogos con `id`, `role`, `tone`, `text`; sin marcadores).
- [x] Actualizar `spec/constitution/tech-stack.md` **únicamente** con la cadena arquitectónica aprobada: "dominio puro → parte → claims → Groq o fallback local".
- [x] Mover la feature a "Hecho" en `spec/constitution/roadmap.md`.
- [x] Barrer la narración del proceso de `013-spec.md`, `013-plan.md`, este archivo y los comentarios de código (`AGENTS.md`, paso 7).
- [x] Marcar `013-spec.md` y `013-plan.md` con el estado que corresponda.
- [x] Validar contra los criterios de aceptación de `013-spec.md`.

---

## Definición de "hecho" (además de los criterios de `013-spec.md`)

- [x] Ningún valor nuevo de color/espaciado se escribe como literal si ya existe un token (no aplica: la feature no toca estilos).
- [x] Grep de variables SCSS tocadas en esta feature: 0 sin uso (no aplica: sin SCSS).
- [x] Ningún dato nuevo se pide a AEMET en runtime.
- [x] No se añaden dependencias nuevas.
- [x] Componentes/estilos de UI y listas con interacción por fila: no aplica (la feature es de dominio y scripts).
