import { MAP_PRIORITY, isSignificantPokemon } from '../map-priority.ts'
import type { AlertFact, DayShapeFact, NarrativeFact, PokemonSpotlightFact } from './types.ts'

/**
 * El registro con el que Oak cuenta el día (`007-plan.md`). Se decide sobre
 * los hechos que ya cerró `collectFacts` — nada se vuelve a filtrar por fecha
 * ni se recuenta aquí — y el primer modo elegible gana:
 *
 *     alerta → invasion → avistamiento → parte
 *
 * Sin continuidad todavía: que el mismo modo salga varios días seguidos es
 * asunto del historial, no de este módulo.
 */
export type DayMode = 'alerta' | 'invasion' | 'avistamiento' | 'parte'

/**
 * El modo y **el hecho que lo justificó**. La decisión viaja junta para que
 * el reparto de diálogos reciba ya el hecho focal en vez de recorrer los
 * hechos otra vez para deducir qué activó el modo — y para que no pueda
 * deducir uno distinto del que decidió aquí.
 *
 * `trigger` es solo ese hecho focal: el resto del inventario sigue completo y
 * disponible aparte.
 */
export type DayModeDecision =
  | { mode: 'alerta'; trigger: AlertFact }
  | { mode: 'invasion'; trigger: PokemonSpotlightFact }
  | { mode: 'avistamiento'; trigger: PokemonSpotlightFact }
  | { mode: 'parte'; trigger: null }

// Un avistamiento es algo que casi no se ve: dos lugares como mucho.
const SIGHTING_MAX_LOCATIONS = 2

/**
 * Un tercio del mapa. Expresado como fracción del total real del día y no
 * como "25 lugares": la intención es la proporción, no el tamaño que hoy
 * tiene el dataset.
 */
function invasionThreshold(totalLocations: number): number {
  return Math.ceil(totalLocations / 3)
}

// Ordenados por `MAP_PRIORITY` una sola vez: cualquier empate posterior lo
// gana el primero, sin repetir el criterio de desempate en cada regla.
function spotlightsByPriority(facts: readonly NarrativeFact[]): PokemonSpotlightFact[] {
  return facts
    .filter((fact): fact is PokemonSpotlightFact => fact.kind === 'pokemon_spotlight')
    .sort((a, b) => MAP_PRIORITY.indexOf(a.pokemonId) - MAP_PRIORITY.indexOf(b.pokemonId))
}

// `>` / `<` estrictos: en un empate se queda el que ya estaba, que por el
// orden de entrada es el mejor situado en `MAP_PRIORITY`.
function pickByCount(spotlights: readonly PokemonSpotlightFact[], direction: 'max' | 'min'): PokemonSpotlightFact | null {
  return spotlights.reduce<PokemonSpotlightFact | null>((best, current) => {
    if (!best) return current
    const better = direction === 'max' ? current.locationCount > best.locationCount : current.locationCount < best.locationCount
    return better ? current : best
  }, null)
}

/**
 * Amarillo no activa el modo: es el nivel ordinario de un otoño ibérico y
 * `alerta` tiene que conservar su excepcionalidad. Sigue existiendo como
 * `AlertFact` para que Oak pueda mencionarlo dentro de otro modo.
 *
 * El rojo manda sobre el naranja porque es el propio nivel oficial quien lo
 * dice. A igualdad de nivel decide el orden en que `collectFacts` los emitió
 * (el orden estable de `locations`) — no se inventa ninguna jerarquía entre
 * fenómenos: nada nuestro dice que una tormenta importe más que una lluvia.
 */
function severeAlert(facts: readonly NarrativeFact[]): AlertFact | null {
  const severe = facts.filter((fact): fact is AlertFact => fact.kind === 'alert' && (fact.level === 'naranja' || fact.level === 'rojo'))
  return severe.find((alert) => alert.level === 'rojo') ?? severe[0] ?? null
}

function invader(facts: readonly NarrativeFact[]): PokemonSpotlightFact | null {
  const dayShape = facts.find((fact): fact is DayShapeFact => fact.kind === 'day_shape')
  if (!dayShape) return null

  const threshold = invasionThreshold(dayShape.totalLocations)
  return pickByCount(
    spotlightsByPriority(facts).filter((spotlight) => spotlight.locationCount >= threshold),
    'max',
  )
}

/**
 * Basta con que exista un Pokémon significativo en muy pocos lugares. Cuál se
 * lleva el foco es el menos visto de ellos — pero la selección de
 * protagonistas sigue siendo quien decide a quién narrar.
 */
function sighting(facts: readonly NarrativeFact[]): PokemonSpotlightFact | null {
  return pickByCount(
    spotlightsByPriority(facts).filter(
      (spotlight) => isSignificantPokemon(spotlight.pokemonId) && spotlight.locationCount <= SIGHTING_MAX_LOCATIONS,
    ),
    'min',
  )
}

export function resolveDayMode(facts: readonly NarrativeFact[]): DayModeDecision {
  const alert = severeAlert(facts)
  if (alert) return { mode: 'alerta', trigger: alert }

  const invading = invader(facts)
  if (invading) return { mode: 'invasion', trigger: invading }

  const sighted = sighting(facts)
  if (sighted) return { mode: 'avistamiento', trigger: sighted }

  return { mode: 'parte', trigger: null }
}
