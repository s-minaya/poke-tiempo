# 007 · Profesor Oak — Plan

## Enfoque

Toda decisión de contenido es determinista y vive en `src/domain/oak/`: sin red, sin IA, testeable en aislamiento. La IA solo redacta prosa a partir de hechos ya cerrados. Si la IA falla, una capa de plantillas locales genera los mismos 3 diálogos a partir del mismo plan.

## Arquitectura de capas

```
002 (datos)      → src/data/forecast.json: 74 LocationForecast con cada eje
                   meteorológico y sus avisos oficiales. Fuente única de
                   cualquier número que Oak menciona.
003 (asignación) → assignPokemon() y las funciones por eje. Única autoridad
                   sobre qué Pokémon corresponde a qué condición.
004/005 (orden)  → MAP_PRIORITY + pickMapPokemon(): criterio editorial ya
                   fijado de qué es más "noticia" y, sobre todo, de qué
                   Pokémon ve realmente el usuario en cada lugar.
007 (Oak)        → extrae hechos, elige protagonistas y modo, reparte en 3
                   diálogos. No mide, no asigna, no reordena.
IA               → redacta los hechos. No decide ninguno.
```

## Reconciliación con el plan anterior

### Decisiones que ya no aplican

| Decisión antigua | Estado hoy |
|---|---|
| "Bloqueada hasta que existan la 002 y la 003" | Obsoleta: ambas implementadas. |
| "`types.ts` no declara ningún tipo de la 003" | Obsoleta: se importan `PokedexId` y `src/domain/types.ts` directamente. |
| `DialogueSlot` con el payload factual deliberadamente vacío | Resuelta: `NarrativeFact` queda definido abajo. |
| `priority.ts` "sin ranking fijo, esperando metadata de la 003" | Obsoleta: el ranking ya existe (`MAP_PRIORITY`) y no hace falta metadata nueva de la 003. |
| 13 modos narrativos + 4 deshabilitados | Obsoleta: se reducen a 4, todos con condición comprobable. |
| `Flavour` como eje propio junto a `Tone` | Obsoleta: dos ejes de estilo paralelos para tres frases. Se colapsa en `Tone`. |
| `OakHistoryEntry.openingStyle` / `.flavour` | Obsoletas: vocabulario extra sin problema real que resolver. |
| "Oak necesita el conjunto completo de avisos" | Cerrada: solo los 74 proxies. Ver "Avisos oficiales". |
| Cifras de cuota gratuita de Groq como propiedad del sistema | Se mantienen fuera del diseño; ver "IA". |

### Lo que sigue siendo válido

Dominio puro separado del I/O; una única llamada a la IA por generación; fallback local de primera clase; historial de solo IDs versionado en git; `oak-today.json` en `src/data/` (no en `public/`); `alerta` con prioridad absoluta y nunca inferida del Pokémon asignado; `anomalia`/`relevo`/`migracion` fuera por falta de dato.

### Bloqueos de diseño

Ninguno bloquea la implementación. Una única deuda menor, que no es dato nuevo sino colocación:

- `isActiveOnDate` (solape de un `OfficialAlert` con una fecha) es privada en `assign-pokemon.ts`. Oak necesita exactamente el mismo criterio. Se **mueve** a `src/domain/alerts.ts` (su sitio natural, junto a `selectAlertsForZones`) y `assign-pokemon.ts` la importa. Cero cambio de comportamiento, cero criterio duplicado.

**No hace falta añadir metadata nueva a la 003.**

## Contratos reales que Oak consume

De la 002 (`src/domain/types.ts`), sin redeclarar nada: `Forecast`, `LocationForecast`, `Location`, `Temperature`, `Precipitation`, `Snow`, `Wind`, `SkyCondition`, `MarineAvailability`, `AlertsAvailability`, `OfficialAlert`, `AlertLevel`, `AlertPhenomenon`.

De la 003: `PokedexId` (`src/domain/pokedex.ts`) y `assignPokemon` (`assign-pokemon.ts`).

De la 004/005: `MAP_PRIORITY` y `pickMapPokemon` (`pick-map-pokemon.ts`), `buildLocationViews` (`location-views.ts`) y la tabla de etiquetas hoy llamada `LEGEND_METADATA`.

### Qué se mueve a `src/domain/` y qué no

Oak vive en `src/domain/` y no puede importar de `src/components/`. Movimientos mínimos, cada uno justificado por ser vocabulario o regla de dominio, no presentación:

| Origen | Destino | Por qué |
|---|---|---|
| `components/SpainMap/pick-map-pokemon.ts` | `domain/map-priority.ts` | `MAP_PRIORITY` es el criterio editorial de qué condición manda, y `pickMapPokemon` decide el Pokémon real de cada lugar. Nada visual. |
| `components/SpainMap/location-views.ts` | `domain/location-views.ts` | Cruce puro de los 74 lugares con el forecast. Las coordenadas `x`/`y` que arrastra vienen de `map-geometry.ts` (ya en `src/data/`), no de CSS. |
| `components/Legend/legend-metadata.ts` | `domain/pokemon-labels.ts` (`POKEMON_LABELS`) | **Comprobado: no contiene nada visual.** Es un `Record<PokedexId, string>` de 25 etiquetas de texto ("Helado", "Lluvia moderada"), es decir el significado de cada `PokedexId` — la lectura inversa de `assignPokemon`. Se renombra al moverlo porque deja de ser "metadata de la leyenda" para ser vocabulario compartido. |

**Lo visual se queda donde está.** `sprite-sources.ts` (los 25 `import` de PNG), `Legend.tsx`/`.scss`, `marker-temperature.ts` y `thermal-mood.ts` no se tocan: Oak no necesita ningún sprite ni ningún color. La extracción mínima es exactamente el `Record<PokedexId, string>`, no el componente que lo pinta.

## `NarrativeFact` — el hecho cerrado

Un hecho es **autocontenido y verificable**: lleva exactamente lo necesario para redactar esa frase y nada más. Unión discriminada por `kind`, sin `Record<string, unknown>` ni payloads genéricos. Todos los números salen tal cual del `LocationForecast`.

### Regla: Oak solo nombra el Pokémon que se ve en el mapa

`assignPokemon` devuelve **todos** los candidatos de un lugar; `pickMapPokemon` elige el único que se dibuja. Exponer un candidato perdedor haría que Oak hablase de un Pokémon que el usuario no ve por ninguna parte.

No es un riesgo teórico: en el `forecast.json` del 2026-09-18, **71 de los 74 lugares tienen al menos un candidato descartado**. A Coruña dibuja Castform-ice (niebla) y descarta a la vez `castform-rain`, `gyarados`, `hoppip` y `castform-sun`.

Por eso **ningún `NarrativeFact` lleva el `PokedexId` del eje que lo produjo**. Cada hecho de lugar lleva dos campos derivados de `pickMapPokemon`:

- `mapPokemonId: PokedexId` — el Pokémon realmente visible en ese lugar. Es el único que Oak puede nombrar.
- `representedOnMap: boolean` — `true` si el eje que produjo este hecho es el que ganó en el mapa. Permite que el planificador prefiera hechos coherentes con lo que se ve (la lluvia de un lugar que dibuja Kyogre) sobre los que no lo son, sin llegar a exponer nunca el candidato perdedor.

Con eso, el peor caso posible es una frase igualmente cierta: "llueven 3 mm en A Coruña, donde hoy manda Castform-ice".

```ts
// src/domain/oak/types.ts
import type { PokedexId } from '../pokedex.ts'
import type { AlertLevel, AlertPhenomenon, SkyCondition } from '../types.ts'

/** Un lugar tal y como Oak lo nombra, con el Pokémon que se ve ahí.
 *  `mapPokemonId` sale siempre de `pickMapPokemon`, nunca de un `assignBy*`. */
export interface FactLocation {
  locationId: string
  locationName: string
  mapPokemonId: PokedexId
}

/** Por qué esta temperatura es noticia — no es una regla nueva, es el
 *  resultado de ordenar los 74 valores reales del día. */
export type TemperatureRole = 'hottest' | 'coldest_day' | 'coldest_night'

export interface TemperatureFact extends FactLocation {
  kind: 'temperature'
  role: TemperatureRole
  maxC: number
  minC: number
  representedOnMap: boolean
}

export interface RainFact extends FactLocation {
  kind: 'rain'
  mm: number                      // > 0 siempre: sin acumulado no hay hecho
  probabilityPercent: number | null
  representedOnMap: boolean
}

export interface SnowFact extends FactLocation {
  kind: 'snow'
  cm: number                      // > 0 siempre
  representedOnMap: boolean
}

export interface WindFact extends FactLocation {
  kind: 'wind'
  speedKmh: number
  gustKmh: number | null
  warm: boolean                   // cumple también el umbral de viento cálido
  representedOnMap: boolean
}

export interface StormFact extends FactLocation {
  kind: 'storm'
  representedOnMap: boolean
}

export interface FogFact extends FactLocation {
  kind: 'fog'
  representedOnMap: boolean
}

export interface CalimaFact extends FactLocation {
  kind: 'calima'
  fromAlert: boolean              // true si vino del aviso, no del código de cielo
  representedOnMap: boolean
}

export interface SkyFact extends FactLocation {
  kind: 'sky'
  sky: SkyCondition
  representedOnMap: boolean
}

export interface MarineFact extends FactLocation {
  kind: 'marine'
  waveHeightM: number
  wavePeriodS: number | null
  representedOnMap: boolean
}

/** Un aviso oficial nunca dibuja Pokémon por sí mismo: `mapPokemonId` sigue
 *  siendo el del lugar, y `representedOnMap` no aplica. */
export interface AlertFact extends FactLocation {
  kind: 'alert'
  level: AlertLevel
  phenomenon: AlertPhenomenon
  sourcePhenomenon: string        // literal de la fuente — trazabilidad
  officialZoneId: string
  source: 'aemet' | 'ipma'
}

/** El Pokémon protagonista y dónde se le ve. Siempre un Pokémon visible:
 *  `locations` son lugares cuyo `mapPokemonId` es exactamente `pokemonId`. */
export interface PokemonSpotlightFact {
  kind: 'pokemon_spotlight'
  pokemonId: PokedexId
  label: string                   // POKEMON_LABELS[pokemonId]
  locations: FactLocation[]       // como mucho 3: las que la IA puede nombrar
  locationCount: number           // total real, aunque `locations` venga recortada
}

/** Dos lugares opuestos en la misma métrica, ambos con su valor real y con
 *  el Pokémon que de verdad se ve en cada uno. */
export interface ContrastFact {
  kind: 'contrast'
  metric: 'temperature_max' | 'rain_mm' | 'wind_speed'
  high: FactLocation & { value: number }
  low: FactLocation & { value: number }
}

/** Forma agregada del día. Todo son recuentos reales sobre los 74 lugares,
 *  calculados sobre el Pokémon visible de cada uno. */
export interface DayShapeFact {
  kind: 'day_shape'
  totalLocations: number
  rainingLocations: number
  alertedLocations: number
  distinctPokemonCount: number
  dominantPokemonId: PokedexId
  dominantLocationCount: number
}

export type Weekday = 'lunes' | 'martes' | 'miercoles' | 'jueves' | 'viernes' | 'sabado' | 'domingo'

/** Único hecho no meteorológico y el único sin lugar. Se deriva de
 *  `forecast.date`, sin dataset. */
export interface CalendarFact {
  kind: 'calendar'
  date: string
  weekday: Weekday
  weekend: boolean
}

export type NarrativeFact =
  | TemperatureFact
  | RainFact
  | SnowFact
  | WindFact
  | StormFact
  | FogFact
  | CalimaFact
  | SkyFact
  | MarineFact
  | AlertFact
  | PokemonSpotlightFact
  | ContrastFact
  | DayShapeFact
  | CalendarFact
```

**Por qué así:** la IA no puede interpretar el forecast porque no lo ve. Recibe entre 3 y 6 de estos objetos y solo puede verbalizarlos. Además es lo que hace viable el presupuesto de tokens de una capa gratuita: mandar los 74 `LocationForecast` serían decenas de miles de tokens; el `DayReport` completo se queda en el orden de un millar.

## `DayReport` y el plan de diálogos

```ts
export type DayMode = 'alerta' | 'invasion' | 'avistamiento' | 'parte'
export type Tone = 'neutral' | 'cientifico' | 'epico' | 'consejo' | 'guasa'
export type DialogueRole = 'apertura' | 'foco' | 'cierre'
export type DialogueId = 'dialogue-1' | 'dialogue-2' | 'dialogue-3'
export type LeitmotifId =
  | 'hoppip-vuela'
  | 'castform-vestuario'
  | 'groudon-termostato'
  | 'gyarados-mar'
  | 'snorunt-frio'

export interface DialogueSlot {
  id: DialogueId
  role: DialogueRole
  tone: Tone
  facts: NarrativeFact[]          // 1..2, nunca vacío, nunca repetidos entre slots
  leitmotif: LeitmotifId | null
}

/** Por qué este Pokémon protagoniza — ver "Protagonistas". */
export type ProtagonistRole = 'severity' | 'spread' | 'rarity'

export interface Protagonist {
  role: ProtagonistRole
  pokemonId: PokedexId
  label: string                   // POKEMON_LABELS[pokemonId]
  locations: FactLocation[]
  locationCount: number
}

export interface DayReport {
  date: string                    // === forecast.date (mañana)
  weekday: Weekday
  weekend: boolean
  dayMode: DayMode
  protagonists: Protagonist[]     // 1..3
  dialoguePlan: [DialogueSlot, DialogueSlot, DialogueSlot]
}
```

`dayMode` es del día, no del slot: tres frases del mismo personaje en el mismo bocadillo no cambian de registro a mitad. El tono sí varía por slot.

### Reparto de los tres diálogos

`plan-dialogues.ts` reparte sin solapar, llevando un conjunto de hechos ya consumidos:

1. **`apertura`** — sitúa el día. Toma el `CalendarFact` y/o el `DayShapeFact`. Tono `neutral` o `cientifico`. Nunca gasta el hecho más fuerte.
2. **`foco`** — el hecho más interesante: el protagonista `severity` con su hecho asociado (y el `AlertFact` si el modo es `alerta`). A igualdad de interés se prefiere un hecho con `representedOnMap: true`. Tono `epico` en `alerta`/`invasion`, `neutral` en el resto. Uno o dos hechos, no más.
3. **`cierre`** — otro dato, un consejo o un gag. Toma un hecho del protagonista `spread` o `rarity`, un `ContrastFact`, o el leitmotiv del día si hay uno elegible. Tono `consejo` si algún hecho es accionable (lluvia, viento, calor, nieve, aviso), `guasa` si no.

**Día poco interesante:** siempre hay material sin necesidad de dramatismo. `DayShapeFact` y `CalendarFact` existen todos los días; siempre hay un `TemperatureFact` de máxima y otro de mínima; `SkyFact` y el `ContrastFact` de temperatura existen prácticamente siempre. El modo cae a `parte` y el tono a `neutral`/`guasa`, que es exactamente el registro correcto para un día ordinario — ese es el "día tranquilo" del repertorio, sin necesidad de un modo aparte.

**Longitud:** cada `text` entre 20 y 160 caracteres. Es un bocadillo, no un párrafo — y lo impone el validador, no solo el prompt.

## Protagonistas — derivados de `MAP_PRIORITY`, sin tabla nueva

No hay segundo sistema de importancia. Partiendo de `buildLocationViews(locations, forecast)` (que ya cruza `assignPokemon` + `pickMapPokemon` para los 74 lugares) se calculan tres protagonistas con reglas objetivas y distintas entre sí, siempre sobre el Pokémon visible:

| Rol | Regla | Qué aporta |
|---|---|---|
| `severity` | El `PokedexId` presente hoy con mejor posición en `MAP_PRIORITY`. | El titular. |
| `spread` | El `PokedexId` que aparece en más lugares del mapa. Empate → mejor posición en `MAP_PRIORITY`. | La cara real del día. |
| `rarity` | El `PokedexId` presente en menos lugares, excluyendo los ya elegidos. Empate → mejor posición en `MAP_PRIORITY`. | La rareza que merece un comentario. |

Si dos roles coinciden, el segundo pasa al siguiente candidato; si no queda ninguno, ese rol no existe ese día (`protagonists` tiene entre 1 y 3 elementos).

Esto evita las dos trampas: no duplica un ranking (usa `MAP_PRIORITY` tal cual) y no narra siempre el primer elemento (solo `severity` lo hace, y el historial puede desbancarlo).

_Con el `forecast.json` del 2026-09-18: `severity` = `gyarados-mega` (2 lugares), `spread` = `charmander` (21), `rarity` = `gyarados` (3)._

## Modos narrativos

Cuatro modos, evaluados **por prioridad: el primero que cumple, gana**. La tabla depende solo del forecast y de los Pokémon visibles, no de los roles de protagonista.

| Modo | Dato real que lo hace elegible | Comprobación con el forecast del 2026-09-18 |
|---|---|---|
| `alerta` | ≥ 1 `OfficialAlert` activo en `forecast.date`, deduplicado, con nivel `naranja` o `rojo`. | **Elegible**: 12 avisos activos deduplicados, 4 naranjas. |
| `invasion` | Un mismo `PokedexId` es el visible en ≥ 25 de los 74 lugares (un tercio del mapa). | No elegible: el máximo es `charmander` con 21. |
| `avistamiento` | Existe algún `PokedexId` visible en ≤ 2 lugares que además es **significativo**: está por delante de `hoppip` en `MAP_PRIORITY`. | Elegible por `gyarados-mega` (2 lugares), aunque hoy gana `alerta` por prioridad. |
| `parte` | Siempre. Es el respaldo, y cubre el día tranquilo mediante el tono. | Siempre. |

### La frontera "por delante de `hoppip`" — sí funciona con el array actual

No es un umbral nuevo: es la frontera que el propio `MAP_PRIORITY` ya documenta. Su comentario dice que `hoppip` y las tres representaciones que le siguen (`castform`, `altaria`, `castform-sun`) son **condiciones secundarias**, que solo se dibujan cuando no hay nada más significativo que mostrar. `índice < índice de 'hoppip'` es, literalmente, "esto es una condición significativa".

Incluye las bandas térmicas, y eso es correcto para `avistamiento`: un `snorunt` en dos únicos lugares de los 74 es exactamente el tipo de rareza que Oak debería comentar. Excluye `hoppip`/`castform`/`altaria`/`castform-sun`, que por frecuentes nunca son un avistamiento.

Se implementa como un único helper exportado junto a `MAP_PRIORITY` (`isSignificantPokemon(id)`), no como una lista aparte.

### Modos retirados y por qué

| Modo antiguo | Motivo |
|---|---|
| `calma` | **Descartado con datos.** Con el `MAP_PRIORITY` actual, todas las bandas térmicas van por delante de `hoppip`, y `assignByTemperature` siempre asigna algo. El día 2026-09-18, **58 de los 74 lugares** muestran un Pokémon por delante de `hoppip` (29 de ellos por banda térmica pura). La condición es prácticamente inalcanzable: sería un día con los 74 lugares entre 15 y 25 °C y sin ningún fenómeno. El registro tranquilo lo cubre `parte` con tono `neutral`. |
| `duelo` | **Descartado con datos.** El umbral de ≥ 12 °C se cumple en un día completamente ordinario: el 2026-09-18 el salto entre la máxima más alta (Sevilla, 33 °C) y la más baja (Oviedo, 19,3 °C) es de **13,7 °C**. Cubrir Canarias, la meseta, el Pirineo y Portugal a la vez hace que el contraste sea la norma, no la noticia. El `ContrastFact` sigue existiendo como hecho para el cierre; lo que no existe es un modo que se active por él. |
| `batalla` | Se solapaba por completo con `duelo`. |
| `expedicion` | Sin condición objetiva: era el reparto normal de hechos, no un modo. |
| `laboratorio` | Solo flavour. Pasa a `Tone.cientifico`. |
| `pokedex` | Solo flavour: leer la etiqueta. Se cubre con `PokemonSpotlightFact` + tono. |
| `consejo` | Solo flavour y siempre aplicable al cierre. Pasa a `Tone.consejo`. |
| `misterio` | Sin condición objetiva propia; la niebla ya es un `FogFact`. Pasa a `Tone.guasa`. |
| `fin_de_semana` | Dato ortogonal al tiempo, no un modo que compita con `alerta`. Pasa a `CalendarFact.weekend`. |
| `efemeride` | Necesita un dataset de efemérides que no existe. |
| `anomalia` | Necesita climatología de referencia. Sigue fuera. |
| `relevo` | Necesita franjas mañana/tarde. Sigue fuera (`roadmap.md`). |
| `migracion` | Necesita información multi-día. Sigue fuera. |

Cuatro modos con condición comprobable en vez de trece con reglas artificiales. `duelo` y `calma` pueden volver el día que haya una razón medida para ello; hoy no la hay.

## Avisos oficiales

### Lo que sí queda persistido

`forecast.json` guarda, por lugar, el `OfficialAlert` **completo**: `level`, `phenomenon`, `sourcePhenomenon`, `startsAt`, `endsAt`, `source`, `officialZoneId`. No se pierde nada del aviso en sí. Oak tiene todo lo necesario sin tocar la red.

### Dos advertencias sobre el dato actual

1. **Los avisos persistidos no están filtrados por fecha.** Son el "último elaborado", que cubre sobre todo el día en curso, mientras que `forecast.date` es mañana. Oak filtra con el mismo `isActiveOnDate` que ya usa la 003 — de ahí el movimiento a `src/domain/alerts.ts`.
2. **Un mismo aviso aparece repetido** en los lugares que comparten zona oficial. Los `AlertFact` se deduplican por `officialZoneId + phenomenon + level + startsAt` antes de entrar en el plan.

### Decisiones cerradas

- **Cobertura: solo los 74 proxies.** No se toca la 002, no se añade `alerts-today.json` y no se hace ninguna consulta de red nueva. Un aviso que Oak no puede atar a un lugar del mapa es un aviso que no puede señalar.
- **`rojo` → activa `alerta`.** Prioridad absoluta.
- **`naranja` → activa `alerta`.**
- **`amarillo` → no cambia `dayMode`**, pero puede producir un `AlertFact` dentro de otro modo.

El umbral en naranja es una **decisión editorial**: el modo `alerta` debe conservar su excepcionalidad, y el amarillo es el nivel ordinario de un otoño ibérico. No se apoya en ninguna medida de frecuencia — haría falta una serie de varios meses, no el reparto de niveles de un solo `forecast.json`. Como referencia puntual, y solo como tal: el 2026-09-18 hay 12 avisos activos deduplicados en `forecast.date`, 8 amarillos y 4 naranjas.

## Historial, continuidad e idempotencia

```ts
export interface OakHistoryEntry {
  date: string
  dayMode: DayMode
  protagonistIds: PokedexId[]     // 1..3, en orden de rol
  leitmotifIds: LeitmotifId[]
}
```

Tres campos menos que el diseño anterior (`tone`, `flavour`, `openingStyle`): no hacen falta para las únicas tres cosas que queremos evitar.

### Idempotencia por fecha (invariante duro)

Puede haber **varias generaciones para el mismo `forecast.date`** (el `schedule` y un `workflow_dispatch` manual el mismo día, o varios reruns). El historial no puede confundir eso con varios días distintos:

- **Al leer**, antes de calcular cooldowns y continuidad, se **descarta toda entrada cuya `date` sea la fecha objetivo actual**. Un rerun ve el mismo historial que vio el run original y, a igualdad de forecast, toma las mismas decisiones.
- **Al escribir**, la entrada del día se aplica por **upsert**: reemplaza la que ya hubiera con esa `date`, nunca se añade al lado.
- **Invariante:** `oak-history.json` no puede contener dos entradas con la misma `date`. Se comprueba antes de escribir; si se viola, el script falla ruidosamente y no escribe nada.
- La retención se cuenta por **días distintos**, no por número de entradas.

### Reglas de continuidad

| Problema | Regla |
|---|---|
| Mismo chiste todos los días | Un leitmotiv no es candidato si aparece dentro de los últimos `cooldownDays` de su propia entrada de catálogo. |
| Mismo modo demasiados días seguidos | Si el modo elegido es el mismo los últimos 3 días y hay otro elegible, se pasa al siguiente. **`alerta` nunca cede** — un aviso naranja tres días seguidos se narra tres días. |
| Mismo protagonista siempre | Si el `PokedexId` de `severity` ha sido el primer protagonista los últimos 3 días y existe un `spread`/`rarity` distinto, el slot `foco` usa ese en su lugar. El modo del día no cambia por esto. |

`history.ts` es **puro**: recibe `OakHistoryEntry[]` y la fecha objetivo, y devuelve las decisiones y la lista actualizada. El I/O (`src/data/oak-history.json`) vive en `scripts/oak/`. Retención: los días distintos que cubran el cooldown más largo configurado, no un número fijo.

## Leitmotivs — catálogo inicial

Cinco, no más. Cada uno solo es candidato si el dato del día lo justifica; ninguno puede afirmar nada que no esté en un hecho del día.

| Id | Idea | Condición de elegibilidad |
|---|---|---|
| `hoppip-vuela` | Hoppip sale volando y a ver cómo vuelve al laboratorio. | Hay un `WindFact` o `hoppip` es visible en algún lugar. |
| `castform-vestuario` | Castform cambiándose de forma según le da el día. | Hay a la vez dos formas distintas de Castform visibles en el mapa. |
| `groudon-termostato` | A alguien se le ha ido la mano con el termostato. | `groudon`/`groudon-primal`/`magmar` visibles, o un `TemperatureFact` de máxima alta. |
| `gyarados-mar` | Gyarados de mal humor mar adentro. | Hay un `MarineFact`, o `gyarados`/`gyarados-mega` visibles. |
| `snorunt-frio` | Snorunt encantado, el resto no tanto. | `snorunt`/`cryogonal`/`abomasnow` visibles, o un `TemperatureFact` de mínima baja. |

La redacción concreta vive en `leitmotifs.ts` y se ajusta sin tocar el motor.

## La voz de Oak

Referencia de personaje, aplicable tanto al prompt de la IA como a las cláusulas del fallback:

- Profesor veterano y curioso; amable; ligeramente despistado.
- Humor seco y cariñoso.
- Frases cortas, de bocadillo de videojuego.
- **Nunca** lenguaje de boletín meteorológico ("se esperan precipitaciones en el tercio norte").
- **Nunca** infantilizar al lector.
- **Nunca** inventar un hecho para poder hacer un chiste: el chiste se hace con lo que hay.

Registro orientativo (referencia de voz, **no** plantillas literales):

> "¡Vaya! Magmar se ha adueñado hoy de buena parte del sur. Yo buscaría algo de sombra."
> "Curioso... varios Castform se han reunido por el norte. No olvidaría el paraguas."
> "Hoppip tiene trabajo hoy. Con ese viento, espero que recuerde cómo volver al laboratorio."
> "Nada demasiado extraño por aquí. A veces un día tranquilo también es una buena noticia."
> "Atención: hay un aviso naranja activo. Hoy dejaremos los experimentos para otro momento."

## Fallback — parte de primera clase

Mismo `DialoguePlan`, mismos hechos, sin red. Se compone, no se enumera:

1. **Una cláusula por `kind` de hecho** — 14 funciones puras y cortas (`fact → string`), cada una con dos o tres redacciones entre las que elige una semilla determinista derivada de `date`. Es donde vive la voz de Oak.
2. **Unos pocos marcos por rol** — tres o cuatro estructuras de frase por `apertura`/`foco`/`cierre` que engarzan una o dos cláusulas y el tono.

Da variedad suficiente sin tabla combinatoria: unas 40 piezas cortas bien escritas en vez de cientos de plantillas completas. Determinista: el mismo día produce siempre el mismo fallback. Vive en `src/domain/oak/` porque es puro.

## IA

- **Dominio desacoplado:** `src/domain/oak/` no conoce Groq. La frontera es una función pequeña, `generateOakDialogues(report: DayReport): Promise<OakGeneration | null>`, implementada en `scripts/oak/groq-adapter.ts`. `null` = usa el fallback.
- **Transporte:** `fetch` de Node contra `POST https://api.groq.com/openai/v1/chat/completions`, `Authorization: Bearer $GROQ_API_KEY`. Sin SDK — la API es OpenAI-compatible y una sola llamada no justifica una dependencia.
- **Salida estructurada:** `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`, soportado hoy por `openai/gpt-oss-120b` y `openai/gpt-oss-20b`. Con `strict: true` el esquema se impone por decodificación restringida; aun así el output **se vuelve a validar** en nuestro código: nunca se confía en el modo estricto.
- **Modelo:** `openai/gpt-oss-120b` por defecto, configurable por `GROQ_MODEL`.
- **Una llamada por generación**, no una por diálogo: los 3 diálogos salen de una única petición. El `schedule` normal hace una al día; un rerun manual hace otra, y eso es esperado — el sistema no promete "una al día", promete "una por generación".
- **Presupuesto de tokens:** el `DayReport` serializado ronda el millar de tokens porque solo lleva hechos cerrados. No es una optimización: es lo que permite quedarse dentro del límite por minuto de una capa gratuita.
- **Capa gratuita, 0 €.** Nunca se habilita billing. Cualquier `429`, indisponibilidad o cambio de cuota cae al fallback. Las cifras concretas de cuota no se fijan en el diseño: se consultan en la consola de Groq y cambian sin aviso.
- **Timeout** corto y explícito (`AbortSignal.timeout`), sin reintentos: si falla, fallback.
- **Secreto:** `GROQ_API_KEY` en GitHub Secrets y en `.env` local. Nunca `VITE_*`, nunca en el JSON publicado.

**Contrato de salida validado:**

```ts
export interface OakGeneration {
  dialogues: [
    { id: 'dialogue-1'; text: string },
    { id: 'dialogue-2'; text: string },
    { id: 'dialogue-3'; text: string },
  ]
}
```

Validación propia antes de publicar: exactamente 3 elementos, los 3 `id` esperados y en orden, `text` no vacío, 20–160 caracteres, sin campos extra. Cualquier desviación → fallback.

## `oak-today.json` y consumo desde el frontend

```ts
export interface OakDialogue {
  id: DialogueId
  role: DialogueRole
  text: string
}

export interface OakToday {
  date: string                    // === forecast.date
  generatedAt: string
  source: 'ai' | 'fallback'
  dayMode: DayMode
  dialogues: [OakDialogue, OakDialogue, OakDialogue]
}
```

No lleva los hechos ni el plan: el frontend no los necesita y el JSON público no debe cargar con el andamiaje.

Consumo idéntico al de `forecast.json`: `import oakData from './data/oak-today.json'` en `App.tsx`, tipado como `OakToday` y pasado a `WeatherApp`. Sin `fetch`, sin estado global, sin lógica narrativa en el componente. `date` viaja para que la interfaz pueda mostrar de qué día habla y detectar un desfase con `forecast.date`.

El componente concreto (`src/components/ProfessorOak/`) y su UX se diseñan en una fase posterior. Sin voz ni TTS en esta feature: el gesto de `EMPEZAR` (006) existe, pero no se da por resuelto el autoplay a futuro.

## Integración en el workflow actual

Workflow de hoy (`.github/workflows/deploy.yml`): `checkout → setup-node → npm ci → fetch:forecast (solo cron/manual) → upload raw forecast artifact → lint → test → build → commit forecast.json → upload pages → deploy`.

Propuesta:

```
npm ci
→ Fetch forecast                (cron/manual)  ← ya aborta sin escribir si no pasa invariantes
→ Upload raw forecast artifact  (cron/manual)  ← SIN MOVER, sigue justo detrás del fetch
→ Generate Oak                  (cron/manual)  ← NUEVO, después del artifact
→ Upload Oak artifact           (cron/manual)  ← NUEVO, opcional, artifact propio
→ lint → test → build
→ Commit (forecast.json + oak-today.json + oak-history.json)
→ upload pages → deploy
```

Por qué exactamente ahí:

- **El artifact del forecast no se mueve.** Su razón de ser es conservar el snapshot del día en cuanto existe, pase lo que pase después. Un fallo de Oak no puede quitarle esa garantía, así que Oak va **detrás** del artifact, nunca entre el fetch y él.
- **Los JSON de Oak, en su propio paso de artifact**, después de generarlos. Si Oak falla, ese paso no llega a ejecutarse y el artifact del forecast ya está a salvo.
- **Después del fetch** porque `fetch-forecast.ts` ya aplica `checkForecastReadiness` y **no escribe** `forecast.json` si el dataset es inválido. La regla de preservar el último JSON válido no se toca.
- **Antes de lint/test/build** para que el `oak-today.json` del día pase por la misma validación que el resto del código y entre en el bundle que se despliega.
- **Mismo `if:`** que el fetch (`schedule || workflow_dispatch`): en un `push` normal se usa el `oak-today.json` ya commiteado.
- **Mismo commit** que el forecast: el día y su narración viajan juntos.

**Guarda propia de Oak:** el script recalcula `computeTargetDate(new Date())` y aborta ruidosamente si no coincide con la `date` del `forecast.json` que acaba de leer. Evita narrar una previsión rancia si alguna vez se ejecutara suelto.

**Semántica de fallo:**

| Qué falla | Qué pasa |
|---|---|
| IA: red, timeout, `429`, JSON inválido, esquema incorrecto, longitud fuera de rango | Fallback local, `source: 'fallback'`, se escriben los JSON, exit 0, aviso en el log. |
| Nuestra lógica: no se pueden construir 3 slots válidos, `forecast.json` incoherente, fecha desalineada, historial con fechas duplicadas | `process.exitCode = 1`, **no se escribe nada**. El job se para antes de `build` y no se despliega; queda en línea el despliegue anterior. |

El workflow **no se toca hasta que se apruebe este plan**.

## Estructura de archivos

```
src/domain/
  alerts.ts                     ← + isActiveOnDate (movida desde assign-pokemon.ts)
  map-priority.ts               ← movido desde components/SpainMap/pick-map-pokemon.ts
                                   (+ isSignificantPokemon)
  pokemon-labels.ts             ← POKEMON_LABELS, movido desde Legend/legend-metadata.ts
  location-views.ts             ← movido desde components/SpainMap/
  oak/
    types.ts                    NarrativeFact, DayReport, DialogueSlot, OakToday, historial
    facts.ts                    Forecast → NarrativeFact[] (puro, solo Pokémon visibles)
    protagonists.ts             Protagonist[] desde MAP_PRIORITY + recuentos
    day-mode.ts                 4 modos, primer modo que cumple
    leitmotifs.ts               catálogo de 5 gags
    history.ts                  puro, sin I/O, idempotente por fecha
    plan-dialogues.ts           los 3 DialogueSlot sin solapar
    fallback-dialogues.ts       cláusulas + marcos, determinista, sin red
scripts/oak/
  build-day-report.ts           I/O: lee forecast.json, arma el DayReport
  groq-adapter.ts               única frontera con la IA
  generate.ts                   entrypoint: report → IA o fallback → escribe los JSON
src/data/
  oak-today.json                generado
  oak-history.json              generado, una entrada por fecha
src/components/ProfessorOak/    fase posterior
```

Sin cambios en `sprite-sources.ts`, `Legend.scss`, `thermal-mood.ts` ni `marker-temperature.ts`.

## Decisiones

- **Oak solo nombra Pokémon visibles.** Ningún hecho lleva un candidato de `assignBy*`; todos llevan `mapPokemonId` de `pickMapPokemon`.
- **Sin ranking paralelo.** `MAP_PRIORITY` es la única autoridad de "qué es más noticia".
- **Hechos cerrados, no forecast libre.** La IA no ve `forecast.json`.
- **`Tone` en vez de `Tone` + `Flavour`.**
- **4 modos, no 13.** `duelo` y `calma` descartados con datos del forecast real.
- **`avistamiento` usa la frontera ya existente** de "condición significativa" (`índice < 'hoppip'`).
- **Avisos: solo los de los 74 lugares**, filtrados por `forecast.date` y deduplicados por zona. Umbral naranja+rojo, decisión editorial.
- **Historial idempotente por fecha**: se ignora la entrada del día objetivo al leer y se hace upsert al escribir.
- **Una llamada a la IA por generación**, no por diálogo.
- **`src/data/`, no `public/`**.
- **Sin SDK de IA.** `fetch` de Node y salida estructurada por `response_format`.

## Riesgos

- **Que la voz de Oak suene a boletín.** Se mitiga en el prompt y, sobre todo, en el fallback: si las cláusulas locales no suenan a Oak, el problema es de redacción y se corrige sin tocar el motor.
- **Que la IA cuele un dato que no está en los hechos.** Mitigado porque solo recibe hechos; el validador comprueba forma y longitud, no veracidad semántica. Riesgo residual aceptado: el modelo podría adornar. Se acota con un prompt corto y explícito y `temperature` baja.
- **Mover `location-views.ts`/`pick-map-pokemon.ts`/las etiquetas a `src/domain/`** toca imports de componentes ya cerrados (004/005). Es un movimiento mecánico cubierto por los tests existentes, pero se hace en su propio bloque y se ve verde antes de seguir.
- **`avistamiento` puede quedarse silencioso semanas enteras** si no hay ningún Pokémon significativo con ≤ 2 lugares. Es aceptable: `parte` cubre el resto y es mejor que un modo que se active por costumbre.
- **Ruido en el historial de git:** commit diario con tres JSON en vez de uno. Aceptado: mismo patrón que ya tiene el proyecto.
