/** Reportes de la vista 24: análisis de gastos (F8.2), resumen del reparto (F8.3) y hoja de vida (F8.4). */
export type TipoReporte = 'gastos' | 'reparto' | 'hoja-de-vida'

/** GET /api/reportes/opciones: lo que el usuario puede incluir según su rol (RN-07). */
export type OpcionesReporte = {
  alcance: 'propios' | 'todos'
  proyectos: { id: string; codigo: string; nombre: string; estatus: string }[]
  /** Los repartidos tienen resumen; los cerrados sin repartir salen marcados (HU-25). */
  periodos: { id: string; nombre: string; repartido: boolean }[]
  equipos: { id: string; nombre: string; codigo: string }[]
  sugerido: { desde: string; hasta: string }
}

export type FiltrosReporte = {
  tipo: TipoReporte
  desde: string
  hasta: string
  /** "todos", "activos" o el UUID de un proyecto (al servidor va como proyectoIds). */
  proyectos: string
  periodo: string
  equipo: string
}

/** GET /api/reportes/vista-previa: la primera página del PDF, o por qué no hay datos. */
export type VistaPrevia = {
  titulo: string
  lineas: string[]
  columnas: { titulo: string; numerica: boolean }[]
  filas: string[][]
  nota: string | null
  paginas: number
  vacio: { titulo: string; detalle: string } | null
}

/** Acciones que registra la auditoría (RF-04). */
export type AccionAuditoria = 'creacion' | 'edicion' | 'cambio-estado' | 'sesion'

export type FiltrosAuditoria = { usuario: string; accion: string; objeto: string; desde: string }

export type RegistroAuditoria = {
  id: string
  fecha: string
  /** null: lo hizo el sistema (una reposición automática, por ejemplo). */
  usuario: { nombre: string; rol: string } | null
  ip: string | null
  accion: AccionAuditoria
  /** "Cambio de prioridad", "Inicio de sesión"… */
  etiqueta: string
  /** "Proyecto BIO-011", "Solicitud SOL-121 a Aprobado" */
  objeto: string
  /** El código dentro del objeto, que va en mono. */
  codigo: string | null
  /** A dónde lleva el objeto, si el Administrador puede abrirlo. */
  enlace: string | null
  descripcion: string
  detalle: string | null
  justificacion: string | null
  valorAnterior: string | null
  valorNuevo: string | null
}

/** GET /api/auditoria (vista 25) */
export type PaginaAuditoria = {
  total: number
  filtrados: number
  pagina: number
  paginas: number
  porPagina: number
  registros: RegistroAuditoria[]
  usuarios: { id: string; nombre: string }[]
}

export type PrioridadProyecto = 'Crítica' | 'Alta' | 'Media' | 'Baja'

/** GET /api/dashboard (vista 03, F8.1) */
export type Dashboard = {
  periodos: { valor: string; etiqueta: string }[]
  periodo: string
  /** Proyectos activos (RN-05) con la prioridad elegida, del que más ejecutó al que menos. */
  proyectos: {
    /** UUID: para enlazar a la ficha. */
    id: string
    codigo: string
    nombre: string
    prioridad: PrioridadProyecto
    presupuesto: number
    gasto: number
  }[]
  /** Gasto ejecutado por mes del período; el mes en curso trae hasta qué día. */
  meses: { clave: string; etiqueta: string; etiquetaLarga: string; valor: number; hasta: string | null }[]
  /** Insumos bajo su mínimo (F3.4) y su reposición abierta (F3.5). */
  stock: {
    id: string
    nombre: string
    unidad: string
    stock: number
    minimo: number
    /** id: UUID; numero: lo que se muestra (REP-2026-0003). */
    reposicion: { id: string; numero: string; estado: string } | null
  }[]
  /** Lotes vencidos y por vencer dentro de la anticipación (F3.6). */
  vencimientos: { lote: string; insumoId: string; insumo: string; vence: string; dias: number }[]
  /** Días de anticipación de la alerta de vencimiento (F1.5). */
  anticipacion: number
  actualizado: string
}
