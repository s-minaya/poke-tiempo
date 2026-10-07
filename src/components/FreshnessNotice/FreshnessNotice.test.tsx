import { describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen } from '@testing-library/react'

import type { ForecastFreshness } from '../../domain/forecast-freshness.ts'
import FreshnessNotice from './FreshnessNotice.tsx'

const LATE: ForecastFreshness = { status: 'late', daysLate: 1 }
const VERY_LATE: ForecastFreshness = { status: 'very-late', daysLate: 3 }

const RELATIVE_DAY_WORD = /(?<![\p{L}\p{N}])(hoy|mañana|ayer)(?![\p{L}\p{N}])/iu
const PUBLISHED_VERSION_CLAIM = /más reciente publicad|era la más reciente|versión nueva|hay una nueva/i

describe('FreshnessNotice', () => {
  it('con dos días de retraso o más: el bloque fuerte, con los días y la fecha absoluta', () => {
    render(<FreshnessNotice freshness={VERY_LATE} forecastDate="2026-10-03" offerReload={false} />)

    const notice = screen.getByRole('region', { name: 'Esta previsión lleva 3 días de retraso.' })
    expect(notice).toHaveTextContent('Corresponde al sábado 3 de octubre.')
    expect(screen.queryByRole('button', { name: 'Recargar' })).not.toBeInTheDocument()
  })

  it('la oferta de recargar dice qué previsión muestra la página, sin afirmar que haya otra', () => {
    const { container } = render(<FreshnessNotice freshness={LATE} forecastDate="2026-10-05" offerReload />)

    expect(container).toHaveTextContent(
      'Esta página sigue mostrando la previsión del lunes 5 de octubre. Recarga para comprobar si hay una más reciente.',
    )
    expect(screen.getByRole('button', { name: 'Recargar' })).toBeInTheDocument()
    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
  })

  it('con dos días o más y la oferta a la vez, todo va en el mismo bloque', () => {
    render(<FreshnessNotice freshness={VERY_LATE} forecastDate="2026-10-03" offerReload />)

    const notice = screen.getByRole('region', { name: 'Esta previsión lleva 3 días de retraso.' })
    expect(notice).toHaveTextContent('Corresponde al sábado 3 de octubre.')
    expect(notice).toHaveTextContent('Esta página sigue mostrando la previsión del sábado 3 de octubre.')
    expect(notice).toContainElement(screen.getByRole('button', { name: 'Recargar' }))
  })

  it('«Recargar» recarga solo al pulsarlo', () => {
    const onReload = vi.fn()
    render(<FreshnessNotice freshness={LATE} forecastDate="2026-10-05" offerReload onReload={onReload} />)

    expect(onReload).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Recargar' }))
    expect(onReload).toHaveBeenCalledTimes(1)
  })

  it('los iconos no se anuncian', () => {
    const { container } = render(<FreshnessNotice freshness={VERY_LATE} forecastDate="2026-10-03" offerReload />)

    for (const icon of container.querySelectorAll('svg')) {
      expect(icon).toHaveAttribute('aria-hidden', 'true')
    }
  })

  it.each([
    { label: 'dos días o más', freshness: VERY_LATE, offerReload: false },
    { label: 'oferta de recargar', freshness: LATE, offerReload: true },
    { label: 'dos días o más con la oferta', freshness: VERY_LATE, offerReload: true },
  ])('$label: ni hoy, ni mañana, ni ayer, ni nada sobre lo publicado', ({ freshness, offerReload }) => {
    const { container } = render(<FreshnessNotice freshness={freshness} forecastDate="2026-10-03" offerReload={offerReload} />)

    expect(container.textContent).not.toMatch(RELATIVE_DAY_WORD)
    expect(container.textContent).not.toMatch(PUBLISHED_VERSION_CLAIM)
  })
})
