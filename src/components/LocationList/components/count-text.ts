// Cuánto espera la región viva a que el recuento deje de cambiar: escribir
// una palabra no debe anunciar un recuento por tecla.
export const COUNT_ANNOUNCEMENT_DELAY_MS = 500

/** «74 lugares» sin filtros, «8 de 74 lugares» o «Ningún lugar coincide». */
export function countText(total: number, matchCount: number | null): string {
  if (matchCount === null) return `${total} lugares`
  if (matchCount === 0) return 'Ningún lugar coincide'
  return `${matchCount} de ${total} lugares`
}
