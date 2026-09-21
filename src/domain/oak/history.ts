import type { PokedexId } from '../pokedex.ts'
import type { DayModeDecision } from './day-mode.ts'
import type { LeitmotifId } from './leitmotifs.ts'
import type { Protagonist } from './protagonists.ts'
import type { PokemonSpotlightFact } from './types.ts'

/**
 * Memoria mínima de Oak (`007-plan.md`): lo justo para no repetir el mismo
 * foco ni el mismo gag un día tras otro. Nunca guarda texto generado.
 *
 * **La continuidad no toca los hechos ni el modo del día.** Si los datos dicen
 * `alerta` tres días seguidos, Oak está en alerta tres días; el
 * `DayModeDecision` del día y su `trigger` son intocables. Lo único que puede
 * mover el historial es qué Pokémon secundario recibe el foco cuando de
 * verdad hay dónde elegir, y qué leitmotiv puede reutilizarse.
 *
 * Puro: recibe el historial ya leído y no toca disco. El upsert real por
 * fecha vive en el script de generación.
 */
export interface OakHistoryEntry {
  date: string
  focusPokemonId: PokedexId | null
  leitmotifIds: LeitmotifId[]
}

// Días distintos que un mismo Pokémon puede encadenar como foco antes de
// ceder el turno, si hay a quién cedérselo.
const FOCUS_REPEAT_LIMIT = 3

/**
 * El historial que cuenta para decidir hoy: días **anteriores y distintos**,
 * del más reciente al más antiguo.
 *
 * - Una entrada con la fecha objetivo no es historial previo, es la
 *   generación de hoy — puede existir si el día ya se generó antes (un rerun
 *   manual), y contarla haría que el segundo intento decidiera distinto.
 * - Las fechas repetidas se colapsan en una: dos entradas del mismo día son
 *   un día, no dos. Gana la última escrita.
 */
export function recentHistory(history: readonly OakHistoryEntry[], targetDate: string): OakHistoryEntry[] {
  const byDate = new Map<string, OakHistoryEntry>()
  for (const entry of history) {
    if (entry.date === targetDate) continue
    byDate.set(entry.date, entry)
  }

  return [...byDate.values()].sort((a, b) => b.date.localeCompare(a.date))
}

/** Si un Pokémon ya ha sido el foco de los `FOCUS_REPEAT_LIMIT` días anteriores distintos. */
export function isFocusExhausted(recent: readonly OakHistoryEntry[], pokemonId: PokedexId): boolean {
  const streak = recent.slice(0, FOCUS_REPEAT_LIMIT)
  return streak.length === FOCUS_REPEAT_LIMIT && streak.every((entry) => entry.focusPokemonId === pokemonId)
}

/**
 * Qué Pokémon recibe el foco narrativo — que no es lo mismo que la lista de
 * protagonistas, que no se toca.
 *
 * En `invasion` y `avistamiento` el foco es el Pokémon del `trigger`, sin
 * negociación: es precisamente el que activó el modo. En `alerta` el centro
 * del diálogo es el aviso, así que no hay Pokémon de foco por esta vía.
 * Solo `parte` deja elegir, y ahí se prefiere `headline` salvo que lleve tres
 * días distintos siendo foco y exista alternativa (`spread`, después
 * `rarity`). Sin alternativa se repite: mejor una repetición verdadera que
 * una regla artificial.
 */
export function resolveFocusSpotlight(
  decision: DayModeDecision,
  protagonists: readonly Protagonist[],
  recent: readonly OakHistoryEntry[],
): PokemonSpotlightFact | null {
  if (decision.mode === 'invasion' || decision.mode === 'avistamiento') return decision.trigger
  if (decision.mode === 'alerta') return null

  const candidates = protagonists.map((protagonist) => protagonist.spotlight)
  if (candidates.length === 0) return null

  return candidates.find((candidate) => !isFocusExhausted(recent, candidate.pokemonId)) ?? candidates[0]
}
