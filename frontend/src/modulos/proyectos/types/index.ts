import type { Prioridad } from '@/components/ui/estado'

export type Area = 'Física' | 'Química' | 'Biología'
export type Estatus = 'Propuesta' | 'En ejecución' | 'Suspendido' | 'Finalizado'

export const AREAS: Area[] = ['Física', 'Química', 'Biología']
export const ESTATUS: Estatus[] = ['En ejecución', 'Propuesta', 'Suspendido', 'Finalizado']
export const PRIORIDADES: Prioridad[] = ['Crítica', 'Alta', 'Media', 'Baja']

/** Un proyecto de la lista (GET /api/proyectos). */
export type ResumenProyecto = {
  codigo: string
  nombre: string
  area: Area
  estatus: Estatus
  prioridad: Prioridad
  presupuesto: number
  gastoEjecutado: number
  /** Avance físico (F2.6); null mientras el plan de hitos no esté confirmado. */
  avance: number | null
  /** Ejecución presupuestaria en % (F2.7); puede pasar de 100. */
  ejecucion: number
  planConfirmado: boolean
  coordinador: { id: string; nombre: string } | null
}

export type PaginaProyectos = {
  items: ResumenProyecto[]
  total: number
  pagina: number
  paginas: number
  porPagina: number
  /** Proyectos por estatus con los demás filtros aplicados, para los botones de arriba. */
  conteos: Record<'Todos' | Estatus, number>
}

export type FiltrosProyectos = {
  q: string
  area: Area | ''
  prioridad: Prioridad | ''
  estatus: Estatus | ''
  pagina: number
}

/** Cuenta activa con rol Coordinador, para asignarla (F2.2). */
export type Coordinador = { id: string; nombre: string; proyectos: number }

export type ConflictoCodigo = { proyecto: { codigo: string; nombre: string } }

export type Hito = {
  id: string
  numero: number
  nombre: string
  peso: number
  fechaPrevista: string
  /** Último avance cargado, de 0 a 100 (F2.5). */
  avance: number
}

/** Línea de "Movimientos recientes": un cargo o una carga de avance. */
export type Movimiento = {
  id: string
  fecha: string
  texto: string
  referencia: string | null
  monto: number | null
  nota: string | null
  tipo: string
}

/** GET /api/proyectos/:codigo (vista 07). */
export type FichaProyecto = ResumenProyecto & {
  registradoEl: string
  hitos: Hito[]
  sumaPesos: number
  proximoHito: Omit<Hito, 'id'> | null
  /** F2.7: de dónde sale el gasto ejecutado. */
  desglose: { gastos: number; despachos: number; compartidos: number }
  movimientos: Movimiento[]
  /** Estatus a los que puede pasar (F2.3) y, si todavía no se puede, por qué. */
  transiciones: { estatus: Estatus; bloqueo: string | null }[]
}

export type CargoProyecto = {
  id: string
  fecha: string
  tipo: 'gasto' | 'despacho' | 'compartido'
  concepto: string
  referencia: string | null
  monto: number
}

export type ReservaProyecto = {
  id: string
  equipo: string
  inicio: string
  fin: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
}

export type EventoProyecto = {
  id: string
  fecha: string
  descripcion: string
  justificacion: string | null
  ip: string
}

/** Un hito en el plan (vista 08): con su última carga y cuántas tiene. */
export type HitoPlan = Hito & {
  ultimaCarga: string | null
  /** Con cargas de avance, el hito ya no se puede quitar del plan (F2.5: no se borran). */
  cargas: number
}

/** GET /api/proyectos/:codigo/plan (vista 08). */
export type PlanProyecto = {
  codigo: string
  nombre: string
  estatus: Estatus
  planConfirmado: boolean
  /** Avance físico (F2.6); null mientras el plan no esté confirmado. */
  avance: number | null
  hitos: HitoPlan[]
}

/** Una carga de avance de un hito (F2.5). */
export type CargaAvance = {
  id: string
  fecha: string
  porcentaje: number
  comentario: string | null
  usuario: string
}

/** Respuesta al cargar un avance: el avance físico del proyecto antes y después (F2.6). */
export type ResultadoCarga = { hito: number; antes: number | null; despues: number | null; completo: boolean }
