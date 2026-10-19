import { MAP_PRIORITY } from '../map-priority.ts'
import type { PokedexId } from '../pokedex.ts'
import type { AlertPhenomenon } from '../types.ts'
import type { DayBriefing } from './briefing.ts'
import type { DayMode, DayModeDecision } from './day-mode.ts'
import type { OakHistoryEntry } from './history.ts'
import { recentHistory, resolveFocusSpotlight } from './history.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import { leitmotifPokemonIds, orderedLeitmotifs } from './leitmotifs.ts'
import type { Protagonist } from './protagonists.ts'
import { isSeriousDay } from './serious-day.ts'
import type { AlertFact, CalendarFact, NarrativeFact, PokemonSpotlightFact } from './types.ts'

/**
 * El guion factual del día (`007-plan.md`): tres bocadillos, cada uno con los
 * hechos que le tocan y una instrucción de tono. Aquí no se redacta nada:
 * las frases las ponen `claims.ts`, el fallback y la IA.
 *
 * El parte (`briefing.ts`) manda sobre el reparto: el hecho de cada rol entra
 * siempre en su hueco, y lo narrativo —protagonista, modo, leitmotiv, tono—
 * solo ocupa lo que sobra. Todo sale del parte y de los hechos: este módulo no
 * vuelve al `LocationForecast` ni reinterpreta ningún dato.
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
 * de generación — el fallback local y la IA — y por eso vive
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
  briefing: DayBriefing
}

export interface DayPlan {
  date: string
  dayMode: DayMode
  /** El parte que manda sobre el reparto; cada rol tiene su hueco. */
  briefing: DayBriefing
  /**
   * Día sin humor. Lo decide `serious-day.ts` y viaja resuelto para que
   * nadie vuelva a preguntárselo: la respuesta es la misma para el fallback,
   * para el prompt y para quien venga después.
   */
  serious: boolean
  focusPokemonId: PokedexId | null
  leitmotif: LeitmotifId | null
  dialoguePlan: DialoguePlan
  /** Listo para persistir; el upsert por fecha lo hace la capa de I/O. */
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

/**
 * La apertura empieza con el panorama del parte (`overview`). El recuento del
 * día (`DayShapeFact`) ya no se añade como relleno: el parte trae el panorama
 * y volver a contarlo justo después sería decir dos veces lo mismo.
 *
 * Solo el calendario de fin de semana puede acompañar, y solo si no es ya el
 * propio hecho del rol. Nombrar el día de la semana a diario convertiría la
 * apertura en un formulario.
 */
function buildOpening(facts: readonly NarrativeFact[], used: Set<NarrativeFact>, briefing: DayBriefing): DialogueSlot {
  const overview = briefing.overview.fact
  used.add(overview)
  const slotFacts: NarrativeFact[] = [overview]

  const calendar = facts.find((fact): fact is CalendarFact => fact.kind === 'calendar')
  if (calendar && !used.has(calendar) && calendar.weekend && slotFacts.length < 2) {
    used.add(calendar)
    slotFacts.push(calendar)
  }

  // Siempre neutral: el panorama existe casi todos los días, así que atarle el
  // registro científico volvería científica casi toda apertura.
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
 * El foco empieza con el hecho de `highlight`. En `alerta` ese hecho es el
 * propio `trigger` del modo, así que no se duplica. Un protagonista o el
 * acompañante del aviso solo añaden material: nunca desplazan lo que el parte
 * decidió contar.
 */
function buildFocus(
  decision: DayModeDecision,
  focusSpotlight: PokemonSpotlightFact | null,
  facts: readonly NarrativeFact[],
  used: Set<NarrativeFact>,
  briefing: DayBriefing,
): DialogueSlot {
  const highlight = briefing.highlight.fact
  used.add(highlight)
  const slotFacts: NarrativeFact[] = [highlight]
  let tone: Tone = 'neutral'

  if (decision.mode === 'alerta') {
    const companion = alertCompanion(decision.trigger, facts, used)
    if (companion) slotFacts.push(companion)

    // Un naranja se cuenta con consejo práctico; lo épico se reserva al rojo,
    // que es el único nivel que de verdad lo justifica.
    tone = decision.trigger.level === 'rojo' ? 'epico' : 'consejo'
  } else {
    if (focusSpotlight && !used.has(focusSpotlight)) {
      used.add(focusSpotlight)
      slotFacts.push(focusSpotlight)
    }

    if (decision.mode === 'invasion') tone = 'epico'
    else if (decision.mode === 'avistamiento') tone = 'cientifico'
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
 * El cierre empieza con el hecho de `secondary`; encima va otro dato, un
 * consejo o el gag del día — pero siempre sobre un hecho real.
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
  briefing: DayBriefing,
): DialogueSlot {
  const secondary = briefing.secondary.fact
  used.add(secondary)

  for (const candidate of candidates) {
    const supported = pickLeitmotifFact(facts, protagonists, used, candidate)
    if (!supported) continue

    used.add(supported)
    return { id: 'dialogue-3', role: 'cierre', tone: 'guasa', facts: [secondary, supported], leitmotif: candidate }
  }

  const closing = pickClosingFact(facts, protagonists, used)
  if (closing) used.add(closing)

  const slotFacts: NarrativeFact[] = closing ? [secondary, closing] : [secondary]
  // El tono describe el material narrativo del remate; sin él, el hecho del rol.
  const toneFact = closing ?? secondary

  return {
    id: 'dialogue-3',
    role: 'cierre',
    tone: ADVICE_KINDS.has(toneFact.kind) ? 'consejo' : 'neutral',
    facts: slotFacts,
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

/**
 * La invariante de un día serio, comprobada y no confiada. Llegar aquí con
 * un gag o con tono `guasa` sería un bug nuestro, no un dato raro: se lanza
 * antes de que nadie redacte nada.
 */
function assertNoHumour(dialoguePlan: DialoguePlan): void {
  const offender = dialoguePlan.find((slot) => slot.tone === 'guasa' || slot.leitmotif !== null)
  if (offender) {
    throw new Error(`Día serio con humor en ${offender.id}: tono ${offender.tone}, leitmotiv ${String(offender.leitmotif)}.`)
  }
}

export function planDialogues(input: DayPlanInput): DayPlan {
  const { date, facts, protagonists, decision, history, briefing } = input

  const recent = recentHistory(history, date)
  const focusSpotlight = resolveFocusSpotlight(decision, protagonists, recent)
  // Un día serio no elige gag, así que tampoco lo gasta: el cooldown de los
  // cinco leitmotivs se queda exactamente como estaba.
  const serious = isSeriousDay(decision)
  const leitmotifCandidates = serious ? [] : orderedLeitmotifs(facts, recent, date)

  const used = new Set<NarrativeFact>()
  const opening = buildOpening(facts, used, briefing)
  const focus = buildFocus(decision, focusSpotlight, facts, used, briefing)
  const closing = buildClosing(facts, protagonists, used, leitmotifCandidates, briefing)

  const dialoguePlan: DialoguePlan = [opening, focus, closing]
  if (serious) assertNoHumour(dialoguePlan)

  const focusPokemonId = resolveFocusPokemonId(focus)
  // El gag que de verdad se cuenta, no el preseleccionado: si se cayó por
  // falta de un hecho suyo, tampoco consume cooldown.
  const usedLeitmotif = closing.leitmotif

  return {
    date,
    dayMode: decision.mode,
    serious,
    briefing,
    focusPokemonId,
    leitmotif: usedLeitmotif,
    dialoguePlan,
    historyEntry: { date, focusPokemonId, leitmotifIds: usedLeitmotif ? [usedLeitmotif] : [] },
  }
}
