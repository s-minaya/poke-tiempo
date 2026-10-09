import { ROOT_VIEW_BOX, canaryBox } from '../../data/map-geometry.ts'

// Punto más bajo del contenido real del mapa: el recuadro de Canarias
// remata más abajo que el contexto norteafricano (ambos coinciden con el
// borde inferior de `northAfricaContext.clip`, ver `build-map.ts`) — el
// mar se detiene aquí, no en el borde inferior del `viewBox`.
export const MAP_SEA_BOTTOM = canaryBox.y + canaryBox.height

// Proporción del dibujo, de ancho entre alto hasta el mar. Con ella calcula
// el CSS el ancho del mapa (`--map-aspect`): el propio mapa y, en escritorio,
// la rejilla de la página, que le da a la leyenda lo que el mapa deja libre.
export const MAP_ASPECT = ROOT_VIEW_BOX.width / MAP_SEA_BOTTOM
