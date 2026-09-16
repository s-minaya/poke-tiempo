import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'

import App from './App.tsx'

describe('App', () => {
  it('renders without crashing', () => {
    render(<App />)

    expect(screen.getByRole('heading', { name: 'POKETIEMPO' })).toBeInTheDocument()
    expect(screen.getByRole('contentinfo')).toBeInTheDocument()
  })
})
