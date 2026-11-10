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
  /** UUID: va en las rutas de la API y en los enlaces (?id=). Nunca se muestra. */
  id: string
  /** Número de la solicitud (SOL-2026-0001): es lo que se muestra. */
  numero: string
  tipo: TipoSolicitud
  /** Código del proyecto (se muestra) y su UUID. */
  proyecto: string
  proyectoId: string
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

/** Un proyecto del coordinador para pedir: el UUID va al servidor, el código y el nombre se muestran. */
export type ProyectoPropio = { id: string; codigo: string; nombre: string; ejecucion: number }

export type ListaSolicitudes = {
  items: FilaSolicitud[]
  conteos: Record<'Todas' | EstadoSolicitud, number>
  misProyectos: ProyectoPropio[]
  insumos: InsumoPedido[]
}

export type LineaRetiro = { insumoId: string; cantidad: number }

/** GET /api/solicitudes/:id (id: UUID) */
export type Solicitud = {
  /** UUID, para la API y los enlaces. */
  id: string
  /** Número (SOL-2026-0001), para mostrar. */
  numero: string
  tipo: TipoSolicitud
  proyecto: string
  proyectoId: string
  estado: EstadoSolicitud
  fecha: string
  resumen: string
  lineas: LineaRetiro[]
  proposito: string | null
  insumoServicio: string | null
  cantidadGasto: string | null
  monto: number | null
  justificacion: string | null
  /** Nombre del PDF de la cotización; lo pone el servidor al subirlo (POST /api/solicitudes/:id/cotizacion). */
  cotizacion: string | null
  motivoRechazo: string | null
  decididaPor: string | null
  despacho: string | null
}

/**
 * Lo que guarda el borrador (F5.1, F5.2): siempre el formulario completo. La cotización no va aquí: se
 * sube como archivo (useSubirCotizacion).
 */
export type ContenidoBorrador = {
  /** UUID del proyecto. */
  proyectoId: string
  lineas?: LineaRetiro[]
  proposito?: string | null
  insumoServicio?: string | null
  cantidadGasto?: string | null
  monto?: number | null
  justificacion?: string | null
}

/** POST /api/solicitudes/:id/cotizacion (200): el archivo que quedó adjunto. */
export type CotizacionSubida = { nombre: string; tamano: number }
