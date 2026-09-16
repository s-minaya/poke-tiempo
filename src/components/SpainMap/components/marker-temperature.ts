/**
 * Franja de color de cada dígito de temperatura sobre un `LocationMarker`
 * (`005-plan.md` → punto 4): capa de presentación, no dominio — solo
 * decide el aspecto visual de la cifra, nunca qué Pokémon corresponde a
 * nadie. `assignPokemon` (`src/domain/assign-pokemon.ts`) sigue siendo la
 * única regla meteorológica del proyecto.
 *
 * Clasifica sobre el valor ya redondeado al entero (el mismo que se
 * muestra), no sobre el crudo — así el color de "21°" nunca corresponde a
 * la franja de al lado por culpa de un decimal invisible en pantalla.
 */
export type MarkerTemperatureBand = 'freezing' | 'cool' | 'mild' | 'pleasant' | 'hot' | 'scorching'

export function classifyMarkerTemperature(roundedCelsius: number): MarkerTemperatureBand {
  if (roundedCelsius < 0) return 'freezing'
  if (roundedCelsius < 10) return 'cool'
  if (roundedCelsius <= 20) return 'mild'
  if (roundedCelsius <= 25) return 'pleasant'
  if (roundedCelsius <= 34) return 'hot'
  return 'scorching'
}
