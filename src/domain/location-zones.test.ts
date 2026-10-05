import { describe, expect, it } from 'vitest'

import { LOCATION_ZONES } from './location-zones.ts'

describe('LOCATION_ZONES', () => {
  it('son 21 zonas sin repetir', () => {
    expect(LOCATION_ZONES).toHaveLength(21)
    expect(new Set(LOCATION_ZONES).size).toBe(21)
  })

  it('las 19 comunidades y ciudades autónomas van por orden alfabético en español, y después Portugal y Andorra', () => {
    const spanish = LOCATION_ZONES.slice(0, 19)
    expect(spanish).toEqual([...spanish].sort((a, b) => a.localeCompare(b, 'es')))
    expect(LOCATION_ZONES.slice(19)).toEqual(['Portugal', 'Andorra'])
  })
})
