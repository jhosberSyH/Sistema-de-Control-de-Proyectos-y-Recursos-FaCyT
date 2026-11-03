export type TipoSolicitud = 'gasto' | 'retiro'
export type EstadoSolicitud = 'Borrador' | 'Pendiente de Aprobación' | 'Aprobado' | 'Rechazado' | 'Ejecutado'
export const ESTADOS_SOLICITUD: EstadoSolicitud[] = [
  'Borrador',
  'Pendiente de Aprobación',
  'Aprobado',
  'Rechazado',
  'Ejecutado',
]

/** Una fila de "Mis solicitudes" (GET /api/solicitudes). */
export type FilaSolicitud = {
  id: string
  tipo: TipoSolicitud
  proyecto: string
  /** "Etanol 96 %, acetona" o "Nitrato de cerio hexahidratado, US$ 640,00" */
  detalle: string
  estado: EstadoSolicitud
  /** Último cambio (guardado, envío o decisión). */
  fecha: string
  motivoRechazo: string | null
  despacho: string | null
}

/** Insumo que se puede pedir, con lo que hay para despachar (F5.2). */
export type InsumoPedido = {
  id: string
  nombre: string
  unidad: string
  disponible: number
  reposicionEnCurso: boolean
}

export type ProyectoPropio = { codigo: string; nombre: string; ejecucion: number }

export type ListaSolicitudes = {
  items: FilaSolicitud[]
  conteos: Record<'Todas' | EstadoSolicitud, number>
  misProyectos: ProyectoPropio[]
  insumos: InsumoPedido[]
}

export type LineaRetiro = { insumoId: string; cantidad: number }

/** GET /api/solicitudes/:id */
export type Solicitud = {
  id: string
  tipo: TipoSolicitud
  proyecto: string
  estado: EstadoSolicitud
  fecha: string
  resumen: string
  lineas: LineaRetiro[]
  proposito: string | null
  insumoServicio: string | null
  cantidadGasto: string | null
  monto: number | null
  justificacion: string | null
  cotizacion: string | null
  motivoRechazo: string | null
  decididaPor: string | null
  despacho: string | null
}

/** Lo que guarda el borrador (F5.1, F5.2): siempre el formulario completo. */
export type ContenidoBorrador = {
  proyecto: string
  lineas?: LineaRetiro[]
  proposito?: string | null
  insumoServicio?: string | null
  cantidadGasto?: string | null
  monto?: number | null
  justificacion?: string | null
  cotizacion?: string | null
}
