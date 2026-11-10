import { nombreMes } from '@/lib/formato'
import { PERIODOS } from './cierre'
import { delPeriodo } from './despachos'
import { dia, diasDesdeHoy } from './fechas'
import { PROYECTOS } from './proyectos'

/**
 * Cargos de cada proyecto: lo que suma su gasto ejecutado (F2.7). Tres orígenes: solicitudes de gasto
 * ejecutadas, insumos despachados y su parte de los gastos compartidos (prorrateo).
 *
 * QUI-024 trae el desglose del mockup 07 (US$ 3.150 + 1.402 + 260 = 4.812) y, en el mes en curso, los
 * 12 cargos por US$ 1.284,50 que revisa su coordinadora antes del cierre (inicio, vista 21).
 * Los demás proyectos reparten su gasto ejecutado 60 / 30 / 10 % entre compras, despachos y gastos
 * compartidos; las compras y los despachos, en los últimos cuatro meses, y los compartidos, en los
 * repartos de los tres períodos ya repartidos (datos/repartos.ts).
 */
export type TipoCargo = 'gasto' | 'despacho' | 'compartido'

export type CargoSemilla = {
  id: string
  proyecto: string
  fecha: string
  tipo: TipoCargo
  concepto: string
  /** Solicitud o despacho que lo originó (SOL-112, DES-0318); null en los gastos compartidos. */
  referencia: string | null
  monto: number
}

const c = (
  proyecto: string,
  enDias: number,
  tipo: TipoCargo,
  concepto: string,
  referencia: string | null,
  monto: number,
): CargoSemilla => ({
  id: `cg-${proyecto}-${referencia ?? `${tipo}${enDias}`}`,
  proyecto,
  fecha: dia(enDias),
  tipo,
  concepto,
  referencia,
  monto,
})

/** Períodos ya repartidos, del más antiguo al más reciente. */
const REPARTIDOS = PERIODOS.filter((p) => p.estado === 'prorrateado')

/** Día en que se aplicó el reparto de un período: el siguiente a su fin. */
export function diaDelReparto(p: { fin: string }) {
  const f = new Date(`${p.fin}T12:00:00Z`)
  f.setUTCDate(f.getUTCDate() + 1)
  return f.toISOString().slice(0, 10)
}

/** La parte de un proyecto en el reparto del período k (0 = el más antiguo de los tres). */
const compartido = (proyecto: string, k: number, monto: number) => {
  const p = REPARTIDOS[k]
  return c(
    proyecto,
    diasDesdeHoy(diaDelReparto(p)),
    'compartido',
    `Gastos compartidos de ${nombreMes(p.inicio)}`,
    null,
    monto,
  )
}

const QUI_024: CargoSemilla[] = [
  // Solicitudes de gasto ejecutadas: US$ 3.150,00
  c('QUI-024', -10, 'gasto', 'Nitrato de cerio hexahidratado', 'SOL-112', 640),
  c('QUI-024', -43, 'gasto', 'Crisoles de alúmina, 10 unidades', 'SOL-104', 410),
  c('QUI-024', -72, 'gasto', 'Horno de mufla, mantenimiento', 'SOL-098', 1250),
  c('QUI-024', -108, 'gasto', 'Patrones de difracción certificados', 'SOL-091', 850),
  // Gastos compartidos de los meses anteriores: US$ 260,00
  compartido('QUI-024', 2, 92),
  compartido('QUI-024', 1, 88),
  compartido('QUI-024', 0, 80),
  // Insumos despachados: US$ 1.402,00 (los 11 del período en revisión suman US$ 644,50). Son los
  // despachos fijos de datos/despachos.ts, con las mismas fechas y cantidades.
  c('QUI-024', delPeriodo(-5), 'despacho', 'Acetona grado analítico 1 L, etanol 96 % 2 L', 'DES-0318', 38.4),
  c('QUI-024', delPeriodo(-8), 'despacho', 'Guantes de nitrilo talla M 2 cajas', 'DES-0316', 54.35),
  c('QUI-024', delPeriodo(-9), 'despacho', 'Hexano grado reactivo 0,5 L', 'DES-0314', 38.5),
  c('QUI-024', delPeriodo(-11), 'despacho', 'Papel absorbente 4 rollos', 'DES-0311', 29.9),
  c('QUI-024', delPeriodo(-12), 'despacho', 'Hidróxido de amonio 28 % 0,25 L', 'DES-0310', 96),
  c('QUI-024', delPeriodo(-17), 'despacho', 'Etanol 96 % 1 L', 'DES-0309', 47.25),
  c('QUI-024', delPeriodo(-19), 'despacho', 'Puntas de micropipeta 200 µL 2 bolsas', 'DES-0308', 58.8),
  c('QUI-024', delPeriodo(-22), 'despacho', 'Papel de filtro cualitativo 1 caja', 'DES-0306', 33.6),
  c('QUI-024', delPeriodo(-24), 'despacho', 'Ácido nítrico 65 % 1 L', 'DES-0305', 120.5),
  c('QUI-024', delPeriodo(-26), 'despacho', 'Acetona grado analítico 1 L', 'DES-0303', 42),
  c('QUI-024', delPeriodo(-29), 'despacho', 'Nitrato de cerio hexahidratado 100 g', 'DES-0301', 85.2),
  c('QUI-024', -47, 'despacho', 'Agua desionizada 20 L', 'DES-0280', 222),
  c('QUI-024', -64, 'despacho', 'Hidróxido de amonio 1 L', 'DES-0262', 145),
  c('QUI-024', -87, 'despacho', 'Vidrio de reloj, 12 unidades', 'DES-0245', 180.5),
  c('QUI-024', -111, 'despacho', 'Nitrato de cerio 50 g', 'DES-0221', 210),
]

const redondear = (n: number) => Math.round(n * 100) / 100

/** Reparte un total según los pesos; el último se lleva el residuo del redondeo. */
function partes(total: number, pesos: number[]) {
  const montos = pesos.map((w) => redondear(total * w))
  montos[montos.length - 1] = redondear(total - montos.slice(0, -1).reduce((t, m) => t + m, 0))
  return montos
}

const MESES = [0.3, 0.25, 0.25, 0.2]

/** Cargos que suman el gasto ejecutado del proyecto, repartidos en los últimos meses. */
function generico(proyecto: string, gasto: number): CargoSemilla[] {
  if (gasto <= 0) return []
  const despacho = redondear(gasto * 0.3)
  const compartidos = redondear(gasto * 0.1)
  const compras = redondear(gasto - despacho - compartidos)
  return [
    ...partes(compras, MESES).map((m, i) =>
      c(proyecto, -14 - 31 * i, 'gasto', 'Compra de reactivos y materiales', null, m),
    ),
    ...partes(despacho, MESES).map((m, i) =>
      c(proyecto, -27 - 31 * i, 'despacho', 'Insumos despachados del almacén', null, m),
    ),
    ...partes(compartidos, [1 / 3, 1 / 3, 1 / 3]).map((m, k) => compartido(proyecto, k, m)),
  ]
}

export const CARGOS: CargoSemilla[] = PROYECTOS.flatMap((p) =>
  p.codigo === 'QUI-024' ? QUI_024 : generico(p.codigo, p.gastoEjecutado),
)
