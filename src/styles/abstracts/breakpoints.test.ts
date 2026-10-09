import { compileString } from 'sass'
import { describe, expect, it } from 'vitest'

// Compila los módulos reales y lee lo que emiten: los valores de las medidas
// de las que salen los puntos de corte de columnas, de leyenda partida y de
// pantallas anchas, y las media queries que generan. Si una medida cambia y un
// punto de corte no la sigue —o se escribe como literal—, la combinación deja
// de cuadrar.
const { css } = compileString(
  `@use 'variables' as vars;
  @use 'breakpoints' as bp;
  @use 'reset';

  .tokens {
    root: vars.$root-font-size;
    legend: bp.$legend-column-width;
    threshold: bp.$map-temperature-threshold;
    allowance: bp.$scrollbar-allowance;
    large: bp.$breakpoint-desktop-large;
    split: bp.$legend-split-width;
  }

  @include bp.respond-from(bp.$breakpoint-desktop-columns) {
    .columns {
      grid: columns;
    }
  }

  @include bp.respond-from(bp.$breakpoint-desktop-wide) {
    .wide {
      grid: wide;
    }
  }

  @include bp.respond-between(bp.$breakpoint-legend-split, bp.$breakpoint-desktop-wide) {
    .split {
      grid: split;
    }
  }`,
  { loadPaths: ['src/styles/abstracts'] },
)

function token(name: string, unit: string): number {
  const match = css.match(new RegExp(`${name}: ([\\d.]+)${unit};`))
  if (!match) throw new Error(`No encuentro ${name} en ${unit} en el CSS compilado`)
  return Number(match[1])
}

/** Los términos del `calc()` de la media query, sumados por unidad. */
function columnsBreakpoint(): Record<string, number> {
  const match = css.match(/@media \(min-width: calc\((.+?)\)\) \{\s*\.columns/)
  if (!match) throw new Error('No encuentro la media query de dos columnas en el CSS compilado')
  const sums: Record<string, number> = {}
  for (const term of match[1].split(' + ')) {
    const [, value, unit] = term.match(/^([\d.]+)([a-z]+)$/) ?? []
    if (!unit) throw new Error(`Término inesperado en la media query: ${term}`)
    sums[unit] = (sums[unit] ?? 0) + Number(value)
  }
  return sums
}

describe('punto de corte de dos columnas', () => {
  it('es la columna de la leyenda, en em de media query, más el umbral del mapa y el margen de la barra', () => {
    const root = token('root', '%') / 100
    const legend = token('legend', 'rem')
    const threshold = token('threshold', 'px')
    const allowance = token('allowance', 'px')

    const breakpoint = columnsBreakpoint()

    expect(Object.keys(breakpoint).sort()).toEqual(['em', 'px'])
    expect(breakpoint.em).toBeCloseTo(legend * root, 6)
    expect(breakpoint.px).toBeCloseTo(threshold + allowance, 6)
  })

  it('la raíz de la página usa el mismo tamaño que la conversión a em', () => {
    expect(css).toMatch(new RegExp(`html \\{\\s*font-size: ${token('root', '%')}%;`))
  })
})

/** Una medida en `rem` de la página, en el `em` de una media query. */
function mediaEm(name: string): number {
  return Number((token(name, 'rem') * (token('root', '%') / 100)).toFixed(6))
}

/** `$breakpoint-desktop-wide`, tal como lo emite Sass. */
function wideBreakpoint(): string {
  const large = token('large', 'px')
  return `calc(${large}px + 2 * (${large}px - ${mediaEm('legend')}em - ${token('threshold', 'px')}px))`
}

describe('punto de corte de pantallas anchas', () => {
  it('es el tope más el doble del mar que deja junto a la leyenda la composición de dos columnas: el tope menos la leyenda, en em de media query, y el umbral del mapa', () => {
    expect(css).toContain(`@media (min-width: ${wideBreakpoint()}) {\n  .wide {`)
  })
})

describe('leyenda partida', () => {
  it('va desde el ancho en que caben entre los bordes de la ventana la leyenda partida y el mapa que llena su celda, el tope menos la columna de la leyenda, hasta las pantallas anchas', () => {
    const split = `calc(${token('large', 'px')}px - ${mediaEm('legend')}em + ${mediaEm('split')}em)`

    expect(css).toContain(`@media (min-width: ${split}) and (width < ${wideBreakpoint()}) {\n  .split {`)
  })
})
