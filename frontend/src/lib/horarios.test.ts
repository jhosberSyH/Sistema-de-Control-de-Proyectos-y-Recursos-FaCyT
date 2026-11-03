import { describe, expect, it } from 'vitest'
import { horaDe, instante, lunesDe, partesCaracas, rangosLibres, seCruzan } from './horarios'

describe('horarios de reserva (F4.4)', () => {
  it('con una reserva de 09:00 a 11:00, quedan libres 07:00 a 09:00 y 11:00 a 18:00 (mockup 12)', () => {
    const libres = rangosLibres([{ desde: 540, hasta: 660 }], 600)
    expect(libres.map((r) => `${horaDe(r.desde)} a ${horaDe(r.hasta)}`)).toEqual([
      '07:00 a 09:00',
      '11:00 a 18:00',
    ])
  })

  it('ordena los libres por cercanía al horario pedido y descarta huecos de menos de 30 min', () => {
    const libres = rangosLibres(
      [
        { desde: 420, hasta: 600 },
        { desde: 615, hasta: 900 },
      ],
      960,
    )
    expect(libres).toEqual([{ desde: 900, hasta: 1080 }])
  })

  it('un rango que termina cuando empieza otro no choca', () => {
    const a = { inicio: instante('2026-11-04', '09:00'), fin: instante('2026-11-04', '11:00') }
    expect(
      seCruzan(a, { inicio: instante('2026-11-04', '11:00'), fin: instante('2026-11-04', '13:00') }),
    ).toBe(false)
    expect(
      seCruzan(a, { inicio: instante('2026-11-04', '10:00'), fin: instante('2026-11-04', '12:00') }),
    ).toBe(true)
  })

  it('la semana empieza el lunes, y el domingo pasa a la siguiente', () => {
    expect(lunesDe('2026-10-28')).toBe('2026-10-26')
    expect(lunesDe('2026-11-01')).toBe('2026-11-02')
    expect(partesCaracas('2026-11-04T11:30:00-04:00')).toEqual({ fecha: '2026-11-04', minutos: 690 })
  })
})
