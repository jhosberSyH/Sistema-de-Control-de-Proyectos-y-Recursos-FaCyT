import type { Prioridad } from '@/components/ui/estado'

/*
 * Contrato de GET /api/inicio (vista 02). El servidor junta los datos de varios módulos para el
 * rol de quien pide; los textos de la interfaz se arman en el frontend a partir de estos datos.
 */

export type EstatusProyecto = 'Propuesta' | 'En ejecución' | 'Suspendido' | 'Finalizado'
export type EstadoSolicitud = 'Borrador' | 'Pendiente de Aprobación' | 'Aprobado' | 'Rechazado' | 'Ejecutado'

/** Pendientes del coordinador y del administrador; cada clase tiene su texto y su acción. */
export type Pendiente =
  | { clase: 'confirmar-cargos'; proyecto: string; cargos: number; monto: number; cierre: string }
  | { clase: 'solicitud-rechazada'; solicitud: string; decididaPor: string; motivo: string }
  | {
      clase: 'reserva-aprobada'
      reserva: string
      equipo: string
      proyecto: string
      inicio: string
      fin: string
    }
  | { clase: 'sin-coordinador'; proyecto: string; motivo: string; fecha: string }
  | { clase: 'plan-confirmado'; proyecto: string }

export type ResumenProyecto = {
  codigo: string
  nombre: string
  estatus: EstatusProyecto
  prioridad: Prioridad
  avance: number | null
  /** Porcentaje del presupuesto asignado; puede pasar de 100 (F2.7) */
  ejecucion: number
  gastoEjecutado: number
  presupuesto: number
}

export type ResumenReserva = {
  id: string
  equipo: string
  proyecto: string
  inicio: string
  fin: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
}

export type ResumenSolicitud = {
  id: string
  tipo: 'gasto' | 'retiro' | 'reposicion'
  descripcion: string
  monto: number | null
  estado: EstadoSolicitud
}

export type InicioCoordinador = {
  rol: 'coordinador'
  nombre: string
  cierrePeriodo: string | null
  pendientes: Pendiente[]
  proyectos: ResumenProyecto[]
  reservas: ResumenReserva[]
  solicitudes: ResumenSolicitud[]
}

/** Un pedido de la bandeja del aprobador, con lo justo para describirlo en una línea. La fecha es la del envío. */
export type PedidoBandeja =
  | { clase: 'retiro'; id: string; proyecto: string; prioridad: Prioridad; items: number; fecha: string }
  | { clase: 'gasto'; id: string; proyecto: string; prioridad: Prioridad; monto: number; fecha: string }
  | {
      clase: 'reserva'
      id: string
      proyecto: string
      prioridad: Prioridad
      equipo: string
      inicio: string
      fin: string
      fecha: string
    }
  | {
      clase: 'correccion'
      id: string
      proyecto: string
      prioridad: Prioridad
      despacho: string
      valorOriginal: string
      valorNuevo: string
      fecha: string
    }
  | { clase: 'reposicion'; id: string; insumo: string; stock: number; minimo: number; unidad: string }

export type AlertaInventario =
  | { clase: 'bajo-minimo'; insumoId: string; insumo: string; stock: number; minimo: number; unidad: string }
  | { clase: 'por-vencer'; insumoId: string; insumo: string; lote: string; vence: string; dias: number }
  | { clase: 'vencido'; insumoId: string; insumo: string; lote: string; vence: string }

export type InicioAprobador = {
  rol: 'aprobador'
  nombre: string
  decisiones: number
  contadores: { solicitudes: number; reservas: number; correcciones: number; despachos: number }
  bandeja: PedidoBandeja[]
  cierre: { periodoId: string; inicio: string; confirmados: number; total: number } | null
  alertas: AlertaInventario[]
  despachos: { solicitud: string; proyecto: string; items: string[] }[]
}

export type Actividad = {
  id: string
  descripcion: string
  detalle: string | null
  justificacion: string | null
  fecha: string
  ip: string
}

export type InicioAdministrador = {
  rol: 'administrador'
  nombre: string
  pendientes: Pendiente[]
  contadores: {
    proyectosActivos: number
    ejecucionGlobal: number
    alertasStock: number
    lotesPorVencer: number
  }
  actividad: Actividad[]
  prioridades: { codigo: string; nombre: string; prioridad: Prioridad }[]
  accesos: { cuentasActivas: number; anticipacionVencimiento: number }
}

export type Inicio = InicioCoordinador | InicioAprobador | InicioAdministrador
