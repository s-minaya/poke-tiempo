/**
 * Identificadores de Pokémon/forma que el motor de asignación (`assign-pokemon.ts`)
 * puede producir hoy — uno por sprite necesario (`003-plan.md`). No incluye
 * `'thundurus'`: la regla que lo usaría (tormenta + DANA) está deshabilitada
 * (`constitution/roadmap.md`), así que ninguna regla actual puede producirlo.
 */
export type PokedexId =
  | 'snorunt'
  | 'solrock'
  | 'castform-sun'
  | 'charmander'
  | 'charmeleon'
  | 'magmar'
  | 'groudon'
  | 'groudon-primal'
  | 'altaria'
  | 'castform'
  | 'castform-rain'
  | 'kyogre'
  | 'kyogre-primal'
  | 'cryogonal'
  | 'abomasnow'
  | 'hoppip'
  | 'dragonite'
  | 'rayquaza'
  | 'tornadus'
  | 'hippowdon'
  | 'zapdos'
  | 'castform-ice'
  | 'gyarados'
  | 'gyarados-mega'
