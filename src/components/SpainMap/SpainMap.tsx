import { useMemo } from 'react'

import type { Forecast } from '../../domain/types.ts'

import { buildLocationViews } from './location-views.ts'

import LocationMarker from './components/LocationMarker.tsx'
import TerritoryInset from './components/TerritoryInset.tsx'

import { locations } from '../../data/locations.ts'
import { ROOT_VIEW_BOX, canaryBox, northAfricaContext, provinceBoundariesPath, territoryPaths } from '../../data/map-geometry.ts'

import './SpainMap.scss'

interface SpainMapProps {
  forecast: Forecast
}

// España, Baleares, Ceuta y Melilla comparten el mismo color (son España);
// Portugal y Andorra llevan el suyo propio (005-plan.md → punto 3). Cada
// territorio sigue siendo su propio `<path>` (`territoryPaths`,
// `build-map.ts`) — la agrupación es solo de estilo, no de geometría.
const TERRITORY_COUNTRY: Record<keyof typeof territoryPaths, 'es' | 'pt' | 'ad'> = {
  spain: 'es',
  portugal: 'pt',
  andorra: 'ad',
  'balearic-islands': 'es',
  ceuta: 'es',
  melilla: 'es',
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
 * península. Responsive vía `viewBox` — el mismo SVG escala junto con el
 * resto de la composición (raíz fluida, `_reset.scss`), sin JS de resize.
 *
 * `role="group"` en el SVG raíz, no `role="img"`: con `role="img"` los 74
 * `LocationMarker` de dentro (cada uno con su propio nombre accesible)
 * quedarían ocultos como descendientes de una única imagen.
 */
// Punto más bajo del contenido real del mapa: el recuadro de Canarias
// remata más abajo que el contexto norteafricano (ambos coinciden con el
// borde inferior de `northAfricaContext.clip`, ver `build-map.ts`) — el
// mar se detiene aquí, no en el borde inferior del `viewBox`.
const seaBottom = canaryBox.y + canaryBox.height

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
      // La caja del `<svg>` se recorta a la altura real con contenido
      // (`seaBottom`), no a `ROOT_VIEW_BOX.height` completo: por debajo de
      // `seaBottom` el `viewBox` solo reserva aire (`BOTTOM_BAND`,
      // 004-plan.md), y `align-items: stretch` (App.scss) usa la caja del
      // `<svg>` para igualar la altura de la leyenda a la del mapa — sin
      // este recorte, la leyenda (que sí rellena toda su caja de azul)
      // se veía más larga que el mapa. `preserveAspectRatio="… slice"`
      // hace que sea un recorte de verdad (mismo ancho/escala que antes),
      // no un reencuadre que reduzca el mapa para caber en una caja más
      // baja; no se toca `ROOT_VIEW_BOX` ni ninguna coordenada de
      // `map-geometry.ts`.
      style={{ aspectRatio: `${ROOT_VIEW_BOX.width} / ${seaBottom}` }}
      preserveAspectRatio="xMidYMin slice"
      role="group"
      aria-label="Mapa de España, Portugal y Andorra con el Pokémon del tiempo de cada lugar"
    >
      <defs>
        <clipPath id="north-africa-context-clip">
          <rect x={northAfricaContext.clip.x} y={northAfricaContext.clip.y} width={northAfricaContext.clip.width} height={northAfricaContext.clip.height} />
        </clipPath>
      </defs>
      {/* El mar cubre el fondo de todo el contenido real del mapa — primer
          elemento, detrás de toda la geometría de tierra (005-plan.md →
          punto 3) — pero se detiene donde termina Canarias/el contexto
          norteafricano (`seaBottom`), no en el borde inferior del
          `viewBox`: por debajo de ese punto el `viewBox` solo reserva aire
          (`BOTTOM_BAND`, 004-plan.md), y rellenarlo de azul se veía como un
          bloque de mar vacío y desproporcionado. */}
      <rect
        className="spain-map__sea"
        x={ROOT_VIEW_BOX.x}
        y={ROOT_VIEW_BOX.y}
        width={ROOT_VIEW_BOX.width}
        height={seaBottom - ROOT_VIEW_BOX.y}
        aria-hidden="true"
      />
      {/* Geometría puramente decorativa: sin `LocationMarker`, sin nombre
          accesible propio — `aria-hidden` la saca del árbol de
          accesibilidad por completo, coherente con que no es un lugar
          del dominio (004-plan.md → "Reglas explícitas"). */}
      <g clipPath="url(#north-africa-context-clip)" aria-hidden="true">
        <path className="spain-map__north-africa-context" d={northAfricaContext.moroccoPath} />
        <path className="spain-map__north-africa-context" d={northAfricaContext.algeriaPath} />
      </g>
      {/* Un `<path>` por territorio, coloreado por país — no una única
          silueta combinada (005-plan.md → punto 3). */}
      {Object.entries(territoryPaths).map(([id, path]) => (
        <path key={id} className={`spain-map__territory spain-map__territory--${TERRITORY_COUNTRY[id as keyof typeof territoryPaths]}`} d={path} />
      ))}
      {/* Fronteras de comunidades autónomas / distritos — detalle visual de
          la misma silueta, no un lugar nuevo: sin rol propio, expuesto
          igual que el resto del `<svg>` raíz (`role="group"`). */}
      <path className="spain-map__province-boundaries" d={provinceBoundariesPath} aria-hidden="true" />
      {locationsByRegion.main.map((location) => (
        <LocationMarker
          key={location.id}
          x={location.x}
          y={location.y}
          name={location.name}
          pokemonId={location.pokemonId}
          minC={location.minC}
          maxC={location.maxC}
        />
      ))}
      <TerritoryInset {...canaryBox} label="Canarias" locations={locationsByRegion.canary} frame />
    </svg>
  )
}

export default SpainMap
