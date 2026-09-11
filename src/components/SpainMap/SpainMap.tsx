import { useMemo } from 'react'

import type { Forecast } from '../../domain/types.ts'

import { buildLocationViews } from './location-views.ts'

import LocationMarker from './components/LocationMarker.tsx'
import TerritoryInset from './components/TerritoryInset.tsx'

import { locations } from '../../data/locations.ts'
import { ROOT_VIEW_BOX, canaryBox, mainMapPath, northAfricaContext, provinceBoundariesPath } from '../../data/map-geometry.ts'

import './SpainMap.scss'

interface SpainMapProps {
  forecast: Forecast
}

/**
 * El mapa de España, Portugal y Andorra: silueta geográfica real (generada
 * en build time, ver `scripts/build-map.ts`), con las fronteras internas
 * de comunidades autónomas/distritos también trazadas — ayudan a leer a
 * qué región corresponde cada punto — y el Pokémon del tiempo de cada uno
 * de los 74 lugares. Ceuta y Melilla se proyectan ya en su
 * posición geográfica real dentro del mapa principal, con una franja
 * decorativa de contexto norteafricano (Marruecos + norte de Argelia)
 * detrás — sin lugar propio, sin `LocationMarker`. Canarias, mucho más
 * lejos en la realidad, se mantiene como un recuadro aparte
 * (`TerritoryInset`), desplazado a la izquierda del ancho que ocupa la
 * península. Responsive vía `viewBox` — el mismo SVG escala en los 5
 * breakpoints, sin JS de resize.
 *
 * `role="group"` en el SVG raíz, no `role="img"`: con `role="img"` los 74
 * `LocationMarker` de dentro (cada uno con su propio nombre accesible)
 * quedarían ocultos como descendientes de una única imagen.
 */
function SpainMap({ forecast }: SpainMapProps) {
  const locationsByRegion = useMemo(() => {
    const views = buildLocationViews(locations, forecast)
    return {
      main: views.filter((view) => view.region === 'main'),
      canary: views.filter((view) => view.region === 'canary'),
    }
  }, [forecast])

  return (
    <svg
      className="spain-map"
      viewBox={`${ROOT_VIEW_BOX.x} ${ROOT_VIEW_BOX.y} ${ROOT_VIEW_BOX.width} ${ROOT_VIEW_BOX.height}`}
      role="group"
      aria-label="Mapa de España, Portugal y Andorra con el Pokémon del tiempo de cada lugar"
    >
      <defs>
        <clipPath id="north-africa-context-clip">
          <rect x={northAfricaContext.clip.x} y={northAfricaContext.clip.y} width={northAfricaContext.clip.width} height={northAfricaContext.clip.height} />
        </clipPath>
      </defs>
      {/* Geometría puramente decorativa: sin `LocationMarker`, sin nombre
          accesible propio — `aria-hidden` la saca del árbol de
          accesibilidad por completo, coherente con que no es un lugar
          del dominio (004-plan.md → "Reglas explícitas"). */}
      <g clipPath="url(#north-africa-context-clip)" aria-hidden="true">
        <path className="spain-map__north-africa-context" d={northAfricaContext.moroccoPath} />
        <path className="spain-map__north-africa-context" d={northAfricaContext.algeriaPath} />
      </g>
      <path className="spain-map__landmass" d={mainMapPath} />
      {/* Fronteras de comunidades autónomas / distritos — detalle visual de
          la misma silueta, no un lugar nuevo: sin rol propio, expuesto
          igual que el resto del `<svg>` raíz (`role="group"`). */}
      <path className="spain-map__province-boundaries" d={provinceBoundariesPath} aria-hidden="true" />
      {locationsByRegion.main.map((location) => (
        <LocationMarker key={location.id} x={location.x} y={location.y} name={location.name} pokemonId={location.pokemonId} />
      ))}
      <TerritoryInset {...canaryBox} label="Canarias" locations={locationsByRegion.canary} frame />
    </svg>
  )
}

export default SpainMap
