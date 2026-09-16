# 002 · Pipeline de datos meteorológicos

**Estado:** implementado ✅

## Qué hace

Un script de build (`scripts/`, Node + `tsx`) calcula un único **`targetDate`** (el día siguiente a la fecha de ejecución, respecto a `Europe/Madrid`) y descarga, para ese día, la previsión de los 74 lugares desde AEMET (España), IPMA (Portugal) y Open-Meteo (Andorra; como complemento puntual de AEMET/IPMA cuando estas no puedan dar una cantidad real en la unidad que necesita el resto del sistema; y como **fallback meteorológico completo** cuando la fuente principal de un lugar falla del todo tras sus reintentos). Normaliza todo a un dominio común (`src/domain/`) y escribe `src/data/forecast.json`. Se ejecuta en GitHub Actions, nunca desde el navegador.

PokéTiempo muestra la previsión de mañana, no la de hoy: el pipeline corre a las 06:00 UTC y genera el `targetDate` siguiente.

## Por qué

Es el requisito de `roadmap.md` antes de construir la 003 (motor de asignación) y la UI: define la forma real de los datos con los que trabaja todo lo demás, incluida la futura 007 (Profesor Oak). Construir contra datos inventados y adaptar después sería trabajo tirado.

## Criterios de aceptación

- [x] El script descarga y normaliza los 74 lugares en una sola ejecución, con las tres fuentes según corresponda a cada uno.
- [x] Ningún número se fabrica para homogeneizar fuentes: si una fuente no puede dar un dato con la unidad real que necesita el dominio, el campo es `null` (o se complementa con Open-Meteo, nunca se convierte por aproximación — ver `002-plan.md`).
- [x] `null` significa "no hay un valor normalizado fiable disponible para esa métrica", sea cual sea la razón; `false`/`0` significa "se ha podido evaluar y confirma ausencia/cero" — nunca se usa `false`/`0` como valor por defecto ante la duda. La razón de un `null` (sin capacidad estructural / falló el complemento en esta ejecución) vive en `degradations`, no dentro de cada campo individual.
- [x] Cuando un eje mezcla fuentes con métricas semánticamente ligadas (ej. `snow.cm` y `snow.present`), el resultado es internamente coherente: `present` se deriva de `cm` cuando este existe, nunca queda una combinación contradictoria entre fuentes distintas del mismo eje.
- [x] La trazabilidad de qué fuente aportó cada métrica queda en `provenance`, a nivel de métrica cuando un mismo bloque mezcla fuentes (no solo a nivel de forecast completo). `provenance.primary` refleja la fuente que realmente dio el bloque — `'open-meteo'` cuando un lugar usó el fallback, no la fuente que se planeaba usar.
- [x] `alerts` distingue "consultado sin avisos", "fuente sin este producto" y "error en la consulta de esta ejecución" — nunca los tres casos colapsados en un mismo `null`. `marine` distingue igual "no aplica (interior)" de "costero pero falló en esta ejecución" — nunca ambos como el mismo `null`. Ambos son independientes del `weather`: que fallen no invalida el lugar.
- [x] **Si la fuente principal completa de un lugar (AEMET o IPMA) falla tras sus reintentos, Open-Meteo se usa como fallback meteorológico completo para ese lugar** — el mismo camino que ya usa como fuente principal única de Andorra. AEMET e IPMA reintentan ante fallos transitorios antes de darse por vencidas.
- [x] **Un `sourceIds` ausente en `locations.ts` es un error de configuración, no un fallo de proveedor — nunca dispara el fallback.** Se valida antes de intentar la fuente principal; un lugar mal configurado falla directo, sin que Open-Meteo llegue a intentarse.
- [x] Un fallo de autenticación de AEMET (401/403, key caducada) aborta el run entero de inmediato, sin fallback por lugar — nunca queda absorbido por el `catch` genérico que activa el fallback.
- [x] **Tolerancia cero: `forecast.json` solo se escribe si contiene exactamente los 74 lugares**, con `locationId` únicos y sin ninguno ajeno a la lista esperada, y **cada uno con al menos un `PokedexId` asignable vía `assignPokemon`** (003). Si cualquier condición falla, el script aborta sin escribir — el `forecast.json` anterior sigue en línea. No se inventa un Pokémon por defecto ni se publica un subconjunto.
- [x] **`targetDate` se calcula una sola vez**, respecto a `Europe/Madrid`, y es el mismo valor para `Forecast.date` y cada `LocationForecast.date` — una única fecha calendario de referencia para las tres fuentes/países.
- [x] **Ninguna fuente selecciona el bloque del día por posición**: AEMET diaria/horaria, IPMA y Open-Meteo (weather y Marine) seleccionan explícitamente el bloque cuya fecha coincide con `targetDate`.
- [x] Un `LocationForecast` se escribe si su fuente principal (o su fallback) devuelve al menos `temperature` — es el único campo obligatorio; todo lo demás puede ser `null`/`error` sin invalidar el lugar.
- [x] **Fallo sistémico de una fuente complementaria** (más del 50% de los lugares que dependen de ese complemento fallan en la misma ejecución) aborta el despliegue como condición independiente de la tolerancia cero de arriba — no se despliega en silencio una previsión con un bloque entero de lugares degradado. `SYSTEMIC_COMPLEMENT_FAILURE_RATIO` (50%) es una constante nombrada y configurable.
- [x] `forecast.json` incluye `meta` (`totalLocations`, `successfulLocations`, `failedLocations`) — no hace falta contar `locations.length` a mano para saber si el resultado está completo.
- [x] `AEMET_API_KEY` (y cualquier credencial equivalente) vive solo en GitHub Secrets, nunca en el bundle ni en el JSON público.
- [x] El mapeo de cada uno de los 74 lugares a su(s) zona(s) oficial(es) de aviso (AEMET/IPMA — algunos lugares pueden necesitar más de una, `Location.alertZoneIds` ya lo soporta) y a sus `marineCoordinates` (donde aplique) es configuración explícita versionada, no inferencia aproximada en tiempo de ejecución.

## Fuera de alcance

- **Una tercera fuente de fallback además de Open-Meteo** — si Open-Meteo también falla para un lugar, se aborta, no se busca una cuarta fuente.
- **Inventar datos de una ubicación cercana** cuando todas las fuentes fallan para un lugar — se aborta el run, nunca se aproxima con el dato de otro punto.
- **Cambiar la hora del cron** — sigue a las 06:00 UTC; lo único que cambia es qué día calendario representa el contenido que genera.
- **La lógica visual del mapa (004)** — esta feature es solo pipeline/dominio.
- **Elegir qué métrica de viento usa la tabla de la 003** (velocidad sostenida vs racha) — decisión de esa feature, no de esta. El dominio expone ambas cuando existen.
- **Definir el umbral numérico de `waveHeightM` que activa la regla de Gyarados** — decisión de producto de la 003.
- **Representar DANA** — sigue sin señal fiable en ninguna fuente; la regla tormenta+DANA→Thundurus queda documentada como deshabilitada en `roadmap.md`, sin campo en el dominio.
- **Franjas horarias (`periods`/mañana-tarde)** — capacidad contemplada conceptualmente, sin comprometer forma de dato porque ningún consumidor actual la necesita (el modo `relevo` de la 007 depende de esto y sigue deshabilitado).
- **`classPrecInt` de IPMA** — no entra en el dominio normalizado.
- **Histórico de previsiones** — ver `roadmap.md` → Backlog.
