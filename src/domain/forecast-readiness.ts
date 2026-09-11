import { assignPokemon } from './assign-pokemon.ts'
import type { LocationForecast } from './types.ts'

/**
 * Última comprobación antes de escribir `forecast.json` (`002-plan.md`):
 * ninguna de las 74 ubicaciones puede publicarse sin Pokémon. La tolerancia
 * cero de `fault-tolerance.ts` ya garantiza que no falten `LocationForecast`
 * tras aplicar el fallback — esto comprueba, aparte, que los que llegaron
 * son exactamente los lugares esperados (sin duplicados ni ids ajenos) y
 * que cada uno produce al menos un `PokedexId` vía `assignPokemon` (003).
 * Si algo falla aquí, el dataset entero se considera inválido: no se
 * inventa un Pokémon por defecto ni se publica un subconjunto — se aborta
 * y se deja el `forecast.json` anterior en línea.
 */
export interface ForecastReadiness {
  ready: boolean
  reason?: string
}

export function checkForecastReadiness(
  expectedLocationIds: readonly string[],
  locationForecasts: readonly LocationForecast[],
): ForecastReadiness {
  if (locationForecasts.length !== expectedLocationIds.length) {
    return {
      ready: false,
      reason: `se esperaban ${expectedLocationIds.length} lugares, el forecast trae ${locationForecasts.length}`,
    }
  }

  const seenIds = new Set<string>()
  for (const forecast of locationForecasts) {
    if (seenIds.has(forecast.locationId)) {
      return { ready: false, reason: `locationId duplicado: "${forecast.locationId}"` }
    }
    seenIds.add(forecast.locationId)
  }

  const missing = expectedLocationIds.filter((id) => !seenIds.has(id))
  if (missing.length > 0) {
    return { ready: false, reason: `faltan lugares esperados: ${missing.join(', ')}` }
  }

  for (const forecast of locationForecasts) {
    if (assignPokemon(forecast).length === 0) {
      return { ready: false, reason: `"${forecast.locationId}": assignPokemon() no asignó ningún Pokémon` }
    }
  }

  return { ready: true }
}
