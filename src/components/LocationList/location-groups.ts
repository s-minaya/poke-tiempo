import type { LocationSummary } from '../LocationCard/location-summary.ts'
import type { MarkerTemperatureBand } from '../SpainMap/components/marker-temperature.ts'
import type { LocationZone } from '../../domain/location-zones.ts'

import { LOCATION_ZONES } from '../../domain/location-zones.ts'
import { MARKER_TEMPERATURE_BANDS, classifyMarkerTemperature, markerTemperatureRange } from '../SpainMap/components/marker-temperature.ts'

export type LocationOrder = 'zone' | 'name' | 'warmest' | 'coldest'

export interface LocationGroup {
  key: string
  /** `null` en el orden alfabético, que es un solo grupo sin encabezado. */
  title: string | null
  /** La franja de la cifra por la que se ordena; `null` fuera de los órdenes de temperatura. */
  band: MarkerTemperatureBand | null
  rows: readonly LocationSummary[]
}

export const NO_FORECAST_GROUP_TITLE = 'Sin previsión'

// Orden alfabético en español («Ávila» junto a «Albacete», no al final); el
// id desempata, así que dos nombres iguales nunca dependen del orden de
// entrada.
const collator = new Intl.Collator('es')

function byName(a: LocationSummary, b: LocationSummary): number {
  return collator.compare(a.name, b.name) || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0)
}

/**
 * Título de una franja, con los mismos límites con los que se colorean las
 * cifras del mapa (`marker-temperature.ts`): «Máxima de 35° o más», «Mínima
 * entre 0° y 9°», «Mínima bajo cero».
 */
export function temperatureBandTitle(band: MarkerTemperatureBand, metric: 'max' | 'min'): string {
  const label = metric === 'max' ? 'Máxima' : 'Mínima'
  const { from, to } = markerTemperatureRange(band)
  if (from === null) return to === -1 ? `${label} bajo cero` : `${label} de ${to}° o menos`
  if (to === null) return `${label} de ${from}° o más`
  return `${label} entre ${from}° y ${to}°`
}

/**
 * Los lugares ordenados y agrupados para la lista. No cambia la entrada:
 * devuelve arrays nuevos. Copia y ordena con `[...x].sort()`, no con
 * `toSorted`/`toReversed`: Firefox 114, dentro del objetivo por defecto de
 * Vite (`baseline-widely-available`), no los tiene, y Vite no los rellena.
 *
 * - `zone`: un grupo por zona con lugares, en el orden de `LOCATION_ZONES`.
 * - `name`: un solo grupo, sin título.
 * - `warmest` / `coldest`: por máxima de mayor a menor o por mínima de menor
 *   a mayor, un grupo por franja de esa cifra, y los lugares sin ella al
 *   final, en un grupo propio.
 *
 * Dentro de cada grupo, a igual cifra, orden alfabético. Sin lugares, ningún
 * grupo.
 */
export function groupLocations(
  summaries: readonly LocationSummary[],
  order: LocationOrder,
  zoneById: ReadonlyMap<string, LocationZone>,
): LocationGroup[] {
  if (order === 'name') {
    return summaries.length > 0 ? [{ key: 'name', title: null, band: null, rows: [...summaries].sort(byName) }] : []
  }

  if (order === 'zone') {
    const rowsByZone = new Map<LocationZone, LocationSummary[]>()
    for (const summary of summaries) {
      const zone = zoneById.get(summary.id)
      if (!zone) throw new Error(`Sin zona para el lugar "${summary.id}"`)
      rowsByZone.set(zone, [...(rowsByZone.get(zone) ?? []), summary])
    }
    return LOCATION_ZONES.flatMap((zone) => {
      const rows = rowsByZone.get(zone)
      return rows ? [{ key: `zone:${zone}`, title: zone, band: null, rows: [...rows].sort(byName) }] : []
    })
  }

  const metric = order === 'warmest' ? 'max' : 'min'
  const value = (summary: LocationSummary) => (metric === 'max' ? summary.maxC : summary.minC)
  const withValue = summaries.filter((summary) => value(summary) != null)
  const withoutValue = summaries.filter((summary) => value(summary) == null)

  const sorted = [...withValue].sort((a, b) => {
    const difference = order === 'warmest' ? value(b)! - value(a)! : value(a)! - value(b)!
    return difference || byName(a, b)
  })
  const bands = order === 'warmest' ? [...MARKER_TEMPERATURE_BANDS].reverse() : MARKER_TEMPERATURE_BANDS

  const groups: LocationGroup[] = bands.flatMap(({ band }) => {
    const rows = sorted.filter((summary) => classifyMarkerTemperature(value(summary)!) === band)
    return rows.length > 0 ? [{ key: `${metric}:${band}`, title: temperatureBandTitle(band, metric), band, rows }] : []
  })
  if (withoutValue.length > 0) {
    groups.push({ key: 'no-forecast', title: NO_FORECAST_GROUP_TITLE, band: null, rows: [...withoutValue].sort(byName) })
  }
  return groups
}
