/**
 * Los anuncios de una región viva, contados en el DOM: lo que hace hablar a
 * un lector de pantalla es que el contenido de la región cambie, no que
 * React vuelva a pintar. Un render que deja el mismo texto no muta nada y no
 * cuenta.
 *
 * Se llama a `announcements()` después de cada paso del test: si el paso
 * cambió el contenido, se añade el texto que quedó.
 */
export function watchLiveRegion(region: Element) {
  const announced: string[] = []
  let pending = 0
  const observer = new MutationObserver((records) => {
    pending += records.length
  })
  observer.observe(region, { childList: true, characterData: true, subtree: true })

  return {
    announcements(): string[] {
      pending += observer.takeRecords().length
      if (pending > 0) announced.push(region.textContent ?? '')
      pending = 0
      return [...announced]
    },
    disconnect() {
      observer.disconnect()
    },
  }
}
