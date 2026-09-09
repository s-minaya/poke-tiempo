# 002 · Pipeline de datos meteorológicos — Tareas

## Bloque 1 — Dominio y catálogo de lugares ✅

- [x] `src/domain/` — tipos del contrato: `SourceId`, `SkyCondition`, `Temperature`, `Precipitation`, `Snow`, `Wind`, `Marine`, `MarineAvailability`, `AlertLevel`, `AlertPhenomenon`, `OfficialAlert`, `AlertsAvailability`, `MetricPath`, `Degradation`, `Provenance`, `Location`, `LocationForecast`, `Forecast` (ver `002-plan.md`).
- [x] Archivo de **configuración manual** (nombre indicativo, p. ej. `scripts/config/locations.manual.ts`) con los 74 lugares: `id`, `name`, `country`, `latitude`, `longitude`, `timezone`, `primarySource`, `coastal`, `marineCoordinates` (los 28 lugares costeros, más los ambiguos ya identificados — Girona, Murcia, Sevilla, Granada, Leiria — con su decisión explícita), `alertZoneIds`. Este archivo sí se edita a mano.
- [x] `npm run build:locations` — script que lee la configuración manual, cruza el maestro de municipios de AEMET y el catálogo de `api.ipma.pt` para resolver `sourceIds` (código INE / `globalIdLocal`) automáticamente, y escribe `src/data/locations.ts` **generado** — no se edita a mano nunca, cualquier corrección va al archivo de configuración manual y se regenera.
- [x] Tests: `locations.ts` tiene exactamente 74 entradas, sin duplicados de `id`, y todo lugar con `coastal: true` tiene `marineCoordinates`.

## Bloque 2 — Cliente AEMET ✅

- [x] `scripts/sources/aemet.ts` — cliente (doble llamada, decodificación ISO-8859-1, throttle, reintentos). Cubre predicción diaria **y horaria** por municipio.
- [x] Normalización AEMET → bloque parcial de `LocationForecast`: `temperature`, `sky`, `precipitation.probabilityPercent`, `snow.present`, `wind.speedKmh`/`gustKmh`, `storm`, `calima`, `fog`. `precipitation.mm` **no** sale de AEMET: su horaria de "hoy" solo cubre desde la hora de generación hasta el final del día, nunca el día completo, así que no es un acumulado diario válido — queda `null` y lo complementa Open-Meteo (Bloque 4/5).
- [x] Tests con fixtures de respuestas reales guardadas (no llamadas en vivo en la suite de tests).

## Bloque 3 — Cliente IPMA ✅

- [x] `scripts/sources/ipma.ts` — previsión diaria por `globalIdLocal` y avisos (`warnings_www.json`).
- [x] Normalización IPMA → bloque parcial: `temperature`, `sky`, `precipitation.probabilityPercent` (nunca `.mm`), `snow.present` (vía `idWeatherType`, nunca `.cm`), `storm`, `fog`. `calima` siempre `null` — sin categoría en IPMA, confirmado. Un `idWeatherType` fuera del catálogo se trata como sin información (null), no como fenómeno ausente.
- [x] Tests con fixtures reales.

## Bloque 4 — Cliente Open-Meteo (forecast + Marine) ✅

- [x] `scripts/sources/open-meteo.ts` — forecast estándar: `snowfall_sum`, `wind_speed_10m_max`, `wind_gusts_10m_max`, `weather_code`. Sin API key. `precipitation.mm` se construye como `rain_sum + showers_sum` (precipitación líquida real) — nunca `precipitation_sum`, que Open-Meteo documenta como "rain, showers and snowfall" y por tanto incluye el equivalente en agua de la nieve.
- [x] `scripts/sources/open-meteo-marine.ts` — `wave_height_max`, `wave_period_max`, `wave_direction_dominant` vía `marineCoordinates`. Los 28 puntos costeros de `locations.ts` verificados uno a uno contra la API real.
- [x] Normalización Open-Meteo → bloque completo (Andorra, fuente única) y bloques reutilizables como complemento (`precipitation.mm`, `snow.cm`, `wind.speedKmh`/`gustKmh`, `marine`).
- [x] Tests con fixtures reales.

## Bloque 5 — Combinación de fuentes: provenance, coherencia y degradación ✅

- [x] `src/domain/` — funciones puras: derivar `snow.present` desde `snow.cm` cuando existe (regla de coherencia), construir `Provenance` (primary + complementary disperso), construir `Degradation[]`.
- [x] `scripts/` — orquestador por lugar: aplica principal + complementarias según `Location.primarySource` y la tabla de la 002 (España→precipitation/snow, Portugal→precipitation/snow/wind, Andorra→nada).
- [x] Tests table-driven: fuente única sin complemento; complemento exitoso; complemento fallido aislado (degradación, lugar válido); combinación con `snow.present`/`snow.cm` de fuentes distintas (verificar coherencia).

## Bloque 6 — Tolerancia a fallos y `meta` ✅

- [x] Constantes nombradas `MAX_FAILED_LOCATIONS_RATIO = 0.10` y `SYSTEMIC_COMPLEMENT_FAILURE_RATIO = 0.50`, configurables.
- [x] Cálculo de `meta` (`totalLocations`, `successfulLocations`, `failedLocations`); exclusión de `locations[]` para fallos de fuente principal.
- [x] Detección de fallo sistémico de complemento (ratio de fallos por combinación fuente-complementaria/grupo) como **señal independiente** (`hasSystemicComplementFailure`) — nunca sumada al conteo de fallos de fuente principal. El ratio se calcula por **intentos de complemento por lugar**, nunca contando entradas de `degradations` (un mismo fallo genera 2 entradas en España y 4 en Portugal, pero es un único intento).
- [x] Aborto: `primaryFailureRatio > MAX_FAILED_LOCATIONS_RATIO || hasSystemicComplementFailure` — el script sale con error (y no escribe `forecast.json`) si cualquiera de las dos se cumple.
- [x] Tests: ninguna condición superada → publica con `failedLocations` no vacío; solo `primaryFailureRatio` superado → aborta; solo fallo sistémico de un complemento (con `primaryFailureRatio` bajo) → aborta igual, cada condición probada por separado.

## Bloque 7 — Avisos oficiales y zonas ✅

- [x] `Location.alertZoneIds` poblado contra el catálogo real de zonas de AEMET (PDF oficial "Detalle de municipios por zonas meteorológicas", cruzado por código INE) e IPMA (`idAreaAviso` del catálogo de distritos). 24 de los 25 lugares costeros de España llevan zona terrestre + su compañera marítima (mismo código + sufijo "C", confirmado contra `avisos_cap` real). País Vasco es el único con tres zonas: el municipio de Bilbao (su proxy) cae en "Bizkaia interior", sin compañera costera, así que se añade también "Bizkaia litoral" + su "C" — ver comentario en `locations.manual.ts`. Cada lugar usa solo la zona de su propio punto/proxy, nunca todas las zonas de la isla/CCAA que representa visualmente.
- [x] Cliente y normalización de avisos: `scripts/sources/aemet-alerts.ts` (lector TAR propio + parser CAP XML + `normalizeAemetAlert`) y `normalizeIpmaAlert` en `ipma.ts`, con el vocabulario `AlertPhenomenon` verificado contra el catálogo real (AEMET tiene 3 fenómenos sin categoría en el dominio — Aludes, Galernas, Rissagas — que caen en `'desconocido'` a propósito) y `sourcePhenomenon` conservando el literal original. `selectAlertsForZones` (dominio, puro) filtra por lugar.
- [x] Tests con fixtures reales de avisos activos (naranja, amarillo) e inactivos (verde/green, filtrados antes de llegar a `OfficialAlert`).

## Bloque 8 — Entrypoint y despliegue ✅

- [x] `scripts/fetch-forecast.ts` — orquesta todo lo anterior y escribe `src/data/forecast.json`.
- [x] `package.json` → `npm run fetch:forecast` apunta a este entrypoint.
- [x] **Un único workflow, una única cadena — sin depender de que un commit dispare otro workflow.** `.github/workflows/deploy.yml` extendido con un trigger `schedule` (cron diario, 06:00 UTC) además del `push`/`workflow_dispatch` que ya tenía, y un paso de fetch **antes** del build, dentro del mismo job/run:

  ```
  schedule (cron) / workflow_dispatch / push
          ↓
  fetch forecast (npm run fetch:forecast) — solo en schedule/workflow_dispatch
          ↓
  commit del bot con forecast.json (registro histórico — no dispara nada, usa el GITHUB_TOKEN por defecto)
          ↓
  lint / test / build (ya existente de la 001)
          ↓
  deploy a GitHub Pages
  ```
- [x] `AEMET_API_KEY` desde Secrets (IPMA y Open-Meteo no necesitan key) — falta que una persona lo dé de alta en la configuración del repositorio, un agente no puede hacerlo.
- [x] Verificación real: ejecutado en local con la key real contra las tres fuentes. El ritmo sostenido real de AEMET es más estricto que el 50/min documentado en `tech-stack.md` — `AEMET_MAX_REQUESTS_PER_MINUTE` queda en 28 req/min, y un HTTP 429 tiene su propio backoff (lineal, más largo que el de un fallo de red genérico), en vez de tratarse como un fallo transitorio cualquiera. Con eso: 69/74 lugares en una ejecución completa (5 fallos residuales de AEMET, dentro del 10% tolerado — verificados uno a uno como transitorios, no un error de configuración), `forecast.json` válido, estructura verificada a mano (Lisboa reproduce el ejemplo de `002-plan.md`, Andorra sin `marine`/`alerts`, Almería con su aviso real, `meta` consistente).

## Bloque 9 — Cierre ✅

- [x] Barrer la narración del proceso de comentarios y de `002-spec.md`/`002-plan.md`/este archivo.
- [x] Validar contra los criterios de aceptación de `002-spec.md`.
- [x] Actualizar `constitution/roadmap.md`: mover la 002 a "Hecho", cerrar las "Decisiones pendientes" que esta feature resolvió (mapeo de zonas, umbrales ya no son propuesta sino hechos).
- [x] Confirmar que ninguna llamada a AEMET/IPMA/Open-Meteo ocurre fuera de `scripts/` (nunca desde `src/` en runtime).

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ningún valor se fabrica por conversión aproximada (mm↔cm de nieve AEMET, clase↔km/h de IPMA) — verificado por revisión de código, no solo por test.
- [x] `degradations` y `meta.failedLocations` reflejan la realidad de la última ejecución en cualquier fixture de test que simule fallos.
- [x] Ningún literal de umbral (`0.10`, `0.50`) aparece hardcodeado fuera de su constante nombrada.
- [x] Grep de variables/tipos del dominio tocados en esta feature: 0 quedan sin uso.

## Mantenimiento (checklist recurrente)

- [ ] Si AEMET, IPMA u Open-Meteo cambian su schema de respuesta, revisar primero los fixtures de test antes de tocar la normalización.
- [ ] Revisar `MAX_FAILED_LOCATIONS_RATIO`/`SYSTEMIC_COMPLEMENT_FAILURE_RATIO` con datos reales de ejecuciones pasadas cada cierto tiempo — son una propuesta de partida, no cifras definitivas.
