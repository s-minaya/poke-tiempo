/**
 * Mood térmico de la cabecera (`005-plan.md` → punto 2): capa de
 * presentación, no dominio — solo decide el aspecto visual de "POKETIEMPO"
 * y de la línea de previsión, nunca qué Pokémon corresponde a nadie.
 * `assignPokemon` (`src/domain/assign-pokemon.ts`) sigue siendo la única
 * regla meteorológica del proyecto.
 */
export type ThermalMoodCategory = 'gelid' | 'cold' | 'neutral' | 'heat' | 'sweltering'

const THERMAL_MOOD_ORDER: readonly ThermalMoodCategory[] = ['gelid', 'cold', 'neutral', 'heat', 'sweltering']

export function classifyTemperatureMood(maxC: number): ThermalMoodCategory {
  if (maxC < 0) return 'gelid'
  if (maxC < 10) return 'cold'
  if (maxC < 26) return 'neutral'
  if (maxC < 35) return 'heat'
  return 'sweltering'
}

function median(values: readonly number[]): number {
  const sorted = [...values].sort((a, b) => a - b)
  const middle = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle]
}

/**
 * Categoría con más `temperature.maxC` entre los lugares del forecast. En
 * caso de empate en el recuento, desempata la categoría en la que cae la
 * mediana de todas las máximas — determinista, no depende del orden del
 * array de entrada (el recuento es por categoría, y la mediana se calcula
 * sobre una copia ordenada). Array vacío → `'neutral'` como respaldo
 * explícito; no se espera en producción (el pipeline garantiza 74/74,
 * `002-plan.md`), pero la función no lo asume.
 */
export function resolveThermalMood(maxCValues: readonly number[]): ThermalMoodCategory {
  if (maxCValues.length === 0) return 'neutral'

  const counts = new Map<ThermalMoodCategory, number>()
  for (const value of maxCValues) {
    const category = classifyTemperatureMood(value)
    counts.set(category, (counts.get(category) ?? 0) + 1)
  }

  const maxCount = Math.max(...counts.values())
  const leaders = THERMAL_MOOD_ORDER.filter((category) => counts.get(category) === maxCount)

  return leaders.length === 1 ? leaders[0] : classifyTemperatureMood(median(maxCValues))
}
