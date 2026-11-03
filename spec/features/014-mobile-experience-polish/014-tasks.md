# 014 · Pulido de la experiencia móvil — Tareas

_Checklist derivada de `014-spec.md` y `014-plan.md`._

_Estado: Bloque 1 (leyenda) y R1–R5 hechos y aprobados. R6 (Safari de iPhone real y cierre) hecho. Feature completada y movida a «Hecho» en `roadmap.md`. El teclado externo en Safari real no se ha verificado: R6.2 y un criterio de la spec siguen sin marcar. Cada bloque termina con tests, lint, build y una parada para revisión._

---

## Bloque 1 — Leyenda

**Objetivo:** unificar el fondo de la leyenda con la banda de atribución mientras está debajo del mapa y conservar el fondo del mar cuando pasa a estar al lado.

**Referencias:** `014-spec.md` → Alcance 1 y Criterios de aceptación → Leyenda; `014-plan.md` → §1.

- [x] **B1.1** En `src/components/Legend/Legend.scss`, mantener el fondo base `.legend` en `$map-attribution` y restituir `$map-sea` dentro de `respond-from($breakpoint-desktop-columns)`, el breakpoint real de la composición de dos columnas. No añadir selectores, breakpoints, medidas, literales de color ni cambios de DOM.
- [x] **B1.2** Mantener `src/components/Legend/Legend.styles.test.ts` (entorno Node) compilando el SCSS real con Sass; comprobar el fondo base `$map-attribution` y el override de dos columnas `$map-sea` en el breakpoint de composición.
- [x] **B1.3** Revisar el diff de `Legend.scss`: sin cambios en estructura, ancho, relleno, columnas, etiquetas, sprites, estados ni en `Legend.tsx`; sin variables SCSS huérfanas.
- [x] **B1.4** Ejecutar `npm run test`, `npm run lint` y `npm run build`.
- [x] **B1.5** Tomar capturas en 320, 768, 1180, 1200, 1360, justo antes y después de `$breakpoint-desktop-columns`, y 1600px; comprobar los fondos computados, la composición real, la continuidad con la atribución y la ausencia de recortes, solapes y scroll horizontal.
- [x] **B1.6** Tomar capturas en 667×375, 844×390, 768×500 y 1180×820; revisar el escalón de anchura, el contraste de etiquetas y el estado seleccionado con borde azul, caja blanca y ✓.
- [x] **B1.7** Presentar resultados, capturas y cualquier diferencia; parar antes de tocar la tarjeta.

**Criterios de terminación**

- Los fondos computados coinciden con `$map-attribution` en la composición apilada, incluido 1200/1360, y con `$map-sea` solo cuando la composición real pasa a dos columnas.
- La leyenda mantiene DOM, orden, etiquetas, sprites, nombres accesibles y estados.
- El test de contrato SCSS pasa y no se ha introducido ningún literal de color nuevo.
- Las capturas no muestran recortes, solapes ni scroll horizontal.
- La distinción del estado seleccionado se revisa visualmente; si no se distingue, se para y se pide decisión sin inventar un color.

**Parada:** no iniciar el Bloque 2 hasta recibir aprobación.

---

## R1 — Retirada de la hoja

**Objetivo:** quitar la hoja inferior `position: fixed`, la reserva del documento que dejaba para ella y el revelado bajo la hoja, sin tocar la leyenda.

**Referencias:** `014-plan.md` → §2 y Tests → Retirados.

- [x] **R1.1** Guardar fuera del repositorio `git diff` y una copia de los archivos sin seguimiento antes de empezar.
- [x] **R1.2** Sin código que lea `VisualViewport` para la tarjeta, ni sus tests.
- [x] **R1.3** Eliminar `use-reveal-when-selected.ts` y sus usos en `LocationMarker.tsx` y `LocationList.tsx`.
- [x] **R1.4** `LocationCard.tsx` conserva la prop `ref` con su firma (`Ref<HTMLElement>`) y no depende de ningún hook de viewport.
- [x] **R1.5** En `LocationCard.scss`, eliminar la hoja de la regla base (`position: fixed`, `inset-*`, `max-block-size`, `overflow-y`, relleno de área segura, borde y esquinas inferiores rectos) y `html:has(.location-card)` con `--location-sheet-max`, la reserva del `body` y `scroll-padding-block-end`.
- [x] **R1.6** Retirar los tests de la sección «Retirados» del plan.
- [x] **R1.7** Grep en código de producción: sin referencias a `visualViewport`, `--sheet-`, `--location-sheet`, `useRevealWhenSelected` ni variables SCSS huérfanas.
- [x] **R1.8** `npm run test`, `npm run lint`, `npm run build`. Presentar y parar.

## R2 — Detalle en el flujo y navegación

**Objetivo:** detalle bajo el mapa con Cerrar al principio; ir al detalle desde marcador y fila; volver al origen al cerrar desde la tarjeta; conservar la posición cuando el detalle se quita desde fuera.

**Referencias:** `014-spec.md` → Alcance 2; `014-plan.md` → §2, §3, §4 y §5.

- [x] **R2.1** `LocationCard.scss`, composición apilada: en el flujo, margen superior, áreas `'close heading'`, columnas `auto minmax(0, 1fr)`, bordes completos. Escritorio: `'heading close'` y todo lo anclado sin cambios.
- [x] **R2.2** Tipo `SelectionOrigin` en `location-filters.ts`; en `WeatherApp`, `useState` del origen, `toggleFromMap` y `toggleFromList` estables, registro de filas en `useRef(new Map())`, `registerRow` y `findRow`.
- [x] **R2.3** `LocationMarker` y `LocationRow` informan de si la activación fue por teclado; `LocationRow` se registra con un callback ref estable. La fila sigue memoizada.
- [x] **R2.4** `SpainMap`: `isInFlow`; `useLayoutEffect` que lleva al comienzo del detalle al seleccionar; `closeCard` con vuelta al origen y retorno de foco con `preventScroll` cuando hay vuelta. Se retira el `opener` basado en `document.activeElement`.
- [x] **R2.5** `LocationCard.onRemove` y conservación de posición en `SpainMap` (§5) para cierres desde fuera de la tarjeta.
- [x] **R2.6** Contrato SCSS reescrito en `LocationCard.styles.test.ts` y tests (a)–(f) de `WeatherApp.test.tsx`; `SpainMap.test.tsx` con el retorno de foco desde el origen.
- [x] **R2.7** `npm run test`, `npm run lint`, `npm run build`. Presentar y parar.

## R3 — Selección visual

**Objetivo:** seleccionado en color, el resto en silueta; excluidos por filtro sin marcador; no seleccionados operables.

**Referencias:** `014-spec.md` → Alcance 3; `014-plan.md` → §7.

- [x] **R3.1** `MarkerLayers.tsx`: separar `excluded` de `silhouette`; `MarkerSprite` recibe `silhouette`; el marcador se monta con `!excluded`.
- [x] **R3.2** `MarkerLayers.test.tsx` table-driven (`it.each`) con los cinco casos del plan.
- [x] **R3.3** `npm run test`, `npm run lint`, `npm run build`. Presentar y parar.

## R4 — Foco por teclado

**Objetivo:** con teclado y la tarjeta en el flujo, el foco acompaña a la vista; sin modal ni trampa de foco; escritorio sin cambios.

**Referencias:** `014-spec.md` → Decisiones de producto (foco por teclado); `014-plan.md` → §6.

- [x] **R4.1** Implementar la política aprobada: foco en Cerrar al abrir con teclado con la tarjeta en el flujo (`closeRef`), sin efecto con puntero, toque o tecnología de asistencia; repeticiones de la tecla ignoradas en Cerrar; Escape o Intro en la fila, y Escape en el marcador, dejan ese elemento a la vista y enfocado, sin alterar la compensación de §5.
- [x] **R4.2** Test (g) de `WeatherApp.test.tsx`: foco, Escape con retorno al origen y Tab sin trampa; y tests de `SpainMap`, `LocationCard` y `LocationList` de la detección.
- [x] **R4.3** `npm run test`, `npm run lint`, `npm run build`. Presentar y parar.

## R5 — Validación en Chromium

**Referencias:** `014-plan.md` → Tests → Navegador real, Chromium.

- [x] **R5.1** Script temporal de Playwright fuera del repositorio, sin dependencias nuevas.
- [x] **R5.2** Leyenda: fondos computados en las cinco anchuras y capturas en paisaje y ventanas bajas.
- [x] **R5.3** Matriz de anchuras, pinch emulado al 400 % y zoom de navegador al 200 y 400 %, sin scroll horizontal.
- [x] **R5.4** Navegación marcador ↔ detalle y fila ↔ detalle, cambio de lugar entre vías y escritorio sin desplazamientos.
- [x] **R5.5** Filtros con el detalle abierto y la vista en la lista (búsqueda, zona, condición de la leyenda, Escape y segunda pulsación de la fila), con y sin `overflow-anchor`: sin saltos.
- [x] **R5.6** Siluetas con y sin filtros; marcadores en silueta operables y excluidos sin marcador.
- [x] **R5.7** Teclado según R4, consola limpia y tabla de resultados aparte de Safari. Parar.

## R6 — Safari de iPhone real y cierre

- [x] **R6.1** Repetir en Safari de iPhone, sobre el repositorio principal, marcador y fila a 100 y 400 %, vuelta al origen y siluetas.
  _Resultado comunicado por el usuario: todas las comprobaciones realizadas pasaron, sin incidencias._
- [ ] **R6.2** Añadir filtros que excluyen el lugar abierto, paisaje, VoiceOver y teclado externo si está disponible.
  _Filtros y paisaje: entre los pasos propuestos, con resultado correcto. VoiceOver: correcto en iPhone SE (2022). Teclado externo: no consta que se probara, así que no se da por superado._
- [x] **R6.3** Registrar dispositivo, versión de iOS, pasos, resultado y diferencias, aparte de Chromium.
  _Registrado en `014-spec.md` → Validación. Dispositivo: iPhone SE (2022), última versión de iOS (número no facilitado)._
- [x] **R6.4** Barrer spec, plan, tasks y comentarios de narración del proceso. Las secciones de histórico y de decisiones sustituidas se reducen a hechos finales.
  _Reescritos los dos comentarios que seguían describiendo la hoja `position: fixed` (`SpainMap.tsx`, `SpainMap.scss`); histórico de la solución anterior reducido a un párrafo; sin referencias al prototipo en los documentos ni comentarios sobre la hoja en el código._
- [x] **R6.5** Recorrer los criterios de aceptación y la definición de hecho de `AGENTS.md`.
  _Criterios de aceptación: todos verificados salvo uno, que depende de Safari real con teclado externo (`014-spec.md`). Definición de hecho: cumplida (cinco anchuras, información textual accesible, sin literales con token ni variables SCSS sin uso, filas memoizadas, `loading="lazy"` solo en la lista, sin datos nuevos de AEMET en runtime)._
- [x] **R6.6** Actualizar los estados de spec, plan y tasks. Mover la feature en `roadmap.md` solo con la aprobación del usuario.
  _Estados actualizados. `roadmap.md` no se ha tocado._
- [x] **R6.7** Presentar resultados finales y parar.

---

## Dependencias y orden

1. **Bloque 1 → R1 → R2 → R3 → R4 → R5 → R6.** Sin bloques en paralelo.
2. **R4** aplica la política de foco por teclado aprobada.
3. **R6** necesita Safari de iPhone real; la emulación no lo sustituye.

## Condiciones de parada

- Al final de cada bloque: tests, lint y build, presentar y parar.
- Si hace falta cambiar la spec o el plan, una dependencia nueva, la constitución o el roadmap: parar y consultar.
- Si §5 del plan no funciona en jsdom o en navegador por el orden de desmontaje: parar y proponer la alternativa del plan antes de cambiarla.

---

## Solución anterior sustituida

La primera solución de la tarjeta, una hoja inferior `position: fixed` que seguía al viewport visual con `VisualViewport`, se sustituyó por el detalle en el flujo (R1–R5). Sus tareas no forman parte del cierre. El motivo está en `014-spec.md` → Por qué y Decisiones sustituidas.
