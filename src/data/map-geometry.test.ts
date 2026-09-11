import { describe, expect, it } from 'vitest'

import { locations } from './locations.ts'
import { POINT_PADDING, ROOT_VIEW_BOX, canaryBox, mainMapPath, mapPoints, northAfricaContext, provinceBoundariesPath } from './map-geometry.ts'

const CANARY_LOCATION_IDS = new Set([
  'la-palma',
  'la-gomera',
  'tenerife',
  'gran-canaria',
  'fuerteventura',
  'lanzarote',
])

describe('map-geometry', () => {
  it('genera un viewBox raíz con dimensiones positivas', () => {
    expect(ROOT_VIEW_BOX.width).toBeGreaterThan(0)
    expect(ROOT_VIEW_BOX.height).toBeGreaterThan(0)
  })

  it('genera un path SVG no vacío para el mapa principal, las fronteras internas, Canarias y el contexto norteafricano', () => {
    expect(mainMapPath.startsWith('M')).toBe(true)
    expect(provinceBoundariesPath.startsWith('M')).toBe(true)
    expect(canaryBox.path.startsWith('M')).toBe(true)
    expect(northAfricaContext.moroccoPath.startsWith('M')).toBe(true)
    expect(northAfricaContext.algeriaPath.startsWith('M')).toBe(true)
  })

  it('el recuadro de Canarias cae dentro del viewBox raíz (que arranca en un origen negativo)', () => {
    expect(canaryBox.x).toBeGreaterThanOrEqual(ROOT_VIEW_BOX.x)
    expect(canaryBox.y).toBeGreaterThanOrEqual(ROOT_VIEW_BOX.y)
    expect(canaryBox.x + canaryBox.width).toBeLessThanOrEqual(ROOT_VIEW_BOX.x + ROOT_VIEW_BOX.width)
    expect(canaryBox.y + canaryBox.height).toBeLessThanOrEqual(ROOT_VIEW_BOX.y + ROOT_VIEW_BOX.height)
  })

  it('el recorte del contexto norteafricano se queda antes de la frontera real Argelia/Túnez', () => {
    // Comprobado muestreando el polígono de Argelia punto a punto: ese
    // salto recto (una frontera real, no un artefacto) aparece en
    // x≈1165 en este sistema de coordenadas — 004-plan.md → punto 3.
    expect(northAfricaContext.clip.x + northAfricaContext.clip.width).toBeLessThan(1165)
  })

  it('proyecta exactamente los 74 lugares de locations.ts', () => {
    const locationIds = locations.map((location) => location.id).sort()
    const pointIds = Object.keys(mapPoints).sort()
    expect(pointIds).toEqual(locationIds)
  })

  it('reparte los lugares por región: 6 en Canarias, el resto (Ceuta y Melilla incluidas) en el mapa principal', () => {
    const byRegion = { main: 0, canary: 0 }
    for (const point of Object.values(mapPoints)) byRegion[point.region] += 1
    expect(byRegion).toEqual({ main: 68, canary: 6 })

    const canaryIds = Object.entries(mapPoints)
      .filter(([, point]) => point.region === 'canary')
      .map(([id]) => id)
      .sort()
    expect(canaryIds).toEqual([...CANARY_LOCATION_IDS].sort())

    // Ceuta y Melilla no tienen región propia: se proyectan en su posición
    // geográfica real, como cualquier lugar peninsular (004-plan.md →
    // punto 3).
    expect(mapPoints.ceuta.region).toBe('main')
    expect(mapPoints.melilla.region).toBe('main')
  })

  it('los puntos de Canarias dejan el margen de POINT_PADDING en los cuatro bordes de su propio viewBox local', () => {
    const outOfBounds = Object.entries(mapPoints).filter(
      ([, point]) =>
        point.region === 'canary' &&
        (point.x < POINT_PADDING ||
          point.x > canaryBox.width - POINT_PADDING ||
          point.y < POINT_PADDING ||
          point.y > canaryBox.height - POINT_PADDING),
    )
    expect(outOfBounds).toEqual([])
  })

  it('mantiene la orientación geográfica: A Coruña (noroeste) queda por encima y a la izquierda de Murcia (sureste)', () => {
    expect(mapPoints['a-coruna'].x).toBeLessThan(mapPoints.murcia.x)
    expect(mapPoints['a-coruna'].y).toBeLessThan(mapPoints.murcia.y)
  })

  it('Ceuta y Melilla quedan al sur de la costa peninsular más cercana (Cádiz), no al norte', () => {
    expect(mapPoints.ceuta.y).toBeGreaterThan(mapPoints.cadiz.y)
    expect(mapPoints.melilla.y).toBeGreaterThan(mapPoints.cadiz.y)
  })
})
