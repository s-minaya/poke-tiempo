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
- `mapRepresentsFact: boolean` — `true` si el Pokémon visible es uno de los que asigna el eje de este hecho. Es una comprobación de **coincidencia**, no de procedencia: `pickMapPokemon` devuelve un `PokedexId` y no conserva de qué eje salió, así que afirmar cuál "ganó" sería inventar información. Permite que el planificador prefiera hechos coherentes con lo que se ve (la lluvia de un lugar que dibuja Kyogre) sin llegar a exponer nunca el candidato perdedor.

Con eso, el peor caso posible es una frase igualmente cierta: "llueven 3 mm en A Coruña, donde hoy manda Castform-ice".

```ts
// src/domain/oak/types.ts — contrato implementado: 12 `kind`.
// Los comentarios largos de cada campo viven en el propio archivo.
import type { PokedexId } from '../pokedex.ts'
import type { AlertLevel, AlertPhenomenon } from '../types.ts'

/** Un lugar, solo identidad: no todo hecho de un lugar tiene Pokémon. */
export interface FactLocation {
  locationId: string
  locationName: string
}

/** Un lugar con el Pokémon que de verdad se dibuja en él. */
export interface MapFactLocation extends FactLocation {
  mapPokemonId: PokedexId
}

/** Hecho de un lugar cuyo eje meteorológico sí tiene Pokémon en la 003. */
export interface RepresentableFact extends MapFactLocation {
  mapRepresentsFact: boolean
}

/** Por qué esta temperatura es noticia — no es una regla nueva, es el
 *  resultado de ordenar los valores reales del día. */
export type TemperatureRole = 'hottest' | 'coldest_day' | 'coldest_night'

export interface TemperatureFact extends RepresentableFact {
  kind: 'temperature'
  role: TemperatureRole
  maxC: number
  minC: number
}

export interface RainFact extends RepresentableFact {
  kind: 'rain'
  mm: number                      // > 0 siempre: sin acumulado no hay hecho
  probabilityPercent: number | null
}

export interface SnowFact extends RepresentableFact {
  kind: 'snow'
  cm: number                      // > 0 siempre
}

export interface WindFact extends RepresentableFact {
  kind: 'wind'
  speedKmh: number
  gustKmh: number | null
  warm: boolean                   // cumple también el umbral de viento cálido
}

export interface StormFact extends RepresentableFact { kind: 'storm' }

export interface FogFact extends RepresentableFact { kind: 'fog' }

export interface CalimaFact extends RepresentableFact {
  kind: 'calima'
  fromAlert: boolean              // hay aviso oficial de calima activo ese día
}

export interface MarineFact extends RepresentableFact {
  kind: 'marine'
  waveHeightM: number
  wavePeriodS: number | null
}

/** Un aviso oficial nunca dibuja Pokémon: se emite para una zona oficial, no
 *  para un lugar nuestro, así que no lleva `mapPokemonId` ni
 *  `mapRepresentsFact`. `affectedLocations` dice qué puntos del mapa caen
 *  bajo esa zona. */
export interface AlertFact {
  kind: 'alert'
  level: AlertLevel
  phenomenon: AlertPhenomenon
  sourcePhenomenon: string        // literal de la fuente — trazabilidad
  officialZoneId: string
  source: 'aemet' | 'ipma'
  affectedLocations: FactLocation[]
  affectedLocationCount: number
}

/** El Pokémon protagonista y dónde se le ve. Siempre un Pokémon visible:
 *  `locations` son lugares cuyo `mapPokemonId` es exactamente `pokemonId`. */
export interface PokemonSpotlightFact {
  kind: 'pokemon_spotlight'
  pokemonId: PokedexId
  label: string                   // POKEMON_LABELS[pokemonId]
  locations: MapFactLocation[]    // como mucho 3: las que se pueden nombrar
  locationCount: number           // total real, aunque `locations` venga recortada
}

/** Forma agregada del día. Recuentos reales sobre los lugares con previsión,
 *  calculados sobre el Pokémon visible de cada uno. Deliberadamente **no**
 *  dice qué Pokémon domina: eso ya lo dice `PokemonSpotlightFact`. */
export interface DayShapeFact {
  kind: 'day_shape'
  totalLocations: number
  rainingLocations: number
  alertedLocations: number
  distinctPokemonCount: number
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
  | MarineFact
  | AlertFact
  | PokemonSpotlightFact
  | DayShapeFact
  | CalendarFact
```

**Por qué así:** la IA no puede interpretar el forecast porque no lo ve. Recibe entre 3 y 6 de estos objetos y solo puede verbalizarlos. Además es lo que hace viable el presupuesto de tokens de una capa gratuita: mandar los 74 `LocationForecast` serían decenas de miles de tokens; el payload que recibe la IA se queda en el orden de un millar.

## `DayPlan` y el plan de diálogos

El objeto que cierra el día no se llama `DayReport`: **el dominio produce un `DayPlan`** y no existe ningún segundo objeto con la misma información.

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

export type DialoguePlan = [DialogueSlot, DialogueSlot, DialogueSlot]

/** Por qué este Pokémon protagoniza — ver "Protagonistas". */
export type ProtagonistRole = 'headline' | 'spread' | 'rarity'

export interface Protagonist {
  role: ProtagonistRole
  spotlight: PokemonSpotlightFact // el hecho entero, no una copia de sus campos
}

/** El modo y el hecho que lo justificó, juntos: el reparto no vuelve a deducirlo. */
export type DayModeDecision =
  | { mode: 'alerta'; trigger: AlertFact }
  | { mode: 'invasion'; trigger: PokemonSpotlightFact }
  | { mode: 'avistamiento'; trigger: PokemonSpotlightFact }
  | { mode: 'parte'; trigger: null }

export interface DayPlan {
  date: string                    // === forecast.date (mañana)
  dayMode: DayMode
  focusPokemonId: PokedexId | null
  leitmotif: LeitmotifId | null
  dialoguePlan: DialoguePlan
  historyEntry: OakHistoryEntry   // listo para persistir
}
```

`Protagonist` guarda el `PokemonSpotlightFact` entero en vez de repetir sus campos: el hecho ya existe y duplicarlo era una fuente de divergencia. El día de la semana tampoco se copia al plan — vive en el `CalendarFact`, que es un hecho como los demás.

## Protagonistas — derivados de `MAP_PRIORITY`, sin tabla nueva

No hay segundo sistema de importancia. Partiendo de `buildLocationViews(locations, forecast)` (que ya cruza `assignPokemon` + `pickMapPokemon` para los 74 lugares) se calculan tres protagonistas con reglas objetivas y distintas entre sí, siempre sobre el Pokémon visible:

| Rol | Regla | Qué aporta |
|---|---|---|
| `headline` | El `PokedexId` presente hoy con mejor posición en `MAP_PRIORITY`. | El titular. |
| `spread` | El `PokedexId` que aparece en más lugares del mapa. Empate → mejor posición en `MAP_PRIORITY`. | La cara real del día. |
| `rarity` | El `PokedexId` presente en menos lugares, excluyendo los ya elegidos. Empate → mejor posición en `MAP_PRIORITY`. | La rareza que merece un comentario. |

Si dos roles coinciden, el segundo pasa al siguiente candidato; si no queda ninguno, ese rol no existe ese día (`protagonists` tiene entre 1 y 3 elementos).

Esto evita las dos trampas: no duplica un ranking (usa `MAP_PRIORITY` tal cual) y no narra siempre el primer elemento (solo `headline` lo hace, y el historial puede desbancarlo).

_Con el `forecast.json` del 2026-09-18: `headline` = `gyarados-mega` (2 lugares), `spread` = `charmander` (21), `rarity` = `gyarados` (3)._

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
| `duelo` | **Descartado con datos.** El umbral de ≥ 12 °C se cumple en un día completamente ordinario: el 2026-09-18 el salto entre la máxima más alta (Sevilla, 33 °C) y la más baja (Oviedo, 19,3 °C) es de **13,7 °C**. Cubrir Canarias, la meseta, el Pirineo y Portugal a la vez hace que el contraste sea la norma, no la noticia. El contraste térmico no llegó a existir como hecho — un dato que se cumple casi todos los días no es una noticia —, y tampoco existe un modo que se active por él. |
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
| Mismo protagonista siempre | Si el `PokedexId` de `headline` ha sido el primer protagonista los últimos 3 días y existe un `spread`/`rarity` distinto, el slot `foco` usa ese en su lugar. El modo del día no cambia por esto. |

`history.ts` es **puro**: recibe `OakHistoryEntry[]` y la fecha objetivo, y devuelve las decisiones y la lista actualizada. El upsert por fecha y la retención también viven ahí (`nextHistory`), no en el script: del script solo es leer, validar y escribir.

Retención derivada de sus dos únicos consumidores, no de una cifra redonda: `max(FOCUS_REPEAT_LIMIT, MAX_LEITMOTIF_COOLDOWN_DAYS)` días anteriores más el propio día generado. En una ventana de N días de calendario no caben más de N fechas distintas, así que quedarse con las N más recientes cubre el cooldown exactamente.

Lectura del archivo (`scripts/oak/history-file.ts`): **que no exista es normal** — el primer día no hay historial y `[]` es la respuesta correcta. **Que exista y esté mal no lo es**: JSON roto, forma inesperada, `PokedexId` o `LeitmotifId` desconocidos y fechas imposibles abortan sin escribir nada. Convertirlos en "historial vacío" haría que Oak olvidara su continuidad en silencio.

Una entrada **posterior** a la fecha objetivo también aborta: o el reloj iba mal cuando se generó, o el archivo viene de otra rama, y fiarse de ella envenenaría el cooldown y la racha de focos durante días. La del propio día objetivo sí vale — es un rerun, y `recentHistory` ya sabe que no cuenta como historial previo. La comprobación vive en el lector y no en `history.ts`: depende de qué día se está generando, no de la forma del dato, y el dominio puro no sabe eso.

## Leitmotivs — catálogo inicial

Cinco, no más. Una única condición para los cinco, sin reglas particulares: el gag habla de un Pokémon concreto y solo es candidato si **ese Pokémon está hoy en el mapa** — es decir, si existe su `PokemonSpotlightFact` — y no está en cooldown. Ninguno puede afirmar nada que no esté en un hecho del día.

| Id | Idea | Pokémon que lo activan |
|---|---|---|
| `hoppip-vuela` | Hoppip sale volando y a ver cómo vuelve al laboratorio. | `hoppip` |
| `castform-vestuario` | Castform cambiándose de forma según le da el día. | `castform`, `castform-sun`, `castform-rain`, `castform-ice` |
| `groudon-termostato` | A alguien se le ha ido la mano con el termostato. | `groudon`, `groudon-primal` |
| `gyarados-mar` | Gyarados de mal humor mar adentro. | `gyarados`, `gyarados-mega` |
| `snorunt-frio` | Snorunt encantado, el resto no tanto. | `snorunt` |

Cooldown de 5 **días de calendario** para los cinco: usado el día 10, bloqueado del 11 al 15, disponible el 16. Que el pipeline se saltara alguna jornada no alarga la espera — el gag descansa cinco días, no cinco ejecuciones.

**Días serios (`serious-day.ts`).** Hay días en los que Oak no bromea, y no es una indicación de redacción: el reparto no puede producir humor. Cuando el día es serio no se elige leitmotiv, ningún hueco lleva tono `guasa`, el historial no registra ningún gag —así que tampoco se consume cooldown: el gag que no se contó sigue disponible mañana— y `planDialogues` lanza si aun así se colara alguno. El `DayPlan` viaja con `serious: boolean`, que es lo que leen el fallback, los claims y el prompt.

Hoy la única causa es `dayMode === 'alerta'`, que solo se activa con un aviso oficial naranja o rojo. Vive en su propio módulo y devuelve un motivo con nombre (`'aviso-oficial'`) en vez de un booleano, para que añadir una causa nueva —y no tiene por qué ser meteorológica— sea añadir una rama ahí y nada más: el resto del sistema ya consulta `serious`, no la causa. Los tonos del foco no cambian: naranja sigue siendo `consejo` y rojo `epico`, pero en un día serio épico significa gravedad y atención, no espectáculo. El cierre se queda en el tono no humorístico que ya le tocaba (`consejo` para hechos que admiten prudencia, `neutral` si no).

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

Mismo `DialoguePlan`, mismos hechos, sin red. `generateFallbackDialogues(dayPlan: DayPlan): OakDialogues` **no decide nada**: no toca los hechos, no elige protagonista, no cambia el modo, no busca otro leitmotiv, no vuelve al forecast y no mira `MAP_PRIORITY`. Recibe un plan cerrado y lo pone en palabras. Se compone, no se enumera:

1. **Una cláusula por `kind` de hecho** — 12 funciones puras y cortas, cada una con dos o tres redacciones y una formulación compacta de reserva. Devuelven un **fragmento** sin punto final, para poder encadenarse; el spotlight devuelve además una frase suelta con la etiqueta del fenómeno.
2. **Aperturas y remates por tono**, no por rol: el tono ya viene decidido por el plan y es lo que manda el registro. `consejo` remata siempre con prudencia genérica — nunca con una instrucción oficial, que nuestros datos no traen.
3. **Tres o cuatro redacciones por leitmotiv**, que es lo único que aporta el `guasa`.

Reglas de redacción que no son de estilo sino de verdad:

- **Nombres humanos** desde `src/domain/pokemon-names.ts`, la única fuente. Las cuatro formas de Castform se llaman "Castform", sin sufijo inventado.
- **La etiqueta (`POKEMON_LABELS`) no se verbaliza.** Mezcla sustantivos ("Niebla"), adjetivos ("Caluroso") y sintagmas ("Nevadas intensas"), así que ninguna plantilla la admite entera y clasificarlos gramaticalmente sería un vocabulario nuevo a cambio de muy poco. El nombre y el reparto ya dicen la verdad del spotlight, y cuando el hueco lleva además un hecho meteorológico, sus cifras dicen bastante más que una etiqueta. Decisión tomada, no deuda pendiente.
- **Ningún hecho meteorológico nombra al Pokémon del mapa, y es deliberado.** Ni con `mapRepresentsFact: false` (sería atribuirle un fenómeno ajeno) ni con `true`, donde el contrato solo afirma coincidencia y no causa. Los Pokémon se nombran por `PokemonSpotlightFact` y por los leitmotivs, que son las dos piezas que existen para eso; así la regla del `false` no depende de acordarse de ella, sino de que no haya por dónde romperla. Abrir asociaciones Pokémon-fenómeno desde `RainFact` o `WindFact` sería una decisión de producto aparte, no un pendiente de este bloque.
- **Lo opcional se omite cuando no existe**: sin `probabilityPercent` no hay porcentaje, sin `gustKmh` no hay racha, sin `wavePeriodS` no hay periodo. Y la probabilidad se cuenta como probabilidad: un 60 % nunca es una certeza.
- **Trazabilidad que no se lee en voz alta**: `officialZoneId`, `source` y `sourcePhenomenon` no aparecen nunca en un texto.
- **Muestra, no censo**: cuando `locationCount` supera a los lugares nombrados, la lista se presenta como muestra ("entre ellos"). "Solo" se reserva al único caso que lo justifica, un lugar.
- **Lugares, no puntos**: un punto es la chincheta del mapa. El recuento es el mismo; la palabra es la de una persona.
- **Unión sin causa**: dos hechos del mismo hueco se encadenan con " y ", "; además, " o " mientras " — nunca con un conector causal. " y " se descarta si el primer fragmento ya termina en enumeración, donde se leería como un elemento más de la lista. Y si los dos hablan del mismo sitio y no hay ambigüedad, el segundo dice "allí" en vez de repetir el nombre.

**Variación determinista:** una suma posicional sobre las partes que identifican cada elección (`date` + `dialogueId` + `kind`/`role`/leitmotiv). No es un PRNG y no hay `Math.random()`: el mismo `DayPlan` produce siempre los mismos textos, y dos fechas distintas pueden caer en variantes distintas. Un conjunto compartido entre los tres bocadillos evita además que el día entero abra con la misma muletilla.

**20–160 caracteres, redactando y no cortando:** cada hueco genera varias formulaciones de la misma verdad, de la más suelta a la más apretada, y se publica la primera que entra en rango. Lo que se pierde por el camino son detalles opcionales del propio hecho — la muestra de lugares, la racha, la etiqueta —, nunca el hecho. Nada de `slice(0, 160)`: si ni la formulación más compacta cabe, es un fallo nuestro de redacción y se lanza un error.

Da variedad suficiente sin tabla combinatoria: unas 60 piezas cortas bien escritas en vez de cientos de plantillas completas. Vive en `src/domain/oak/` porque es puro.

## IA

- **Dominio desacoplado:** `src/domain/oak/` no conoce Groq. La frontera es una función pequeña, `generateOakDialogues(dayPlan: DayPlan): Promise<OakDialogues | null>`, implementada en `scripts/oak/groq-adapter.ts`. `null` no es una excepción, es una respuesta: significa "usa el fallback".
- **Transporte:** `fetch` de Node contra `POST https://api.groq.com/openai/v1/chat/completions`, `Authorization: Bearer $GROQ_API_KEY`. Sin SDK — la API es OpenAI-compatible y una sola llamada no justifica una dependencia.
- **Salida estructurada:** `response_format: { type: 'json_schema', json_schema: { name, strict: true, schema } }`, soportado hoy por `openai/gpt-oss-120b` y `openai/gpt-oss-20b`. En modo estricto todo objeto lleva `additionalProperties: false` y todos sus campos en `required`. El esquema se queda en el subconjunto que la documentación lista explícitamente (tipos, `enum`, `object`, `array`, `required`, `additionalProperties`): el recuento exacto de tres y los 20–160 caracteres **no** se le piden al proveedor, se comprueban en `validate.ts`. Nunca se confía en el modo estricto.
- **Modelo:** `openai/gpt-oss-120b` por defecto, configurable por `GROQ_MODEL`.
- **Una llamada por generación**, no una por diálogo: los 3 diálogos salen de una única petición. El `schedule` normal hace una al día; un rerun manual hace otra, y eso es esperado — el sistema no promete "una al día", promete "una por generación".
- **Presupuesto de tokens:** el payload serializado ronda el millar de tokens porque solo lleva hechos cerrados. No es una optimización: es lo que permite quedarse dentro del límite por minuto de una capa gratuita.
- **Capa gratuita, 0 €.** Nunca se habilita billing. Cualquier `429`, indisponibilidad o cambio de cuota cae al fallback. Las cifras concretas de cuota no se fijan en el diseño: se consultan en la consola de Groq y cambian sin aviso.
- **Parámetros:** `reasoning_effort: 'low'`, `stream: false` y `max_completion_tokens` — no `max_tokens`, deprecado en Groq. Sin herramientas, sin búsqueda web, sin tool calling: Oak no necesita ninguna capacidad externa.
- **Timeout** corto y explícito (`AbortSignal.timeout`), sin reintentos: si falla, fallback. Un segundo intento no arregla un 429.
- **Capa de claims (`src/domain/oak/claims.ts`):** transformación pura `DayPlan → afirmaciones en español ya resueltas`. La IA dejó de recibir `NarrativeFact` serializados cuando dos generaciones reales demostraron que tenía que interpretar nuestros campos, y los interpretaba mal: `papel: coldest_night` con `maximaC: 30` y `minimaC: 10` salió como "la noche más fría: 10-30 °C"; `lugaresConAviso: 7` salió como "7 avisos"; una muestra de tres lugares salió como "desde La Rioja hasta Huesca". Los claims cierran esa decisión antes de preguntar: un claim por hecho, seco, con el valor que el papel señala y **sin el que no** — la `maxC` de una noche fría ya no viaja. No es una segunda redacción con personalidad: la voz la pone quien redacta después, y el fallback no pasa por aquí.
- **Qué ve la IA:** ni el `forecast.json`, ni los 74 lugares, ni el historial, ni el `historyEntry`, ni los hechos. Solo el modo y los tres huecos con su papel, su tono, sus claims y la dirección editorial de su leitmotiv. Se quedan fuera los ids técnicos, la trazabilidad del aviso (`officialZoneId`, `source`, `sourcePhenomenon`), `mapPokemonId`/`mapRepresentsFact` — la forma más segura de que el modelo no nombre al Pokémon del mapa desde un hecho meteorológico es que no lo tenga —, el recuento que decidimos no contar (`distinctPokemonCount`, que sigue en `DayShapeFact`), el valor térmico que el papel no señala, y también la fecha: Oak no la dice y solo aportaría dígitos que no le están permitidos. El nombre humano va ya resuelto (`gyarados-mega` → "Mega-Gyarados"): es presentación nuestra, no una deducción suya.
- **Personalidad (`scripts/oak/oak-prompt.ts`):** el prompt es prosa y vive aparte del transporte. Character bible del personaje, qué significa cada uno de los cinco tonos, la política de días serios y una dirección editorial por leitmotiv. Al no quedarle ninguna decisión factual al proveedor, todo el encargo es de voz. El payload lleva `seriousDay` como bandera propia y no deducida de `dayMode`: el día que la causa no sea meteorológica, el prompt no se entera porque ya reacciona a la bandera.
- **Secreto:** `GROQ_API_KEY` en GitHub Secrets y en `.env` local. Nunca `VITE_*`, nunca en el JSON publicado, nunca en la URL ni en el cuerpo — solo en la cabecera `Authorization`. Que falte **no es un fallo**: es el camino normal en desarrollo local, y sale el fallback.

**Contrato de salida.** La IA devuelve solo los textos — ni modo, ni papel, ni hechos, ni metadatos, ni razonamiento:

```ts
{ dialogues: [{ id: 'dialogue-1', text }, { id: 'dialogue-2', text }, { id: 'dialogue-3', text }] }
```

El `role` se lo pone después el programa desde el `DialoguePlan`. Validación propia antes de publicar: objeto exacto, 3 elementos, los 3 `id` esperados y en orden, `text` no vacío, 20–160 caracteres, sin campos extra. Cualquier desviación → fallback.

**Guarda factual (`scripts/oak/factual-guard.ts`).** Después de la forma, el contenido. No es un verificador semántico —eso no se puede hacer con reglas deterministas— sino una comprobación estrecha y decidible: que no haya entrado **ninguna entidad factual nueva**. Cuatro controles por hueco, contra los claims de ese mismo hueco: cifras (normalizando coma y punto decimal), nombres de lugar, nombres de Pokémon (el censo entero de `POKEMON_NAMES`, no solo los del día) y niveles de aviso. Los nombres propios que no conocemos se detectan por mayúscula interior de frase. Es la red por debajo del diseño, no el diseño: la defensa primera es que el payload ya no lleve nada que invite a inventar. Un falso positivo cuesta un texto de IA y publica el fallback, que es bueno; un falso negativo publica una mentira — ante la duda, se rechaza.

**Todo lo que cae al fallback** y termina en éxito: sin `GROQ_API_KEY`, timeout, error de red, HTTP no 2xx, 429, respuesta sin `content`, JSON ilegible, esquema inesperado, ids mal o en otro orden, texto vacío o fuera de rango, cualquier campo extra, y cualquier cifra, lugar, Pokémon o nivel de aviso que no estuviera en los claims de ese hueco. Se registra `Oak AI unavailable/invalid → using local fallback (motivo)`, sin secretos ni cabeceras.

**Lo que aborta** con código 1 y sin escribir nada: `forecast.date` desalineada del `computeTargetDate(now)`, historial corrupto o inválido, y cualquier fallo de nuestra propia lógica o validación. No hay `try` general: un bug nuestro no se disfraza de indisponibilidad del proveedor.

```
    IA rota     → fallback → se escribe → éxito
    lógica rota → no se escribe → fallo
```

**Orden de publicación.** Cada `rename` es atómico, pero **dos `rename` no forman una transacción conjunta**: entre uno y otro hay un instante en el que un archivo está publicado y el otro no. No se monta nada para evitarlo; se elige el orden en el que ese estado intermedio es inofensivo:

```
construir y validar los dos objetos → serializar los dos → escribir los dos temporales
→ rename oak-history.json → rename oak-today.json (SIEMPRE EL ÚLTIMO)
```

`oak-today.json` es el artefacto publicable, el que mira el frontend, y solo cambia cuando ya está todo lo demás en su sitio. Un historial adelantado sin su `oak-today` se corrige solo en la siguiente ejecución, porque el upsert por fecha reescribe esa misma entrada; al revés, un `oak-today` nuevo con el historial viejo repetiría foco o gag al día siguiente.

## `oak-today.json` y consumo desde el frontend

```ts
/** El OakDialogue compartido más el papel que ya tenía en el plan. */
export interface OakTodayDialogue extends OakDialogue {
  role: DialogueRole
}

export interface OakToday {
  date: string                    // === forecast.date
  generatedAt: string             // ISO UTC real de la ejecución
  source: 'ai' | 'fallback'       // 'ai' solo si pasó NUESTRA validación; un 200 no basta
  dayMode: DayMode
  dialogues: [OakTodayDialogue, OakTodayDialogue, OakTodayDialogue]
}
```

No lleva los hechos ni el plan: el frontend no los necesita y el JSON público no debe cargar con el andamiaje.

Consumo idéntico al de `forecast.json`: `import oakData from './data/oak-today.json'` en `App.tsx`, tipado como `OakToday` y pasado a `WeatherApp`. Sin `fetch`, sin estado global, sin lógica narrativa en el componente. `date` viaja para que la interfaz pueda mostrar de qué día habla y detectar un desfase con `forecast.date`.

El componente concreto (`src/components/ProfessorOak/`) y su UX se diseñan en una fase posterior. Sin voz ni TTS en esta feature: el gesto de `EMPEZAR` (006) existe, pero no se da por resuelto el autoplay a futuro.

## Integración en el workflow

Implementado en `.github/workflows/deploy.yml`. El job `build` quedó así, con los dos pasos nuevos en negrita:

```
checkout → setup-node 22 → npm ci
→ Fetch forecast                 (cron/manual)  ya aborta sin escribir si no pasa invariantes
→ Upload raw forecast artifact   (cron/manual)  SIN MOVER, justo detrás del fetch
→ **Generate Oak**               (cron/manual)
→ **Upload Oak generation artifact** (cron/manual)
→ lint → test → build
→ Commit daily data              (cron/manual)  forecast.json + oak-today.json + oak-history.json
→ configure-pages → upload-pages-artifact → (job deploy)
```

Por qué exactamente ahí:

- **El artifact del forecast no se movió.** Su razón de ser es conservar el snapshot D→D+1 en cuanto existe, pase lo que pase después; sirve para las comparaciones históricas y no puede depender de que Oak funcione. Oak va **detrás** de él, nunca entre el fetch y él.
- **Los JSON de Oak, en su propio paso de artifact**, nunca mezclados con el meteorológico: son dos instantes y dos propósitos distintos. Este es de diagnóstico — si lint/test/build fallan, el run no commitea nada y el texto se perdería, y cuando `source` es `ai` no es reproducible, porque la misma entrada no vuelve a dar la misma respuesta.
- **Después del fetch** porque `fetch-forecast.ts` ya aplica `checkForecastReadiness` y **no escribe** `forecast.json` si el dataset es inválido. Si el fetch falla, el job se para y Oak ni se ejecuta.
- **Antes de lint/test/build** para que los JSON del día pasen por la misma validación que el resto del código y entren en el bundle que se despliega. Hoy el bundle todavía no los importa —el frontend es el bloque siguiente—, pero el orden ya es el correcto para cuando lo haga.
- **Mismo `if:`** que el fetch, carácter por carácter (`github.event_name == 'schedule' || github.event_name == 'workflow_dispatch'`): en un `push` normal no se consulta meteorología, no se genera Oak y se construye con los JSON ya versionados. Un PR o un push no necesitan `AEMET_API_KEY` ni `GROQ_API_KEY`.
- **Mismo commit** que el forecast, nunca tres: un `oak-today.json` sin su `forecast.json` hablaría de un día que el mapa no dibuja.

**Secretos.** Solo `GROQ_API_KEY`, y desde GitHub Secrets al paso de Oak. `GROQ_MODEL` no es secreto y no se pasa: el código ya trae `openai/gpt-oss-120b` por defecto, y el repositorio no usa el patrón `vars.*` para nada más. **Que falte `GROQ_API_KEY` no salta el paso ni lo hace fallar**: sale el fallback local, que es contenido de producto, y así el pipeline entero se puede ejecutar antes de dar de alta la clave.

**Sin `continue-on-error` en el paso de Oak**, a propósito: el script ya distingue lo recuperable de lo fatal y el workflow solo tiene que respetar su código de salida.

**Guarda propia de Oak:** el script recalcula `computeTargetDate(now)` y aborta si no coincide con la `date` del `forecast.json` que acaba de leer. En el workflow las dos cosas pasan en el mismo run, así que coinciden por construcción; la guarda protege la ejecución suelta y el forecast rancio.

**Sin bucle de generación recursiva.** El push del commit diario usa el `GITHUB_TOKEN` por defecto y GitHub no re-ejecuta workflows a partir de un push hecho con ese token. Añadir los dos JSON de Oak al mismo commit no cambia nada: es el mismo push, con el mismo token, en el mismo paso.

**Semántica de fallo:**

| Qué falla | Qué pasa |
|---|---|
| Fetch del forecast | El job falla ahí. Oak no se ejecuta, no hay commit ni despliegue nuevo, y queda en línea el anterior. |
| IA: sin `GROQ_API_KEY`, red, timeout, `429`, HTTP no 2xx, JSON inválido, esquema o longitud incorrectos | Fallback local, `source: 'fallback'`, se escriben los JSON, exit 0, motivo en el log. El workflow continúa. |
| Nuestra lógica: no se pueden construir 3 diálogos válidos, fecha desalineada, historial corrupto o con una entrada futura | `exit 1` y **no se escribe nada**. El job se para antes de lint/test/build, no hay commit ni despliegue — y el artifact del forecast **ya está preservado**. |

## Estructura de archivos

```
src/domain/
  alerts.ts                     ← + isActiveOnDate (movida desde assign-pokemon.ts)
  map-priority.ts               ← movido desde components/SpainMap/pick-map-pokemon.ts
                                   (+ isSignificantPokemon)
  pokemon-labels.ts             ← POKEMON_LABELS, movido desde Legend/legend-metadata.ts
  pokemon-names.ts              ← POKEMON_NAMES, nuevo: única fuente de nombres humanos
  location-views.ts             ← movido desde components/SpainMap/
  oak/
    types.ts                    los 12 NarrativeFact
    facts.ts                    Forecast → NarrativeFact[] (puro, solo Pokémon visibles)
    protagonists.ts             Protagonist[] desde MAP_PRIORITY + recuentos
    day-mode.ts                 4 modos, primer modo que cumple
    leitmotifs.ts               catálogo de 5 gags
    history.ts                  puro, sin I/O, idempotente por fecha
    plan-dialogues.ts           los 3 DialogueSlot sin solapar, DayPlan y OakDialogue
    fallback-dialogues.ts       DayPlan → 3 textos, determinista, sin red
scripts/oak/
  build-day-plan.ts             I/O: forecast + historial, guarda de fecha, arma el DayPlan
  history-file.ts               lee y valida oak-history.json (ausente = [], corrupto = aborta)
  validate.ts                   aduana: respuesta de la IA y OakToday antes de publicar
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
- **Que la IA cuele un dato que no está en los hechos.** Pasó, dos veces, y por eso ya no recibe hechos sino claims: lo que no viaja no se puede publicar. Encima va la guarda factual, que rechaza cualquier entidad nueva. Riesgo residual aceptado y conocido: lo que la guarda **no** ve es el error puramente semántico sin entidad nueva — leer "7 lugares bajo aviso" como "7 avisos" usa el mismo 7, y una entidad inventada al empezar una frase se confunde con la mayúscula normal del español. Distinguir eso pediría un diccionario y semántica; la defensa ahí es el claim, que ya no ofrece esa lectura, y el prompt, que la prohíbe.
- **Mover `location-views.ts`/`pick-map-pokemon.ts`/las etiquetas a `src/domain/`** toca imports de componentes ya cerrados (004/005). Es un movimiento mecánico cubierto por los tests existentes, pero se hace en su propio bloque y se ve verde antes de seguir.
- **`avistamiento` puede quedarse silencioso semanas enteras** si no hay ningún Pokémon significativo con ≤ 2 lugares. Es aceptable: `parte` cubre el resto y es mejor que un modo que se active por costumbre.
- **Ruido en el historial de git:** commit diario con tres JSON en vez de uno. Aceptado: mismo patrón que ya tiene el proyecto.
