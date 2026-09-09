# 002 · Pipeline de datos meteorológicos

**Estado:** implementado ✅

## Qué hace

Un script de build (`scripts/`, Node + `tsx`) descarga la previsión de hoy para los 74 lugares desde AEMET (España), IPMA (Portugal) y Open-Meteo (Andorra, y como complemento puntual de AEMET/IPMA cuando estas no puedan dar una cantidad real en la unidad que necesita el resto del sistema), la normaliza a un dominio común (`src/domain/`) y escribe `src/data/forecast.json`. Se ejecuta en GitHub Actions, nunca desde el navegador.

## Por qué

Es el requisito de `roadmap.md` antes de construir la 003 (motor de asignación) y la UI: define la forma real de los datos con los que trabaja todo lo demás, incluida la futura 007 (Profesor Oak). Construir contra datos inventados y adaptar después sería trabajo tirado.

## Criterios de aceptación

- [x] El script descarga y normaliza los 74 lugares en una sola ejecución, con las tres fuentes según corresponda a cada uno.
- [x] Ningún número se fabrica para homogeneizar fuentes: si una fuente no puede dar un dato con la unidad real que necesita el dominio, el campo es `null` (o se complementa con Open-Meteo, nunca se convierte por aproximación — ver `002-plan.md`).
- [x] `null` significa "no hay un valor normalizado fiable disponible para esa métrica", sea cual sea la razón; `false`/`0` significa "se ha podido evaluar y confirma ausencia/cero" — nunca se usa `false`/`0` como valor por defecto ante la duda. La razón de un `null` (sin capacidad estructural / falló el complemento hoy) vive en `degradations`, no dentro de cada campo individual.
- [x] Cuando un eje mezcla fuentes con métricas semánticamente ligadas (ej. `snow.cm` y `snow.present`), el resultado es internamente coherente: `present` se deriva de `cm` cuando este existe, nunca queda una combinación contradictoria entre fuentes distintas del mismo eje.
- [x] La trazabilidad de qué fuente aportó cada métrica queda en `provenance`, a nivel de métrica cuando un mismo bloque mezcla fuentes (no solo a nivel de forecast completo).
- [x] `alerts` distingue "consultado sin avisos", "fuente sin este producto" y "error en la consulta de hoy" — nunca los tres casos colapsados en un mismo `null`. `marine` distingue igual "no aplica (interior)" de "costero pero falló hoy" — nunca ambos como el mismo `null`.
- [x] **Tolerancia a fallos de tres niveles, no uno solo** (ver `002-plan.md` → "Política de tolerancia a fallos"): fallo de fuente principal excluye el lugar entero; fallo de fuente complementaria aislado degrada solo la métrica afectada sin invalidar el lugar; fallo de avisos degrada solo `alerts` de ese lugar.
- [x] **Fallo sistémico de una fuente complementaria** (más del 50% de los lugares que dependen de ese complemento fallan en la misma ejecución) aborta el despliegue como **condición independiente**, sin mezclarse con el conteo de fallos de fuente principal — no se despliega en silencio una previsión con un bloque entero de lugares degradado.
- [x] `MAX_FAILED_LOCATIONS_RATIO` (10% de partida) y `SYSTEMIC_COMPLEMENT_FAILURE_RATIO` (50%) son constantes nombradas y configurables, no cifras sueltas en el código.
- [x] Un `LocationForecast` se escribe con el mínimo de `temperature` — es el único campo obligatorio; todo lo demás puede ser `null`/`error` sin invalidar el lugar.
- [x] `forecast.json` incluye `meta` (`totalLocations`, `successfulLocations`, `failedLocations`) — no hace falta contar `locations.length` a mano para saber si el resultado está completo.
- [x] `AEMET_API_KEY` (y cualquier credencial equivalente) vive solo en GitHub Secrets, nunca en el bundle ni en el JSON público.
- [x] El mapeo de cada uno de los 74 lugares a su(s) zona(s) oficial(es) de aviso (AEMET/IPMA — algunos lugares pueden necesitar más de una, `Location.alertZoneIds` ya lo soporta) y a sus `marineCoordinates` (donde aplique) es configuración explícita versionada, no inferencia aproximada en tiempo de ejecución.

## Fuera de alcance

- **Elegir qué métrica de viento usa la tabla de la 003** (velocidad sostenida vs racha) — decisión de esa feature, no de esta. El dominio expone ambas cuando existen.
- **Definir el umbral numérico de `waveHeightM` que activa la regla de Gyarados** — decisión de producto de la 003.
- **Representar DANA** — sigue sin señal fiable en ninguna fuente; la regla tormenta+DANA→Thundurus queda documentada como deshabilitada en `roadmap.md`, sin campo en el dominio.
- **Franjas horarias (`periods`/mañana-tarde)** — capacidad contemplada conceptualmente, sin comprometer forma de dato porque ningún consumidor actual la necesita (el modo `relevo` de la 007 depende de esto y sigue deshabilitado).
- **`classPrecInt` de IPMA** — no entra en el dominio normalizado.
- **Histórico de previsiones** — ver `roadmap.md` → Backlog.
