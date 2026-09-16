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
 *
 * Exportada para que la leyenda (005) ordene sus entradas igual que el
 * mapa, sin copiar el array.
 *
 * `castform-sun` va al final de todos los tramos de temperatura, no en su
 * posición natural entre solrock y charmander: desde que `assignBySky`
 * también lo asigna por cielo despejado (005-plan.md → ampliación de
 * alcance), un día despejado fuera de la franja 15–25°C produce dos
 * candidatos de temperatura a la vez (el real, p. ej. charmeleon a 32°C, y
 * castform-sun por el cielo) — sin este cambio, castform-sun ganaba por ir
 * antes en la lista y tapaba la temperatura real. Puesto el último, solo
 * gana cuando es el único candidato de temperatura, que es exactamente
 * cuando cielo y temperatura real coinciden.
 *
 * `moltres` ("viento cálido", ampliación de la 005) va justo detrás de
 * Gyarados y por delante del resto de la familia de viento: es una
 * combinación más específica y menos frecuente que el viento simple.
 *
 * **Hoppip (viento moderado) como condición secundaria — criterio
 * editorial propio de PokéTiempo, no una reproducción de la cuenta
 * original (ver `003-plan.md` → "Prioridad de Hoppip / viento moderado").**
 * `assignByWind` y su umbral no cambian: Hoppip sigue significando
 * exactamente "viento moderado". Lo que cambia es cuándo se *dibuja* en
 * el mapa: un viento moderado no debe tapar un fenómeno claramente más
 * importante, así que suben por delante de Hoppip:
 * - `dragonite`/`rayquaza`/`tornadus` (viento fuerte o superior — si el
 *   viento ya basta para una forma más severa, esa forma debe ganar, no
 *   quedar oculta por el propio viento moderado);
 * - toda la temperatura relevante excepto `castform-sun`: `snorunt`,
 *   `solrock`, `charmander`, `charmeleon`, `magmar`, `groudon`,
 *   `groudon-primal` (una temperatura no neutral comunica mejor el día
 *   que un viento moderado).
 *
 * Por debajo de Hoppip quedan las representaciones ordinarias/neutrales:
 * `castform` (nuboso/cubierto), `altaria` (poco nuboso) y `castform-sun`
 * (banda térmica neutral + despejado) — ninguna se considera un fenómeno
 * significativo al nivel de tormenta/nieve/calima/niebla/lluvia/oleaje,
 * así que ahora ceden tanto ante temperatura relevante como ante Hoppip.
 * `castform` deja así de tener prioridad especial frente a temperatura
 * (ver `003-plan.md` para el porqué: la evidencia de las comparaciones
 * nunca fue concluyente en ninguna dirección). `castform-sun` sigue el
 * último de todos por el motivo ya explicado arriba (solo gana cuando es
 * el único candidato de temperatura).
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
