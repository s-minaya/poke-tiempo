import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import Credits from './Credits.tsx'

describe('Credits', () => {
  it('muestra las dos líneas de crédito', () => {
    render(<Credits />)

    expect(screen.getByText('Datos meteorológicos: AEMET · IPMA · Open-Meteo')).toBeInTheDocument()
    expect(screen.getByText('PokéTiempo original: Gabriel Ortega Díaz')).toBeInTheDocument()
  })

  it('usa un <footer> semántico', () => {
    render(<Credits />)

    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
