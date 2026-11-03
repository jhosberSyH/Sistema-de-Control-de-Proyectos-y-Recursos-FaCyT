export type TipoPeriodo = 'mensual' | 'trimestral'

/** Estados del período contable (F7.1 a F7.4). */
export type EstadoPeriodo = 'abierto' | 'en_revision' | 'cerrado' | 'prorrateado'

export type Periodo = {
  id: string
  tipo: TipoPeriodo
  /** Fechas ISO (AAAA-MM-DD) */
  inicio: string
  fin: string
  estado: EstadoPeriodo
}

/** Período con quién abrió la revisión (vistas 21 y 22). */
export type PeriodoRevision = Periodo & { abiertoEl: string | null; abiertoPor: string | null }

export type EstadoConfirmacion = 'confirmado' | 'por-confirmar' | 'correccion' | 'sin-coordinador'

/** GET /api/cierre/cargos (vista 21, Coordinador) */
export type CargosCierre = {
  periodo: PeriodoRevision | null
  /** El aprobador que cierra el período. */
  cierra: string | null
  proyectos: {
    codigo: string
    estado: EstadoConfirmacion
    confirmadoEl: string | null
    /** Correcciones pendientes de sus despachos: mientras haya una, no se confirma. */
    correcciones: string[]
    cargos: number
    monto: number
  }[]
  proyecto: string | null
  cargos: {
    id: string
    fecha: string
    concepto: string
    referencia: string | null
    tipo: 'gasto' | 'despacho' | 'compartido'
    monto: number
  }[]
}

/** GET /api/cierre (vista 22, Aprobador) */
export type TableroCierre = {
  periodo: PeriodoRevision | null
  filas: {
    proyecto: string
    coordinador: string | null
    estado: EstadoConfirmacion
    confirmadoEl: string | null
    cargos: number
    monto: number
  }[]
  coordinadoresPendientes: number
  /** Período cerrado que espera el reparto de gastos compartidos (F7.3). */
  porRepartir: { id: string; tipo: TipoPeriodo; inicio: string; fin: string } | null
  /** Fechas sugeridas para abrir la siguiente revisión. */
  sugerido: { inicio: string; fin: string } | null
}

/** Criterio del reparto de gastos compartidos: según el consumo (F7.3) o en partes iguales (F7.4). */
export type CriterioReparto = 'consumo' | 'iguales'

/** GET /api/reparto (vista 23, Aprobador) */
export type Reparto = {
  /** Período cerrado que espera el reparto; null si no hay ninguno. */
  periodo: (Omit<Periodo, 'estado'> & { cerradoEl: string | null }) | null
  /** El último reparto aplicado, para el estado vacío. */
  ultimo: {
    periodo: Omit<Periodo, 'estado'>
    criterio: CriterioReparto
    total: number
    aplicadoEl: string
    aplicadoPor: string
  } | null
  /** Proyectos suspendidos: no participan (RN-05). */
  excluidos: string[]
  gastos: { total: number; lotes: number; insumos: string[] } | null
  consumoTotal: number
  filas: {
    proyecto: string
    nombre: string
    consumo: number
    porcentaje: number
    /** null si nadie consumió: el criterio según el consumo no se puede calcular. */
    segunConsumo: number | null
    enPartesIguales: number
  }[]
  /** Residuo del redondeo de cada criterio: va al proyecto de código menor (F7.4). */
  residuo: { consumo: number; iguales: number } | null
}

/** POST /api/periodos/:id/reparto */
export type RepartoAplicado = {
  periodoId: string
  criterio: CriterioReparto
  total: number
  filas: { proyecto: string; consumo: number; porcentaje: number; monto: number }[]
}
