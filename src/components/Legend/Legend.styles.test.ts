import { compileString } from 'sass'
import { describe, expect, it } from 'vitest'

const { css } = compileString("@use 'src/components/Legend/Legend.scss';", { loadPaths: ['.'] })
const normalizedCss = css.replace(/\s+/g, ' ').toLowerCase()

describe('Legend styles', () => {
  it('usa la banda de la atribución en la composición apilada', () => {
    expect(normalizedCss).toMatch(/\.legend \{ [^}]*background: #dcf5f9;/)
  })

  it('recupera el azul del mapa desde el breakpoint real de dos columnas', () => {
    expect(normalizedCss).toMatch(/@media \(min-width: calc\(18\.25em \+ 1063px \+ 17px\)\) \{ \.legend \{ background: #b9fffd; \} \}/)
  })
})
