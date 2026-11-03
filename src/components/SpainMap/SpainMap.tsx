import { useCallback, useLayoutEffect, useMemo, useRef } from 'react'
import type { CSSProperties } from 'react'

import type { SelectionOrigin } from '../WeatherApp/location-filters.ts'
import type { LocationView } from '../../domain/location-views.ts'
import type { Forecast } from '../../domain/types.ts'

import { buildLocationViews } from '../../domain/location-views.ts'

import LocationCard from '../LocationCard/LocationCard.tsx'
import { announceLocation, summarizeView } from '../LocationCard/location-summary.ts'
import MarkerLayers from './components/MarkerLayers.tsx'
import TerritoryInset from './components/TerritoryInset.tsx'
import { MARKER_SILHOUETTE_FILTER_ID, MARKER_SILHOUETTE_MATRIX } from './components/marker-silhouette.ts'
import { SPRITE_SIZE } from './components/marker-size.ts'
import { MAP_ASPECT, MAP_SEA_BOTTOM } from './map-frame.ts'

import { locations } from '../../data/locations.ts'
import { ROOT_VIEW_BOX, canaryBox, northAfricaContext, provinceBoundariesPath, territoryPaths } from '../../data/map-geometry.ts'

import './SpainMap.scss'

interface SpainMapProps {
  forecast: Forecast
  /** El lugar cuya tarjeta está abierta, o `null`. El estado vive en `WeatherApp`. */
  selectedLocationId?: string | null
  /**
   * Los lugares que cumplen los filtros (`location-filters.ts`): el resto
   * pasa a sombra. `null`, sin filtros: los 74 como siempre.
   */
  matchingIds?: ReadonlySet<string> | null
  /** Activar un marcador: lo selecciona, o cierra la tarjeta si ya lo estaba. `keyboard` dice si fue con Intro o Espacio. */
  onToggleLocation?: (id: string, keyboard: boolean) => void
  onClearLocation?: () => void
  /** Por dónde se abrió la tarjeta (`WeatherApp`): adónde vuelven la vista y el foco al cerrarla desde ella. */
  selectionOrigin?: SelectionOrigin
  /** La fila de un lugar en «Todos los lugares», si está en la lista. */
  findRow?: (id: string) => HTMLElement | null
}

const ORIGIN_MAP: SelectionOrigin = { via: 'map', keyboard: false }

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
 * península. Responsive vía `viewBox` — el mismo SVG escala con la caja que
 * le da `SpainMap.scss`, sin JS de resize.
 *
 * `role="group"` en el SVG raíz, no `role="img"`: con `role="img"` los 74
 * `LocationMarker` de dentro (cada uno con su propio nombre accesible)
 * quedarían ocultos como descendientes de una única imagen.
 */
// Medio sprite, en fracción del ancho del mapa: lo que la tarjeta anclada
// tiene que dejar libre para no tapar al Pokémon que describe.
const ANCHOR_CLEARANCE = SPRITE_SIZE / 2 / ROOT_VIEW_BOX.width

/**
 * Dónde está el marcador, en fracciones del mapa dibujado (0–1 en cada eje):
 * lo que la tarjeta necesita para anclarse a su lado solo con CSS. Los de
 * Canarias viven en el `<svg>` anidado del recuadro, a la misma escala, así
 * que basta con sumarles su esquina.
 */
function anchorOf(view: LocationView): { x: number; y: number } {
  const x = view.region === 'canary' ? canaryBox.x + view.x : view.x
  const y = view.region === 'canary' ? canaryBox.y + view.y : view.y
  return { x: (x - ROOT_VIEW_BOX.x) / ROOT_VIEW_BOX.width, y: (y - ROOT_VIEW_BOX.y) / MAP_SEA_BOTTOM }
}

/**
 * Si la tarjeta está en el flujo del documento (composición apilada) o anclada
 * junto a su marcador (escritorio). Lo decide el CSS; aquí solo se lee para
 * saber si tiene sentido desplazar la página hasta ella, porque la anclada ya
 * se ve donde está su marcador.
 */
function isInFlow(card: HTMLElement | null): boolean {
  return card !== null && getComputedStyle(card).position !== 'absolute'
}

/** Si el elemento está entero dentro de la ventana, sin tener que desplazarse a él. */
function isWithinViewport(element: Element): boolean {
  const box = element.getBoundingClientRect()
  return box.top >= 0 && box.bottom <= document.documentElement.clientHeight
}

function SpainMap({
  forecast,
  selectedLocationId = null,
  matchingIds = null,
  onToggleLocation,
  onClearLocation,
  selectionOrigin = ORIGIN_MAP,
  findRow,
}: SpainMapProps) {
  const views = useMemo(() => buildLocationViews(locations, forecast), [forecast])
  const locationsByRegion = useMemo(
    () => ({
      main: views.filter((view) => view.region === 'main'),
      canary: views.filter((view) => view.region === 'canary'),
    }),
    [views],
  )

  const selectedView = selectedLocationId ? views.find((view) => view.id === selectedLocationId) : undefined
  const summary = selectedView ? summarizeView(selectedView) : null
  const anchor = selectedView ? anchorOf(selectedView) : null

  // Los 74 marcadores se registran aquí: son el sitio al que vuelven la vista y
  // el foco cuando la tarjeta se abrió desde el mapa.
  const markers = useRef(new Map<string, SVGGElement>())
  const registerMarker = useCallback((id: string, element: SVGGElement | null) => {
    if (element) markers.current.set(id, element)
    else markers.current.delete(id)
  }, [])

  const card = useRef<HTMLElement | null>(null)
  const closeButton = useRef<HTMLButtonElement | null>(null)
  const attribution = useRef<HTMLParagraphElement | null>(null)

  // Adónde vuelve la vista al cerrar desde la tarjeta: la fila o el marcador
  // desde el que se abrió.
  const returnTo = useRef<{ element: Element; inline: ScrollLogicalPosition } | null>(null)
  // Dónde estaba la atribución, que va justo debajo de la tarjeta, cuando se
  // quitó la tarjeta sin volver a ningún sitio.
  const belowBefore = useRef<number | null>(null)
  // El lugar cuyo detalle se mostró por última vez, y si iba en el flujo.
  const shown = useRef<{ id: string; inFlow: boolean } | null>(null)
  // Si el detalle se cerró con Escape en un marcador, que conserva el foco.
  const escapedFromMarker = useRef(false)
  const dismissFromMarker = useCallback(() => {
    if (shown.current) escapedFromMarker.current = true
    onClearLocation?.()
  }, [onClearLocation])

  // El efecto de la selección solo debe repetirse cuando cambia la selección:
  // el origen y la búsqueda de filas, que lo acompañan, se leen aquí.
  const host = useRef({ origin: selectionOrigin, findRow })
  useLayoutEffect(() => {
    host.current = { origin: selectionOrigin, findRow }
  })

  // En la composición apilada la tarjeta está en el flujo: al seleccionar, la
  // página se desplaza hasta su comienzo, desde el mapa y desde la lista, sin
  // tocar el zoom. Desde el mapa, que está encima, basta el mínimo
  // (`nearest`). Desde la lista, que está debajo, `nearest` alinea el borde
  // inferior si la tarjeta es más alta que la ventana visual (pinch alto en una
  // pantalla pequeña) y recorta su comienzo: se alinea siempre el superior
  // (`start`). Si se abrió con teclado, el foco va a Cerrar: se quedaría en
  // el origen, fuera de la vista. Con puntero, toque o tecnología de asistencia
  // no se mueve. Al cerrarla desde la propia tarjeta, la vista y el foco
  // vuelven al origen. Si se cierra desde otro sitio (pulsar otra vez la fila,
  // Escape, un filtro) no hay vuelta, pero lo que había debajo de la tarjeta
  // sube lo que ella medía: se compensa para que lo que el usuario mira no se
  // mueva.
  useLayoutEffect(() => {
    const { origin, findRow: rowOf } = host.current

    if (selectedLocationId) {
      belowBefore.current = null
      escapedFromMarker.current = false
      const inFlow = isInFlow(card.current)
      shown.current = { id: selectedLocationId, inFlow }
      if (inFlow) {
        card.current?.scrollIntoView?.({ block: origin.via === 'list' ? 'start' : 'nearest', inline: 'start' })
        if (origin.keyboard) closeButton.current?.focus({ preventScroll: true })
      }
      return
    }

    const closed = shown.current
    const back = returnTo.current
    const before = belowBefore.current
    const escaped = escapedFromMarker.current
    shown.current = null
    returnTo.current = null
    belowBefore.current = null
    escapedFromMarker.current = false

    if (back) {
      if (back.element.isConnected) back.element.scrollIntoView?.({ block: 'center', inline: back.inline })
      return
    }
    const now = attribution.current?.getBoundingClientRect().top
    if (before !== null && now !== undefined && Math.abs(now - before) > 0.5) window.scrollBy(0, now - before)

    // Escape (o Intro) en la fila con el detalle abierto lo cierra y deja el
    // foco en ella, que pudo quedar lejos de la vista al ir al detalle: se
    // lleva a la vista, ya compensado lo de debajo. Lo mismo con Escape en el
    // marcador; otros cierres desde el marcador no se mueven.
    const row = closed?.inFlow ? rowOf?.(closed.id) : null
    if (row && row === document.activeElement && !isWithinViewport(row)) row.scrollIntoView?.({ block: 'center', inline: 'start' })
    const marker = escaped && closed?.inFlow ? markers.current.get(closed.id) : null
    if (marker && marker === document.activeElement && !isWithinViewport(marker)) marker.scrollIntoView?.({ block: 'center', inline: 'center' })
  }, [selectedLocationId])

  // La tarjeta avisa justo antes de salir del DOM, cuando aún se puede medir.
  // Solo hace falta compensar si empezaba por encima de lo que se ve.
  const rememberBelow = useCallback(() => {
    const node = card.current
    if (!node || !isInFlow(node) || node.getBoundingClientRect().top >= 0) return
    belowBefore.current = attribution.current?.getBoundingClientRect().top ?? null
  }, [])

  // Si el foco estaba dentro de la tarjeta, caería al `<body>` al
  // desmontarse: vuelve a quien la abrió —la fila, si se abrió desde la
  // lista; saltar al mapa haría perder el sitio— o, si no, a su marcador. Si
  // el foco estaba fuera (un toque que no enfoca el botón), no se mueve nada.
  // Con la tarjeta en el flujo, enfocar no desplaza: de eso se ocupa la vuelta.
  const closeCard = useCallback(() => {
    const row = selectionOrigin.via === 'list' && selectedLocationId ? findRow?.(selectedLocationId) : null
    const marker = selectedLocationId ? markers.current.get(selectedLocationId) : undefined
    const back: HTMLElement | SVGElement | null = row ?? marker ?? null
    const inFlow = isInFlow(card.current)

    if (back && inFlow) returnTo.current = { element: back, inline: row ? 'start' : 'center' }
    if (card.current?.contains(document.activeElement)) back?.focus({ preventScroll: inFlow })
    onClearLocation?.()
  }, [selectedLocationId, selectionOrigin, findRow, onClearLocation])

  // El envoltorio es quien lleva `grid-area` y quien se dimensiona: el
  // `<svg>` solo rellena lo que le den. Expone su relación de aspecto real
  // para que el CSS pueda acotar su alto sin duplicar las cifras de
  // `map-geometry.ts`.
  return (
    <div className="spain-map" style={{ '--map-aspect': MAP_ASPECT } as CSSProperties}>
      {/* El dibujo y su atribución, juntos: en dos columnas se apoyan al
          final de la celda y acompañan al scroll (`SpainMap.scss`). */}
      <div className="spain-map__body">
        {/* El dibujo y su tarjeta, en la caja en la que la tarjeta se ancla:
            mide lo que el dibujo, sin la atribución de debajo. */}
        <div className="spain-map__drawing">
          {/* El contenedor de consulta es solo el dibujo (`SpainMap.scss`): la
              tarjeta y la región viva, que son sus hermanas, quedan fuera. */}
          <div className="spain-map__viewport">
            <svg
              className="spain-map__canvas"
              viewBox={`${ROOT_VIEW_BOX.x} ${ROOT_VIEW_BOX.y} ${ROOT_VIEW_BOX.width} ${ROOT_VIEW_BOX.height}`}
              // La caja del `<svg>` se recorta a la altura real con contenido
              // (`MAP_SEA_BOTTOM`), no a `ROOT_VIEW_BOX.height` completo: por debajo de
              // `MAP_SEA_BOTTOM` el `viewBox` solo reserva aire (`BOTTOM_BAND`,
              // 004-plan.md). Sin el recorte, la caja del mapa sería más alta que
              // el dibujo: alargaría la fila de la leyenda en dos columnas, y la
              // tarjeta anclada, que se coloca en fracciones de ese alto, dejaría
              // de medir el dibujo. `preserveAspectRatio="… slice"` hace que sea
              // un recorte de verdad, al mismo ancho y escala, no un reencuadre
              // que reduzca el mapa para caber en una caja más baja; no se toca
              // `ROOT_VIEW_BOX` ni ninguna coordenada de `map-geometry.ts`.
              style={{ aspectRatio: `${ROOT_VIEW_BOX.width} / ${MAP_SEA_BOTTOM}` }}
              preserveAspectRatio="xMidYMin slice"
              role="group"
              aria-label="Mapa de España, Portugal y Andorra con el Pokémon del tiempo de cada lugar"
            >
              <defs>
                <clipPath id="north-africa-context-clip">
                  <rect x={northAfricaContext.clip.x} y={northAfricaContext.clip.y} width={northAfricaContext.clip.width} height={northAfricaContext.clip.height} />
                </clipPath>
                {/* La silueta de los lugares que no cumplen los filtros. Filtro
                    SVG y no `filter` de CSS, que no se aplica igual a los
                    elementos SVG en todos los navegadores. */}
                <filter id={MARKER_SILHOUETTE_FILTER_ID}>
                  <feColorMatrix type="matrix" values={MARKER_SILHOUETTE_MATRIX} />
                </filter>
              </defs>
              {/* El mar cubre el fondo de todo el contenido real del mapa — primer
                  elemento, detrás de toda la geometría de tierra (005-plan.md →
                  punto 3) — pero se detiene donde termina Canarias/el contexto
                  norteafricano (`MAP_SEA_BOTTOM`), no en el borde inferior del
                  `viewBox`: por debajo de ese punto el `viewBox` solo reserva aire
                  (`BOTTOM_BAND`, 004-plan.md), y rellenarlo de azul se vería como un
                  bloque de mar vacío y desproporcionado. */}
              <rect
                className="spain-map__sea"
                x={ROOT_VIEW_BOX.x}
                y={ROOT_VIEW_BOX.y}
                width={ROOT_VIEW_BOX.width}
                height={MAP_SEA_BOTTOM - ROOT_VIEW_BOX.y}
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
              <MarkerLayers
                locations={locationsByRegion.main}
                selectedLocationId={selectedLocationId}
                matchingIds={matchingIds}
                onActivateLocation={onToggleLocation}
                onDismissLocation={dismissFromMarker}
                registerMarker={registerMarker}
              />
              <TerritoryInset
                {...canaryBox}
                label="Canarias"
                locations={locationsByRegion.canary}
                frame
                selectedLocationId={selectedLocationId}
                matchingIds={matchingIds}
                onActivateLocation={onToggleLocation}
                onDismissLocation={dismissFromMarker}
                registerMarker={registerMarker}
              />
            </svg>
          </div>
          {summary && anchor && (
            <LocationCard
              ref={card}
              closeRef={closeButton}
              summary={summary}
              side={anchor.x < 0.5 ? 'east' : 'west'}
              style={{ '--anchor-x': anchor.x, '--anchor-y': anchor.y, '--anchor-clearance': ANCHOR_CLEARANCE } as CSSProperties}
              onClose={closeCard}
              onRemove={rememberBelow}
            />
          )}
          {/* Siempre montada, vacía cuando no hay selección: una región viva
              solo anuncia cambios si ya existía antes de que llegaran. */}
          <p className="spain-map__announcement" aria-live="polite">
            {summary ? announceLocation(summary) : ''}
          </p>
        </div>
        {/* Atribución común de los datos que dibuja el mapa y que repiten la
            leyenda, la tarjeta, la lista y Oak: una sola, junto al mapa, que
            es donde se muestran los de todos los lugares a la vez
            (`tech-stack.md` → Legal). */}
        <p ref={attribution} className="spain-map__attribution">
          Datos meteorológicos: AEMET · IPMA ·{' '}
          <a className="spain-map__attribution-link" href="https://open-meteo.com/">
            Open-Meteo.com
          </a>{' '}
          (
          <a className="spain-map__attribution-link" href="https://creativecommons.org/licenses/by/4.0/">
            CC BY 4.0
          </a>
          ), adaptados para el mapa.
        </p>
      </div>
    </div>
  )
}

export default SpainMap
