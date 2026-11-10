import { dia, mesAtras, momento } from './fechas'

/**
 * Períodos contables y confirmación de cargos (F7.1, F7.2).
 *
 * La revisión de un mes se hace cuando termina: durante los primeros 10 días del mes, el período en
 * revisión es el mes pasado; después, el mes en curso (como en los mockups 21 y 22, a fin de mes). Los
 * tres meses anteriores ya se cerraron y se repartieron. Así los cargos del período salen siempre de los
 * datos de la semilla, cualquier día que se pruebe.
 */
type Periodo = {
  id: string
  tipo: 'mensual' | 'trimestral'
  inicio: string
  fin: string
  estado: 'abierto' | 'en_revision' | 'cerrado' | 'prorrateado'
  abiertoEl: string | null
  abiertoPor: string | null
  cerradoEl: string | null
  cerradoPor: string | null
}

const desfase = Number(dia(0).slice(8)) <= 10 ? 1 : 0
/** Ocho días antes de que termine el mes (la revisión del mockup 22 se abrió el 23/10), nunca después de ayer. */
function apertura(fin: string) {
  const f = new Date(`${fin}T12:00:00Z`)
  f.setUTCDate(f.getUTCDate() - 8)
  const d = f.toISOString().slice(0, 10)
  return `${d < dia(-1) ? d : dia(-1)}T09:00:00-04:00`
}

const periodo = (n: number, estado: Periodo['estado']): Periodo => {
  const m = mesAtras(n)
  const cerrado = estado === 'cerrado' || estado === 'prorrateado'
  return {
    id: `per-${m.inicio.slice(0, 7)}`,
    tipo: 'mensual',
    ...m,
    estado,
    abiertoEl: apertura(m.fin),
    abiertoPor: 'u-apr',
    cerradoEl: cerrado ? `${m.fin}T17:00:00-04:00` : null,
    cerradoPor: cerrado ? 'u-apr' : null,
  }
}

export const PERIODOS: Periodo[] = [
  periodo(desfase + 3, 'prorrateado'),
  periodo(desfase + 2, 'prorrateado'),
  periodo(desfase + 1, 'prorrateado'),
  periodo(desfase, 'en_revision'),
]

const EN_REVISION = PERIODOS[PERIODOS.length - 1]

/** Proyectos que revisan sus cargos del período y si el coordinador ya los confirmó (F7.1). */
export type ConfirmacionSemilla = {
  periodoId: string
  proyecto: string
  confirmado: boolean
  confirmadoEl: string | null
  confirmadoPor: string | null
}

const c = (proyecto: string, confirmadoEl: string | null = null, confirmadoPor: string | null = null) => ({
  periodoId: EN_REVISION.id,
  proyecto,
  confirmado: confirmadoEl !== null,
  confirmadoEl,
  confirmadoPor,
})

export const CONFIRMACIONES: ConfirmacionSemilla[] = [
  c('BIO-011'),
  c('BIO-015'),
  c('QUI-024'),
  c('FIS-008'),
  c('QUI-031', momento(-7, '09:40'), 'u-qui'),
  c('FIS-010', momento(-3, '16:10'), 'u-fis'),
  c('QUI-027'),
]
