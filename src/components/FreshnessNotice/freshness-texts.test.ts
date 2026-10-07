import { describe, expect, it } from 'vitest'

import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'

import { announceFreshness } from './freshness-texts.ts'

const RELOAD = 'Esta página sigue mostrando la previsión del lunes 5 de octubre. Recarga para comprobar si hay una más reciente.'

describe('announceFreshness', () => {
  it.each<{ freshness: ForecastFreshness; offerReload: boolean; text: string }>([
    { freshness: { status: 'tomorrow', daysLate: 0 }, offerReload: false, text: 'Previsión para el lunes 5 de octubre, mañana.' },
    { freshness: { status: 'today', daysLate: 0 }, offerReload: false, text: 'Previsión para el lunes 5 de octubre, hoy.' },
    {
      freshness: { status: 'late', daysLate: 1 },
      offerReload: false,
      text: 'Previsión para el lunes 5 de octubre, atrasada. Esta previsión corresponde al lunes 5 de octubre y lleva 1 día de retraso.',
    },
    {
      freshness: { status: 'late', daysLate: 1 },
      offerReload: true,
      text: `Previsión para el lunes 5 de octubre, atrasada. Esta previsión corresponde al lunes 5 de octubre y lleva 1 día de retraso. ${RELOAD}`,
    },
    {
      freshness: { status: 'very-late', daysLate: 2 },
      offerReload: false,
      text: 'Previsión para el lunes 5 de octubre, atrasada. Esta previsión lleva 2 días de retraso. Corresponde al lunes 5 de octubre.',
    },
    {
      freshness: { status: 'very-late', daysLate: 2 },
      offerReload: true,
      text: `Previsión para el lunes 5 de octubre, atrasada. Esta previsión lleva 2 días de retraso. Corresponde al lunes 5 de octubre. ${RELOAD}`,
    },
    { freshness: { status: 'unknown', daysLate: 0 }, offerReload: false, text: 'Previsión para el lunes 5 de octubre.' },
  ])('$freshness.status, con oferta de recargar: $offerReload', ({ freshness, offerReload, text }) => {
    expect(announceFreshness('2026-10-05', freshness, offerReload)).toBe(text)
  })
})
