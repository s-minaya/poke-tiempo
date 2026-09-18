import { MAP_PRIORITY, isSignificantPokemon } from '../map-priority.ts'
import type { PokedexId } from '../pokedex.ts'
import type { NarrativeFact, PokemonSpotlightFact } from './types.ts'

/**
 * Los Pokémon que protagonizan el día (`007-plan.md`). No hay ranking nuevo:
 * los recuentos ya los cerró `collectFacts` en los `PokemonSpotlightFact`, y
 * el orden de importancia ya lo fija `MAP_PRIORITY`. Aquí solo se reparten
 * papeles narrativos sobre esos hechos.
 *
 * Sin continuidad todavía: si el mismo Pokémon vuelve a ser `headline` varios
 * días seguidos, este módulo lo devuelve igualmente — desbancarlo es trabajo
 * del historial.
 */

export type ProtagonistRole = 'headline' | 'spread' | 'rarity'

/**
 * Un papel y el hecho que lo ocupa. `spotlight` es el `PokemonSpotlightFact`
 * tal cual: `pokemonId`, `label`, `locations` y `locationCount` siguen
 * viviendo ahí y no se copian, para que no puedan desincronizarse.
 */
export interface Protagonist {
  role: ProtagonistRole
  spotlight: PokemonSpotlightFact
}

function spotlightsOf(facts: readonly NarrativeFact[]): PokemonSpotlightFact[] {
  return facts.filter((fact): fact is PokemonSpotlightFact => fact.kind === 'pokemon_spotlight')
}

/**
 * Reparte hasta tres papeles, cada uno sobre un Pokémon distinto:
 *
 * - `headline`: el mejor situado en `MAP_PRIORITY` de los presentes hoy. Es
 *   el criterio editorial del proyecto sobre qué merece mostrarse, no una
 *   escala de severidad meteorológica.
 * - `spread`: el que aparece en más lugares — la cara real del día.
 * - `rarity`: el de menor recuento **entre los significativos**, para que una
 *   condición ordinaria (Hoppip, Castform, Altaria, Castform-sun) no pase por
 *   rareza interesante solo por salir poco.
 *
 * Los tres empatan por posición en `MAP_PRIORITY`, así que el resultado no
 * depende del orden en que lleguen los hechos. Un papel sin candidato
 * simplemente no existe: devuelve entre 1 y 3 protagonistas (0 solo si el día
 * no tiene ningún Pokémon visible, que el pipeline ya impide).
 */
export function selectProtagonists(facts: readonly NarrativeFact[]): Protagonist[] {
  // Ordenar una vez por `MAP_PRIORITY` hace que cualquier empate posterior lo
  // gane el primero, sin repetir el criterio de desempate en cada regla.
  const byPriority = spotlightsOf(facts)
    .slice()
    .sort((a, b) => MAP_PRIORITY.indexOf(a.pokemonId) - MAP_PRIORITY.indexOf(b.pokemonId))

  const protagonists: Protagonist[] = []
  const taken = new Set<PokedexId>()

  function claim(role: ProtagonistRole, spotlight: PokemonSpotlightFact | undefined): void {
    if (!spotlight) return
    protagonists.push({ role, spotlight })
    taken.add(spotlight.pokemonId)
  }

  function available(extra: (spotlight: PokemonSpotlightFact) => boolean = () => true): PokemonSpotlightFact[] {
    return byPriority.filter((spotlight) => !taken.has(spotlight.pokemonId) && extra(spotlight))
  }

  claim('headline', byPriority[0])
  claim('spread', pickByCount(available(), 'max'))
  claim('rarity', pickByCount(available((spotlight) => isSignificantPokemon(spotlight.pokemonId)), 'min'))

  return protagonists
}

// `>` / `<` estrictos: en un empate se queda el que ya estaba, que por el
// orden de entrada es el mejor situado en `MAP_PRIORITY`.
function pickByCount(spotlights: readonly PokemonSpotlightFact[], direction: 'max' | 'min'): PokemonSpotlightFact | undefined {
  return spotlights.reduce<PokemonSpotlightFact | undefined>((best, current) => {
    if (!best) return current
    const better = direction === 'max' ? current.locationCount > best.locationCount : current.locationCount < best.locationCount
    return better ? current : best
  }, undefined)
}
