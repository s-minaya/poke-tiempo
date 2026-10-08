/**
 * Lado del sprite de cada marcador, en unidades del `viewBox` y no en CSS:
 * mismo tamaño de icono en el mapa principal y en el recuadro de Canarias,
 * para que escale siempre junto con la silueta (004-plan.md → "Responsive").
 * El Pokémon es el protagonista visual del mapa, no un icono discreto — 62u,
 * coherente con el margen (`POINT_PADDING`) que deja `build-map.ts` en los
 * bordes del recuadro de Canarias.
 *
 * Vive en su propio módulo porque lo usan el sprite (`MarkerLayers.tsx`), el
 * marcador, con su área de toque y su aro de foco (`LocationMarker.tsx`), y
 * `SpainMap`, para anclar la tarjeta del lugar justo al lado del sprite.
 */
export const SPRITE_SIZE = 62
