import type { PokedexId } from '../pokedex.ts'
import type { OakHistoryEntry } from './history.ts'
import type { NarrativeFact, PokemonSpotlightFact } from './types.ts'

/**
 * Los gags recurrentes de Oak (`007-plan.md`). Aquí solo viven su
 * identificador, qué dato del día los hace elegibles y cada cuánto pueden
 * repetirse — **la redacción no está aquí**: un leitmotiv marca de qué va la
 * broma, no con qué palabras se cuenta.
 *
 * Un leitmotiv nunca afirma nada por su cuenta: solo es candidato si el
 * Pokémon del que habla está hoy de verdad en el mapa.
 */
export type LeitmotifId =
  | 'hoppip-vuela'
  | 'castform-vestuario'
  | 'groudon-termostato'
  | 'gyarados-mar'
  | 'snorunt-frio'

export interface Leitmotif {
  id: LeitmotifId
  /** Días distintos que tienen que pasar antes de poder repetirlo. */
  cooldownDays: number
  /** Elegible si alguno de estos Pokémon es visible hoy. */
  pokemonIds: readonly PokedexId[]
}

// El mismo para los cinco: no hay experiencia real todavía que justifique
// cinco números distintos.
const COOLDOWN_DAYS = 5

export const LEITMOTIFS: readonly Leitmotif[] = [
  { id: 'hoppip-vuela', cooldownDays: COOLDOWN_DAYS, pokemonIds: ['hoppip'] },
  {
    id: 'castform-vestuario',
    cooldownDays: COOLDOWN_DAYS,
    // Las cuatro formas que existen de verdad como `PokedexId`.
    pokemonIds: ['castform', 'castform-sun', 'castform-rain', 'castform-ice'],
  },
  { id: 'groudon-termostato', cooldownDays: COOLDOWN_DAYS, pokemonIds: ['groudon', 'groudon-primal'] },
  { id: 'gyarados-mar', cooldownDays: COOLDOWN_DAYS, pokemonIds: ['gyarados', 'gyarados-mega'] },
  { id: 'snorunt-frio', cooldownDays: COOLDOWN_DAYS, pokemonIds: ['snorunt'] },
]

/**
 * Semilla determinista a partir de la fecha. No es un PRNG ni pretende
 * serlo: solo reparte de forma estable entre los candidatos del día, para
 * que la misma fecha con los mismos datos elija siempre el mismo gag.
 */
function dateSeed(date: string): number {
  let seed = 0
  for (let index = 0; index < date.length; index += 1) {
    seed = (seed * 31 + date.charCodeAt(index)) % 1_000_003
  }
  return seed
}

/**
 * Días naturales entre dos fechas `YYYY-MM-DD`. `Date.UTC` se usa solo como
 * aritmética de calendario, nunca como instante real — igual que en
 * `target-date.ts` —, así que el resultado no depende de la zona horaria del
 * entorno de ejecución.
 */
function daysBetween(from: string, to: string): number {
  const [fromYear, fromMonth, fromDay] = from.split('-').map(Number)
  const [toYear, toMonth, toDay] = to.split('-').map(Number)
  return (Date.UTC(toYear, toMonth - 1, toDay) - Date.UTC(fromYear, fromMonth - 1, fromDay)) / 86_400_000
}

/**
 * El cooldown se cuenta en **días de calendario**: usado el día 10 con
 * `cooldownDays: 5`, queda bloqueado del 11 al 15 y vuelve el 16. Que el
 * pipeline se saltara alguna jornada no alarga la espera — el gag descansa
 * cinco días, no cinco ejecuciones.
 */
function isOnCooldown(leitmotif: Leitmotif, recent: readonly OakHistoryEntry[], date: string): boolean {
  return recent.some(
    (entry) => entry.leitmotifIds.includes(leitmotif.id) && daysBetween(entry.date, date) <= leitmotif.cooldownDays,
  )
}

function visiblePokemon(facts: readonly NarrativeFact[]): Set<PokedexId> {
  const spotlights = facts.filter((fact): fact is PokemonSpotlightFact => fact.kind === 'pokemon_spotlight')
  return new Set(spotlights.map((spotlight) => spotlight.pokemonId))
}

export function eligibleLeitmotifs(
  facts: readonly NarrativeFact[],
  recent: readonly OakHistoryEntry[],
  date: string,
): Leitmotif[] {
  const visible = visiblePokemon(facts)
  return LEITMOTIFS.filter(
    (leitmotif) => leitmotif.pokemonIds.some((id) => visible.has(id)) && !isOnCooldown(leitmotif, recent, date),
  )
}

/** Los Pokémon de los que habla un gag — para poder exigir que el hecho que lo acompaña sea uno de ellos. */
export function leitmotifPokemonIds(id: LeitmotifId): readonly PokedexId[] {
  return LEITMOTIFS.find((leitmotif) => leitmotif.id === id)?.pokemonIds ?? []
}

/**
 * Los candidatos del día en orden de preferencia: la lista elegible rotada
 * por la fecha. El primero es el gag preferido y los siguientes son el
 * recambio para cuando el reparto de diálogos no encuentra un hecho libre con
 * el que sostener al primero — un gag solo se cuenta si hay un hecho suyo
 * que lo justifique, y quedarse sin gag pudiendo contar otro sería tirarlo.
 */
export function orderedLeitmotifs(
  facts: readonly NarrativeFact[],
  recent: readonly OakHistoryEntry[],
  date: string,
): LeitmotifId[] {
  const eligible = eligibleLeitmotifs(facts, recent, date)
  if (eligible.length === 0) return []

  const start = dateSeed(date) % eligible.length
  return [...eligible.slice(start), ...eligible.slice(0, start)].map((leitmotif) => leitmotif.id)
}

/** Como mucho uno al día, y `null` si ninguno encaja: ningún día necesita un gag a la fuerza. */
export function selectLeitmotif(
  facts: readonly NarrativeFact[],
  recent: readonly OakHistoryEntry[],
  date: string,
): LeitmotifId | null {
  return orderedLeitmotifs(facts, recent, date)[0] ?? null
}

/**
 * El descanso más largo del catálogo. Lo usa la retención del historial
 * para saber cuántos días atrás hay que conservar: guardar menos rompería
 * el cooldown, y guardar más sería basura.
 */
export const MAX_LEITMOTIF_COOLDOWN_DAYS = Math.max(...LEITMOTIFS.map((leitmotif) => leitmotif.cooldownDays))
