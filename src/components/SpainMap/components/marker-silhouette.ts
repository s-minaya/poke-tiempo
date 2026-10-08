// Filtro SVG que convierte el sprite de un lugar en sombra: la silueta negra
// a un 20 % de opacidad (009-plan.md → punto 7). Se define una sola vez en el
// `<defs>` del mapa (`SpainMap.tsx`) y cada sprite en sombra lo referencia por
// su id (`MarkerLayers.tsx`), también desde el `<svg>` anidado de Canarias.
export const MARKER_SILHOUETTE_FILTER_ID = 'location-marker-silhouette'

// R, G y B a cero; el alfa del sprite, multiplicado por 0,2.
export const MARKER_SILHOUETTE_MATRIX = '0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.2 0'
