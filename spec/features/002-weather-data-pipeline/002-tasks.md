# 002 · Pipeline de datos meteorológicos — Tareas

## Bloque 1 — Dominio y catálogo de lugares ✅

- [x] `src/domain/` — tipos del contrato: `SourceId`, `SkyCondition`, `Temperature`, `Precipitation`, `Snow`, `Wind`, `Marine`, `MarineAvailability`, `AlertLevel`, `AlertPhenomenon`, `OfficialAlert`, `AlertsAvailability`, `MetricPath`, `Degradation`, `Provenance`, `Location`, `LocationForecast`, `Forecast` (ver `002-plan.md`).
- [x] Archivo de **configuración manual** (nombre indicativo, p. ej. `scripts/config/locations.manual.ts`) con los 74 lugares: `id`, `name`, `country`, `latitude`, `longitude`, `timezone`, `primarySource`, `coastal`, `marineCoordinates` (los 28 lugares costeros, más los ambiguos ya identificados — Girona, Murcia, Sevilla, Granada, Leiria — con su decisión explícita), `alertZoneIds`. Este archivo sí se edita a mano.
- [x] `npm run build:locations` — script que lee la configuración manual, cruza el maestro de municipios de AEMET y el catálogo de `api.ipma.pt` para resolver `sourceIds` (código INE / `globalIdLocal`) automáticamente, y escribe `src/data/locations.ts` **generado** — no se edita a mano nunca, cualquier corrección va al archivo de configuración manual y se regenera.
- [x] Tests: `locations.ts` tiene exactamente 74 entradas, sin duplicados de `id`, y todo lugar con `coastal: true` tiene `marineCoordinates`.

## Bloque 2 — Cliente AEMET ✅

- [x] `scripts/sources/aemet.ts` — cliente (doble llamada, decodificación ISO-8859-1, throttle, reintentos). Cubre predicción diaria **y horaria** por municipio.
- [x] Normalización AEMET → bloque parcial de `LocationForecast`, seleccionando el día cuya fecha coincide con `targetDate` (nunca por posición — ver `002-plan.md` → `targetDate`): `temperature`, `sky`, `precipitation.probabilityPercent`, `snow.present`, `wind.speedKmh`/`gustKmh`, `storm`, `calima`, `fog`. `precipitation.mm` **no** sale de AEMET: su horaria no da un campo de mm por hora del que se pueda fiar un acumulado diario — queda `null` y lo complementa Open-Meteo (Bloque 5).
- [x] Tests con fixtures de respuestas reales guardadas (no llamadas en vivo en la suite de tests), incluidas fixtures con más de un día para probar que la selección es por fecha y no por posición.

## Bloque 3 — Cliente IPMA ✅

- [x] `scripts/sources/ipma.ts` — previsión diaria por `globalIdLocal` y avisos (`warnings_www.json`), con reintentos ante fallos transitorios (3 intentos, backoff exponencial, mismo patrón que Open-Meteo).
- [x] Normalización IPMA → bloque parcial, seleccionando la entrada cuyo `forecastDate` coincide con `targetDate`: `temperature`, `sky`, `precipitation.probabilityPercent` (nunca `.mm`), `snow.present` (vía `idWeatherType`, nunca `.cm`), `storm`, `fog`. `calima` siempre `null` — sin categoría en IPMA, confirmado. Un `idWeatherType` fuera del catálogo se trata como sin información (null), no como fenómeno ausente.
- [x] Tests con fixtures reales.

## Bloque 4 — Cliente Open-Meteo (forecast + Marine) ✅

- [x] `scripts/sources/open-meteo.ts` — forecast estándar: `snowfall_sum`, `wind_speed_10m_max`, `wind_gusts_10m_max`, `weather_code`. Sin API key. Petición con `start_date`/`end_date=targetDate` (nunca `forecast_days` sin más); la normalización verifica además que `daily.time` contiene esa fecha antes de leer nada. `precipitation.mm` se construye como `rain_sum + showers_sum` (precipitación líquida real) — nunca `precipitation_sum`, que Open-Meteo documenta como "rain, showers and snowfall" y por tanto incluye el equivalente en agua de la nieve.
- [x] `scripts/sources/open-meteo-marine.ts` — `wave_height_max`, `wave_period_max`, `wave_direction_dominant` vía `marineCoordinates`, mismo patrón de `start_date`/`end_date` + verificación por fecha. Los 28 puntos costeros de `locations.ts` verificados uno a uno contra la API real.
- [x] Normalización Open-Meteo → bloque completo (Andorra, fuente principal; y fallback de cualquier lugar de AEMET/IPMA cuya principal falle del todo — Bloque 6) y bloques reutilizables como complemento (`precipitation.mm`, `snow.cm`, `wind.speedKmh`/`gustKmh`, `marine`).
- [x] Tests con fixtures reales.

## Bloque 5 — Combinación de fuentes: provenance, coherencia y degradación ✅

- [x] `src/domain/` — funciones puras: derivar `snow.present` desde `snow.cm` cuando existe (regla de coherencia), construir `Provenance` (primary + complementary disperso), construir `Degradation[]`.
- [x] `scripts/` — orquestador por lugar: aplica principal + complementarias según `Location.primarySource` y la tabla de la 002 (España→precipitation/snow, Portugal→precipitation/snow/wind, Andorra→nada).
- [x] Tests table-driven: fuente única sin complemento; complemento exitoso; complemento fallido aislado (degradación, lugar válido); combinación con `snow.present`/`snow.cm` de fuentes distintas (verificar coherencia).

## Bloque 6 — Tolerancia a fallos, fallback y `meta` ✅

- [x] **Fallback de bloque completo:** si la fuente principal de un lugar (AEMET/IPMA) falla tras sus reintentos, se intenta Open-Meteo como bloque completo — mismo camino que ya usa como fuente única de Andorra. Si responde, el lugar se incluye con normalidad y `provenance.primary: 'open-meteo'`; ese lugar no participa además en el tally de complemento de su grupo (`usedFallback: true` en `LocationWeatherResult`, `scripts/orchestrate-location.ts`).
- [x] **Excepciones que nunca disparan el fallback, por ser errores distintos a "el proveedor no respondió":** un `AemetAuthError` (401/403, key caducada) se relanza sin capturar y aborta el run entero de inmediato — `Promise.allSettled` en la petición diaria+horaria de AEMET para que nunca pierda una carrera de promesas contra un error genérico de la otra petición. Un `sourceIds` ausente en `locations.ts` (`assertSourceIdConfigured`) es un error de configuración y falla directo, sin intentar Open-Meteo.
- [x] **Tolerancia cero:** si un lugar falla tanto en su fuente principal como en el fallback, `forecast.json` no se escribe — el script aborta y el `forecast.json` anterior sigue en línea. Constantes de ratio (`MAX_FAILED_LOCATIONS_RATIO`) ya no existen: no hay margen tolerable cuando el umbral es "cero fallos".
- [x] **Última comprobación antes de escribir** (`checkForecastReadiness`, `src/domain/forecast-readiness.ts`, función pura): exige exactamente los 74 `locationId` esperados, sin duplicados ni ids ajenos, y que `assignPokemon(locationForecast)` (003) devuelva al menos un `PokedexId` para cada uno. Cualquier fallo aborta sin escribir, sin inventar un Pokémon por defecto.
- [x] **Fallo sistémico de una fuente complementaria** (más del 50% de los lugares que dependen de ese complemento fallan en la misma ejecución) sigue siendo una condición de aborto independiente de la tolerancia cero — `SYSTEMIC_COMPLEMENT_FAILURE_RATIO = 0.50`, constante nombrada y configurable. El ratio se calcula por intentos de complemento por lugar, nunca contando entradas de `degradations` (un mismo fallo genera 2 entradas en España y 4 en Portugal, pero es un único intento).
- [x] `meta` (`totalLocations`, `successfulLocations`, `failedLocations`) — con la tolerancia cero, un `forecast.json` que se llega a escribir siempre tiene `successfulLocations === 74`.
- [x] Tests: `fault-tolerance.test.ts` (umbral sistémico, `decideAbort` con las dos condiciones independientes), `forecast-readiness.test.ts` (74 válidos, falta uno, duplicado, asignación vacía), `orchestrate-location.test.ts` (primary normal sin fallback, fallo normal → fallback, `AemetAuthError` nunca activa el fallback — incluida la carrera de promesas, `sourceIds` ausente nunca activa el fallback, fallback también falla → error distinguible).

## Bloque 7 — Avisos oficiales y zonas ✅

- [x] `Location.alertZoneIds` poblado contra el catálogo real de zonas de AEMET (PDF oficial "Detalle de municipios por zonas meteorológicas", cruzado por código INE) e IPMA (`idAreaAviso` del catálogo de distritos). 24 de los 25 lugares costeros de España llevan zona terrestre + su compañera marítima (mismo código + sufijo "C", confirmado contra `avisos_cap` real). País Vasco es el único con tres zonas: el municipio de Bilbao (su proxy) cae en "Bizkaia interior", sin compañera costera, así que se añade también "Bizkaia litoral" + su "C" — ver comentario en `locations.manual.ts`. Cada lugar usa solo la zona de su propio punto/proxy, nunca todas las zonas de la isla/CCAA que representa visualmente.
- [x] Cliente y normalización de avisos: `scripts/sources/aemet-alerts.ts` (lector TAR propio + parser CAP XML + `normalizeAemetAlert`) y `normalizeIpmaAlert` en `ipma.ts`, con el vocabulario `AlertPhenomenon` verificado contra el catálogo real (AEMET tiene 3 fenómenos sin categoría en el dominio — Aludes, Galernas, Rissagas — que caen en `'desconocido'` a propósito) y `sourcePhenomenon` conservando el literal original. `selectAlertsForZones` (dominio, puro) filtra por lugar. Independiente del `weather`: que la consulta de avisos falle no invalida el lugar.
- [x] Tests con fixtures reales de avisos activos (naranja, amarillo) e inactivos (verde/green, filtrados antes de llegar a `OfficialAlert`).

## Bloque 8 — Entrypoint, `targetDate` y despliegue ✅

- [x] `src/domain/target-date.ts` — `computeTargetDate(now: Date): string`: mañana respecto a `Europe/Madrid` (vía `Intl.DateTimeFormat`, sin librería de fechas), no respecto a UTC — importa para una ejecución manual cerca de medianoche en Madrid. Tests: caso normal, los dos bordes de medianoche (invierno/verano), cambio de mes, de año, 29 de febrero.
- [x] `scripts/fetch-forecast.ts` — calcula `targetDate` una única vez al principio de `run()` y lo pasa a cada fuente; `Forecast.date` y cada `LocationForecast.date` se escriben como ese mismo `targetDate`. Orquesta todo lo anterior (Bloques 2-7) y escribe `src/data/forecast.json` solo si pasa la tolerancia cero y `checkForecastReadiness` (Bloque 6).
- [x] `package.json` → `npm run fetch:forecast` apunta a este entrypoint.
- [x] **Un único workflow, una única cadena — sin depender de que un commit dispare otro workflow.** `.github/workflows/deploy.yml`: trigger `schedule` (cron diario, 06:00 UTC) además de `push`/`workflow_dispatch`, con un paso de fetch **antes** del build, dentro del mismo job/run:

  ```
  schedule (cron) / workflow_dispatch / push
          ↓
  fetch forecast (npm run fetch:forecast) — solo en schedule/workflow_dispatch
          ↓
  commit del bot con forecast.json (registro histórico — no dispara nada, usa el GITHUB_TOKEN por defecto; el mensaje lleva la fecha real del forecast generado, no la de ejecución)
          ↓
  lint / test / build (ya existente de la 001)
          ↓
  deploy a GitHub Pages
  ```
- [x] `AEMET_API_KEY` desde Secrets (IPMA y Open-Meteo no necesitan key) — falta que una persona lo dé de alta en la configuración del repositorio, un agente no puede hacerlo.
- [x] **Verificación real de los 74 lugares** (con la `AEMET_API_KEY` local, contra las tres fuentes reales): `forecast.json` con `meta: {"totalLocations":74,"successfulLocations":74,"failedLocations":[]}`, `forecast.date` y los 74 `LocationForecast.date` coincidiendo con el día siguiente en `Europe/Madrid`, `provenance.primary` mayoritariamente `aemet`/`ipma` y `open-meteo` solo en los lugares donde la principal falló de verdad (fallback funcionando en real, no solo en test), `assignPokemon()` produciendo al menos un Pokémon para los 74. El ritmo sostenido real de AEMET es más estricto que el 50/min documentado en `tech-stack.md` — `AEMET_MAX_REQUESTS_PER_MINUTE` queda en 28 req/min, y un HTTP 429 tiene su propio backoff (lineal, más largo que el de un fallo de red genérico).
- [x] Confirmado que ninguna llamada a AEMET/IPMA/Open-Meteo ocurre fuera de `scripts/` (nunca desde `src/` en runtime).

## Bloque 9 — Cierre ✅

- [x] Barrer la narración del proceso de comentarios y de `002-spec.md`/`002-plan.md`/este archivo.
- [x] Validar contra los criterios de aceptación de `002-spec.md`.
- [x] Actualizar `constitution/roadmap.md`: la 002 en "Hecho" refleja el pipeline final (fallback completo, tolerancia cero, `targetDate` de mañana); cerradas las "Decisiones pendientes" que esta feature resolvió.
- [x] Confirmado que la 004 (mapa) no se ha tocado — esta feature es solo pipeline/dominio.

## Definición de "hecho" (además de los criterios de la spec)

- [x] Ningún valor se fabrica por conversión aproximada (mm↔cm de nieve AEMET, clase↔km/h de IPMA) — verificado por revisión de código, no solo por test.
- [x] `degradations` y `meta.failedLocations` reflejan la realidad de la última ejecución en cualquier fixture de test que simule fallos.
- [x] Ningún literal de umbral (`0.50`) aparece hardcodeado fuera de su constante nombrada.
- [x] Grep de variables/tipos del dominio tocados en esta feature: 0 quedan sin uso.

## Mantenimiento (checklist recurrente)

- [ ] Si AEMET, IPMA u Open-Meteo cambian su schema de respuesta, revisar primero los fixtures de test antes de tocar la normalización.
- [ ] Revisar `SYSTEMIC_COMPLEMENT_FAILURE_RATIO` con datos reales de ejecuciones pasadas cada cierto tiempo — es una propuesta de partida, no una cifra definitiva.
