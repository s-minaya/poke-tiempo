import { describe, expect, it } from 'vitest'

import { parseTar } from './tar.ts'

// Cabecera TAR mínima: solo se rellenan los campos que `parseTar` lee
// (nombre en el byte 0, tamaño octal en el byte 124) — es lo único que
// necesita un lector de solo lectura, no hace falta un tar 100% conforme
// al estándar (checksum, uid/gid, etc.) para probarlo.
function buildTarHeader(name: string, size: number): Buffer {
  const header = Buffer.alloc(512)
  header.write(name, 0, 'utf-8')
  header.write(`${size.toString(8).padStart(11, '0')}\0`, 124, 'utf-8')
  return header
}

function buildTar(entries: Array<{ name: string; content: string }>): Buffer {
  const parts: Buffer[] = []
  for (const entry of entries) {
    const content = Buffer.from(entry.content, 'utf-8')
    parts.push(buildTarHeader(entry.name, content.length))
    parts.push(content)
    const padding = (512 - (content.length % 512)) % 512
    if (padding > 0) parts.push(Buffer.alloc(padding))
  }
  parts.push(Buffer.alloc(1024)) // dos bloques de ceros: marca de fin de archivo
  return Buffer.concat(parts)
}

describe('parseTar', () => {
  it('lee varias entradas con su nombre y contenido exactos', () => {
    const tar = buildTar([
      { name: 'zona-a.xml', content: '<alert>a</alert>' },
      { name: 'zona-b.xml', content: '<alert>b</alert>' },
    ])

    const entries = parseTar(tar)

    expect(entries).toHaveLength(2)
    expect(entries[0]).toEqual({ name: 'zona-a.xml', content: Buffer.from('<alert>a</alert>') })
    expect(entries[1]).toEqual({ name: 'zona-b.xml', content: Buffer.from('<alert>b</alert>') })
  })

  it('lee contenido que no es múltiplo de 512 bytes (respeta el relleno)', () => {
    const longContent = 'x'.repeat(600) // cruza un límite de bloque de 512
    const tar = buildTar([{ name: 'largo.xml', content: longContent }])

    const entries = parseTar(tar)

    expect(entries).toHaveLength(1)
    expect(entries[0].content.toString('utf-8')).toBe(longContent)
  })

  it('un tar vacío (solo la marca de fin) no devuelve entradas', () => {
    expect(parseTar(Buffer.alloc(1024))).toEqual([])
  })
})
