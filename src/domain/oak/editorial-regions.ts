import type { Location } from '../types.ts'
import type { LocationZone } from '../location-zones.ts'
import type { DerivedRegionId, EditorialRegionId, PatternScope, RegionId } from './types.ts'

/**
 * Geografía editorial del parte (`013-spec.md` → Regiones editoriales, Ámbitos).
 *
 * Las siete regiones explícitas son **solapables**: un lugar puede pertenecer a
 * varias y ninguna pertenencia se decide por descarte. Canarias, Baleares y
 * Portugal **no se declaran aquí**: salen de `Location.zone`/`Location.country`,
 * que ya existen, para no tener dos listas que puedan desincronizarse. Andorra,
 * Ceuta y Melilla no tienen región propia.
 */

export const EDITORIAL_REGIONS: Record<EditorialRegionId, readonly string[]> = {
  northwest: ['a-coruna', 'lugo', 'ourense', 'pontevedra', 'oviedo', 'gijon'],
  north: [
    'a-coruna',
    'lugo',
    'ourense',
    'pontevedra',
    'oviedo',
    'gijon',
    'cantabria',
    'pais-vasco',
    'navarra',
    'la-rioja',
    'huesca',
    'jaca',
    'benasque',
  ],
  northeast: ['huesca', 'jaca', 'benasque', 'teruel', 'alcaniz', 'zaragoza', 'barcelona', 'lleida', 'girona', 'tarragona'],
  meseta: [
    'leon',
    'palencia',
    'burgos',
    'zamora',
    'salamanca',
    'avila',
    'segovia',
    'soria',
    'valladolid',
    'guadalajara',
    'cuenca',
    'tarancon',
    'albacete',
    'toledo',
    'ciudad-real',
    'manzanares',
    'madrid',
  ],
  southwest: ['caceres', 'plasencia', 'badajoz', 'merida', 'huelva', 'sevilla', 'cadiz', 'cordoba'],
  southeast: ['jaen', 'huescar', 'granada', 'almeria', 'murcia', 'alicante'],
  mediterranean: ['barcelona', 'girona', 'tarragona', 'castellon', 'valencia', 'alicante', 'murcia', 'almeria', 'malaga'],
}

/** Los tres grupos derivados de la zona o el país del lugar, nunca una tabla de miembros. */
export const DERIVED_REGION_IDS: readonly DerivedRegionId[] = ['canarias', 'baleares', 'portugal']

/** Los trece ámbitos, en un orden estable que la selección puede reutilizar. */
export const PATTERN_SCOPES: readonly PatternScope[] = [
  'map',
  'spain',
  'iberian-peninsula',
  'region:northwest',
  'region:north',
  'region:northeast',
  'region:meseta',
  'region:southwest',
  'region:southeast',
  'region:mediterranean',
  'region:canarias',
  'region:baleares',
  'region:portugal',
]

/**
 * El ámbito contra el que se mide "el resto" (`prevalenceRest`), explícito y
 * sin mezclar islas ni otros países en el contraste de una región española.
 */
export const PARENT_SCOPE: Record<PatternScope, PatternScope | null> = {
  map: null,
  spain: 'map',
  'iberian-peninsula': 'map',
  'region:northwest': 'spain',
  'region:north': 'spain',
  'region:northeast': 'spain',
  'region:meseta': 'spain',
  'region:southwest': 'spain',
  'region:southeast': 'spain',
  'region:mediterranean': 'spain',
  'region:canarias': 'spain',
  'region:baleares': 'spain',
  'region:portugal': 'iberian-peninsula',
}

/** España que no entra en la península ibérica. */
const SPAIN_OUTSIDE_PENINSULA: ReadonlySet<LocationZone> = new Set(['Canarias', 'Baleares', 'Ceuta', 'Melilla'])

const SCOPE_LABELS: Record<PatternScope, string> = {
  map: 'el mapa',
  spain: 'España',
  'iberian-peninsula': 'la península ibérica',
  'region:northwest': 'el noroeste',
  'region:north': 'el norte',
  'region:northeast': 'el noreste',
  'region:meseta': 'la meseta',
  'region:southwest': 'el suroeste',
  'region:southeast': 'el sureste',
  'region:mediterranean': 'el Mediterráneo',
  'region:canarias': 'Canarias',
  'region:baleares': 'Baleares',
  'region:portugal': 'los lugares de Portugal representados en el mapa',
}

function regionIdOf(scope: PatternScope): RegionId {
  return scope.slice('region:'.length) as RegionId
}

/**
 * Los `locationId` del ámbito, en el orden estable de `locations`. Para las
 * regiones explícitas son los de la tabla; para el resto, un filtro sobre la
 * zona o el país del lugar. No recorta a los lugares con previsión: eso lo
 * decide el parte al cruzar con su universo.
 */
export function scopeLocationIds(scope: PatternScope, locations: readonly Location[]): string[] {
  if (scope === 'map') return locations.map((location) => location.id)
  if (scope === 'spain') return locations.filter((location) => location.country === 'ES').map((location) => location.id)
  if (scope === 'iberian-peninsula') {
    return locations
      .filter(
        (location) =>
          (location.country === 'ES' && !SPAIN_OUTSIDE_PENINSULA.has(location.zone)) ||
          location.country === 'PT' ||
          location.country === 'AD',
      )
      .map((location) => location.id)
  }

  const region = regionIdOf(scope)
  if (region === 'canarias') return locations.filter((location) => location.zone === 'Canarias').map((location) => location.id)
  if (region === 'baleares') return locations.filter((location) => location.zone === 'Baleares').map((location) => location.id)
  if (region === 'portugal') return locations.filter((location) => location.country === 'PT').map((location) => location.id)
  return [...EDITORIAL_REGIONS[region]]
}

/**
 * La etiqueta en español del ámbito. **Independiente del recuento**: el `N/M`
 * pertenece al claim de apoyo opcional, nunca a la etiqueta base. Portugal
 * nunca se generaliza, ni siquiera con sus ocho lugares.
 */
export function scopeLabel(scope: PatternScope): string {
  return SCOPE_LABELS[scope]
}
