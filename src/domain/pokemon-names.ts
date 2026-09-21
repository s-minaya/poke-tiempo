import type { PokedexId } from './pokedex.ts'

/**
 * El nombre con el que se llama a cada Pokémon en voz alta. Es la **única**
 * fuente de nombres del proyecto: antes de la 007 no existía ninguna: el
 * mapa no expone nombre (el sprite va con `alt=""` y el marcador anuncia
 * lugar y temperaturas) y la leyenda muestra el fenómeno, no al Pokémon.
 *
 * No confundir con `POKEMON_LABELS`, que describe **qué tiempo** representa
 * cada uno (`castform-ice` → "Niebla"). Aquí van los nombres propios
 * (`castform-ice` → "Castform"), y son ejes distintos a propósito: dos ids
 * pueden compartir nombre y tener etiquetas opuestas.
 *
 * Las cuatro formas de Castform se llaman **las cuatro "Castform"**: es como
 * se les llama de verdad, y ninguna lleva un sufijo de forma inventado. Las
 * que sí tienen nombre propio usan la grafía oficial en español:
 * `Mega-Gyarados` con guion, `Primigenio` en mayúscula.
 */
export const POKEMON_NAMES: Record<PokedexId, string> = {
  snorunt: 'Snorunt',
  solrock: 'Solrock',
  'castform-sun': 'Castform',
  charmander: 'Charmander',
  charmeleon: 'Charmeleon',
  magmar: 'Magmar',
  groudon: 'Groudon',
  'groudon-primal': 'Groudon Primigenio',
  altaria: 'Altaria',
  castform: 'Castform',
  'castform-rain': 'Castform',
  kyogre: 'Kyogre',
  'kyogre-primal': 'Kyogre Primigenio',
  cryogonal: 'Cryogonal',
  abomasnow: 'Abomasnow',
  hoppip: 'Hoppip',
  dragonite: 'Dragonite',
  rayquaza: 'Rayquaza',
  tornadus: 'Tornadus',
  hippowdon: 'Hippowdon',
  zapdos: 'Zapdos',
  'castform-ice': 'Castform',
  gyarados: 'Gyarados',
  'gyarados-mega': 'Mega-Gyarados',
  moltres: 'Moltres',
}
