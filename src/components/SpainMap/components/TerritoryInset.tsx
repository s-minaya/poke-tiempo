import type { LocationView } from '../../../domain/location-views.ts'

import MarkerLayers from './MarkerLayers.tsx'

import './TerritoryInset.scss'

// Tamaño del corte a 45° en la esquina superior derecha del marco — misma
// convención que los mapas políticos de España para el recuadro de
// Canarias. Fijo: no depende del tamaño del recuadro.
const FRAME_CHAMFER = 26

function framePath(width: number, height: number): string {
  return `M0,0 L${width - FRAME_CHAMFER},0 L${width},${FRAME_CHAMFER} L${width},${height} L0,${height} Z`
}

interface TerritoryInsetProps {
  x: number
  y: number
  width: number
  height: number
  path: string
  label: string
  locations: LocationView[]
  /**
   * Solo Canarias lleva marco — un borde grueso con la esquina superior
   * derecha achaflanada la ancla como recuadro aparte (convención habitual
   * en los mapas políticos de España).
   */
  frame?: boolean
  /** Selección de lugar: se pasa tal cual a sus lugares (`SpainMap.tsx`). */
  selectedLocationId?: string | null
  /** Los lugares que cumplen los filtros, o `null` sin filtros (`SpainMap.tsx`). */
  matchingIds?: ReadonlySet<string> | null
  onActivateLocation?: (id: string) => void
  onDismissLocation?: () => void
  registerMarker?: (id: string, element: SVGGElement | null) => void
}

/**
 * Un territorio auxiliar (actualmente, solo Canarias — Ceuta y Melilla se
 * proyectan ya en su posición real dentro del mapa principal, ver
 * `004-plan.md` → punto 3) integrado en el mismo `viewBox` que la
 * península — un `<svg>` anidado con su propia proyección/`viewBox`, así
 * que escala junto con el mapa principal sin necesitar ningún cálculo de
 * offset.
 *
 * `role="group"`, no `role="img"`: un contenedor `role="img"` trata a sus
 * descendientes como parte de una única imagen y los oculta de la
 * tecnología de asistencia como elementos propios — aquí cada
 * `LocationMarker` de dentro necesita seguir exponiendo su propio nombre.
 */
function TerritoryInset({
  x,
  y,
  width,
  height,
  path,
  label,
  locations,
  frame = false,
  selectedLocationId = null,
  matchingIds = null,
  onActivateLocation,
  onDismissLocation,
  registerMarker,
}: TerritoryInsetProps) {
  return (
    <svg
      className="territory-inset"
      x={x}
      y={y}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="group"
      aria-label={label}
    >
      {/* Mismo tratamiento que el mapa principal: el mar rellena el fondo
          completo del recuadro, detrás de la silueta (005-plan.md → punto 3). */}
      <rect className="territory-inset__sea" x={0} y={0} width={width} height={height} aria-hidden="true" />
      {frame && <path className="territory-inset__frame" d={framePath(width, height)} />}
      <path className="territory-inset__landmass" d={path} />
      <MarkerLayers
        locations={locations}
        selectedLocationId={selectedLocationId}
        matchingIds={matchingIds}
        onActivateLocation={onActivateLocation}
        onDismissLocation={onDismissLocation}
        registerMarker={registerMarker}
      />

    </svg>
  )
}

export default TerritoryInset
