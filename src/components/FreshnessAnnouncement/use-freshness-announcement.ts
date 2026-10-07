import { useState } from 'react'

import type { ForecastFreshness, FreshnessStatus } from '../../domain/forecast-freshness.ts'

import { announceFreshness } from '../FreshnessNotice/freshness-texts.ts'

interface Announcement {
  /** El estado del último anuncio, o el de partida si todavía no ha habido ninguno. */
  status: FreshnessStatus
  text: string
}

/**
 * El texto de la región viva de frescura. Empieza vacío: el estado con el que
 * se monta ya está en la página y no se anuncia. Cambia solo cuando cambia
 * el `status`, y entonces dice el estado nuevo una vez; recalcular el mismo
 * estado no vuelve a anunciarlo. No es un historial: guarda solo el último.
 *
 * Que cambien solo los días de retraso, sin cambiar el estado, no se anuncia.
 */
export function useFreshnessAnnouncement(forecastDate: string, freshness: ForecastFreshness, offerReload: boolean): string {
  const [announcement, setAnnouncement] = useState<Announcement>({ status: freshness.status, text: '' })

  // Ajuste durante el render, no en un efecto: el anuncio llega en el mismo
  // pintado que el estado nuevo.
  if (announcement.status !== freshness.status) {
    setAnnouncement({ status: freshness.status, text: announceFreshness(forecastDate, freshness, offerReload) })
  }

  return announcement.text
}
