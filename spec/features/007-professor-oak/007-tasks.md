# 007 · Profesor Oak — Tareas

_Checklist derivada del `007-plan.md`, agrupada en bloques. Se implementa un bloque, se para y se enseña al usuario antes de pasar al siguiente (`AGENTS.md`, paso 5)._

**Estado.** Feature cerrada. El bloque del workflow (7) se implementó antes que el del frontend (6): el primer `oak-today.json` tenía que salir de una generación diaria válida y no de un seed escrito a mano, y el frontend necesitaba ese JSON real para construirse contra él.

## Bloque 0 — Preparar el dominio (movimientos, sin lógica nueva)

- [x] Mover `isActiveOnDate` de `src/domain/assign-pokemon.ts` a `src/domain/alerts.ts` y exportarla; `assign-pokemon.ts` la importa. Sin cambio de comportamiento.
- [x] Mover `MAP_PRIORITY` + `pickMapPokemon` a `src/domain/map-priority.ts`; actualizar los imports de `SpainMap/`, `Legend/` y sus tests.
- [x] Añadir `isSignificantPokemon(id)` junto a `MAP_PRIORITY`: `índice < índice de 'hoppip'`, la frontera de "condición significativa" que el propio array ya documenta.
- [x] Mover el `Record<PokedexId, string>` de `Legend/legend-metadata.ts` a `src/domain/pokemon-labels.ts` como `POKEMON_LABELS`; actualizar `Legend.tsx` y su test. **No se mueve nada visual**: `sprite-sources.ts` se queda donde está.
- [x] Mover `buildLocationViews` + `LocationView` a `src/domain/location-views.ts`; actualizar imports.
- [x] `npm run lint` y `npm run test` en verde sin cambiar ninguna aserción.

## Bloque 1 — Tipos y hechos

- [x] Contratos repartidos por módulo en vez de un `types.ts` cajón: los 12 `NarrativeFact` en `types.ts`, `DayMode`/`DayModeDecision` en `day-mode.ts`, `Tone`/`DialogueRole`/`DialogueId`/`DialogueSlot`/`DayPlan`/`OakDialogue` en `plan-dialogues.ts`, `Protagonist` en `protagonists.ts`, `LeitmotifId` en `leitmotifs.ts`, `OakHistoryEntry` en `history.ts` y `OakToday` en `oak-today.ts`.
- [x] `src/domain/oak/facts.ts` — `collectFacts(locations, forecast): NarrativeFact[]`. Cada número sale tal cual del `LocationForecast`; **cada `PokedexId` sale de `pickMapPokemon`**, nunca de un `assignBy*`.
- [x] `mapRepresentsFact` calculado una sola vez por hecho, comparando el eje que lo produjo con el Pokémon visible del lugar.
- [x] Filtrado de avisos por `forecast.date` con `isActiveOnDate` y deduplicado por `officialZoneId + phenomenon + level + startsAt`.
- [x] Tests table-driven (`it.each`): un caso por `kind`, los `null`/`0`/`false` que no deben producir hecho, el filtrado/deduplicado de avisos, y **un test explícito de que ningún hecho expone un candidato descartado** (fixture con lluvia + tormenta en el mismo lugar).

## Bloque 2 — Protagonistas y modo del día

- [x] `src/domain/oak/protagonists.ts` — `selectProtagonists(views): Protagonist[]` con los roles `headline`/`spread`/`rarity` y su desempate por `MAP_PRIORITY`.
- [x] `src/domain/oak/day-mode.ts` — cuatro modos en orden de prioridad (`alerta` → `invasion` → `avistamiento` → `parte`), primer modo que cumple. Depende solo del forecast y de los Pokémon visibles, no de los roles de protagonista.
- [x] Tests: cada modo con su caso que lo activa y su caso que no; `alerta` que ignora el amarillo; `avistamiento` que ignora un `castform-sun` raro por no ser significativo; colisión de roles de protagonista; día con un solo protagonista.
- [x] Comprobar que ningún archivo de `oak/` contiene un umbral meteorológico ni un `PokedexId` decidido por Oak. Los únicos `PokedexId` de `oak/` son los sujetos de los leitmotivs, que no asignan nada; el `≤ 2` de `avistamiento` es un umbral de rareza narrativa, no meteorológico.

## Bloque 3 — Historial, leitmotivs y plan de diálogos

- [x] `src/domain/oak/leitmotifs.ts` — los cinco: `hoppip-vuela`, `castform-vestuario`, `groudon-termostato`, `gyarados-mar`, `snorunt-frio`, cada uno con su `cooldownDays` y su condición de elegibilidad sobre los hechos del día.
- [x] `src/domain/oak/history.ts` — puro e **idempotente por fecha**: ignora la entrada de la fecha objetivo al leer, upsert al escribir, invariante de "una entrada por fecha", retención contada por días distintos.
- [x] Reglas de continuidad: cooldown de leitmotivs, rotación de modo repetido (`alerta` nunca cede), sustitución de protagonista repetido.
- [x] `src/domain/oak/plan-dialogues.ts` — los 3 `DialogueSlot` sin solapar, 1–2 hechos por slot, tono por rol, preferencia por hechos con `mapRepresentsFact: true` en el `foco`.
- [x] Tests: ningún hecho repetido entre slots; siempre 3 slots no vacíos; día trivial que sigue produciendo 3 slots; las tres reglas de continuidad; **dos generaciones seguidas para la misma fecha producen el mismo resultado y dejan una única entrada de historial**.

## Bloque 4 — Fallback local

- [x] `src/domain/oak/fallback-dialogues.ts` — una cláusula por `kind` de hecho y marcos de frase por rol, con semilla determinista derivada de `date`.
- [x] Tests: determinismo (mismo día → mismo texto), longitud dentro de 20–160 caracteres, los 3 diálogos siempre presentes, ningún dato ni Pokémon que no esté en los hechos.
- [x] Revisión de voz contra la referencia de personaje del `007-plan.md`: leer los 3 diálogos de varios días de ejemplo y confirmar que suenan a Oak y no a boletín. Tres pasadas editoriales con el usuario.

## Bloque 5 — Generación e IA

- [x] `scripts/oak/build-day-plan.ts` — lee `forecast.json`, `locations.ts` y el historial, comprueba que `forecast.date === computeTargetDate(now)` antes de nada y arma el `DayPlan` encadenando las funciones puras. Ninguna decisión narrativa vive en `scripts/`.
- [x] `scripts/oak/groq-adapter.ts` — una llamada `fetch` con `response_format: json_schema` (`strict: true`), `reasoning_effort: 'low'`, `stream: false`, `max_completion_tokens`, timeout con `AbortSignal.timeout`, sin reintentos, sin SDK, sin herramientas. Modelo `openai/gpt-oss-120b` por defecto, configurable con `GROQ_MODEL`. Devuelve `null` ante cualquier fallo del proveedor.
- [x] `scripts/oak/validate.ts` — validación propia del output (3 diálogos, ids en orden, longitud 20–160, sin campos extra) → fallback ante cualquier desviación; y `assertValidOakToday`, que ante un fallo nuestro lanza en vez de publicar.
- [x] `scripts/oak/generate.ts` — construye y valida los dos objetos completos en memoria y solo entonces escribe `src/data/oak-today.json` y `src/data/oak-history.json` (temporal + `rename`, los dos temporales antes de renombrar ninguno). Falla ruidosamente y sin escribir nada ante cualquier fallo propio: un error de generación nunca pisa el último JSON válido.
- [x] `npm run generate:oak` en `package.json`; `GROQ_API_KEY` y `GROQ_MODEL` en `.env.example`, nunca `VITE_*`.
- [x] Tests del adapter con `fetch` simulado (429, 500, red, timeout, sin content, JSON inválido, ids invertidos, texto corto/largo, campos extra, respuesta correcta) y del generador contra directorio temporal (guarda de fecha, historial ausente/corrupto, rerun idempotente, `role` desde el plan, fallo propio que no se convierte en fallback, ningún archivo escrito hasta tener los dos válidos).

## Bloque 6 — La escena de Oak en el frontend

- [x] `OakToday` amplía el contrato con `serious` y un `tone` por diálogo, los dos tomados del `DayPlan` en `generate.ts` y exigidos por `assertValidOakToday`. El frontend recibe resuelto lo que necesita para elegir la pose: no lo deduce del texto ni del modo.
- [x] `readOakToday` valida el JSON importado antes de montar nada: otra fecha que el mapa, o el contrato anterior, y la escena no sale — EMPEZAR lleva al mapa como antes.
- [x] Seis poses de PNG a WebP con alfa sin pérdida (1.893 → 618 KB, mismas dimensiones, nada recortado) y el blip de la máquina de escribir, en `src/assets/oak/`. `oak-tired` queda como pose secundaria: ningún tono la pide y no entra en el bundle.
- [x] `oak-pose.ts` — `Record<Tone, OakPose>` completo (un tono nuevo no compila hasta tener pose) y la regla de día serio: nunca `playful` ni `epic`.
- [x] Componente `src/components/ProfessorOak/` con el retrato y el cuadro de texto clásico recreado en HTML + SCSS, sin lógica narrativa propia, sin voz ni TTS y sin librerías.
- [x] Etapa `oak` en el flujo de entrada de `App.tsx`, con el mapa montado debajo e `inert` mientras Oak habla.
- [x] El jingle de EMPEZAR se funde a 0 al salir la portada y Oak espera 200 ms antes de hablar: el blip no se solapa con él. Medido en el build de producción.
- [x] Tests de renderizado, pose, máquina de escribir, audio, movimiento reducido y acceso por teclado a los 3 diálogos, más los del flujo completo en `App`.
- [x] Verificación visual en navegador a cinco tamaños, con el peor caso de 160 caracteres, día serio y movimiento reducido: Oak entero en pantalla, sin desbordes y con el texto siempre por encima del retrato.

## Bloque 7 — Workflow

- [x] Paso `Generate Oak` en `.github/workflows/deploy.yml`, **después del `Upload raw forecast artifact`** (que no se movió) y antes de lint/test/build, con el mismo `if:` que el fetch y sin `continue-on-error`.
- [x] Paso propio de artifact para `oak-today.json` / `oak-history.json`, posterior a la generación y sin mezclarse con el snapshot meteorológico.
- [x] Los tres JSON en el mismo commit diario, nunca en tres commits; mecanismo, autor, mensaje y push sin tocar.
- [x] `GROQ_API_KEY` como secret del repositorio, dada de alta por el usuario. Su ausencia no bloquea nada: el paso se ejecuta igual y sale el fallback local.
- [x] Ejecución manual (`workflow_dispatch`) de verificación de extremo a extremo: es la que produjo el primer `oak-today.json` real, a partir de un forecast fresco del mismo run. No se creó ningún seed a mano.
- [x] Segunda ejecución manual seguida: `oak-history.json` byte a byte idéntico, idempotencia comprobada.
- [x] Tercera ejecución manual ya con `GROQ_API_KEY` dada de alta, con `source: 'ai'` verificado.

## Bloque 7 bis — Frontera claims → IA, guarda factual y días serios

_Con un payload de `NarrativeFact` serializados, el modelo tiene que interpretar nuestro modelo de dominio, y lo interpreta mal ("la noche más fría: 10-30 °C", "7 avisos", "desde La Rioja hasta Huesca"). La frontera se mueve; el prompt no se apreta._

- [x] `src/domain/oak/claims.ts` — transformación pura `DayPlan → afirmaciones en español ya resueltas`, una por hecho, con el vocabulario que cada diálogo autoriza. Solo viaja el valor que el papel señala: la `maxC` de una noche fría no sale del dominio.
- [x] Selección de `day_shape` nuestra y no suya: avisos > lluvia > ausencia de ambos, el total como contexto y nunca `distinctPokemonCount`. El campo sigue en el contrato.
- [x] `scripts/oak/oak-prompt.ts` — character bible, los cinco tonos, la política de días serios y una dirección editorial por leitmotiv. El prompt es prosa y vive aparte del transporte.
- [x] `scripts/oak/factual-guard.ts` — guarda determinista post-Groq: ninguna cifra, lugar, Pokémon ni nivel de aviso que no esté en los claims de ese hueco. Sin NLP, sin LLM juez, sin dependencias. Sus dos puntos ciegos están documentados y con test propio.
- [x] El payload deja de llevar `NarrativeFact`: ni ids técnicos, ni trazabilidad del aviso, ni `mapPokemonId`/`mapRepresentsFact`, ni el recuento descartado, ni el valor térmico que no toca, ni la fecha.
- [x] `src/domain/oak/serious-day.ts` — política de días serios con motivo extensible (`'aviso-oficial'`), pensada para que una causa futura no meteorológica entre sin tocar nada más. `DayPlan.serious` la transporta.
- [x] Un día serio no elige leitmotiv, no consume cooldown, no puede llevar tono `guasa` y `planDialogues` lanza si se colara alguno. El fallback adapta además el `epico` a la voz del `consejo`: un aviso rojo es excepcional en el plan, pero no se cuenta como espectáculo.
- [x] Tests: los doce `kind` convertidos a claim, el valor descartado ausente del texto y del vocabulario, las cuatro ramas de `day_shape`, la guarda contra las familias de error reales, fixtures naranja y rojo sin humor en ningún slot, y el resto de modos conservando su gag.
- [x] Cuarta y quinta ejecuciones manuales, auditadas contra los claims del mismo run: la quinta sale con `source: 'ai'`, cero desviaciones factuales y las cifras publicadas exactamente iguales a las autorizadas.

## Bloque 8 — cierre

- [x] `npm run lint` y `npm run test` en verde.
- [x] Accesibilidad de los diálogos, repasada en navegador: `role="dialog"` con `aria-modal`, nombre accesible "Profesor Oak" (sin placa visible), `aria-describedby` con la pista de avance, el foco entra en la escena al aparecer, el mapa queda `inert` debajo y recupera la interacción al salir, y el bocadillo completo se anuncia de una vez en una región viva en vez de carácter a carácter. **Hallazgo anotado:** `Escape` no cierra la escena, cosa que un diálogo modal sí suele ofrecer; queda como decisión de producto porque el juego de interacciones (clic/toque/Intro/Espacio) está fijado a propósito.
- [x] `constitution/tech-stack.md` actualizado: proveedor y modelo de IA, `GROQ_API_KEY`, los dos JSON de Oak en `src/data/`, `npm run generate:oak`, los módulos que pasan a `src/domain/`, `src/assets/oak/`, la excepción de unidades para lo que se superpone a la réplica fija y tres límites duros nuevos.
- [x] `constitution/roadmap.md` actualizado: la 007 en "Hecho", y cerradas las entradas de "Decisiones pendientes" sobre el umbral de `alerta` (naranja y rojo) y la cobertura de avisos (los 74 proxies).
- [x] Barrida la narración del proceso de `007-spec.md`, `007-plan.md` y este archivo (`AGENTS.md`, paso 7).
- [x] Validada contra los criterios de aceptación de `007-spec.md`: los 21 se cumplen.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Sin dependencias nuevas. La 007 solo añade el script `generate:oak` al `package.json`.
- [x] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo/Groq desde el navegador.
- [x] `src/domain/` sigue sin importar nada de `src/components/` ni de `scripts/`.
- [x] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token. El SCSS de la escena no contiene ni un hex: todo color sale de `_variables.scss`, y los dos tokens nuevos (`$z-oak`, `$z-landing`) se añadieron ahí. Las medidas en `px`/`vw` con `clamp()` son la excepción documentada en `tech-stack.md` para lo que se superpone a la réplica fija.
