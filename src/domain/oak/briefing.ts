import {
  GYARADOS_WAVE_HEIGHT_THRESHOLD_M,
  assignByCalima,
  assignByMarine,
  assignByRain,
  assignBySnow,
  assignByTemperature,
  assignByWind,
} from '../assign-pokemon.ts'
import type { PokedexId } from '../pokedex.ts'
import type { SkyCondition } from '../types.ts'
import type { DayModeDecision } from './day-mode.ts'
import { PARENT_SCOPE, PATTERN_SCOPES, scopeLocationIds } from './editorial-regions.ts'
import type { LocationEntry } from './facts.ts'
import type {
  FactLocation,
  NarrativeFact,
  OccurrencePhenomenon,
  OccurrencePolarity,
  PatternCondition,
  PatternFact,
  PatternMeasures,
  PatternScope,
} from './types.ts'

/**
 * Motor del parte (`013-plan.md`): mide la elegibilidad por eje y las cinco
 * medidas de cada ámbito y condición (`buildPatternFact`), materializa los
 * candidatos que pasan compuertas e informatividad (`briefingCandidates`) y
 * elige los tres roles del día (`buildBriefing`) con deduplicación y
 * degradación, siempre de forma determinista.
 *
 * Reutiliza las reglas de la 003 (`assignByWind`, `assignByCalima`) y no
 * reimplementa ninguna: un umbral, una copia.
 */

/**
 * Qué polaridades admite cada fenómeno. La negativa solo se genera donde el
 * dato la sostiene: `viento` y `olas` son **solo positivos** — un valor por
 * debajo del umbral no es "no hay viento" ni "no hay olas".
 */
export const OCCURRENCE_POLARITIES: Record<OccurrencePhenomenon, readonly OccurrencePolarity[]> = {
  lluvia: ['presente', 'ausente'],
  nieve: ['presente', 'ausente'],
  viento: ['presente'],
  tormenta: ['presente', 'ausente'],
  niebla: ['presente', 'ausente'],
  calima: ['presente', 'ausente'],
  olas: ['presente'],
}

/** El universo del parte: los lugares con previsión y su fecha. */
export interface BriefingSource {
  entries: readonly LocationEntry[]
  date: string
}

/** La banda ocupada la identifica el `PokedexId` de la 003; nunca se publica. */
interface OccupiedBands {
  highest: PokedexId | null
  lowest: PokedexId | null
}

function occupiedBands(entries: readonly LocationEntry[]): OccupiedBands {
  if (entries.length === 0) return { highest: null, lowest: null }

  const hottest = entries.reduce((best, current) =>
    current.forecast.temperature.maxC > best.forecast.temperature.maxC ? current : best,
  )
  const coldest = entries.reduce((best, current) =>
    current.forecast.temperature.maxC < best.forecast.temperature.maxC ? current : best,
  )

  return {
    highest: assignByTemperature(hottest.forecast.temperature),
    lowest: assignByTemperature(coldest.forecast.temperature),
  }
}

function occurrenceEligible(entry: LocationEntry, phenomenon: OccurrencePhenomenon, date: string): boolean {
  const { precipitation, snow, wind, storm, fog, calima, marine } = entry.forecast
  switch (phenomenon) {
    case 'lluvia':
      return (precipitation?.mm ?? null) !== null
    case 'nieve':
      return (snow?.cm ?? null) !== null
    case 'viento':
      return (wind?.speedKmh ?? null) !== null
    case 'tormenta':
      return storm !== null
    case 'niebla':
      return fog !== null
    case 'calima':
      return calima !== null || assignByCalima(calima, entry.forecast.alerts, date) !== null
    case 'olas':
      return marine.status === 'ok' && marine.data.waveHeightM !== null
  }
}

function occurrencePresent(entry: LocationEntry, phenomenon: OccurrencePhenomenon, date: string): boolean {
  const { precipitation, snow, wind, storm, fog, calima, marine } = entry.forecast
  switch (phenomenon) {
    case 'lluvia': {
      const mm = precipitation?.mm ?? null
      return mm !== null && mm > 0
    }
    case 'nieve': {
      const cm = snow?.cm ?? null
      return cm !== null && cm > 0
    }
    case 'viento':
      return assignByWind(wind) !== null
    case 'tormenta':
      return storm === true
    case 'niebla':
      return fog === true
    case 'calima':
      return assignByCalima(calima, entry.forecast.alerts, date) !== null
    case 'olas':
      return (
        marine.status === 'ok' &&
        marine.data.waveHeightM !== null &&
        marine.data.waveHeightM >= GYARADOS_WAVE_HEIGHT_THRESHOLD_M
      )
  }
}

function isEligible(entry: LocationEntry, condition: PatternCondition, date: string): boolean {
  switch (condition.family) {
    case 'occurrence':
      return occurrenceEligible(entry, condition.phenomenon, date)
    case 'sky':
      return entry.forecast.sky !== null
    case 'temperature':
      return true
  }
}

/** Un lugar afectado es, siempre, un lugar elegible que satisface la condición concreta. */
function isAffected(entry: LocationEntry, condition: PatternCondition, bands: OccupiedBands, date: string): boolean {
  if (!isEligible(entry, condition, date)) return false

  switch (condition.family) {
    case 'occurrence': {
      const present = occurrencePresent(entry, condition.phenomenon, date)
      return condition.polarity === 'presente' ? present : !present
    }
    case 'sky':
      return entry.forecast.sky === condition.value
    case 'temperature': {
      const target = condition.extreme === 'highest' ? bands.highest : bands.lowest
      return target !== null && assignByTemperature(entry.forecast.temperature) === target
    }
  }
}

function plainLocation(entry: LocationEntry): FactLocation {
  return { locationId: entry.location.id, locationName: entry.location.name }
}

function computeMeasures(counts: {
  parentScope: PatternScope | null
  eligibleScope: number
  affectedScope: number
  eligibleParent: number
  affectedParent: number
  eligibleRest: number
  affectedRest: number
}): PatternMeasures {
  const prevalenceInternal = counts.eligibleScope > 0 ? counts.affectedScope / counts.eligibleScope : 0
  const prevalenceRest = counts.eligibleRest > 0 ? counts.affectedRest / counts.eligibleRest : 0
  const concentration = counts.affectedParent > 0 ? counts.affectedScope / counts.affectedParent : 0
  const sizeShare = counts.eligibleParent > 0 ? counts.eligibleScope / counts.eligibleParent : 0
  const overRepresentation = sizeShare > 0 && concentration > 0 ? concentration / sizeShare : 0
  // Sin padre (`map`) no hay resto; sin elegibles en el resto tampoco hay base
  // contra la que contrastar. En ambos casos la medida sin base vale 0: la
  // falta de dato no se interpreta como prevalencia real 0.
  const contrast =
    counts.parentScope === null || counts.eligibleRest === 0 ? 0 : prevalenceInternal - prevalenceRest

  return { prevalenceInternal, prevalenceRest, contrast, concentration, overRepresentation }
}

/**
 * El respaldo completo de una afirmación sobre `scope`: el ámbito afectado, su
 * denominador elegible, los recuentos y las cinco medidas. `affectedCount`
 * cuenta los elegibles que **satisfacen** la condición — una ausencia uniforme
 * da `affectedCount === eligibleCount`, no 0.
 */
export function buildPatternFact(scope: PatternScope, condition: PatternCondition, source: BriefingSource): PatternFact {
  const { entries, date } = source
  const universeLocations = entries.map((entry) => entry.location)
  const memberIds = new Set(scopeLocationIds(scope, universeLocations))
  const inScope = entries.filter((entry) => memberIds.has(entry.location.id))

  const parentScope = PARENT_SCOPE[scope]
  const parentIds = parentScope === null ? null : new Set(scopeLocationIds(parentScope, universeLocations))
  const inParent = parentIds === null ? [] : entries.filter((entry) => parentIds.has(entry.location.id))
  const inRest = parentIds === null ? [] : inParent.filter((entry) => !memberIds.has(entry.location.id))

  const bands = occupiedBands(entries)

  const eligibleScope = inScope.filter((entry) => isEligible(entry, condition, date))
  const eligibleParent = inParent.filter((entry) => isEligible(entry, condition, date))
  const eligibleRest = inRest.filter((entry) => isEligible(entry, condition, date))

  const affected = inScope.filter((entry) => isAffected(entry, condition, bands, date))
  const affectedParent = inParent.filter((entry) => isAffected(entry, condition, bands, date))
  const affectedRest = inRest.filter((entry) => isAffected(entry, condition, bands, date))

  return {
    kind: 'pattern',
    scope,
    parentScope,
    scopeSize: inScope.length,
    condition,
    eligibleCount: eligibleScope.length,
    affectedCount: affected.length,
    affectedLocations: affected.map(plainLocation),
    measures: computeMeasures({
      parentScope,
      eligibleScope: eligibleScope.length,
      affectedScope: affected.length,
      eligibleParent: eligibleParent.length,
      affectedParent: affectedParent.length,
      eligibleRest: eligibleRest.length,
      affectedRest: affectedRest.length,
    }),
  }
}

/**
 * El umbral de «contraste material» para `secondary` (`013-plan.md` → Decisión
 * «Contraste real»): el grupo retiene al menos el doble de la cuota que le
 * tocaría por su tamaño. Es la única constante numérica de la selección.
 */
export const MATERIAL_CONTRAST_MIN_OVER_REPRESENTATION = 2

export type BriefingRole = 'overview' | 'highlight' | 'secondary'

/** Un rol del parte y el hecho que lo sostiene. Referencia, no copia. */
export interface BriefingItem {
  role: BriefingRole
  fact: NarrativeFact
}

export interface DayBriefing {
  overview: BriefingItem
  highlight: BriefingItem
  secondary: BriefingItem
}

/**
 * Un patrón que ha pasado el respaldo y las compuertas, con los roles para los
 * que su tamaño lo habilita. La geografía y las medidas ya están dentro del
 * `PatternFact`; aquí solo queda qué papel puede jugar.
 */
export interface BriefingCandidate {
  fact: PatternFact
  regional: boolean
  roles: readonly BriefingRole[]
}

export interface BriefingInput {
  source: BriefingSource
  facts: readonly NarrativeFact[]
  decision: DayModeDecision
}

const ALL_ROLES: readonly BriefingRole[] = ['overview', 'highlight', 'secondary']

const OCCURRENCE_PHENOMENA: readonly OccurrencePhenomenon[] = [
  'lluvia',
  'nieve',
  'viento',
  'tormenta',
  'niebla',
  'calima',
  'olas',
]

// El orden de declaración sigue el de la asignación de la 003: categorías de
// cielo y luego bandas térmicas, con la más alta antes que la más baja.
const SKY_CONDITIONS: readonly SkyCondition[] = ['despejado', 'poco_nuboso', 'nuboso', 'cubierto']

function allConditions(bandCount: number): PatternCondition[] {
  const conditions: PatternCondition[] = []

  for (const phenomenon of OCCURRENCE_PHENOMENA) {
    for (const polarity of OCCURRENCE_POLARITIES[phenomenon]) {
      conditions.push({ family: 'occurrence', phenomenon, polarity })
    }
  }
  for (const value of SKY_CONDITIONS) {
    conditions.push({ family: 'sky', value })
  }
  // Una sola banda ocupada no da patrón térmico: no hay con qué contrastar.
  if (bandCount > 1) {
    conditions.push({ family: 'temperature', extreme: 'highest' })
    conditions.push({ family: 'temperature', extreme: 'lowest' })
  }

  return conditions
}

function isRegionalScope(scope: PatternScope): boolean {
  return scope.startsWith('region:')
}

/**
 * A4 (`013-spec.md` → Restricciones de candidatura por rol): una ausencia de
 * ocurrencia con ámbito global —`map`, `spain` o `iberian-peninsula`— no
 * compite por `overview`. Una ausencia regional solo compite si contrasta con
 * su padre. No altera la candidatura general ni el resto de roles.
 */
function canCompeteForOverview(candidate: BriefingCandidate): boolean {
  const { condition, scope, measures } = candidate.fact
  if (condition.family !== 'occurrence' || condition.polarity !== 'ausente') return true
  if (!isRegionalScope(scope)) return false
  return measures.contrast > 0
}

/**
 * B (`013-spec.md` → Restricciones de candidatura por rol): `olas/presente` no
 * compite por `secondary`. Sigue siendo un `PatternFact` válido y puede ocupar
 * los demás roles para los que ya sea elegible.
 */
function isOlasPresente(candidate: BriefingCandidate): boolean {
  const { condition } = candidate.fact
  return (
    condition.family === 'occurrence' &&
    condition.phenomenon === 'olas' &&
    condition.polarity === 'presente'
  )
}

/**
 * La compuerta de tamaño (`013-spec.md` → Elegibilidad regional): 6+ puede dar
 * `overview`, 3 a 5 solo `secondary`, 2 o menos ninguna afirmación agregada.
 * Los ámbitos globales no la necesitan; `spain` tiene además su propia
 * compuerta de cobertura, dispersión y concentración.
 */
function rolesFor(scope: PatternScope, eligibleCount: number): readonly BriefingRole[] {
  if (!isRegionalScope(scope)) return ALL_ROLES
  if (eligibleCount >= 6) return ALL_ROLES
  if (eligibleCount >= 3) return ['secondary']
  return []
}

function occupiedBandCount(entries: readonly LocationEntry[]): number {
  return new Set(entries.map((entry) => assignByTemperature(entry.forecast.temperature))).size
}

/**
 * Las tres condiciones de `spain`, medidas con `Location.zone` —la agrupación
 * exclusiva— y nunca con las regiones solapables: cobertura ≥ 2/3, afectados en
 * ≥ 3 zonas y ninguna zona con más de 2/3 de los afectados.
 */
function passesSpainGate(fact: PatternFact, zoneById: ReadonlyMap<string, string>): boolean {
  if (fact.affectedCount * 3 < fact.eligibleCount * 2) return false

  const zoneCounts = new Map<string, number>()
  for (const place of fact.affectedLocations) {
    const zone = zoneById.get(place.locationId)
    if (zone === undefined) continue
    zoneCounts.set(zone, (zoneCounts.get(zone) ?? 0) + 1)
  }
  if (zoneCounts.size < 3) return false

  return [...zoneCounts.values()].every((count) => count * 3 <= fact.affectedCount * 2)
}

/**
 * La condición informativa (`013-plan.md` → Condición informativa). Una
 * presencia siempre cuenta —también la uniforme—; una categoría de cielo
 * siempre; una ausencia solo si no es uniforme o si el resto contrasta; una
 * banda térmica solo si localiza.
 */
function isInformative(fact: PatternFact, condition: PatternCondition): boolean {
  switch (condition.family) {
    case 'occurrence':
      if (condition.polarity === 'presente') return true
      return !(fact.affectedCount === fact.eligibleCount && fact.measures.contrast === 0)
    case 'sky':
      return true
    case 'temperature':
      return fact.measures.contrast > 0
  }
}

/**
 * Todos los patrones con respaldo (`eligibleCount > 0`, `affectedCount > 0`),
 * informativos, que pasan su compuerta y pueden jugar algún rol. Se generan en
 * el orden de declaración: familia/fenómeno, luego ámbito, luego `presente`
 * antes que `ausente`. El orden es el desempate estable de toda la selección.
 */
export function briefingCandidates(source: BriefingSource): BriefingCandidate[] {
  const { entries } = source
  const zoneById = new Map(entries.map((entry) => [entry.location.id, entry.location.zone]))
  const bandCount = occupiedBandCount(entries)
  const candidates: BriefingCandidate[] = []

  for (const condition of allConditions(bandCount)) {
    for (const scope of PATTERN_SCOPES) {
      // `map` nunca produce patrón térmico: "las máximas más altas se
      // concentran en el mapa" sería tautológico.
      if (condition.family === 'temperature' && scope === 'map') continue

      const fact = buildPatternFact(scope, condition, source)
      if (fact.eligibleCount === 0 || fact.affectedCount === 0) continue

      const regional = isRegionalScope(scope)
      if (regional && fact.eligibleCount <= 2) continue
      if (!isInformative(fact, condition)) continue
      if (scope === 'spain' && !passesSpainGate(fact, zoneById)) continue

      const roles = rolesFor(scope, fact.eligibleCount)
      if (roles.length === 0) continue

      candidates.push({ fact, regional, roles })
    }
  }

  return candidates
}

/**
 * La clave del eje para la deduplicación. La `occurrence` ignora la polaridad
 * y la `temperature` la banda: dos lecturas (presente/ausente, alta/baja) del
 * mismo fenómeno son el mismo eje. Dos afirmaciones del mismo eje no pueden
 * sostenerse sobre el mismo conjunto de lugares, y como mucho una afirmación
 * regional por fenómeno y día.
 */
function axisKey(condition: PatternCondition): string {
  switch (condition.family) {
    case 'occurrence':
      return `occ:${condition.phenomenon}`
    case 'sky':
      return `sky:${condition.value}`
    case 'temperature':
      return 'temperature'
  }
}

function sameAffectedSet(a: PatternFact, b: PatternFact): boolean {
  if (a.affectedCount !== b.affectedCount) return false
  const ids = new Set(a.affectedLocations.map((place) => place.locationId))
  return b.affectedLocations.every((place) => ids.has(place.locationId))
}

function duplicates(candidate: BriefingCandidate, chosen: BriefingCandidate): boolean {
  if (axisKey(candidate.fact.condition) !== axisKey(chosen.fact.condition)) return false
  if (candidate.regional && chosen.regional) return true
  return sameAffectedSet(candidate.fact, chosen.fact)
}

function materialContrast(candidate: BriefingCandidate): boolean {
  return (
    candidate.fact.measures.contrast > 0 &&
    candidate.fact.measures.overRepresentation >= MATERIAL_CONTRAST_MIN_OVER_REPRESENTATION
  )
}

// --- comparadores: cada escalón decide por comparación directa, sin puntuación ---

function compareHighlight(a: BriefingCandidate, b: BriefingCandidate): number {
  return (
    b.fact.measures.contrast - a.fact.measures.contrast ||
    b.fact.affectedCount - a.fact.affectedCount ||
    b.fact.measures.concentration - a.fact.measures.concentration
  )
}

function compareOverview(a: BriefingCandidate, b: BriefingCandidate): number {
  return b.fact.affectedCount - a.fact.affectedCount || b.fact.measures.prevalenceInternal - a.fact.measures.prevalenceInternal
}

const compareSecondary = compareHighlight

// --- degradación a hechos locales, con la severidad ya existente de la 003 ---

function localPhenomenon(fact: NarrativeFact): string | null {
  switch (fact.kind) {
    case 'temperature':
    case 'storm':
    case 'snow':
    case 'rain':
    case 'wind':
    case 'marine':
    case 'fog':
    case 'calima':
      return fact.kind
    default:
      return null
  }
}

/**
 * La banda de severidad de un hecho local, tal cual la clasifica la 003: el
 * `PokedexId` que devuelve su `assignBy*`. La entrada se reconstruye con los
 * valores que el hecho ya lleva —nunca se copia un umbral—. Un `null` es un
 * fenómeno sin escala comparable (tormenta, niebla y calima tienen una sola
 * banda) y por tanto nunca compite.
 */
function localBand(fact: NarrativeFact): PokedexId | null {
  switch (fact.kind) {
    case 'temperature':
      return assignByTemperature({ maxC: fact.maxC, minC: fact.minC })
    case 'rain':
      return assignByRain({ mm: fact.mm, probabilityPercent: fact.probabilityPercent })
    case 'snow':
      return assignBySnow({ cm: fact.cm, present: true })
    case 'wind':
      return assignByWind({ speedKmh: fact.speedKmh, gustKmh: fact.gustKmh })
    case 'marine':
      return assignByMarine(
        {
          status: 'ok',
          data: {
            waveHeightM: fact.waveHeightM,
            wavePeriodS: fact.wavePeriodS,
            waveDirectionDeg: null,
            source: 'aemet',
          },
        },
        { status: 'ok', alerts: [] },
        '',
      )
    default:
      return null
  }
}

/**
 * El valor del dominio que la 003 usa para bandear, leído del hecho. Solo
 * orienta entre **dos bandas distintas** del mismo fenómeno: `assignBy*` es
 * monótona en ese valor, así que, cuando las bandas difieren, la del valor
 * mayor es la superior. Dentro de una misma banda no se compara nada.
 */
function localScaleValue(fact: NarrativeFact): number | null {
  switch (fact.kind) {
    case 'temperature':
      return fact.maxC
    case 'rain':
      return fact.mm
    case 'snow':
      return fact.cm
    case 'wind':
      return fact.speedKmh
    case 'marine':
      return fact.waveHeightM
    default:
      return null
  }
}

/**
 * ¿`candidate` está en una banda superior a `current`, dentro del mismo
 * fenómeno? Misma banda, o fenómeno sin escala comparable, no sustituye —gana
 * el primero por orden estable—. Bandas distintas: gana la del valor mayor,
 * que es la superior porque `assignBy*` es monótona. Nunca se comparan
 * fenómenos distintos.
 */
function higherBand(candidate: NarrativeFact, current: NarrativeFact): boolean {
  const candidateBand = localBand(candidate)
  const currentBand = localBand(current)
  if (candidateBand === null || currentBand === null || candidateBand === currentBand) return false

  const candidateValue = localScaleValue(candidate)
  const currentValue = localScaleValue(current)
  return candidateValue !== null && currentValue !== null && candidateValue > currentValue
}

/** Un hecho local por fenómeno: sobrevive el de banda superior; a igual banda, el primero. */
function reducedLocalFacts(facts: readonly NarrativeFact[]): NarrativeFact[] {
  const survivors = new Map<string, NarrativeFact>()
  for (const fact of facts) {
    const phenomenon = localPhenomenon(fact)
    if (phenomenon === null) continue
    const current = survivors.get(phenomenon)
    if (!current || higherBand(fact, current)) survivors.set(phenomenon, fact)
  }
  return facts.filter((fact) => {
    const phenomenon = localPhenomenon(fact)
    return phenomenon !== null && survivors.get(phenomenon) === fact
  })
}

function noFact(): never {
  throw new Error('El parte no puede rellenar un rol: no hay ningún hecho disponible.')
}

/**
 * Rellena el rol de panorama cuando no compite ningún patrón: un hecho del
 * inventario, que siempre existe. El día no se publica sin parte.
 */
function pickOverviewFallback(facts: readonly NarrativeFact[], used: ReadonlySet<NarrativeFact>): NarrativeFact {
  const preferred = facts.find(
    (fact) => !used.has(fact) && (fact.kind === 'temperature' || fact.kind === 'calendar' || fact.kind === 'day_shape'),
  )
  return preferred ?? facts.find((fact) => !used.has(fact)) ?? noFact()
}

/**
 * El parte del día: los tres roles, elegidos por el orden lexicográfico de la
 * spec y degradando —nunca abortando— cuando no hay patrón informativo. Es
 * determinista: la misma entrada produce el mismo parte.
 */
export function buildBriefing({ source, facts, decision }: BriefingInput): DayBriefing {
  const candidates = briefingCandidates(source)
  const used = new Set<NarrativeFact>()
  const chosenPatterns: BriefingCandidate[] = []

  const isDuplicate = (candidate: BriefingCandidate): boolean =>
    chosenPatterns.some((chosen) => duplicates(candidate, chosen))

  const pick = (
    pool: readonly BriefingCandidate[],
    compare: (a: BriefingCandidate, b: BriefingCandidate) => number,
  ): BriefingCandidate | null => {
    for (const candidate of [...pool].sort(compare)) {
      if (isDuplicate(candidate)) continue
      chosenPatterns.push(candidate)
      return candidate
    }
    return null
  }

  const highlightPool = candidates.filter((candidate) => candidate.roles.includes('highlight'))

  let highlightFact: NarrativeFact
  if (decision.mode === 'alerta') {
    highlightFact = decision.trigger
  } else {
    const chosen = pick(highlightPool, compareHighlight)
    const local = reducedLocalFacts(facts).find((fact) => !used.has(fact))
    highlightFact = chosen?.fact ?? local ?? facts.find((fact) => !used.has(fact)) ?? noFact()
  }
  used.add(highlightFact)

  const overviewChosen = pick(
    candidates.filter(
      (candidate) =>
        candidate.roles.includes('overview') &&
        canCompeteForOverview(candidate) &&
        !used.has(candidate.fact),
    ),
    compareOverview,
  )
  const overviewFact = overviewChosen?.fact ?? pickOverviewFallback(facts, used)
  used.add(overviewFact)

  const secondaryChosen = pick(
    candidates.filter(
      (candidate) =>
        candidate.regional &&
        candidate.roles.includes('secondary') &&
        materialContrast(candidate) &&
        !isOlasPresente(candidate) &&
        !used.has(candidate.fact),
    ),
    compareSecondary,
  )
  let secondaryFact: NarrativeFact | null = secondaryChosen?.fact ?? null
  if (secondaryFact === null) {
    const nextPattern = pick(
      candidates.filter(
        (candidate) =>
          candidate.roles.includes('highlight') &&
          !isOlasPresente(candidate) &&
          !used.has(candidate.fact),
      ),
      compareHighlight,
    )
    const local = reducedLocalFacts(facts).find((fact) => !used.has(fact))
    secondaryFact = nextPattern?.fact ?? local ?? facts.find((fact) => !used.has(fact)) ?? noFact()
  }
  used.add(secondaryFact)

  return {
    overview: { role: 'overview', fact: overviewFact },
    highlight: { role: 'highlight', fact: highlightFact },
    secondary: { role: 'secondary', fact: secondaryFact },
  }
}
