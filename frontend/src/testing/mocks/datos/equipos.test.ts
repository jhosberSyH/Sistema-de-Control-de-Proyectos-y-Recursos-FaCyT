import { afterEach, describe, expect, it, vi } from 'vitest'
import { diaSemana } from '@/lib/horarios'
import { dia } from './fechas'
import { primerDiaHabil } from './equipos'

afterEach(() => vi.useRealTimers())

describe('semilla de reservas', () => {
  it('el primer día hábil siempre es posterior a hoy y nunca cae en domingo', () => {
    // Dos semanas seguidas, a primera y a última hora del día
    for (let d = 0; d < 14; d++) {
      for (const hora of ['08:00', '23:30']) {
        vi.useFakeTimers()
        const base = new Date(Date.parse('2026-11-01T12:00:00-04:00') + d * 86_400_000)
        vi.setSystemTime(new Date(base.getTime() + (hora === '08:00' ? -4 : 11) * 3_600_000))
        const hoy = dia(0)
        const proximo = primerDiaHabil()
        expect(proximo > hoy, `${hoy} → ${proximo}`).toBe(true)
        expect(diaSemana(proximo), `${hoy} → ${proximo}`).not.toBe(0)
      }
    }
  })
})
