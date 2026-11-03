import type { Prioridad } from '@/components/ui/estado'

/** GET /api/almacen: las tareas del día del almacén (plan §7.1). */
export type Almacen = {
  lotesPorVencer: number
  lotesVencidos: number
  despachos: {
    solicitud: string
    proyecto: string
    prioridad: Prioridad
    items: string[]
    aprobadaEl: string
  }[]
  porRecibir: {
    id: string
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
  /** Reposiciones aprobadas que esperan la compra: se cierran al recibir el lote. */
  reposiciones: { id: string; insumoId: string; cantidad: number }[]
}

export type DatosLote = {
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
    id: string
    proyecto: string
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
  siguiente: string | null
}

/** POST /api/despachos (201) */
export type DespachoRegistrado = {
  codigo: string
  fecha: string
  solicitud: string
  proyecto: string
  coordinador: string | null
  /** Cuándo se aprobó el retiro (subtítulo del encabezado). */
  aprobadaEl: string
  retiro: string
  monto: number
  lineas: { insumo: string; unidad: string; cantidad: number; lote: string }[]
  siguiente: string | null
}

/** Una línea de la bitácora (GET /api/bitacora): un insumo de un despacho, o un movimiento de corrección. */
export type LineaBitacora = {
  id: string
  codigo: string
  fecha: string
  proyecto: string | null
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
  proyectos: { codigo: string; nombre: string }[]
  filas: LineaBitacora[]
}

export type FiltrosBitacora = { proyecto: string; desde: string; hasta: string; q: string; despacho: string }

export type PedidoCorreccion =
  | { lineaId: string; campo: 'cantidad'; cantidadNueva: number; motivo: string }
  | { lineaId: string; campo: 'proyecto'; proyectoNuevo: string; motivo: string }

/** GET /api/usos-materia: lo despachado y lo usado de un insumo en el mes (F6.4). */
export type UsoMateria = {
  proyectos: { codigo: string; nombre: string }[]
  proyecto: string | null
  insumos: { id: string; nombre: string; unidad: string }[]
  insumo: string | null
  mes: { inicio: string; fin: string }
  despachado: number
  usado: number
  usos: { id: string; fecha: string; cantidad: number; observaciones: string | null }[]
}
