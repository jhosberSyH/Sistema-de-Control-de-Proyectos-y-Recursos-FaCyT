import { CARGOS, diaDelReparto } from './cargos'
import { PERIODOS } from './cierre'

/**
 * Repartos de gastos compartidos ya aplicados (F7.3, F7.4): uno por período repartido, con el criterio,
 * el total y la parte de cada proyecto. Las partes son los cargos "compartido" de datos/cargos.ts; el
 * resumen del reparto (reportes, F8.3) sale de aquí.
 */
export type RepartoSemilla = {
  periodoId: string
  criterio: 'consumo' | 'iguales'
  total: number
  aplicadoEl: string
  aplicadoPor: string
  filas: { proyecto: string; consumo: number; porcentaje: number; monto: number }[]
}

const redondear = (n: number) => Math.round(n * 100) / 100

export const REPARTOS: RepartoSemilla[] = PERIODOS.filter((p) => p.estado === 'prorrateado').map((p) => {
  const aplicado = diaDelReparto(p)
  const partes = CARGOS.filter((c) => c.tipo === 'compartido' && c.fecha === aplicado).sort((a, b) =>
    a.proyecto.localeCompare(b.proyecto),
  )
  const total = redondear(partes.reduce((t, c) => t + c.monto, 0))
  return {
    periodoId: p.id,
    criterio: 'consumo',
    total,
    aplicadoEl: `${aplicado}T10:30:00-04:00`,
    aplicadoPor: 'u-apr',
    // Según el consumo: cada parte es proporcional a lo que el proyecto consumió en el período
    filas: partes.map((c) => ({
      proyecto: c.proyecto,
      consumo: redondear(c.monto * 1.26),
      porcentaje: total ? Math.round((c.monto / total) * 1000) / 10 : 0,
      monto: c.monto,
    })),
  }
})
