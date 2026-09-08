# 002 · Pipeline de datos meteorológicos — Tareas

## Bloque 1 — Dominio y catálogo de lugares

- [ ] `src/domain/` — tipos del contrato: `SourceId`, `SkyCondition`, `Temperature`, `Precipitation`, `Snow`, `Wind`, `Marine`, `MarineAvailability`, `AlertLevel`, `AlertPhenomenon`, `OfficialAlert`, `AlertsAvailability`, `MetricPath`, `Degradation`, `Provenance`, `Location`, `LocationForecast`, `Forecast` (ver `002-plan.md`).
- [ ] Archivo de **configuración manual** (nombre indicativo, p. ej. `scripts/config/locations.manual.ts`) con los 74 lugares: `id`, `name`, `country`, `latitude`, `longitude`, `timezone`, `primarySource`, `coastal`, `marineCoordinates` (los 28 lugares costeros, más los ambiguos ya identificados — Girona, Murcia, Sevilla, Granada, Leiria — con su decisión explícita), `alertZoneIds`. Este archivo sí se edita a mano.
- [ ] `npm run build:locations` — script que lee la configuración manual, cruza el maestro de municipios de AEMET y el catálogo de `api.ipma.pt` para resolver `sourceIds` (código INE / `globalIdLocal`) automáticamente, y escribe `src/data/locations.ts` **generado** — no se edita a mano nunca, cualquier corrección va al archivo de configuración manual y se regenera.
- [ ] Tests: `locations.ts` tiene exactamente 74 entradas, sin duplicados de `id`, y todo lugar con `coastal: true` tiene `marineCoordinates`.

## Bloque 2 — Cliente AEMET

- [ ] `scripts/sources/aemet.ts` — cliente sobre el spike ya validado (doble llamada, decodificación ISO-8859-1, throttle, reintentos). Cubre predicción diaria **y horaria** por municipio (la horaria es la que da mm de precipitación y nieve reales — ver `002-plan.md`).
- [ ] Normalización AEMET → bloque parcial de `LocationForecast`: `temperature`, `sky`, `precipitation.mm` (sumando los cubos horarios del periodo), `precipitation.probabilityPercent`, `snow.present`, `wind.speedKmh`/`gustKmh`, `storm`, `calima`, `fog`.
- [ ] Tests con fixtures de respuestas reales guardadas (no llamadas en vivo en la suite de tests).

## Bloque 3 — Cliente IPMA

- [ ] `scripts/sources/ipma.ts` — previsión diaria por `globalIdLocal` y avisos (`warnings_www.json`).
- [ ] Normalización IPMA → bloque parcial: `temperature`, `sky`, `precipitation.probabilityPercent` (nunca `.mm`), `snow.present` (vía `idWeatherType`, nunca `.cm`), `storm`, `fog`. `calima` siempre `null` — sin categoría en IPMA, confirmado.
- [ ] Tests con fixtures reales.

## Bloque 4 — Cliente Open-Meteo (forecast + Marine)

- [ ] `scripts/sources/open-meteo.ts` — forecast estándar: `precipitation_sum`, `snowfall_sum`, `wind_speed_10m_max`, `wind_gusts_10m_max`, `weather_code`. Sin API key.
- [ ] `scripts/sources/open-meteo-marine.ts` — `wave_height`, `wave_period`, `wave_direction` vía `marineCoordinates`.
- [ ] Normalización Open-Meteo → bloque completo (Andorra, fuente única) y bloques reutilizables como complemento (`precipitation.mm`, `snow.cm`, `wind.speedKmh`/`gustKmh`, `marine`).
- [ ] Tests con fixtures reales.

## Bloque 5 — Combinación de fuentes: provenance, coherencia y degradación

- [ ] `src/domain/` — funciones puras: derivar `snow.present` desde `snow.cm` cuando existe (regla de coherencia), construir `Provenance` (primary + complementary disperso), construir `Degradation[]`.
- [ ] `scripts/` — orquestador por lugar: aplica principal + complementarias según `Location.primarySource` y la tabla de la 002 (España→snow, Portugal→precipitation/snow/wind, Andorra→nada).
- [ ] Tests table-driven: fuente única sin complemento; complemento exitoso; complemento fallido aislado (degradación, lugar válido); combinación con `snow.present`/`snow.cm` de fuentes distintas (verificar coherencia).

## Bloque 6 — Tolerancia a fallos y `meta`

- [ ] Constantes nombradas `MAX_FAILED_LOCATIONS_RATIO = 0.10` y `SYSTEMIC_COMPLEMENT_FAILURE_RATIO = 0.50`, configurables.
- [ ] Cálculo de `meta` (`totalLocations`, `successfulLocations`, `failedLocations`); exclusión de `locations[]` para fallos de fuente principal.
- [ ] Detección de fallo sistémico de complemento (ratio de fallos por combinación fuente-complementaria/grupo) como **señal independiente** (`hasSystemicComplementFailure`) — nunca sumada al conteo de fallos de fuente principal.
- [ ] Aborto: `primaryFailureRatio > MAX_FAILED_LOCATIONS_RATIO || hasSystemicComplementFailure` — el script sale con error (y no escribe `forecast.json`) si cualquiera de las dos se cumple.
- [ ] Tests: ninguna condición superada → publica con `failedLocations` no vacío; solo `primaryFailureRatio` superado → aborta; solo fallo sistémico de un complemento (con `primaryFailureRatio` bajo) → aborta igual, cada condición probada por separado.

## Bloque 7 — Avisos oficiales y zonas

- [ ] `Location.alertZoneIds` poblado contra el catálogo real de zonas de AEMET e IPMA (verificar caso por caso qué lugares necesitan más de una zona — no solo País Vasco por suposición).
- [ ] Integración de avisos en `LocationForecast.alerts`, con el vocabulario `AlertPhenomenon` ya mapeado (tabla de `002-plan.md`) y `sourcePhenomenon` conservando el literal original.
- [ ] Tests con fixtures reales de avisos activos e inactivos.

## Bloque 8 — Entrypoint y despliegue

- [ ] `scripts/fetch-forecast.ts` — orquesta todo lo anterior y escribe `src/data/forecast.json`.
- [ ] `package.json` → `npm run fetch:forecast` apunta a este entrypoint.
- [ ] **Un único workflow, una única cadena — sin depender de que un commit dispare otro workflow.** Se extiende `.github/workflows/deploy.yml` (de la 001) añadiendo un trigger `schedule` (cron diario, 06:00 UTC) además del `push`/`workflow_dispatch` que ya tiene, y un paso de fetch **antes** del build, dentro del mismo job/run:

  ```
  schedule (cron) / workflow_dispatch / push
          ↓
  fetch forecast (npm run fetch:forecast) — solo en schedule/workflow_dispatch
          ↓
  commit del bot con forecast.json (registro histórico — no dispara nada, es solo versión)
          ↓
  lint / test / build (ya existente de la 001)
          ↓
  deploy a GitHub Pages
  ```
  El commit del bot documenta la previsión de cada día en el historial de git (tal como ya prevé `tech-stack.md`), pero el propio run **continúa** hacia build/deploy sin esperar a que ese push dispare nada — nunca dos workflows encadenados por push.
- [ ] `AEMET_API_KEY` desde Secrets (IPMA y Open-Meteo no necesitan key).
- [ ] Verificación real: ejecutar el workflow (o el script en local con la key real) y confirmar que `forecast.json` sale válido para los 74 lugares y que el mismo run llega hasta el deploy.

## Bloque 9 — Cierre

- [ ] Barrer la narración del proceso de comentarios y de `002-spec.md`/`002-plan.md`/este archivo.
- [ ] Validar contra los criterios de aceptación de `002-spec.md`.
- [ ] Actualizar `constitution/roadmap.md`: mover la 002 a "Hecho", cerrar las "Decisiones pendientes" que esta feature resolvió (mapeo de zonas, umbrales ya no son propuesta sino hechos).
- [ ] Confirmar que ninguna llamada a AEMET/IPMA/Open-Meteo ocurre fuera de `scripts/` (nunca desde `src/` en runtime).

## Definición de "hecho" (además de los criterios de la spec)

- [ ] Ningún valor se fabrica por conversión aproximada (mm↔cm de nieve AEMET, clase↔km/h de IPMA) — verificado por revisión de código, no solo por test.
- [ ] `degradations` y `meta.failedLocations` reflejan la realidad de la última ejecución en cualquier fixture de test que simule fallos.
- [ ] Ningún literal de umbral (`0.10`, `0.50`) aparece hardcodeado fuera de su constante nombrada.
- [ ] Grep de variables/tipos del dominio tocados en esta feature: 0 quedan sin uso.

## Mantenimiento (checklist recurrente)

- [ ] Si AEMET, IPMA u Open-Meteo cambian su schema de respuesta, revisar primero los fixtures de test antes de tocar la normalización.
- [ ] Revisar `MAX_FAILED_LOCATIONS_RATIO`/`SYSTEMIC_COMPLEMENT_FAILURE_RATIO` con datos reales de ejecuciones pasadas cada cierto tiempo — son una propuesta de partida, no cifras definitivas.
