# 007 · Profesor Oak — Tareas

_Checklist derivada del `007-plan.md`, agrupada en bloques. Se implementa un bloque, se para y se enseña al usuario antes de pasar al siguiente (`AGENTS.md`, paso 5)._

## Bloque 0 — Preparar el dominio (movimientos, sin lógica nueva)

- [ ] Mover `isActiveOnDate` de `src/domain/assign-pokemon.ts` a `src/domain/alerts.ts` y exportarla; `assign-pokemon.ts` la importa. Sin cambio de comportamiento.
- [ ] Mover `MAP_PRIORITY` + `pickMapPokemon` a `src/domain/map-priority.ts`; actualizar los imports de `SpainMap/`, `Legend/` y sus tests.
- [ ] Añadir `isSignificantPokemon(id)` junto a `MAP_PRIORITY`: `índice < índice de 'hoppip'`, la frontera de "condición significativa" que el propio array ya documenta.
- [ ] Mover el `Record<PokedexId, string>` de `Legend/legend-metadata.ts` a `src/domain/pokemon-labels.ts` como `POKEMON_LABELS`; actualizar `Legend.tsx` y su test. **No se mueve nada visual**: `sprite-sources.ts` se queda donde está.
- [ ] Mover `buildLocationViews` + `LocationView` a `src/domain/location-views.ts`; actualizar imports.
- [ ] `npm run lint` y `npm run test` en verde sin cambiar ninguna aserción.

## Bloque 1 — Tipos y hechos

- [x] Contratos repartidos por módulo en vez de un `types.ts` cajón: los 12 `NarrativeFact` en `types.ts`, `DayMode`/`DayModeDecision` en `day-mode.ts`, `Tone`/`DialogueRole`/`DialogueId`/`DialogueSlot`/`DayPlan`/`OakDialogue` en `plan-dialogues.ts`, `Protagonist` en `protagonists.ts`, `LeitmotifId` en `leitmotifs.ts`, `OakHistoryEntry` en `history.ts` y `OakToday` en `oak-today.ts`.
- [ ] `src/domain/oak/facts.ts` — `collectFacts(locations, forecast): NarrativeFact[]`. Cada número sale tal cual del `LocationForecast`; **cada `PokedexId` sale de `pickMapPokemon`**, nunca de un `assignBy*`.
- [ ] `mapRepresentsFact` calculado una sola vez por hecho, comparando el eje que lo produjo con el Pokémon visible del lugar.
- [ ] Filtrado de avisos por `forecast.date` con `isActiveOnDate` y deduplicado por `officialZoneId + phenomenon + level + startsAt`.
- [ ] Tests table-driven (`it.each`): un caso por `kind`, los `null`/`0`/`false` que no deben producir hecho, el filtrado/deduplicado de avisos, y **un test explícito de que ningún hecho expone un candidato descartado** (fixture con lluvia + tormenta en el mismo lugar).

## Bloque 2 — Protagonistas y modo del día

- [ ] `src/domain/oak/protagonists.ts` — `selectProtagonists(views): Protagonist[]` con los roles `headline`/`spread`/`rarity` y su desempate por `MAP_PRIORITY`.
- [ ] `src/domain/oak/day-mode.ts` — cuatro modos en orden de prioridad (`alerta` → `invasion` → `avistamiento` → `parte`), primer modo que cumple. Depende solo del forecast y de los Pokémon visibles, no de los roles de protagonista.
- [ ] Tests: cada modo con su caso que lo activa y su caso que no; `alerta` que ignora el amarillo; `avistamiento` que ignora un `castform-sun` raro por no ser significativo; colisión de roles de protagonista; día con un solo protagonista.
- [ ] Comprobar que ningún archivo de `oak/` contiene un umbral meteorológico ni un `PokedexId` decidido por Oak.

## Bloque 3 — Historial, leitmotivs y plan de diálogos

- [ ] `src/domain/oak/leitmotifs.ts` — los cinco: `hoppip-vuela`, `castform-vestuario`, `groudon-termostato`, `gyarados-mar`, `snorunt-frio`, cada uno con su `cooldownDays` y su condición de elegibilidad sobre los hechos del día.
- [ ] `src/domain/oak/history.ts` — puro e **idempotente por fecha**: ignora la entrada de la fecha objetivo al leer, upsert al escribir, invariante de "una entrada por fecha", retención contada por días distintos.
- [ ] Reglas de continuidad: cooldown de leitmotivs, rotación de modo repetido (`alerta` nunca cede), sustitución de protagonista repetido.
- [ ] `src/domain/oak/plan-dialogues.ts` — los 3 `DialogueSlot` sin solapar, 1–2 hechos por slot, tono por rol, preferencia por hechos con `mapRepresentsFact: true` en el `foco`.
- [ ] Tests: ningún hecho repetido entre slots; siempre 3 slots no vacíos; día trivial que sigue produciendo 3 slots; las tres reglas de continuidad; **dos generaciones seguidas para la misma fecha producen el mismo resultado y dejan una única entrada de historial**.

## Bloque 4 — Fallback local

- [ ] `src/domain/oak/fallback-dialogues.ts` — una cláusula por `kind` de hecho y marcos de frase por rol, con semilla determinista derivada de `date`.
- [ ] Tests: determinismo (mismo día → mismo texto), longitud dentro de 20–160 caracteres, los 3 diálogos siempre presentes, ningún dato ni Pokémon que no esté en los hechos.
- [ ] Revisión de voz contra la referencia de personaje del `007-plan.md`: leer los 3 diálogos de varios días de ejemplo y confirmar que suenan a Oak y no a boletín.

## Bloque 5 — Generación e IA

- [x] `scripts/oak/build-day-plan.ts` — lee `forecast.json`, `locations.ts` y el historial, comprueba que `forecast.date === computeTargetDate(now)` antes de nada y arma el `DayPlan` encadenando las funciones puras. Ninguna decisión narrativa vive en `scripts/`.
- [x] `scripts/oak/groq-adapter.ts` — una llamada `fetch` con `response_format: json_schema` (`strict: true`), `reasoning_effort: 'low'`, `stream: false`, `max_completion_tokens`, timeout con `AbortSignal.timeout`, sin reintentos, sin SDK, sin herramientas. Modelo `openai/gpt-oss-120b` por defecto, configurable con `GROQ_MODEL`. Devuelve `null` ante cualquier fallo del proveedor.
- [x] `scripts/oak/validate.ts` — validación propia del output (3 diálogos, ids en orden, longitud 20–160, sin campos extra) → fallback ante cualquier desviación; y `assertValidOakToday`, que ante un fallo nuestro lanza en vez de publicar.
- [x] `scripts/oak/generate.ts` — construye y valida los dos objetos completos en memoria y solo entonces escribe `src/data/oak-today.json` y `src/data/oak-history.json` (temporal + `rename`, los dos temporales antes de renombrar ninguno). Falla ruidosamente y sin escribir nada ante cualquier fallo propio: un error de generación nunca pisa el último JSON válido.
- [x] `npm run generate:oak` en `package.json`; `GROQ_API_KEY` y `GROQ_MODEL` en `.env.example`, nunca `VITE_*`.
- [x] Tests del adapter con `fetch` simulado (429, 500, red, timeout, sin content, JSON inválido, ids invertidos, texto corto/largo, campos extra, respuesta correcta) y del generador contra directorio temporal (guarda de fecha, historial ausente/corrupto, rerun idempotente, `role` desde el plan, fallo propio que no se convierte en fallback, ningún archivo escrito hasta tener los dos válidos).

## Bloque 6 — Consumo desde el frontend

- [ ] Tipar e importar `src/data/oak-today.json` en `App.tsx` y pasarlo a `WeatherApp`, igual que `forecast.json`.
- [ ] Componente `src/components/ProfessorOak/` — **solo tras decidir su UX con el usuario**; sin lógica narrativa propia, sin voz ni TTS.
- [ ] Tests de renderizado y de acceso por teclado a los 3 diálogos.

## Bloque 7 — Workflow

- [ ] Paso `Generate Oak` en `.github/workflows/deploy.yml`, **después del `Upload raw forecast artifact`** (que no se mueve) y antes de lint/test/build, con el mismo `if:` que el fetch.
- [ ] Paso propio de artifact para `oak-today.json` / `oak-history.json`, posterior a la generación.
- [ ] Incluir `oak-today.json` y `oak-history.json` en el commit diario.
- [ ] `GROQ_API_KEY` como secret del repositorio.
- [ ] Ejecución manual (`workflow_dispatch`) de verificación de extremo a extremo, y una segunda seguida para comprobar la idempotencia del historial.

## Bloque 8 — cierre

- [ ] `npm run lint` y `npm run test` en verde.
- [ ] Revisar accesibilidad de los diálogos (semántica, foco, teclado).
- [ ] Actualizar `constitution/tech-stack.md`: proveedor y modelo de IA, secret nuevo, `oak-today.json`/`oak-history.json` en `src/data/`, comando `generate:oak`, y los módulos que pasan a `src/domain/`.
- [ ] Actualizar `constitution/roadmap.md`: mover la 007 a "Hecho" y cerrar las entradas de "Decisiones pendientes" sobre el umbral de `alerta` y la cobertura de avisos.
- [ ] Barrer la narración del proceso de comentarios, `007-spec.md`, `007-plan.md` y este archivo (`AGENTS.md`, paso 7).
- [ ] Validar contra los criterios de aceptación de `007-spec.md`.

## Definición de "hecho" (además de los criterios de la spec)

- [ ] Sin dependencias nuevas.
- [ ] Ningún dato nuevo se pide a AEMET/IPMA/Open-Meteo/Groq desde el navegador.
- [ ] `src/domain/` sigue sin importar nada de `src/components/` ni de `scripts/`.
- [ ] Ningún valor de espaciado/color nuevo se escribe como literal si ya existe un token.
