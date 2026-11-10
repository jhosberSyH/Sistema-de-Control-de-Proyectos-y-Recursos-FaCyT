import type { Prioridad } from '@/components/ui/estado'

/** GET /api/almacen: las tareas del día del almacén (plan §7.1). */
export type Almacen = {
  lotesPorVencer: number
  lotesVencidos: number
  despachos: {
    /** Número del retiro (se muestra) y su UUID (para enlazar al despacho). */
    solicitud: string
    solicitudId: string
    /** Código del proyecto (se muestra) y su UUID. */
    proyecto: string
    proyectoId: string
    prioridad: Prioridad
    items: string[]
    aprobadaEl: string
  }[]
  /** Reposiciones aprobadas: id es el UUID (para enlazar); numero, lo que se muestra. */
  porRecibir: {
    id: string
    numero: string
    insumoId: string
    insumo: string
    cantidad: number
    unidad: string
    aprobadaEl: string
  }[]
  recientes: {
    codigo: string
    insumoId: string
    insumo: string
    cantidad: number
    unidad: string
    ingreso: string
    proveedor: string
  }[]
}

export type InsumoRecepcion = {
  id: string
  nombre: string
  unidad: string
  stock: number
  stockMinimo: number
  /** true si sus lotes vencen, false si no, null si todavía no tiene lotes. */
  vence: boolean | null
  /** Ubicación de su último lote: la sugerida para el nuevo. */
  ubicacionId: string | null
}

/** GET /api/recepciones/opciones */
export type OpcionesRecepcion = {
  insumos: InsumoRecepcion[]
  ubicaciones: { id: string; nombre: string }[]
  /** Reposiciones aprobadas que esperan la compra: se cierran al recibir el lote. id: UUID; numero: se muestra. */
  reposiciones: { id: string; numero: string; insumoId: string; cantidad: number }[]
}

export type DatosLote = {
  /** UUID de la reposición que cierra esta recepción. */
  solicitud: string | null
  insumoId: string
  loteProveedor: string
  cantidad: number
  costoUnitario: number
  proveedor: string
  ingreso: string
  vence: string | null
  ubicacionId: string
}

/** POST /api/lotes (201) */
export type LoteRegistrado = {
  codigo: string
  insumoId: string
  insumo: string
  unidad: string
  stockAntes: number
  stockDespues: number
  stockMinimo: number
  /** Números de la reposición cerrada y de la que se creó, para mostrarlos. */
  reposicion: string | null
  nuevaReposicion: string | null
}

export type LoteDespacho = {
  codigo: string
  vence: string | null
  ingreso: string
  cantidad: number
  ubicacion: string
  vencido: boolean
  /** El que sugiere el sistema: el que vence (o ingresó) primero entre los que alcanzan (F6.2). */
  sugerido: boolean
}

/** GET /api/despachos/nuevo */
export type NuevoDespacho = {
  solicitud: {
    /** UUID (va al registrar el despacho) y número (se muestra). */
    id: string
    numero: string
    proyecto: string
    proyectoId: string
    coordinador: string | null
    aprobadaEl: string
    proposito: string | null
  } | null
  lineas: {
    insumoId: string
    insumo: string
    unidad: string
    cantidad: number
    stock: number
    vence: boolean
    lotes: LoteDespacho[]
  }[]
  /** Nombres para "Quién retira": el coordinador y quienes ya retiraron para el proyecto. */
  personas: string[]
  /** El próximo retiro por despachar: su número (se muestra) y su UUID (para enlazar). */
  siguiente: string | null
  siguienteId: string | null
}

/** POST /api/despachos (201) */
export type DespachoRegistrado = {
  codigo: string
  fecha: string
  /** Número del retiro despachado (se muestra) y su UUID. */
  solicitud: string
  solicitudId: string
  proyecto: string
  proyectoId: string
  coordinador: string | null
  /** Cuándo se aprobó el retiro (subtítulo del encabezado). */
  aprobadaEl: string
  retiro: string
  monto: number
  lineas: { insumo: string; unidad: string; cantidad: number; lote: string }[]
  /** El próximo retiro por despachar: su número (se muestra) y su UUID (para enlazar). */
  siguiente: string | null
  siguienteId: string | null
}

/** Una línea de la bitácora (GET /api/bitacora): un insumo de un despacho, o un movimiento de corrección. */
export type LineaBitacora = {
  id: string
  codigo: string
  fecha: string
  /** null en los consumibles de uso general (RN-02). */
  proyecto: string | null
  proyectoId: string | null
  insumoId: string
  insumo: string
  unidad: string
  lote: string
  /** Negativa en un movimiento de corrección. */
  cantidad: number
  retiro: string | null
  /** Movimiento de corrección: el despacho que corrige y quién aprobó la corrección. */
  corrige: string | null
  aprobadaPor: string | null
  /** Despacho original ya corregido: el movimiento que lo corrige. */
  corregidoPor: string | null
  correccionPendiente: string | null
  puedeCorregir: boolean
}

export type Bitacora = {
  desde: string
  hasta: string
  resaltado: string | null
  proyectos: ProyectoOpcion[]
  filas: LineaBitacora[]
}

/** Un proyecto para elegir: el UUID va al servidor, el código y el nombre se muestran. */
export type ProyectoOpcion = { id: string; codigo: string; nombre: string }

/**
 * Filtros de la bitácora, como van en la dirección de la página. proyecto: UUID del proyecto, o "" para
 * todos (al servidor va como proyectoId).
 */
export type FiltrosBitacora = { proyecto: string; desde: string; hasta: string; q: string; despacho: string }

export type PedidoCorreccion =
  | { lineaId: string; campo: 'cantidad'; cantidadNueva: number; motivo: string }
  | { lineaId: string; campo: 'proyecto'; proyectoNuevoId: string; motivo: string }

/** GET /api/usos-materia: lo despachado y lo usado de un insumo en el mes (F6.4). */
export type UsoMateria = {
  proyectos: ProyectoOpcion[]
  /** El proyecto elegido: su código (se muestra) y su UUID. */
  proyecto: string | null
  proyectoId: string | null
  insumos: { id: string; nombre: string; unidad: string }[]
  insumo: string | null
  mes: { inicio: string; fin: string }
  despachado: number
  usado: number
  usos: { id: string; fecha: string; cantidad: number; observaciones: string | null }[]
}
