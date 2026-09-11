import type { PokedexId } from '../../domain/pokedex.ts'

/**
 * Orden de prioridad para elegir el único Pokémon que se dibuja en el mapa
 * (`004-plan.md` → "Selección del único Pokémon visible") — decisión de
 * presentación, no de dominio: `assignPokemon` (003) sigue siendo quien
 * decide qué Pokémon le corresponden a un lugar, sin tocar.
 *
 * De más a menos "noticia": un aviso rojo costero oficial (Mega Gyarados)
 * por delante de fenómenos severos sin aviso detrás (tormenta, nieve,
 * calima, niebla), estos por delante de lo frecuente (lluvia, oleaje sin
 * aviso, viento, cielo), y la temperatura la última porque es el único eje
 * que siempre asigna algo — si fuera la primera, taparía cualquier
 * fenómeno más singular todos los días. Gyarados (sin aviso rojo) va
 * detrás de la lluvia a propósito: `waveHeightM >= 1,25` se da con
 * bastante frecuencia en costa y no debe tapar fenómenos más
 * significativos.
 */
const MAP_PRIORITY: readonly PokedexId[] = [
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
  'hoppip',
  'dragonite',
  'rayquaza',
  'tornadus',
  'altaria',
  'castform',
  'snorunt',
  'solrock',
  'castform-sun',
  'charmander',
  'charmeleon',
  'magmar',
  'groudon',
  'groudon-primal',
]

/**
 * Elige, de la lista completa que devuelve `assignPokemon`, el único
 * Pokémon que se dibuja en el mapa: el primero de `MAP_PRIORITY` presente
 * en `pokemonIds`, sin scoring. `null` solo si `pokemonIds` llega vacío —
 * hoy no debería pasar, porque `assignByTemperature` siempre asigna algo,
 * pero la función no lo asume.
 */
export function pickMapPokemon(pokemonIds: readonly PokedexId[]): PokedexId | null {
  const present = new Set(pokemonIds)
  return MAP_PRIORITY.find((id) => present.has(id)) ?? null
}
