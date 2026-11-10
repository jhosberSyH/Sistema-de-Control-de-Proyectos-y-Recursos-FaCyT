import { describe, expect, it } from 'vitest'
import { diaCorto, nombreMes } from '@/lib/formato'
import { horaDe, partesCaracas } from '@/lib/horarios'
import { AVISOS } from './avisos'
import { RESERVAS } from './equipos'
import { mesEnRevision } from './fechas'

describe('semilla de avisos (REV-005)', () => {
  it('el aviso de cargos nombra el mes en revisión', () => {
    const aviso = AVISOS.find((a) => a.id === 'av-1')!
    expect(aviso.titulo).toBe(`Confirma los cargos de ${nombreMes(mesEnRevision().fin)} de QUI-024`)
  })

  it('el aviso de la reserva aprobada tiene el mismo día y horario que la reserva', () => {
    const r = RESERVAS.find((x) => x.id === 'RES-050')!
    const ini = partesCaracas(r.inicio)
    const aviso = AVISOS.find((a) => a.id === 'av-3')!
    expect(aviso.detalle).toBe(
      `${diaCorto(ini.fecha)}, de ${horaDe(ini.minutos)} a ${horaDe(partesCaracas(r.fin).minutos)}, para QUI-024.`,
    )
  })
})
