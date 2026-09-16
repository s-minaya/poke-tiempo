import type { PokedexId } from '../../domain/pokedex.ts'

import abomasnow from '../../assets/sprites/abomasnow.png'
import altaria from '../../assets/sprites/altaria.png'
import castform from '../../assets/sprites/castform.png'
import castformIce from '../../assets/sprites/castform-ice.png'
import castformRain from '../../assets/sprites/castform-rain.png'
import castformSun from '../../assets/sprites/castform-sun.png'
import charmander from '../../assets/sprites/charmander.png'
import charmeleon from '../../assets/sprites/charmeleon.png'
import cryogonal from '../../assets/sprites/cryogonal.png'
import dragonite from '../../assets/sprites/dragonite.png'
import groudon from '../../assets/sprites/groudon.png'
import groudonPrimal from '../../assets/sprites/groudon-primal.png'
import gyarados from '../../assets/sprites/gyarados.png'
import gyaradosMega from '../../assets/sprites/gyarados-mega.png'
import hippowdon from '../../assets/sprites/hippowdon.png'
import hoppip from '../../assets/sprites/hoppip.png'
import kyogre from '../../assets/sprites/kyogre.png'
import kyogrePrimal from '../../assets/sprites/kyogre-primal.png'
import magmar from '../../assets/sprites/magmar.png'
import moltres from '../../assets/sprites/moltres.png'
import rayquaza from '../../assets/sprites/rayquaza.png'
import snorunt from '../../assets/sprites/snorunt.png'
import solrock from '../../assets/sprites/solrock.png'
import tornadus from '../../assets/sprites/tornadus.png'
import zapdos from '../../assets/sprites/zapdos.png'

/**
 * Un sprite por cada `PokedexId` que `assignPokemon` puede producir — no
 * incluye `'thundurus'`, sin uso (ver `domain/pokedex.ts`). Imports
 * estáticos y explícitos: Vite solo empaqueta lo que se importa, y un
 * `PokedexId` sin entrada aquí falla en el tipado, no en runtime.
 */
export const spriteSources: Record<PokedexId, string> = {
  snorunt,
  solrock,
  'castform-sun': castformSun,
  charmander,
  charmeleon,
  magmar,
  groudon,
  'groudon-primal': groudonPrimal,
  altaria,
  castform,
  'castform-rain': castformRain,
  kyogre,
  'kyogre-primal': kyogrePrimal,
  cryogonal,
  abomasnow,
  hoppip,
  dragonite,
  rayquaza,
  tornadus,
  hippowdon,
  zapdos,
  'castform-ice': castformIce,
  gyarados,
  'gyarados-mega': gyaradosMega,
  moltres,
}
