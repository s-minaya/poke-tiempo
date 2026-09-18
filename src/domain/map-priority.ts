import type { PokedexId } from './pokedex.ts'

/**
 * Orden de prioridad para elegir el único Pokémon que se dibuja en el mapa
 * (`003-plan.md` → "Prioridad de presentación") — decisión editorial de
 * qué Pokémon se muestra cuando un lugar tiene varios candidatos:
 * `assignPokemon` (003) sigue siendo quien decide qué Pokémon le
 * corresponden a un lugar, sin tocar.
 *
 * De más a menos "noticia": aviso rojo costero (Mega Gyarados), fenómenos
 * severos (tormenta, nieve, calima, niebla), lo frecuente (lluvia, oleaje
 * sin aviso, viento cálido), viento fuerte o superior, temperatura
 * relevante, Hoppip (viento moderado) y por último las representaciones
 * ordinarias/neutrales (Castform, Altaria, Castform-sun) — Hoppip y estas
 * tres últimas son condiciones secundarias: solo se dibujan cuando no hay
 * nada más significativo que mostrar. Gyarados (sin aviso rojo) va detrás
 * de la lluvia a propósito: `waveHeightM >= 1,25` se da con bastante
 * frecuencia en costa y no debe tapar fenómenos más significativos.
 *
 * Exportada para que la leyenda (005) ordene sus entradas igual que el
 * mapa, sin copiar el array.
 *
 * `castform-sun` va al final de todos: como `assignBySky` también lo
 * asigna por cielo despejado (no solo por el tramo de temperatura
 * 15–25°C), un día despejado fuera de esa franja produce dos candidatos
 * de temperatura a la vez (el real, p. ej. charmeleon a 32°C, y
 * castform-sun por el cielo). Puesto el último, solo gana cuando es el
 * único candidato de temperatura, que es exactamente cuando cielo y
 * temperatura real coinciden.
 */
export const MAP_PRIORITY: readonly PokedexId[] = [
  'gyarados-mega',
  'zapdos',
  'cryogonal',
  'abomasnow',
  'hippowdon',
  'castform-ice',
  'castform-rain',
  'kyogre',
  'kyogre-primal',
  'gyarados',
  'moltres',
  'dragonite',
  'rayquaza',
  'tornadus',
  'snorunt',
  'solrock',
  'charmander',
  'charmeleon',
  'magmar',
  'groudon',
  'groudon-primal',
  'hoppip',
  'castform',
  'altaria',
  'castform-sun',
]

/**
 * Elige, de la lista completa que devuelve `assignPokemon`, el único
 * Pokémon que se dibuja en el mapa: el primero de `MAP_PRIORITY` presente
 * en `pokemonIds`, sin scoring. `null` solo si `pokemonIds` llega vacío —
 * en la práctica no debería pasar, porque `assignByTemperature` siempre
 * asigna algo, pero la función no lo asume.
 */
export function pickMapPokemon(pokemonIds: readonly PokedexId[]): PokedexId | null {
  const present = new Set(pokemonIds)
  return MAP_PRIORITY.find((id) => present.has(id)) ?? null
}

// Donde empiezan las condiciones secundarias de `MAP_PRIORITY`: Hoppip y las
// tres representaciones ordinarias de cielo que le siguen.
const FIRST_SECONDARY_INDEX = MAP_PRIORITY.indexOf('hoppip')

/**
 * Si un Pokémon representa una condición significativa o una de las
 * ordinarias. No es una lista aparte: se deriva de la posición en
 * `MAP_PRIORITY` respecto a `hoppip`, que es justo donde el propio orden
 * editorial separa lo que es noticia de lo que solo se dibuja cuando no hay
 * nada mejor que mostrar. Reordenar `MAP_PRIORITY` mueve la frontera con él.
 */
export function isSignificantPokemon(id: PokedexId): boolean {
  const index = MAP_PRIORITY.indexOf(id)
  return index !== -1 && index < FIRST_SECONDARY_INDEX
}
