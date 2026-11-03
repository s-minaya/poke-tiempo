import { compileString } from 'sass'
import { describe, expect, it } from 'vitest'

const { css } = compileString("@use 'src/components/LocationCard/LocationCard.scss';", { loadPaths: ['.'] })
const normalizedCss = css.replace(/\s+/g, ' ').trim()

// El breakpoint sale del token, no de un literal: el contrato sigue a `_breakpoints.scss`.
const { css: tokenCss } = compileString("@use 'src/styles/abstracts/breakpoints' as bp; .probe { width: bp.$breakpoint-desktop; }", { loadPaths: ['.'] })
const desktopBreakpoint = tokenCss.match(/width: ([^;]+);/)![1]

/** El cuerpo de un bloque que empieza en `opening`, con sus llaves equilibradas. */
function blockAfter(source: string, opening: string): string {
  const start = source.indexOf(opening)
  if (start === -1) throw new Error(`No encuentro ${opening}`)

  let depth = 0
  for (let index = source.indexOf('{', start); index < source.length; index += 1) {
    if (source[index] === '{') depth += 1
    if (source[index] === '}') {
      depth -= 1
      if (depth === 0) return source.slice(source.indexOf('{', start) + 1, index).trim()
    }
  }

  throw new Error(`${opening} no cierra`)
}

const desktopMedia = `@media (min-width: ${desktopBreakpoint})`
const stackedCss = normalizedCss.slice(0, normalizedCss.indexOf('@media'))
const stackedRule = blockAfter(stackedCss, '.location-card {')
const desktopRule = blockAfter(blockAfter(normalizedCss, `${desktopMedia} {`), '.location-card {')

describe('LocationCard styles', () => {
  it('en la composición apilada va en el flujo del documento: sin posición fija ni reserva', () => {
    expect(stackedRule).not.toContain('position:')

    for (const gone of ['position: fixed', 'html:has', '@container', 'container-type', 'scroll-padding', 'sticky', '--sheet-', '--location-sheet']) {
      expect(normalizedCss).not.toContain(gone)
    }
  })

  it('en la composición apilada, Cerrar va delante del título', () => {
    expect(stackedRule).toContain('grid-template-areas: "close heading" "weather weather" "temperatures temperatures";')
    expect(stackedRule).toContain('grid-template-columns: auto minmax(0, 1fr);')
  })

  it('desde el breakpoint de escritorio la tarjeta se ancla junto al marcador y Cerrar vuelve al final', () => {
    expect(desktopRule).toContain('position: absolute;')
    expect(desktopRule).toContain('grid-template-areas: "heading close" "weather weather" "temperatures temperatures";')
    expect(desktopRule).toContain('grid-template-columns: minmax(0, 1fr) auto;')
  })
})
