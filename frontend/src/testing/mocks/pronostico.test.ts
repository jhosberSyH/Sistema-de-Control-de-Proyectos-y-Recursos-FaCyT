import { describe, expect, it } from 'vitest'
import { pronosticar } from './pronostico'

describe('pronóstico de consumo (F3.7)', () => {
  it('sigue la tendencia de la acetona del mockup 10 y da un intervalo alrededor', () => {
    const p = pronosticar([2.5, 3, 3.5, 4.5, 5, 6, 5.5])
    expect(p.valor).toBe(6.1)
    expect(p.minimo).toBeLessThan(p.valor)
    expect(p.maximo).toBeGreaterThan(p.valor)
  })

  it('con un consumo parejo pronostica ese mismo consumo', () => {
    expect(pronosticar([4, 4, 4, 4, 4, 4])).toEqual({ valor: 4, minimo: 4, maximo: 4 })
  })
})
