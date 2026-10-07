import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { FreshnessStatus } from '../../domain/forecast-freshness.ts'

import { watchLiveRegion } from '../../test/watch-live-region.ts'

import FreshnessAnnouncement from './FreshnessAnnouncement.tsx'

const DATE = '2026-10-05'

function region(container: HTMLElement) {
  return container.querySelector<HTMLElement>('.freshness-announcement')!
}

describe('FreshnessAnnouncement', () => {
  it.each([
    { status: 'tomorrow', daysLate: 0, offerReload: false },
    { status: 'today', daysLate: 0, offerReload: false },
    { status: 'late', daysLate: 1, offerReload: true },
    { status: 'very-late', daysLate: 2, offerReload: true },
    { status: 'unknown', daysLate: 0, offerReload: false },
  ] as const)('montada en $status: educada y vacía', ({ status, daysLate, offerReload }) => {
    const { container } = render(<FreshnessAnnouncement forecastDate={DATE} freshness={{ status, daysLate }} offerReload={offerReload} />)

    expect(region(container)).toHaveAttribute('aria-live', 'polite')
    expect(region(container)).toBeEmptyDOMElement()
  })

  it('anuncia el estado nuevo una vez por cambio; el mismo estado otra vez, o solo otros días de retraso, no', () => {
    const { container, rerender } = render(<FreshnessAnnouncement forecastDate={DATE} freshness={{ status: 'tomorrow', daysLate: 0 }} offerReload={false} />)
    const live = watchLiveRegion(region(container))
    const show = (status: FreshnessStatus, daysLate: number, offerReload: boolean) =>
      rerender(<FreshnessAnnouncement forecastDate={DATE} freshness={{ status, daysLate }} offerReload={offerReload} />)

    // El mismo estado en un objeto nuevo, como si se hubiera recalculado.
    show('tomorrow', 0, false)
    expect(live.announcements()).toEqual([])

    show('today', 0, false)
    expect(live.announcements()).toEqual(['Previsión para el lunes 5 de octubre, hoy.'])

    show('today', 0, false)
    show('today', 0, false)
    expect(live.announcements()).toHaveLength(1)

    show('very-late', 2, true)
    show('very-late', 3, true)
    expect(live.announcements()).toHaveLength(2)
    expect(live.announcements()[1]).toContain('Esta previsión lleva 2 días de retraso.')
    live.disconnect()
  })

  it('anunciar no mueve el foco', () => {
    const { container, rerender } = render(
      <>
        <button type="button">Antes</button>
        <FreshnessAnnouncement forecastDate={DATE} freshness={{ status: 'today', daysLate: 0 }} offerReload={false} />
      </>,
    )
    const button = screen.getByRole('button', { name: 'Antes' })
    button.focus()

    rerender(
      <>
        <button type="button">Antes</button>
        <FreshnessAnnouncement forecastDate={DATE} freshness={{ status: 'late', daysLate: 1 }} offerReload />
      </>,
    )

    expect(region(container)).not.toBeEmptyDOMElement()
    expect(button).toHaveFocus()
  })
})
