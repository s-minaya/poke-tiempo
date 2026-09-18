import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import type { Forecast } from '../../domain/types.ts'

import WeatherApp from './WeatherApp.tsx'

import forecastData from '../../data/forecast.json'

describe('WeatherApp', () => {
  it('renders without crashing', () => {
    render(<WeatherApp forecast={forecastData as Forecast} />)

    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
