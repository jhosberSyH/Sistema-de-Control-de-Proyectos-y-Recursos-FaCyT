import { dia, diaEnRevision, momento } from './fechas'
import { INSUMOS, LOTES } from './inventario'
import { PROYECTOS as SEMILLA_PROYECTOS } from './proyectos'
import { USUARIOS } from './usuarios'

/**
 * Bitácora de despachos (F6.2, F6.3): una línea por insumo y lote. De aquí salen el consumo mensual y
 * el pronóstico de la ficha del insumo (F3.7) y su último movimiento.
 *
 * CONSUMO tiene el total despachado de cada insumo en los últimos meses completos, del más antiguo al
 * más reciente. La acetona trae la serie del mockup 10 (abril a octubre si hoy es noviembre). Puntas,
 * crisoles y pasta térmica tienen solo 3 meses: no alcanzan los 6 que pide el pronóstico (F1.5).
 */
export type DespachoSemilla = {
  id: string
  codigo: string
  fecha: string
  proyecto: string | null
  insumoId: string
  lote: string
  /** Negativa en un movimiento de corrección (F6.6): devuelve al lote lo registrado de más. */
  cantidad: number
  /** Quién retiró (F6.3): el personal de laboratorio no tiene cuenta, así que es un nombre. */
  retiro: string | null
  /** Aprobador que registró el despacho. */
  registradoPor: string | null
  /** En un movimiento de corrección, el despacho que corrige (RN-06: el original no cambia). */
  corrige: string | null
  observacion: string | null
}

const CONSUMO: Record<string, number[]> = {
  acetona: [2.5, 3, 3.5, 4.5, 5, 6, 5.5],
  guantes: [6, 7, 7, 8, 7, 9, 9],
  metanol: [2, 2.5, 2.5, 3, 3, 3.5, 4],
  puntas: [3, 4, 5],
  lb: [0.4, 0.5, 0.45, 0.6, 0.55, 0.6, 0.7],
  etanol: [8, 9, 10, 9.5, 11, 12, 11],
  tripsina: [0.1, 0.15, 0.1, 0.2, 0.15, 0.2, 0.25],
  cerio: [40, 60, 55, 70, 80, 90, 85],
  papel: [8, 9, 10, 9, 11, 10, 12],
  hexano: [2, 2.5, 3, 2.5, 3, 3.5, 3],
  nitrico: [0.8, 1, 1.1, 1, 1.3, 1.2, 1.4],
  amonio: [0.5, 0.4, 0.6, 0.5, 0.7, 0.6, 0.6],
  cloroformo: [1, 1.2, 0.9, 1.1, 1.3, 1.2, 1.4],
  nacl: [0.4, 0.5, 0.5, 0.6, 0.5, 0.6, 0.7],
  peptona: [0.2, 0.25, 0.2, 0.3, 0.25, 0.3, 0.35],
  glicerol: [0.3, 0.4, 0.35, 0.5, 0.4, 0.5, 0.45],
  agua: [25, 28, 30, 27, 32, 30, 35],
  petri: [60, 80, 70, 90, 85, 100, 95],
  filtro: [1, 2, 1, 2, 2, 3, 2],
  crisoles: [4, 6, 5],
  pasta: [1, 2, 1],
  isopropilico: [2, 3, 2.5, 3, 3.5, 3, 4],
  jabon: [2, 2, 3, 2.5, 3, 3, 3.5],
  etiquetas: [1, 1, 2, 1, 2, 1, 2],
}

const PROYECTOS = ['QUI-024', 'BIO-011', 'QUI-031', 'FIS-008', 'QUI-027', 'FIS-010', 'BIO-015']

/** Coordinador del proyecto: quien retira en los despachos de la semilla. */
function coordinadorDe(codigo: string | null) {
  const id = SEMILLA_PROYECTOS.find((p) => p.codigo === codigo)?.coordinadorId
  return USUARIOS.find((u) => u.id === id)?.nombre ?? null
}

/**
 * Día de la semilla, contado desde el fin del mes en revisión (-5 = cinco días antes de que acabe): así los
 * despachos del período siguen dentro de él cualquier día que se pruebe la app, y no pasan al mes siguiente.
 */
export const delPeriodo = (desdeElFin: number) => diaEnRevision(32 + desdeElFin)

const f = (
  codigo: string,
  n: number,
  hora: string,
  proyecto: string,
  insumo: string,
  lote: string,
  cantidad: number,
  linea = 1,
): DespachoSemilla => ({
  id: `${codigo.toLowerCase()}-${linea}`,
  codigo,
  fecha: momento(n, hora),
  proyecto,
  insumoId: `ins-${insumo}`,
  lote,
  cantidad,
  retiro: coordinadorDe(proyecto),
  registradoPor: 'u-apr',
  corrige: null,
  observacion: null,
})

/**
 * Líneas que tienen que existir tal cual: los despachos de QUI-024 que forman sus cargos del período
 * (vista 21, datos/cargos.ts), DES-0318 (el último movimiento de la acetona, mockup 10) y DES-0312 (el
 * despacho que corrige COR-006, mockup 15: se registraron 500 g de medio LB agar).
 */
const FIJOS: DespachoSemilla[] = [
  f('DES-0301', delPeriodo(-29), '09:15', 'QUI-024', 'cerio', 'L-0420', 100),
  f('DES-0303', delPeriodo(-26), '10:40', 'QUI-024', 'acetona', 'L-0402', 1),
  f('DES-0305', delPeriodo(-24), '14:10', 'QUI-024', 'nitrico', 'L-0377', 1),
  f('DES-0306', delPeriodo(-22), '09:50', 'QUI-024', 'filtro', 'L-0374', 1),
  f('DES-0308', delPeriodo(-19), '11:05', 'QUI-024', 'puntas', 'L-0386', 2),
  f('DES-0309', delPeriodo(-17), '15:30', 'QUI-024', 'etanol', 'L-0405', 1),
  f('DES-0310', delPeriodo(-12), '08:45', 'QUI-024', 'amonio', 'L-0371', 0.25),
  f('DES-0311', delPeriodo(-11), '13:20', 'QUI-024', 'papel', 'L-0428', 4),
  f('DES-0312', -10, '15:40', 'BIO-011', 'lb', 'L-0425', 0.5),
  f('DES-0314', delPeriodo(-9), '10:05', 'QUI-024', 'hexano', 'L-0389', 0.5),
  f('DES-0316', delPeriodo(-8), '09:30', 'QUI-024', 'guantes', 'L-0380', 2),
  f('DES-0318', delPeriodo(-5), '11:20', 'QUI-024', 'acetona', 'L-0402', 1),
  f('DES-0318', delPeriodo(-5), '11:20', 'QUI-024', 'etanol', 'L-0405', 2, 2),
  // Un despacho ya corregido (mockup 19): se registraron 70 g y se aprobó dejar 50 g, con un movimiento aparte (RN-06)
  f('DES-0297', diaEnRevision(14), '10:10', 'QUI-031', 'cerio', 'L-0420', 70),
  {
    ...f('DES-0298', diaEnRevision(16), '14:30', 'QUI-031', 'cerio', 'L-0420', -20),
    retiro: null,
    corrige: 'DES-0297',
    observacion: 'Corrección COR-005',
  },
]

/** AAAA-MM del mes que está n meses antes del actual (1 = el mes pasado). */
function mes(atras: number) {
  const [a, m] = dia(0).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 - atras, 1)).toISOString().slice(0, 7)
}

const redondear = (n: number) => Math.round(n * 1000) / 1000

/** Cada mes se reparte en dos despachos (días 8 y 21), descontando las líneas fijas de ese mes. */
function generar() {
  const lineas: Omit<DespachoSemilla, 'id' | 'codigo'>[] = []
  INSUMOS.forEach((insumo, n) => {
    const clave = insumo.id.replace('ins-', '')
    const serie = CONSUMO[clave] ?? []
    const lote = LOTES.find((l) => l.insumoId === insumo.id)?.codigo ?? 'L-0000'
    const general = insumo.tipo === 'Consumible de uso general'
    serie.forEach((total, i) => {
      const m = mes(serie.length - i)
      const fijo = FIJOS.filter((f) => f.insumoId === insumo.id && f.fecha.startsWith(m)).reduce(
        (t, f) => t + f.cantidad,
        0,
      )
      const resto = redondear(total - fijo)
      if (resto <= 0) return
      // Lo que se cuenta por pieza (unidades, bolsas, cajas, rollos) no se parte en fracciones
      const porPieza = ['unidades', 'bolsas', 'cajas', 'rollos'].includes(insumo.unidad)
      const primero = porPieza ? Math.round(resto * 0.6) : redondear(Math.round(resto * 0.6 * 100) / 100)
      for (const [dd, cantidad, k] of [
        ['08', primero, 0],
        ['21', redondear(resto - primero), 1],
      ] as const) {
        if (cantidad <= 0) continue
        const proyecto = general ? null : PROYECTOS[(n + i + k) % PROYECTOS.length]
        lineas.push({
          fecha: `${m}-${dd}T10:30:00-04:00`,
          proyecto,
          insumoId: insumo.id,
          lote,
          cantidad,
          retiro: coordinadorDe(proyecto) ?? 'Personal de laboratorio',
          registradoPor: 'u-apr',
          corrige: null,
          observacion: null,
        })
      }
    })
  })
  // Un despacho por día y proyecto, numerados en orden desde DES-0100 (los fijos van de 0301 en adelante)
  const codigos = new Map<string, string>()
  return lineas
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((l, i) => {
      const clave = `${l.fecha}|${l.proyecto ?? 'general'}`
      if (!codigos.has(clave)) codigos.set(clave, `DES-0${100 + codigos.size}`)
      return { ...l, id: `des-h${i}`, codigo: codigos.get(clave)! }
    })
}

export const DESPACHOS: DespachoSemilla[] = [...generar(), ...FIJOS]
