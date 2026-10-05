import type { LocationView } from '../../domain/location-views.ts'
import type { PokedexId } from '../../domain/pokedex.ts'

import { POKEMON_LABELS } from '../../domain/pokemon-labels.ts'
import { POKEMON_NAMES } from '../../domain/pokemon-names.ts'

import { locations } from '../../data/locations.ts'

// `LocationView` no trae el área administrativa, y `buildLocationViews` se
// reutiliza tal cual (008-plan.md): se toma del propio lugar.
const administrativeAreaById = new Map(locations.map((location) => [location.id, location.administrativeArea]))

/**
 * Lo que se cuenta de un lugar al seleccionarlo, ya resuelto para pintarse
 * o decirse en voz alta. Lo comparten la tarjeta, el anuncio para lectores
 * de pantalla y las filas de la lista, para que las tres vías digan
 * exactamente lo mismo.
 */
export interface LocationSummary {
  id: string
  name: string
  /** `null` cuando coincide con `name`: Madrid no es "Madrid, Madrid". */
  administrativeArea: string | null
  pokemonId: PokedexId | null
  /** Nombre propio (`POKEMON_NAMES`): "Castform", no la forma. */
  pokemonName: string | null
  /** El tiempo que representa (`POKEMON_LABELS`): "Niebla". */
  condition: string | null
  /** Redondeadas igual que en el marcador, para que nunca discrepen. */
  minC: number | null
  maxC: number | null
}

/** El resumen de una vista del mapa, con el área administrativa de su lugar. */
export function summarizeView(view: LocationView): LocationSummary {
  return summarizeLocation(view, administrativeAreaById.get(view.id) ?? view.name)
}

export function summarizeLocation(view: LocationView, administrativeArea: string): LocationSummary {
  return {
    id: view.id,
    name: view.name,
    administrativeArea: administrativeArea === view.name ? null : administrativeArea,
    pokemonId: view.pokemonId,
    pokemonName: view.pokemonId ? POKEMON_NAMES[view.pokemonId] : null,
    condition: view.pokemonId ? POKEMON_LABELS[view.pokemonId] : null,
    minC: view.minC != null ? Math.round(view.minC) : null,
    maxC: view.maxC != null ? Math.round(view.maxC) : null,
  }
}

/**
 * La misma información en frases cortas, para la región viva que la anuncia
 * al seleccionar un lugar (WCAG 4.1.3): el foco se queda en el marcador, y
 * sin este anuncio un lector de pantalla no sabría que ha aparecido nada.
 * Frases separadas por punto, porque `POKEMON_LABELS` mezcla sustantivos y
 * adjetivos y ninguna plantilla de frase única los admite a todos.
 */
export function announceLocation(summary: LocationSummary): string {
  const place = summary.administrativeArea ? `${summary.name}, ${summary.administrativeArea}.` : `${summary.name}.`
  const pokemon = summary.pokemonName && summary.condition ? ` ${summary.pokemonName}. ${summary.condition}.` : ''
  const temperatures =
    summary.minC != null && summary.maxC != null
      ? ` Mínima ${summary.minC} grados, máxima ${summary.maxC} grados.`
      : ' Sin previsión para hoy.'
  return place + pokemon + temperatures
}
