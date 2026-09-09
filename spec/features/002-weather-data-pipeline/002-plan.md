# 002 · Pipeline de datos meteorológicos — Plan

**Estado:** implementado ✅

## Enfoque

AEMET, IPMA y Open-Meteo se normalizan a un único dominio (`src/domain/`), sin backend ni llamadas desde el navegador — todo corre en `scripts/` en build time, tal como fija `tech-stack.md`. El principio rector: **el dominio representa datos meteorológicos reales, nunca números fabricados para homogeneizar fuentes.** Cuando una fuente no puede dar un dato con la unidad que necesita el resto del sistema, el campo es `null` y, si existe otra fuente que sí pueda darlo con garantías, se complementa — nunca se convierte ni se aproxima.

Arquitectura de fuentes: **principal + complementarias**, nunca `source: 'x'` a nivel de todo el forecast.

| Zona | Principal | Complementa (solo cuando la principal no puede dar la unidad real) |
|---|---|---|
| España (65) | AEMET | Open-Meteo → `precipitation.mm` (la horaria de AEMET para "hoy" solo cubre desde la hora de generación hasta el final del día — nunca el día completo — así que su suma no es un acumulado diario válido), `snow.cm` (AEMET solo da nieve en mm de equivalente en agua, no se convierte) |
| Portugal (8) | IPMA | Open-Meteo → `precipitation.mm`, `snow.cm`, `wind.speedKmh`/`gustKmh` (IPMA no da mm de lluvia, ni cm de nieve, ni viento en km/h — solo clases/probabilidad) |
| Andorra (1) | Open-Meteo | — (única fuente) |

**Marine, estrategia separada de lo anterior:** predicción física del mar (altura, periodo, dirección) → **Open-Meteo Marine para todas las localidades costeras de España y Portugal**, uniforme — evita normalizar dos sistemas de zonas geográficas marítimas (SWAN de AEMET y oceanografía de IPMA) solo para un número. Los **avisos costeros oficiales** siguen viniendo de AEMET/IPMA, vía `alerts` con `phenomenon: 'costero'` — la oficialidad se conserva ahí, no en el dato físico.

## Dominio (`src/domain/`)

```ts
type SourceId = 'aemet' | 'ipma' | 'open-meteo'

type SkyCondition = 'despejado' | 'poco_nuboso' | 'nuboso' | 'cubierto'
// Solo nubosidad. Lluvia, tormenta, calima, niebla y nieve son ejes propios, no
// se absorben aquí — es la corrección explícita frente a la antigua EstadoCielo.
```

### Identidad del lugar — `Location`

```ts
interface Location {
  id: string                     // slug estable: 'a-coruna', 'lisboa', 'andorra-la-vella'
  name: string
  country: 'ES' | 'PT' | 'AD'
  latitude: number
  longitude: number
  timezone: string                // IANA — Canarias no comparte huso con la España peninsular
  primarySource: SourceId         // config estática de qué agencia cubre el lugar
  sourceIds: { aemet?: string; ipma?: number }
  coastal: boolean
  marineCoordinates?: { latitude: number; longitude: number }   // solo si coastal
  alertZoneIds?: Partial<Record<'aemet' | 'ipma', string[]>>     // ver nota abajo
}
```

`primarySource` es identidad operativa del lugar (qué agencia lo cubre), no una propiedad meteorológica — vive aquí, no en el forecast. Las fuentes complementarias *realmente usadas* un día concreto sí son un hecho del forecast, no del lugar (ver `Provenance`).

**`src/data/locations.ts` es generado — nunca se edita a mano.** Igual que `forecast.json`, es output de un script (`npm run build:locations`), así que cualquier edición manual se perdería en la siguiente regeneración. La entrada tiene dos orígenes distintos, que el generador combina:

- **Configuración manual estable** (un archivo propio, el nombre exacto no importa — p. ej. `scripts/config/locations.manual.ts`): todo lo que es una decisión humana, no un dato consultable en ningún catálogo — `id`, `name`, `country`, `latitude`, `longitude`, `timezone`, `primarySource`, `coastal`, `marineCoordinates`, `alertZoneIds`. Este archivo sí se edita a mano cuando hace falta (añadir un lugar, corregir un huso horario) — es la única fuente de verdad humana.
- **IDs resueltos automáticamente**: `sourceIds` (código INE para AEMET, `globalIdLocal` para IPMA) — el generador los busca cruzando la configuración manual contra el maestro de municipios de AEMET y el catálogo de `api.ipma.pt`, en vez de que alguien los tipee a mano.

`npm run build:locations` lee la configuración manual, resuelve los `sourceIds`, y escribe `src/data/locations.ts` ya combinado — ese archivo final no se toca directamente, igual que no se edita `forecast.json` a mano.

**`alertZoneIds` es una lista, no un único id — no se asume `Location → una sola zona`.** Regla fija: los avisos terrestres de un lugar corresponden a la zona oficial de su punto/proxy representativo, nunca a todas las zonas de la isla/CCAA que ese lugar represente visualmente en el mapa — un lugar costero añade además la zona litoral/marítima asociada a sus `marineCoordinates`. País Vasco es el único caso que necesita tres zonas, y no por representar tres provincias: el municipio de Bilbao (su proxy) cae en la zona de aviso "Bizkaia interior", sin compañera costera, así que se añade también "Bizkaia litoral" (la zona que sí cubre el punto de `marineCoordinates`) y su compañera marítima. El resto de lugares costeros lleva exactamente dos zonas (la suya + la misma con sufijo "C", el patrón real confirmado contra `avisos_cap`); el resto de lugares de interior, una sola.

### Ejes meteorológicos — cada uno independiente

```ts
interface Temperature { maxC: number; minC: number }
interface Precipitation { mm: number | null; probabilityPercent: number | null }
interface Snow { cm: number | null; present: boolean | null }
interface Wind { speedKmh: number | null; gustKmh: number | null }
```

**Coherencia entre métricas del mismo eje cuando se mezclan fuentes.** `snow.present` e `snow.cm` no pueden salir de fuentes distintas sin control — el caso real a evitar: AEMET/IPMA dicen "no nieva" (`present: false`) mientras el complemento Open-Meteo da `cm > 0` para el mismo lugar y día. Regla: **cuando `snow.cm` tiene un valor real (no `null`), `snow.present` se deriva de ese mismo valor** (`cm > 0`) en vez de tomarse independiente de la fuente principal — un único origen de verdad para el eje, no dos fuentes opinando sobre el mismo hecho. Solo cuando `snow.cm` es `null` (ninguna fuente cuantitativa disponible), `present` cae de vuelta a la señal categórica de la fuente principal (AEMET/IPMA vía su código de cielo). `provenance` no necesita una entrada separada para `snow.present` cuando se deriva de `snow.cm` — es implícita, viene del mismo sitio.

**Semántica global de `null` (corregida — la versión anterior contradecía la política de fallos):**

- `null` = **no existe un valor normalizado fiable disponible** para esa métrica, sea cual sea la razón (la fuente no tiene capacidad estructural, o sí la tiene pero el complemento de hoy falló, o el dato simplemente falta). `null` **no** implica "esta fuente nunca puede darlo" — solo que ahora mismo no hay un valor del que fiarse.
- `false`/`0` = la métrica **se ha podido evaluar** y confirma ausencia/cero. Solo se usa cuando de verdad hubo una evaluación, nunca como valor por defecto ante la duda.
- **La razón de un `null`** (sin capacidad estructural / falló el complemento hoy / dato ausente) no se mete dentro de cada campo individual — eso llevaría a envolver cada métrica en un objeto complejo, justo lo que se quiere evitar. Vive aparte, en una lista dispersa a nivel de `LocationForecast`:

```ts
type MetricPath =
  | 'precipitation.mm' | 'snow.cm' | 'wind.speedKmh' | 'wind.gustKmh'
  | 'marine.waveHeightM' | 'marine.wavePeriodS' | 'marine.waveDirectionDeg'

interface Degradation {
  metric: MetricPath
  reason: 'source_error'   // el único motivo posible aquí — ver nota abajo
  attemptedSource: SourceId
}
```

`degradations` solo lista métricas para las que **existía un complemento configurado y se intentó** pero falló hoy — no aparece nada para `calima` en Portugal/Andorra (ahí nunca hay complemento configurado, no es una degradación puntual, es que esa métrica no se persigue con esa fuente, punto). Si `degradations` está vacío o ausente, todos los `null` del resto del forecast son "no aplica/sin capacidad", no "falló algo hoy".

```ts
interface Marine {
  waveHeightM: number | null
  wavePeriodS: number | null
  waveDirectionDeg: number | null
  source: SourceId   // por diseño, 'open-meteo' mientras la estrategia de marine sea esa
}

type MarineAvailability =
  | { status: 'ok'; data: Marine }
  | { status: 'not_applicable' }   // Location.coastal === false — nunca va a haber dato, es un hecho estructural
  | { status: 'error' }             // Location.coastal === true, pero la consulta de hoy falló
```

`marine: null` a secas mezclaba dos cosas muy distintas (lugar de interior vs. costero-pero-falló-hoy) — igual que ya distinguíamos en `alerts`, aquí también hace falta el tercer estado explícito. Fetch de marine siempre se intenta cuando `coastal === true`, sin condición estacional ni de "si hace falta" — así el único motivo real para `error` es un fallo de red/consulta ese día, nunca ambigüedad de si se intentó.

### Avisos oficiales — vocabulario honesto entre AEMET e IPMA

```ts
type AlertLevel = 'amarillo' | 'naranja' | 'rojo'   // 'verde' = sin entrada, no se representa como nivel

type AlertPhenomenon =
  | 'lluvia' | 'nieve' | 'viento' | 'tormenta'
  | 'temperatura_maxima' | 'temperatura_minima'
  | 'costero' | 'niebla'
  | 'calima' | 'deshielo'          // sin equivalente confirmado en IPMA — ver tabla abajo
  | 'desconocido'                    // fallback honesto si algo no mapea, en vez de forzar una categoría

interface OfficialAlert {
  level: AlertLevel
  phenomenon: AlertPhenomenon
  sourcePhenomenon: string           // literal tal cual lo da la fuente — trazabilidad, nunca se pierde
  startsAt: string                    // ISO datetime
  endsAt: string
  source: 'aemet' | 'ipma'            // nunca 'open-meteo' — no tiene este producto
  officialZoneId: string              // zona propia de la fuente, sin mapear a nuestros 74 lugares (ver Riesgos)
}
```

Mapeo verificado contra categorías reales de ambas fuentes (no supuesto):

| Nuestro vocabulario | AEMET | IPMA (`awarenessTypeName`) |
|---|---|---|
| `lluvia` | lluvias | Precipitação |
| `nieve` | nevadas | Neve |
| `viento` | viento | Vento |
| `tormenta` | tormentas | Trovoada |
| `temperatura_maxima` | temperaturas máximas | Tempo Quente |
| `temperatura_minima` | temperaturas mínimas | Tempo Frio |
| `costero` | fenómenos costeros | Agitação Marítima |
| `niebla` | nieblas | Nevoeiro |
| `calima` | polvo en suspensión | *(sin categoría en IPMA)* |
| `deshielo` | deshielo/avenidas | *(sin categoría en IPMA)* |

**Disponibilidad de avisos — distingue "no soportado" de "falló la consulta":**

```ts
type AlertsAvailability =
  | { status: 'ok'; alerts: OfficialAlert[] }   // consultado; alerts puede ser [] (sin avisos activos)
  | { status: 'unsupported' }                     // la fuente no tiene este producto (Open-Meteo/Andorra, siempre)
  | { status: 'error' }                             // el producto existe pero la consulta de hoy falló
```

### Provenance — trazabilidad por métrica, no por bloque entero

Un mismo bloque puede mezclar fuentes (ej. Lisboa: `precipitation.mm` de Open-Meteo, `precipitation.probabilityPercent` de IPMA) — por eso la trazabilidad va por **ruta de métrica**, no por eje completo:

```ts
interface Provenance {
  primary: SourceId
  complementary?: Partial<Record<MetricPath, SourceId>>   // solo las métricas que SÍ vinieron de un complemento
}
```

Reutiliza el mismo `MetricPath` que `Degradation` (arriba) — son las mismas métricas que alguna vez pueden venir de un complemento, así que es un único vocabulario, no dos listas que puedan desincronizarse. `precipitation.probabilityPercent` no está en `MetricPath` porque nunca se complementa (siempre viene de la fuente principal); `snow.present` tampoco, porque por la regla de coherencia de arriba se deriva de `snow.cm`, no se sourcea aparte. Sigue siendo un mapa plano y disperso (solo lista excepciones) — no hace falta anotar `marine.source` a nivel de forecast ni nada de `alerts` aquí porque ya llevan su propio `source`/`status` explícito.

### `LocationForecast`

Se llama `LocationForecast`, no `CityForecast` — de los 74 lugares, varios no son ciudades (Cantabria, La Rioja y País Vasco son regiones enteras representadas por un único punto). `CityForecast` sería un nombre incorrecto para lo que el tipo representa de verdad.

```ts
interface LocationForecast {
  locationId: string    // referencia a Location.id — no hace falta el objeto completo, un id basta
  date: string

  temperature: Temperature          // obligatorio, las 3 fuentes lo dan siempre
  sky: SkyCondition | null
  precipitation: Precipitation | null
  snow: Snow | null
  wind: Wind | null
  storm: boolean | null
  calima: boolean | null
  fog: boolean | null

  marine: MarineAvailability
  alerts: AlertsAvailability

  provenance: Provenance
  degradations?: Degradation[]                // solo métricas con complemento intentado y fallido hoy
  primarySourceDescription: string | null      // texto literal SOLO de la fuente principal — nunca mezclado
}
```

**No incluido deliberadamente en esta versión del contrato:**
- `dana` (o cualquier sustituto) — la regla tormenta+DANA→Thundurus sigue documentada en `roadmap.md` como **deshabilitada**, no se infiere combinando lluvia+tormenta. Se añadirá un campo real el día que exista una fuente/criterio fiable, no antes.
- `classPrecInt` de IPMA — fuera del dominio normalizado. No se retiene "por si acaso"; si alguna vez hace falta, se reincorpora con una necesidad real por delante, no especulativa.
- `periods`/`WeatherPeriod` (mañana/tarde) — la capacidad queda contemplada conceptualmente (ver `roadmap.md` → franjas horarias, modo `relevo` de la 007 deshabilitado por esto mismo), pero **no se compromete ninguna forma de dato ni corte horario en este contrato** porque ninguna feature actual lo consume. Se diseña cuando haya un consumidor real.

## Ejemplo — Lisboa (el caso que más mezcla fuentes)

```json
{
  "locationId": "lisboa",
  "date": "2026-09-08",
  "temperature": { "maxC": 28, "minC": 18 },
  "sky": "despejado",
  "precipitation": { "mm": 0, "probabilityPercent": 4 },
  "snow": { "cm": 0, "present": false },
  "wind": { "speedKmh": 22, "gustKmh": 38 },
  "storm": false,
  "calima": null,
  "fog": false,
  "marine": { "status": "ok", "data": { "waveHeightM": 1.1, "wavePeriodS": 7, "waveDirectionDeg": 310, "source": "open-meteo" } },
  "alerts": { "status": "ok", "alerts": [] },
  "provenance": {
    "primary": "ipma",
    "complementary": {
      "precipitation.mm": "open-meteo",
      "snow.cm": "open-meteo",
      "wind.speedKmh": "open-meteo",
      "wind.gustKmh": "open-meteo"
    }
  },
  "primarySourceDescription": "Céu limpo"
}
```

Nótese: `precipitation.probabilityPercent` **no** aparece en `complementary` — vino de IPMA (primary), mientras que `precipitation.mm`, en el mismo bloque, sí — exactamente la granularidad por métrica que pedías. `calima: null` porque IPMA no tiene forma de detectarla, no porque hoy no haya.

## Contrato raíz — `Forecast`

`LocationForecast` es el elemento; `Forecast` es `forecast.json` completo:

```ts
interface Forecast {
  date: string                        // fecha de la previsión
  generatedAt: string                  // ISO datetime — cuándo corrió el pipeline
  locations: LocationForecast[]         // puede tener menos de 74 entradas si alguna falló por completo
  meta: {
    totalLocations: number               // 74, constante conocida de la lista de lugares
    successfulLocations: number           // cuántas entradas hay en `locations` (incluye las degradadas)
    failedLocations: string[]              // ids de lugares sin entrada este run, para observabilidad
  }
}
```

`meta` no es especulativo: es lo mínimo necesario para que el propio pipeline (y quien lo revise) sepa si el resultado está completo o degradado sin tener que contar `locations.length` a mano ni adivinar qué faltó.

## Política de tolerancia a fallos

Tres niveles de fallo, cada uno con comportamiento distinto — no todo "fallo" es igual:

1. **Falla la fuente principal de un lugar** (AEMET/IPMA/Open-Meteo no responde, o el lugar no aparece en su catálogo) → **el lugar entero se excluye** de `locations` este run. Se registra en `meta.failedLocations`. Cuenta para el umbral de aborto de despliegue por fuente principal.
2. **Falla una fuente complementaria de forma aislada** (Open-Meteo como enriquecimiento de `precipitation`/`snow`/`wind` para Portugal o `snow` para España, u Open-Meteo Marine para un lugar costero, en un lugar suelto) → **el lugar sigue siendo válido**, se incluye en `locations`, pero degradado: la métrica queda `null` y se anota en `degradations`. No cuenta para el umbral de aborto por fuente principal — pero sí alimenta el umbral sistémico (punto siguiente).
3. **Falla la consulta de avisos** para un lugar cuya fuente principal los soporta (AEMET/IPMA) → `alerts.status: 'error'` en ese lugar. Mismo criterio que el punto 2: no invalida el lugar por sí solo.

**Fallo sistémico de un complemento — distinto de fallos aislados, pero es una condición de aborto independiente, no se mezcla con el conteo de fuente principal.** Un puñado de lugares sueltos degradados es tolerable; que un complemento falle para casi todos los lugares que dependen de él no debería desplegarse en silencio (ejemplo del enunciado: Open-Meteo cae y Portugal entero pierde precipitación/nieve/viento cuantitativos de golpe). Regla simple, sin health-checks: por cada combinación (fuente complementaria, grupo de lugares que la usan — p. ej. *Open-Meteo para Portugal*, *Open-Meteo para nieve en España*, *Open-Meteo Marine*), se calcula la proporción de intentos fallidos sobre el total de lugares a los que se le intenta ese complemento.

**Dos condiciones de aborto independientes, nunca convertidas en una sola cifra artificial:**

```ts
const MAX_FAILED_LOCATIONS_RATIO = 0.10           // 10% de 74 ≈ 7 lugares — punto de partida, revisable con datos reales
const SYSTEMIC_COMPLEMENT_FAILURE_RATIO = 0.50

if (
  primaryFailureRatio > MAX_FAILED_LOCATIONS_RATIO ||
  hasSystemicComplementFailure   // algún grupo de complemento superó SYSTEMIC_COMPLEMENT_FAILURE_RATIO
) {
  abort()
}
```

Un fallo sistémico de complemento **no incrementa** `meta.failedLocations` ni el conteo de fallos de fuente principal — es su propia señal, evaluada aparte. Cualquiera de las dos condiciones aborta igual: el script termina con error y el workflow **no despliega** — GitHub Pages sigue sirviendo el `forecast.json` del día anterior. Si ninguna se cumple, el pipeline continúa y publica con los lugares fallidos ausentes de `locations` (visibles en `meta.failedLocations`) y las degradaciones puntuales anotadas en cada lugar.

**Lugar mínimamente válido:** un `LocationForecast` se escribe si su fuente principal devuelve al menos `temperature` — es el único campo obligatorio del contrato. Todo lo demás puede faltar (quedar `null`, `degradations`, o `error` en marine/alerts) sin invalidar el lugar.

## Qué alimenta cada regla de la 003 (y qué queda pendiente de decidir ahí, no aquí)

| Regla (003) | Campo normalizado | Estado |
|---|---|---|
| Temperatura | `temperature.maxC` | Por confirmar formalmente que es `maxC` y no otra combinación |
| Nubes | `sky` | Cerrado |
| Lluvia | `precipitation.mm` | Cerrado |
| Nieve | `snow.cm` | Cerrado |
| Viento | `wind.speedKmh` **o** `wind.gustKmh` | **Sin decidir cuál usa la tabla** — sostenido vs racha |
| Calima | `calima` | Cerrado (con `null` en PT/AD por diseño) |
| Tormenta (Zapdos) | `storm` | Cerrado |
| Tormenta + DANA (Thundurus) | — | **Deshabilitada**, sin campo |
| Niebla | `fog` | Cerrado |
| Oleaje (Gyarados) | `marine.data.waveHeightM` (cuando `marine.status === 'ok'`) | **Sin umbral definido** — toda predicción tiene alguna altura de ola, hace falta un corte numérico real, no "si hay dato" |
| Oleaje muy fuerte (Mega Gyarados) | `alerts` filtrado por `phenomenon: 'costero'` + `level: 'rojo'` | Cerrado |

## Riesgos

- **`AlertPhenomenon: 'desconocido'`** como válvula de escape si aparece una categoría de cualquiera de las dos fuentes que no mapea limpio — no se fuerza una categoría existente por parecido. Ocurre de verdad para tres códigos reales de AEMET sin equivalente en el dominio (`AL` aludes, `GA` galernas, `RI` rissagas); IPMA no tiene ninguno sin mapear en su catálogo actual.
- **Umbral de Gyarados sin definir** — bloquea implementar esa regla concreta de la 003 hasta que exista un número real, igual que ya pasaba con "oleaje muy fuerte".
- **Umbrales de tolerancia a fallos** (`MAX_FAILED_LOCATIONS_RATIO = 0.10`, `SYSTEMIC_COMPLEMENT_FAILURE_RATIO = 0.50`) — aprobados como punto de partida, nombrados como constantes explícitas para poder revisarlos con datos reales de ejecuciones, no cifras enterradas en el código.
