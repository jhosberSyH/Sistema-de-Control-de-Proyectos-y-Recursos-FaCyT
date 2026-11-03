import { describe, expect, it } from 'vitest'
import { elDia, leerMonto } from './formato'

describe('leerMonto: montos escritos como en Venezuela', () => {
  it.each([
    ['9.500,00', 9500],
    ['9500', 9500],
    ['9.500', 9500],
    ['9500,5', 9500.5],
    ['1.234.567,89', 1234567.89],
    ['9500.5', 9500.5],
    ['US$ 1.200', 1200],
  ])('%s → %d', (texto, valor) => {
    expect(leerMonto(texto)).toBe(valor)
  })

  it.each(['', 'abc', '-5', '9,5,5x'])('"%s" no es un monto', (texto) => {
    expect(leerMonto(texto)).toBeNull()
  })
})

describe('elDia: plazos relativos a hoy', () => {
  const ahora = new Date('2026-10-31T15:00:00-04:00')
  it('hoy, mañana o la fecha', () => {
    expect(elDia('2026-10-31', ahora)).toBe('hoy, sábado 31/10')
    expect(elDia('2026-11-01', ahora)).toBe('mañana, domingo 01/11')
    expect(elDia('2026-11-05', ahora)).toBe('el jueves 05/11')
  })
})
