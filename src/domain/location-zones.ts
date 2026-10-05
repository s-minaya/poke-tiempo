/**
 * Las zonas en que se agrupan los 74 lugares, en el orden en que se muestran:
 * las 19 comunidades y ciudades autónomas por orden alfabético, y después
 * Portugal y Andorra (009-plan.md → Zonas). El selector de zona y los grupos
 * de la lista salen de esta misma lista, así que su orden es el de la
 * interfaz. Literales en español porque se muestran tal cual.
 */
export const LOCATION_ZONES = [
  'Andalucía',
  'Aragón',
  'Asturias',
  'Baleares',
  'Canarias',
  'Cantabria',
  'Castilla y León',
  'Castilla-La Mancha',
  'Cataluña',
  'Ceuta',
  'Comunidad de Madrid',
  'Comunidad Valenciana',
  'Extremadura',
  'Galicia',
  'La Rioja',
  'Melilla',
  'Navarra',
  'País Vasco',
  'Región de Murcia',
  'Portugal',
  'Andorra',
] as const

export type LocationZone = (typeof LOCATION_ZONES)[number]
