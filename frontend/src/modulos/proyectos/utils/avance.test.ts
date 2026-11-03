import { describe, expect, it } from 'vitest'
import { avanceFisico, leerEntero } from './avance'

describe('avance físico por hitos ponderados (F2.6)', () => {
  it('HU-05: peso 60 al 50 % y peso 40 al 100 % dan 70 %', () => {
    expect(
      avanceFisico([
        { peso: 60, avance: 50 },
        { peso: 40, avance: 100 },
      ]),
    ).toBe(70)
  })

  it('lleva un decimal: QUI-024 con el hito 3 al 85 % pasa de 62 % a 66,5 %', () => {
    const qui024 = [
      { peso: 10, avance: 100 },
      { peso: 25, avance: 100 },
      { peso: 30, avance: 70 },
      { peso: 25, avance: 24 },
      { peso: 10, avance: 0 },
    ]
    expect(avanceFisico(qui024)).toBe(62)
    expect(avanceFisico(qui024.map((h, i) => (i === 2 ? { ...h, avance: 85 } : h)))).toBe(66.5)
  })

  it('solo acepta enteros', () => {
    expect(leerEntero(' 15 ')).toBe(15)
    expect(leerEntero('')).toBeNull()
    expect(leerEntero('12,5')).toBeNull()
    expect(leerEntero('-3')).toBeNull()
  })
})
