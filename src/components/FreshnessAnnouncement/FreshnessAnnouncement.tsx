import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'

import { useFreshnessAnnouncement } from './use-freshness-announcement.ts'

import './FreshnessAnnouncement.scss'

interface FreshnessAnnouncementProps {
  /** `forecast.date`. */
  forecastDate: string
  freshness: ForecastFreshness
  offerReload: boolean
}

/**
 * La región viva de frescura: la única. Solo para lectores de pantalla.
 * Anuncia una vez cada cambio de estado con la página abierta, sin mover el
 * foco, y nunca el estado con el que se monta.
 *
 * Quien la monta la deja fuera de todo lo que se vuelve inerte u oculto: una
 * región dentro de un subárbol `inert` o `aria-hidden` sale del árbol de
 * accesibilidad y no se anuncia.
 */
function FreshnessAnnouncement({ forecastDate, freshness, offerReload }: FreshnessAnnouncementProps) {
  const announcement = useFreshnessAnnouncement(forecastDate, freshness, offerReload)

  return (
    <p className="freshness-announcement" aria-live="polite">
      {announcement}
    </p>
  )
}

export default FreshnessAnnouncement
