import { useCallback, useEffect, useRef } from 'react'
import type { RefObject } from 'react'

/**
 * Al seleccionarse, que el marcador o la fila que se acaba de activar no
 * quede debajo de la hoja inferior de la composición apilada (WCAG 2.4.11).
 * `nearest` respeta el hueco que reserva `scroll-padding` mientras la hoja
 * está abierta (`LocationCard.scss`), y no mueve nada si el elemento ya se
 * ve. No lee ninguna medida.
 *
 * Depende de qué se activó, no de dónde está el foco: Safari y los
 * navegadores táctiles no enfocan un botón al tocarlo, y la fila tocada
 * quedaría tapada igual. Devuelve la función que el elemento llama al
 * activarse (clic, toque, Intro o Espacio), antes de cambiar la selección.
 *
 * jsdom no implementa `scrollIntoView`.
 */
export function useRevealWhenSelected(element: RefObject<Element | null>, selected: boolean): () => void {
  const activated = useRef(false)

  useEffect(() => {
    const node = element.current
    if (selected && activated.current && node) node.scrollIntoView?.({ block: 'nearest' })
    activated.current = false
  }, [element, selected])

  return useCallback(() => {
    activated.current = true
  }, [])
}
