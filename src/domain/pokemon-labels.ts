import type { PokedexId } from './pokedex.ts'

/**
 * Texto asociado a cada uno de los 25 `PokedexId` que puede producir
 * `assignPokemon` — usado hoy por la leyenda (005). `castform-sun` se lee
 * "Templado", no "Soleado": se asigna tanto por cielo despejado como por
 * temperatura (15–25 °C) sola, así que puede tocarle a un día nublado o
 * lluvioso a esa temperatura — la etiqueta no puede prometer sol.
 */
export const POKEMON_LABELS: Record<PokedexId, string> = {
  snorunt: 'Helado',
  solrock: 'Despejado y frío',
  'castform-sun': 'Templado',
  charmander: 'Caluroso',
  charmeleon: 'Muy caluroso',
  magmar: 'Sofocante',
  groudon: 'Volcánico',
  'groudon-primal': 'Infernal',
  altaria: 'Poco nuboso',
  castform: 'Nuboso o cubierto',
  'castform-rain': 'Lluvia moderada',
  kyogre: 'Lluvia intensa',
  'kyogre-primal': 'Lluvias torrenciales',
  cryogonal: 'Nevadas',
  abomasnow: 'Nevadas intensas',
  hoppip: 'Viento moderado',
  dragonite: 'Viento intenso',
  rayquaza: 'Vendaval',
  tornadus: 'Viento extremo',
  hippowdon: 'Calima',
  zapdos: 'Tormenta',
  'castform-ice': 'Niebla',
  gyarados: 'Oleaje',
  'gyarados-mega': 'Oleaje muy fuerte',
  moltres: 'Viento cálido',
}
