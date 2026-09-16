import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { geoMercator, geoPath } from 'd3-geo'
import type { Feature, FeatureCollection, Geometry, MultiPolygon, Polygon } from 'geojson'

import { locations } from '../src/data/locations.ts'

/**
 * Genera `src/data/map-geometry.ts`: la silueta del mapa principal (España
 * peninsular, Portugal, Andorra, Baleares, Ceuta y Melilla — todas en su
 * posición geográfica real, ajustadas juntas con el mismo `fitExtent`),
 * las fronteras internas de comunidades autónomas/distritos (mismo
 * tratamiento visual, ayudan a leer a qué región pertenece cada punto), el
 * recuadro de Canarias (mucho más lejos en la realidad, se mantiene como
 * `TerritoryInset` aparte) y una capa puramente decorativa de contexto
 * norteafricano (Marruecos + norte de Argelia, detrás de Ceuta/Melilla) —
 * sin ningún lugar propio, sin `LocationMarker`. La
 * posición `[x, y]` de los 74 lugares sale ya proyectada. `d3-geo` corre
 * solo aquí, en build time — nunca se importa desde `src/` (`tech-stack.md`).
 * No se ejecuta en el workflow diario, solo cuando cambia la silueta
 * (`spain-map.geo.json`) o la lista de lugares (`locations.ts`).
 */

interface MapFeatureProperties {
  id: 'spain' | 'portugal' | 'andorra' | 'balearic-islands' | 'ceuta' | 'melilla' | 'canary-islands' | 'morocco' | 'algeria'
  name: string
}

interface ProvinceBoundaryProperties {
  id: 'admin1-boundary'
  country: 'ESP' | 'PRT'
}

type Region = 'main' | 'canary'

type TerritoryPaths = Record<'spain' | 'portugal' | 'andorra' | 'balearic-islands' | 'ceuta' | 'melilla', string>

// Los 6 de los 74 lugares que están en Canarias. Ceuta y Melilla no son una
// región propia: entran en el `fitExtent` del mapa principal y su `region`
// es `'main'`, como cualquier lugar peninsular.
const CANARY_LOCATION_IDS = new Set([
  'la-palma',
  'la-gomera',
  'tenerife',
  'gran-canaria',
  'fuerteventura',
  'lanzarote',
])

const MAIN_TARGET_WIDTH = 960
// Padding asimétrico del mapa principal — la izquierda es mayor a
// propósito: reserva una columna despejada, en toda la altura del mapa,
// para el recuadro de Canarias (no compite por espacio con Ceuta/Melilla
// ni con el contexto norteafricano, que quedan del lado derecho de la
// banda inferior). El resto de bordes llevan más aire que la versión
// anterior (28u uniformes) sin ser el cambio protagonista.
const LEFT_PADDING = 128
const RIGHT_PADDING = 44
const TOP_PADDING = 44
// Banda inferior reservada para que remate en ella el recuadro de
// Canarias y la franja de contexto norteafricano — ninguna de las dos
// amplía ni reescala el `fitExtent` del mapa principal.
const BOTTOM_BAND = 250

// Canarias tiene una proporción propia — no la de una proyección Mercator
// fiel, que deja el archipiélago como una tira plana (~4:1 solo entre los
// 6 lugares reales). `CANARY_CONTENT_WIDTH/HEIGHT` (aspecto ~2.8:1) sale
// de calibrar una referencia con las posiciones reales de los 74 lugares
// contra las coordenadas geográficas reales — ver `fitCanaryAnisotropic`.
// Desplazada a la izquierda con una extensión pura de `viewBox` — no
// reescala el mapa principal.
const CANARY_CONTENT_WIDTH = 249
const CANARY_CONTENT_HEIGHT = 90
// Extensión de lienzo a la izquierda, solo para Canarias (el `viewBox`
// pasa a arrancar en `x = -CANVAS_LEFT_EXTENSION`). El límite real de
// cuánto puede subir el recuadro es la costa de Portugal (Faro cae en el
// mismo rango horizontal) — comprobado que este valor deja margen seguro.
const CANVAS_LEFT_EXTENSION = 130
const CANARY_BOX_X = -CANVAS_LEFT_EXTENSION + 12
// El desplazamiento vertical respecto al límite inferior del mapa
// principal (`BAND_Y0`) es negativo a propósito: sube el recuadro hasta
// donde lo permite la costa de Portugal (Faro cae en el mismo rango
// horizontal) — comprobado que deja margen seguro.
const CANARY_BOX_Y_OFFSET = -65

// Extensión de lienzo a la derecha — no toca el mapa principal. Comprobado
// muestreando el polígono de Argelia punto a punto: su costa se mantiene
// continua desde Melilla hasta su frontera real con Túnez (un salto recto
// en los datos, no un artefacto) en x≈1165 en este sistema de coordenadas
// — no existe un punto "natural" para terminar antes de eso. Se elige un
// valor que deja margen de sobra a esa frontera (960 + 150 = 1110, ~55u
// antes de los 1165) y que llega bastante después de Baleares (~916).
//
// El recorte del contexto ya NO se queda corto respecto al lienzo: su
// borde derecho y su borde inferior son exactamente los del `viewBox`
// (no un rectángulo interior más pequeño) — así el límite se lee como "el
// mapa acaba aquí" (igual que la propia península, Baleares o Canarias),
// no como "hemos recortado este país en concreto". El único borde que
// sigue siendo una línea recta "interior" es el de la izquierda, y ahí
// tiene justificación visual: es donde empieza el recuadro de Canarias.
const CANVAS_RIGHT_EXTENSION = 150

// Margen entre la geometría/los puntos proyectados y el borde del
// recuadro de Canarias: medio sprite (`SPRITE_SIZE = 62` en
// `LocationMarker.tsx`, la mitad son 31 unidades) más un pequeño margen,
// para que ningún punto quede a ras de un borde y su sprite se recorte.
export const POINT_PADDING = 38

function probeAspect(featureCollection: FeatureCollection): number {
  const probe = geoMercator().fitSize([1000, 1000], featureCollection)
  const [[x0, y0], [x1, y1]] = geoPath(probe).bounds(featureCollection)
  return (x1 - x0) / (y1 - y0)
}

type CoordinateTree = [number, number] | CoordinateTree[]

/**
 * Recorre recursivamente un array de coordenadas GeoJSON (`Polygon`,
 * `MultiPolygon`...) aplicando `fn` a cada par `[lon, lat]`.
 */
function mapCoordinates(coords: CoordinateTree, fn: (point: [number, number]) => [number, number]): CoordinateTree {
  if (typeof coords[0] === 'number') return fn(coords as [number, number])
  return (coords as CoordinateTree[]).map((c) => mapCoordinates(c, fn))
}

function isPolygonal(geometry: Geometry): geometry is Polygon | MultiPolygon {
  return geometry.type === 'Polygon' || geometry.type === 'MultiPolygon'
}

interface AnisotropicFit {
  path: string
  projectPoint: (lonLat: [number, number]) => [number, number]
  width: number
  height: number
}

/**
 * Ajusta Canarias con una escala X e Y INDEPENDIENTES (a propósito no
 * conforme — un Mercator de verdad usaría la misma escala en los dos
 * ejes) para que los 6 lugares reales queden repartidos con la proporción
 * ancho/alto calibrada contra sus posiciones reales — el archipiélago real
 * es muy alargado en horizontal (aspecto ~4:1 solo con los puntos), y una
 * proyección de aspecto fiel lo deja como una tira plana. `fitExtent`/
 * `fitSize` de d3-geo no dan esto (mantienen aspecto); se calculan `kx`/
 * `ky` a mano a partir de una proyección Mercator en crudo (`scale(1)`)
 * medida sobre los 6 puntos reales — no sobre la silueta de las islas, que
 * se re-escala con la misma `kx`/`ky` después, consistente con los puntos.
 */
function fitCanaryAnisotropic(
  canaryFeature: Feature<Geometry, MapFeatureProperties>,
  markerLonLat: [number, number][],
  targetContentWidth: number,
  targetContentHeight: number,
  padding: number,
): AnisotropicFit {
  const raw = geoMercator().scale(1).translate([0, 0])
  const rawMarkers = markerLonLat.map((lonLat) => raw(lonLat))
  if (rawMarkers.some((p) => !p)) throw new Error('No se pudo proyectar algún lugar de Canarias')
  const rawXs = rawMarkers.map((p) => (p as [number, number])[0])
  const rawYs = rawMarkers.map((p) => (p as [number, number])[1])
  const rawX0 = Math.min(...rawXs)
  const rawY0 = Math.min(...rawYs)
  const kx = targetContentWidth / (Math.max(...rawXs) - rawX0)
  const ky = targetContentHeight / (Math.max(...rawYs) - rawY0)

  const projectPoint = ([lon, lat]: [number, number]): [number, number] => {
    const p = raw([lon, lat])
    if (!p) throw new Error(`No se pudo proyectar [${lon}, ${lat}]`)
    return [(p[0] - rawX0) * kx + padding, (p[1] - rawY0) * ky + padding]
  }

  if (!isPolygonal(canaryFeature.geometry)) {
    throw new Error(`Geometría de Canarias inesperada: "${canaryFeature.geometry.type}" (se esperaba Polygon o MultiPolygon)`)
  }
  // Mismo `type` ('Polygon'/'MultiPolygon'), coordenadas reproyectadas —
  // la aserción de tipo es segura porque `isPolygonal` ya comprobó la
  // forma real en tiempo de ejecución.
  const projectedGeometry = {
    ...canaryFeature.geometry,
    coordinates: mapCoordinates(canaryFeature.geometry.coordinates as CoordinateTree, projectPoint),
  } as unknown as Polygon | MultiPolygon
  const path = geoPath()({ type: 'Feature', properties: {}, geometry: projectedGeometry })
  if (!path) throw new Error('geoPath no generó un `d` para Canarias')

  return {
    path,
    projectPoint,
    width: targetContentWidth + padding * 2,
    height: targetContentHeight + padding * 2,
  }
}

function loadFeatureCollection(): FeatureCollection<Geometry, MapFeatureProperties> {
  const path = fileURLToPath(new URL('./config/spain-map.geo.json', import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8')) as FeatureCollection<Geometry, MapFeatureProperties>
}

/**
 * Fronteras internas (comunidades autónomas / distritos) de España y
 * Portugal — Natural Earth, capa *Admin 1 – States/Provinces (lines)*
 * 1:10m, filtrada por `adm0_a3` a `ESP`/`PRT` (192 de los ~10 000 tramos
 * de la capa mundial). Igual que `spain-map.geo.json`: se descarga y
 * filtra una sola vez y se commitea. Puramente visual — no es un dato de
 * dominio ni genera lugares nuevos, solo ayuda a leer a qué región
 * corresponde cada punto cuando hay varios próximos entre sí.
 */
function loadProvinceBoundaries(): FeatureCollection<Geometry, ProvinceBoundaryProperties> {
  const path = fileURLToPath(new URL('./config/spain-provinces.geo.json', import.meta.url))
  return JSON.parse(readFileSync(path, 'utf-8')) as FeatureCollection<Geometry, ProvinceBoundaryProperties>
}

function findFeature(
  featureCollection: FeatureCollection<Geometry, MapFeatureProperties>,
  id: MapFeatureProperties['id'],
): Feature<Geometry, MapFeatureProperties> {
  const feature = featureCollection.features.find((f) => f.properties.id === id)
  if (!feature) {
    throw new Error(`spain-map.geo.json no incluye la feature "${id}"`)
  }
  return feature
}

function single(feature: Feature<Geometry, MapFeatureProperties>): FeatureCollection {
  return { type: 'FeatureCollection', features: [feature] }
}

function round(value: number): number {
  return Math.round(value * 100) / 100
}

interface TerritoryBox {
  x: number
  y: number
  width: number
  height: number
  path: string
}

function regionOf(locationId: string): Region {
  if (CANARY_LOCATION_IDS.has(locationId)) return 'canary'
  return 'main'
}

async function buildMap(): Promise<void> {
  const featureCollection = loadFeatureCollection()
  const spain = findFeature(featureCollection, 'spain')
  const portugal = findFeature(featureCollection, 'portugal')
  const andorra = findFeature(featureCollection, 'andorra')
  const balearic = findFeature(featureCollection, 'balearic-islands')
  const ceuta = findFeature(featureCollection, 'ceuta')
  const melilla = findFeature(featureCollection, 'melilla')
  const canaryFeature = findFeature(featureCollection, 'canary-islands')
  const moroccoFeature = findFeature(featureCollection, 'morocco')
  const algeriaFeature = findFeature(featureCollection, 'algeria')

  // Ceuta y Melilla entran en el mismo grupo que se ajusta con `fitExtent`
  // del mapa principal, sin proyección ni recuadro propios (004-plan.md →
  // punto 3).
  const mainCollection: FeatureCollection = { type: 'FeatureCollection', features: [spain, portugal, andorra, balearic, ceuta, melilla] }

  const mainAspect = probeAspect(mainCollection)
  const contentWidth = MAIN_TARGET_WIDTH - LEFT_PADDING - RIGHT_PADDING
  const contentHeight = Math.round(contentWidth / mainAspect)
  const mainProjection = geoMercator().fitExtent(
    [
      [LEFT_PADDING, TOP_PADDING],
      [LEFT_PADDING + contentWidth, TOP_PADDING + contentHeight],
    ],
    mainCollection,
  )
  const mainWidth = MAIN_TARGET_WIDTH
  const mainHeight = TOP_PADDING + contentHeight + BOTTOM_BAND
  const BAND_Y0 = TOP_PADDING + contentHeight

  // Escala X/Y independiente (ver `fitCanaryAnisotropic`): los 6 lugares
  // reales quedan repartidos en `CANARY_CONTENT_WIDTH` × `CANARY_CONTENT_HEIGHT`
  // unidades, más `POINT_PADDING` de margen en cada borde — el mismo
  // margen que evita que un sprite se recorte contra el borde del
  // recuadro en el resto del mapa.
  const canaryMarkerLonLat: [number, number][] = [...CANARY_LOCATION_IDS].map((id) => {
    const location = locations.find((l) => l.id === id)
    if (!location) throw new Error(`falta "${id}" en locations.ts`)
    return [location.longitude, location.latitude]
  })
  const canary = fitCanaryAnisotropic(canaryFeature, canaryMarkerLonLat, CANARY_CONTENT_WIDTH, CANARY_CONTENT_HEIGHT, POINT_PADDING)
  const CANARY_BOX_POSITION = { x: CANARY_BOX_X, y: BAND_Y0 + CANARY_BOX_Y_OFFSET }

  const ROOT_VIEW_BOX = {
    x: -CANVAS_LEFT_EXTENSION,
    y: 0,
    width: mainWidth + CANVAS_LEFT_EXTENSION + CANVAS_RIGHT_EXTENSION,
    height: mainHeight,
  }

  // Un `<path>` por territorio, no una única silueta combinada (005-plan.md
  // → punto 3): misma `mainProjection` que el `fitExtent` conjunto, pero
  // cada `geoPath` recibe solo su propia feature — así España/Portugal/
  // Andorra/Baleares/Ceuta/Melilla se pueden colorear por separado en
  // `SpainMap.tsx` sin depender de ningún hack de CSS sobre una silueta
  // única.
  const territoryFeatures: Record<keyof TerritoryPaths, Feature<Geometry, MapFeatureProperties>> = {
    spain,
    portugal,
    andorra,
    'balearic-islands': balearic,
    ceuta,
    melilla,
  }
  const territoryPaths = Object.fromEntries(
    Object.entries(territoryFeatures).map(([id, feature]) => [id, geoPath(mainProjection)(single(feature))]),
  ) as TerritoryPaths
  // Misma proyección que la silueta principal — las fronteras de provincia
  // son un detalle interno de la misma geometría, no un territorio aparte.
  const provinceBoundaries = loadProvinceBoundaries()
  const provinceBoundariesPath = geoPath(mainProjection)(provinceBoundaries)
  const canaryPath = canary.path
  // Marruecos y Argelia: MISMA proyección que el mapa principal,
  // reutilizada tal cual pero SIN participar en su `fitExtent` — se
  // proyectan en su posición geográfica real. No se recorta ninguna
  // coordenada (cero riesgo de topología inválida, ninguna dependencia
  // nueva): lo que cae fuera del recuadro/degradado de abajo sencillamente
  // no se pinta, con primitivas nativas de SVG.
  const moroccoContextPath = geoPath(mainProjection)(single(moroccoFeature))
  const algeriaContextPath = geoPath(mainProjection)(single(algeriaFeature))
  if (
    Object.values(territoryPaths).some((path) => !path) ||
    !provinceBoundariesPath ||
    !canaryPath ||
    !moroccoContextPath ||
    !algeriaContextPath
  ) {
    throw new Error('geoPath no generó un `d` para alguna de las siluetas')
  }

  const canaryBox: TerritoryBox = { ...CANARY_BOX_POSITION, width: canary.width, height: canary.height, path: canaryPath }

  if (canaryBox.x < ROOT_VIEW_BOX.x || canaryBox.y < 0 || canaryBox.x + canaryBox.width > mainWidth + CANVAS_LEFT_EXTENSION) {
    throw new Error(`canaryBox se sale del viewBox raíz: ${JSON.stringify(canaryBox)}`)
  }

  // Rectángulo de `clip-path` del contexto norteafricano: arranca a la
  // derecha del recuadro de Canarias y llega hasta el borde derecho del
  // `viewBox` raíz (ver comentario en `CANVAS_RIGHT_EXTENSION`) — no un
  // rectángulo interior más estrecho.
  //
  // El borde SUPERIOR se sitúa por encima del punto más al norte de la
  // costa real: comprobado muestreando el polígono de Argelia punto a
  // punto, su costa sube hasta y≈546 en su tramo más al norte (hacia
  // Baleares) — un recorte por debajo de eso cortaría en seco a través de
  // tierra firme, sin ninguna curva de costa que lo justifique. Subirlo
  // por encima de ese máximo no tiene coste visual: donde el contexto
  // coincide con la propia península, el `<path>` de la silueta principal
  // se pinta encima y lo tapa (va después en el orden de pintado).
  //
  // El borde INFERIOR remata a la altura del recuadro de Canarias
  // (`CANARY_BOTTOM`), no en el fondo del `viewBox`.
  const northAfricaClipX = CANARY_BOX_POSITION.x + canary.width + 30
  const northAfricaClipY = 500
  const CANARY_BOTTOM = CANARY_BOX_POSITION.y + canary.height
  const northAfricaClip = {
    x: northAfricaClipX,
    y: northAfricaClipY,
    width: mainWidth + CANVAS_RIGHT_EXTENSION - northAfricaClipX,
    height: CANARY_BOTTOM - northAfricaClipY,
  }

  const northAfricaContext = {
    moroccoPath: moroccoContextPath,
    algeriaPath: algeriaContextPath,
    clip: northAfricaClip,
  }

  const projectionByRegion: Record<Region, (lonLat: [number, number]) => [number, number] | null> = {
    main: mainProjection,
    canary: canary.projectPoint,
  }

  const mapPoints: Record<string, { x: number; y: number; region: Region }> = {}
  for (const location of locations) {
    const region = regionOf(location.id)
    const projected = projectionByRegion[region]([location.longitude, location.latitude])
    if (!projected) {
      throw new Error(`No se pudo proyectar "${location.id}" (${location.longitude}, ${location.latitude})`)
    }
    mapPoints[location.id] = { x: round(projected[0]), y: round(projected[1]), region }
  }

  const countByRegion = { main: 0, canary: 0 }
  for (const point of Object.values(mapPoints)) countByRegion[point.region] += 1
  if (countByRegion.canary !== CANARY_LOCATION_IDS.size) {
    throw new Error(`Reparto de lugares por región inesperado: ${JSON.stringify(countByRegion)}`)
  }

  const outputPath = fileURLToPath(new URL('../src/data/map-geometry.ts', import.meta.url))
  const header =
    '// ARCHIVO GENERADO — no editar a mano.\n' +
    '// Generado por `npm run build:map` a partir de `scripts/config/spain-map.geo.json`\n' +
    '// y `src/data/locations.ts`. Ver `scripts/build-map.ts`.\n\n'
  const body =
    `export const POINT_PADDING = ${POINT_PADDING}\n\n` +
    `export const ROOT_VIEW_BOX = ${JSON.stringify(ROOT_VIEW_BOX)}\n\n` +
    `// Un path por territorio (misma proyección/fitExtent que el conjunto) —\n` +
    `// España, Baleares, Ceuta y Melilla se pintan con el mismo color en\n` +
    `// SpainMap.tsx, pero cada uno es su propio <path>, no una silueta única.\n` +
    `export const territoryPaths: Record<'spain' | 'portugal' | 'andorra' | 'balearic-islands' | 'ceuta' | 'melilla', string> = ${JSON.stringify(territoryPaths, null, 2)}\n\n` +
    `// Fronteras de comunidades autónomas / distritos (España + Portugal) —\n` +
    `// puramente visual, mismo grupo accesible que la silueta principal.\n` +
    `export const provinceBoundariesPath = ${JSON.stringify(provinceBoundariesPath)}\n\n` +
    `export const canaryBox = ${JSON.stringify(canaryBox)}\n\n` +
    `/**\n` +
    ` * Contexto norteafricano (Marruecos + norte de Argelia) — puramente\n` +
    ` * decorativo: no es un lugar del dominio, no lleva \`LocationMarker\` ni\n` +
    ` * nombre accesible (se pinta con \`aria-hidden\`). \`clip\` acota el\n` +
    ` * rectángulo visible — un borde limpio, sin degradado: no hay ningún\n` +
    ` * punto "natural" donde la costa argelina deje de estar presente antes\n` +
    ` * de su frontera real con Túnez, así que se opta por un corte franco en\n` +
    ` * vez de disimularlo.\n` +
    ` */\n` +
    `export const northAfricaContext = ${JSON.stringify(northAfricaContext)}\n\n` +
    `export const mapPoints: Record<string, { x: number; y: number; region: 'main' | 'canary' }> = ${JSON.stringify(mapPoints, null, 2)}\n`

  await writeFile(outputPath, header + body, 'utf-8')
  console.log(
    `map-geometry.ts generado: viewBox raíz ${ROOT_VIEW_BOX.x} ${ROOT_VIEW_BOX.y} ${ROOT_VIEW_BOX.width}x${ROOT_VIEW_BOX.height}, ${locations.length} puntos (${JSON.stringify(countByRegion)}).`,
  )
}

buildMap().catch((error: unknown) => {
  console.error(error)
  process.exitCode = 1
})
