/**
 * Lector mínimo de TAR (formato USTAR/GNU, sin compresión) — AEMET sirve
 * `avisos_cap` como un `.tar` plano (`application/x-gtar`) que empaqueta un
 * fichero CAP XML por zona. No hace falta una librería para esto: el
 * formato es un cabecera de 512 bytes por entrada (nombre en el byte 0,
 * tamaño octal en el byte 124) seguida del contenido, redondeado al
 * siguiente bloque de 512.
 */

export interface TarEntry {
  name: string
  content: Buffer
}

export function parseTar(buffer: Buffer): TarEntry[] {
  const entries: TarEntry[] = []
  let offset = 0

  while (offset + 512 <= buffer.length) {
    const header = buffer.subarray(offset, offset + 512)
    if (header.every((byte) => byte === 0)) break // bloque final de la marca de fin de archivo

    const name = header.subarray(0, 100).toString('utf-8').replace(/\0.*$/, '')
    const sizeField = header.subarray(124, 136).toString('utf-8').replace(/\0.*$/, '').trim()
    const size = Number.parseInt(sizeField, 8) || 0

    offset += 512
    if (name && size > 0) {
      entries.push({ name, content: Buffer.from(buffer.subarray(offset, offset + size)) })
    }
    offset += Math.ceil(size / 512) * 512
  }

  return entries
}
