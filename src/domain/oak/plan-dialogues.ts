import { MAP_PRIORITY } from '../map-priority.ts'
import type { PokedexId } from '../pokedex.ts'
import type { AlertPhenomenon } from '../types.ts'
import type { DayMode, DayModeDecision } from './day-mode.ts'
import type { OakHistoryEntry } from './history.ts'
import { recentHistory, resolveFocusSpotlight } from './history.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import { leitmotifPokemonIds, orderedLeitmotifs } from './leitmotifs.ts'
import type { Protagonist } from './protagonists.ts'
import type { AlertFact, CalendarFact, NarrativeFact, PokemonSpotlightFact } from './types.ts'

/**
 * El guion factual del día (`007-plan.md`): tres bocadillos, cada uno con los
 * hechos que le tocan y una instrucción de tono. Aquí no se redacta nada —
 * las frases son del Bloque 4 y de la IA.
 *
 * Todo sale de los hechos del Bloque 1 y de la decisión del Bloque 2: este
 * módulo no vuelve al `LocationForecast` ni reinterpreta ningún dato.
 */

/** Instrucción de redacción, no un hecho meteorológico. */
export type Tone = 'neutral' | 'cientifico' | 'epico' | 'consejo' | 'guasa'

export type DialogueRole = 'apertura' | 'foco' | 'cierre'
export type DialogueId = 'dialogue-1' | 'dialogue-2' | 'dialogue-3'

export interface DialogueSlot {
  id: DialogueId
  role: DialogueRole
  tone: Tone
  facts: NarrativeFact[]
  leitmotif: LeitmotifId | null
}

export type DialoguePlan = [DialogueSlot, DialogueSlot, DialogueSlot]

/**
 * Un bocadillo ya redactado. Es la forma mínima que comparten las dos vías
 * de generación — el fallback local y, más adelante, la IA — y por eso vive
 * aquí, junto al `DialogueId` que le da la identidad, y no en cada una.
 */
export interface OakDialogue {
  id: DialogueId
  text: string
}

export type OakDialogues = [OakDialogue, OakDialogue, OakDialogue]

/**
 * Un bocadillo de videojuego, no un párrafo. El límite lo comparten las tres
 * piezas que lo necesitan — el fallback al redactar, el validador de la
 * respuesta de la IA y el propio prompt —, así que vive en un único sitio.
 */
export const DIALOGUE_MIN_LENGTH = 20
export const DIALOGUE_MAX_LENGTH = 160

export interface DayPlanInput {
  date: string
  facts: readonly NarrativeFact[]
  protagonists: readonly Protagonist[]
  decision: DayModeDecision
  history: readonly OakHistoryEntry[]
}

export interface DayPlan {
  date: string
  dayMode: DayMode
  focusPokemonId: PokedexId | null
  leitmotif: LeitmotifId | null
  dialoguePlan: DialoguePlan
  /** Listo para persistir; el upsert por fecha es del bloque de I/O. */
  historyEntry: OakHistoryEntry
}

/**
 * Correspondencia entre el fenómeno de un aviso oficial y el eje que lo
 * cuenta en nuestros hechos. Es el mismo vocabulario en los dos lados, no una
 * interpretación: no hay entrada para `temperatura_maxima`,
 * `temperatura_minima`, `deshielo` ni `desconocido` porque ahí no existe una
 * pareja limpia, y sin pareja el aviso se narra solo.
 */
const ALERT_COMPANION_KIND: Partial<Record<AlertPhenomenon, NarrativeFact['kind']>> = {
  lluvia: 'rain',
  nieve: 'snow',
  viento: 'wind',
  tormenta: 'storm',
  niebla: 'fog',
  calima: 'calima',
  costero: 'marine',
}

// Hechos sobre los que tiene sentido dar un consejo práctico. Solo decide
// tono: no es una regla meteorológica ni cambia ningún hecho.
const ADVICE_KINDS: ReadonlySet<NarrativeFact['kind']> = new Set([
  'rain',
  'snow',
  'wind',
  'storm',
  'fog',
  'calima',
  'marine',
  'alert',
])

type RepresentableNarrativeFact = Extract<NarrativeFact, { mapRepresentsFact: boolean }>

function isRepresentable(fact: NarrativeFact): fact is RepresentableNarrativeFact {
  return 'mapRepresentsFact' in fact
}

function take(
  facts: readonly NarrativeFact[],
  used: Set<NarrativeFact>,
  predicate: (fact: NarrativeFact) => boolean,
): NarrativeFact | null {
  const found = facts.find((fact) => !used.has(fact) && predicate(fact))
  if (found) used.add(found)
  return found ?? null
}

function countUnused(facts: readonly NarrativeFact[], used: Set<NarrativeFact>): number {
  return facts.reduce((total, fact) => (used.has(fact) ? total : total + 1), 0)
}

/**
 * Sitúa el día sin gastar el hecho focal: la forma agregada de la jornada y,
 * solo en fin de semana, el calendario. Nombrar el día de la semana a diario
 * convierte la apertura en un formulario.
 */
function buildOpening(facts: readonly NarrativeFact[], used: Set<NarrativeFact>): DialogueSlot {
  const slotFacts: NarrativeFact[] = []

  const dayShape = take(facts, used, (fact) => fact.kind === 'day_shape')
  if (dayShape) slotFacts.push(dayShape)

  const calendar = facts.find((fact): fact is CalendarFact => fact.kind === 'calendar')
  if (calendar && !used.has(calendar) && calendar.weekend && slotFacts.length < 2) {
    used.add(calendar)
    slotFacts.push(calendar)
  }

  if (slotFacts.length === 0) {
    const fallback = take(facts, used, () => true)
    if (!fallback) throw new Error('Oak no puede abrir el día: no hay ningún hecho disponible.')
    slotFacts.push(fallback)
  }

  // Siempre neutral: `DayShapeFact` existe casi todos los días, así que
  // atarle el registro científico volvería científica casi toda apertura.
  return { id: 'dialogue-1', role: 'apertura', tone: 'neutral', facts: slotFacts, leitmotif: null }
}

/**
 * El hecho meteorológico que acompaña a un aviso, si lo hay: mismo fenómeno
 * oficial y uno de los proxies que el propio aviso declara afectados. No es
 * una relación de causa — el aviso cubre una zona y nuestro punto es solo un
 * punto de ella —, sino dos hechos ciertos sobre el mismo fenómeno en el
 * mismo sitio. Sin esa doble coincidencia no se añade nada.
 */
function alertCompanion(alert: AlertFact, facts: readonly NarrativeFact[], used: Set<NarrativeFact>): NarrativeFact | null {
  const companionKind = ALERT_COMPANION_KIND[alert.phenomenon]
  if (!companionKind) return null

  const affected = new Set(alert.affectedLocations.map((place) => place.locationId))
  return take(facts, used, (fact) => fact.kind === companionKind && isRepresentable(fact) && affected.has(fact.locationId))
}

/**
 * Un hecho del mismo Pokémon que protagoniza, y cuyo eje además coincide con
 * el sprite visible: le da a Oak una cifra concreta sin inventar ninguna
 * relación. Solo se coge si queda algo para el cierre.
 */
function spotlightCompanion(
  spotlight: PokemonSpotlightFact,
  facts: readonly NarrativeFact[],
  used: Set<NarrativeFact>,
): NarrativeFact | null {
  if (countUnused(facts, used) <= 1) return null
  return take(facts, used, (fact) => isRepresentable(fact) && fact.mapRepresentsFact && fact.mapPokemonId === spotlight.pokemonId)
}

/** El motivo principal del día. El `trigger` del modo entra siempre, tal cual. */
function buildFocus(
  decision: DayModeDecision,
  focusSpotlight: PokemonSpotlightFact | null,
  facts: readonly NarrativeFact[],
  used: Set<NarrativeFact>,
): DialogueSlot {
  const slotFacts: NarrativeFact[] = []
  let tone: Tone = 'neutral'

  if (decision.mode === 'alerta') {
    used.add(decision.trigger)
    slotFacts.push(decision.trigger)

    const companion = alertCompanion(decision.trigger, facts, used)
    if (companion) slotFacts.push(companion)

    // Un naranja se cuenta con consejo práctico; lo épico se reserva al rojo,
    // que es el único nivel que de verdad lo justifica.
    tone = decision.trigger.level === 'rojo' ? 'epico' : 'consejo'
  } else {
    if (focusSpotlight) {
      used.add(focusSpotlight)
      slotFacts.push(focusSpotlight)

      const companion = spotlightCompanion(focusSpotlight, facts, used)
      if (companion) slotFacts.push(companion)
    }

    if (decision.mode === 'invasion') tone = 'epico'
    else if (decision.mode === 'avistamiento') tone = 'cientifico'
  }

  if (slotFacts.length === 0) {
    const fallback = take(facts, used, () => true)
    if (!fallback) throw new Error('Oak no puede construir el foco del día: no queda ningún hecho disponible.')
    slotFacts.push(fallback)
  }

  return { id: 'dialogue-2', role: 'foco', tone, facts: slotFacts, leitmotif: null }
}

/**
 * Preferencia de cierre, sin ranking meteorológico nuevo: otro protagonista
 * todavía sin usar, un hecho que coincide con el sprite visible (desempatado
 * por `MAP_PRIORITY`), un extremo térmico, y por último cualquier hecho que
 * quede.
 */
function pickClosingFact(
  facts: readonly NarrativeFact[],
  protagonists: readonly Protagonist[],
  used: Set<NarrativeFact>,
): NarrativeFact | null {
  const protagonist = protagonists.map((entry) => entry.spotlight).find((spotlight) => !used.has(spotlight))
  if (protagonist) return protagonist

  const representable = facts
    .filter((fact): fact is RepresentableNarrativeFact => !used.has(fact) && isRepresentable(fact) && fact.mapRepresentsFact)
    .sort((a, b) => MAP_PRIORITY.indexOf(a.mapPokemonId) - MAP_PRIORITY.indexOf(b.mapPokemonId))
  if (representable.length > 0) return representable[0]

  return facts.find((fact) => !used.has(fact) && fact.kind === 'temperature') ?? facts.find((fact) => !used.has(fact)) ?? null
}

/**
 * El hecho que sostiene el gag: uno todavía sin usar sobre alguno de los
 * Pokémon de los que ese leitmotiv habla. Se buscan antes los spotlights de
 * los protagonistas, que son los que mejor lo cuentan.
 */
function pickLeitmotifFact(
  facts: readonly NarrativeFact[],
  protagonists: readonly Protagonist[],
  used: Set<NarrativeFact>,
  leitmotif: LeitmotifId,
): NarrativeFact | null {
  const subjects = new Set(leitmotifPokemonIds(leitmotif))

  const protagonist = protagonists
    .map((entry) => entry.spotlight)
    .find((spotlight) => !used.has(spotlight) && subjects.has(spotlight.pokemonId))
  if (protagonist) return protagonist

  return (
    facts.find(
      (fact) =>
        !used.has(fact) &&
        ((fact.kind === 'pokemon_spotlight' && subjects.has(fact.pokemonId)) || (isRepresentable(fact) && subjects.has(fact.mapPokemonId))),
    ) ?? null
  )
}

/**
 * Otro dato, un consejo o el gag del día — pero siempre sobre un hecho real.
 *
 * Un leitmotiv solo sobrevive si queda un hecho **suyo** con el que
 * sostenerlo: contar el chiste de Castform mientras se señala a Mega Gyarados
 * no es un gag, es un choque. Sin ese hecho se cae el gag, no el hecho.
 */
function buildClosing(
  facts: readonly NarrativeFact[],
  protagonists: readonly Protagonist[],
  used: Set<NarrativeFact>,
  candidates: readonly LeitmotifId[],
): DialogueSlot {
  for (const candidate of candidates) {
    const supported = pickLeitmotifFact(facts, protagonists, used, candidate)
    if (!supported) continue

    used.add(supported)
    return { id: 'dialogue-3', role: 'cierre', tone: 'guasa', facts: [supported], leitmotif: candidate }
  }

  const closing = pickClosingFact(facts, protagonists, used)
  if (!closing) throw new Error('Oak no puede cerrar el día: no queda ningún hecho sin usar.')
  used.add(closing)

  return {
    id: 'dialogue-3',
    role: 'cierre',
    tone: ADVICE_KINDS.has(closing.kind) ? 'consejo' : 'neutral',
    facts: [closing],
    leitmotif: null,
  }
}

/**
 * El Pokémon **elegido explícitamente** como foco narrativo: el
 * `PokemonSpotlightFact` que protagoniza el diálogo principal, y nada más.
 *
 * No vale el `mapPokemonId` de un hecho cualquiera del slot: que el aviso de
 * lluvia de Ibiza venga acompañado de un `RainFact` cuyo mapa dibuja
 * Castform no convierte a Castform en el protagonista del día. En `alerta` el
 * centro es el aviso, así que normalmente no hay foco — y `null` es la
 * respuesta honesta.
 */
function resolveFocusPokemonId(focus: DialogueSlot): PokedexId | null {
  const spotlight = focus.facts.find((fact): fact is PokemonSpotlightFact => fact.kind === 'pokemon_spotlight')
  return spotlight?.pokemonId ?? null
}

export function planDialogues(input: DayPlanInput): DayPlan {
  const { date, facts, protagonists, decision, history } = input

  const recent = recentHistory(history, date)
  const focusSpotlight = resolveFocusSpotlight(decision, protagonists, recent)
  const leitmotifCandidates = orderedLeitmotifs(facts, recent, date)

  const used = new Set<NarrativeFact>()
  const opening = buildOpening(facts, used)
  const focus = buildFocus(decision, focusSpotlight, facts, used)
  const closing = buildClosing(facts, protagonists, used, leitmotifCandidates)

  const focusPokemonId = resolveFocusPokemonId(focus)
  // El gag que de verdad se cuenta, no el preseleccionado: si se cayó por
  // falta de un hecho suyo, tampoco consume cooldown.
  const usedLeitmotif = closing.leitmotif

  return {
    date,
    dayMode: decision.mode,
    focusPokemonId,
    leitmotif: usedLeitmotif,
    dialoguePlan: [opening, focus, closing],
    historyEntry: { date, focusPokemonId, leitmotifIds: usedLeitmotif ? [usedLeitmotif] : [] },
  }
}
