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

export interface MarkerTemperatureRange {
  band: MarkerTemperatureBand
  /** Primer grado de la franja; `null` en la primera, que no tiene suelo. */
  from: number | null
}

/**
 * Las franjas de frío a calor, cada una con su primer grado. Única fuente de
 * los límites: de aquí salen el color de cada cifra del mapa y los títulos
 * de los grupos de la lista (009-plan.md → punto 2), así que no pueden
 * discrepar. Una franja llega hasta el grado anterior al `from` de la
 * siguiente: sin huecos ni solapes, también con decimales.
 */
export const MARKER_TEMPERATURE_BANDS: readonly MarkerTemperatureRange[] = [
  { band: 'freezing', from: null },
  { band: 'cool', from: 0 },
  { band: 'mild', from: 10 },
  { band: 'pleasant', from: 21 },
  { band: 'hot', from: 26 },
  { band: 'scorching', from: 35 },
]

export function classifyMarkerTemperature(roundedCelsius: number): MarkerTemperatureBand {
  let band = MARKER_TEMPERATURE_BANDS[0].band
  for (const range of MARKER_TEMPERATURE_BANDS) {
    if (range.from !== null && roundedCelsius >= range.from) band = range.band
  }
  return band
}

/**
 * Los grados enteros que abarca una franja, para escribirla: `from` es su
 * primer grado y `to`, el último (el `from` de la siguiente menos uno).
 * `null` en el extremo abierto: bajo cero no tiene suelo, y 35° o más no
 * tiene techo.
 */
export function markerTemperatureRange(band: MarkerTemperatureBand): { from: number | null; to: number | null } {
  const index = MARKER_TEMPERATURE_BANDS.findIndex((range) => range.band === band)
  const next = MARKER_TEMPERATURE_BANDS[index + 1]
  return { from: MARKER_TEMPERATURE_BANDS[index].from, to: next?.from != null ? next.from - 1 : null }
}
