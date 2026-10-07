import { describe, expect, it } from 'vitest'
import { render, screen, within } from '@testing-library/react'

import Credits from './Credits.tsx'

describe('Credits', () => {
  it('muestra la autoría de la cuenta original y el disclaimer de Pokémon', () => {
    render(<Credits />)

    expect(screen.getByText('PokéTiempo original: Gabriel Ortega Díaz')).toBeInTheDocument()
    expect(
      screen.getByText(
        'PokéTiempo es un proyecto fan no oficial, sin afiliación ni patrocinio de los titulares de los derechos de Pokémon. Pokémon, sus personajes y sus nombres pertenecen a sus respectivos titulares.',
      ),
    ).toBeInTheDocument()
  })

  it('no lleva la cita de los datos ni ningún enlace: la cita va bajo el mapa', () => {
    render(<Credits />)

    const footer = screen.getByRole('contentinfo')
    expect(footer).not.toHaveTextContent('Datos meteorológicos')
    expect(within(footer).queryAllByRole('link')).toHaveLength(0)
  })

  it('usa un <footer> semántico', () => {
    render(<Credits />)

    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
