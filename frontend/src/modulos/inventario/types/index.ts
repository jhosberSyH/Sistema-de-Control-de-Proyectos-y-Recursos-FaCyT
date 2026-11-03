export type TipoInsumo = 'Materia prima' | 'Consumible de proyecto' | 'Consumible de uso general'
export const TIPOS: TipoInsumo[] = ['Materia prima', 'Consumible de proyecto', 'Consumible de uso general']

/** Unidades de medida del catálogo: el valor que se guarda y cómo se nombra en el formulario. */
export const UNIDADES = [
  { valor: 'L', nombre: 'Litro (L)' },
  { valor: 'mL', nombre: 'Mililitro (mL)' },
  { valor: 'g', nombre: 'Gramo (g)' },
  { valor: 'kg', nombre: 'Kilogramo (kg)' },
  { valor: 'unidades', nombre: 'Unidad' },
  { valor: 'cajas', nombre: 'Caja' },
  { valor: 'bolsas', nombre: 'Bolsa' },
  { valor: 'rollos', nombre: 'Rollo' },
] as const

/** Estado del insumo en la lista (F3.4, F3.6): bajo el mínimo, lote por vencer, lote vencido o al día. */
export type EstadoInsumo = 'bajo' | 'vence' | 'vencido' | 'ok'

/** Un insumo del catálogo (GET /api/insumos). */
export type ResumenInsumo = {
  id: string
  nombre: string
  unidad: string
  tipo: TipoInsumo
  stock: number
  stockMinimo: number
  /** Lotes con existencia. */
  lotes: number
  /** El lote que vence primero, con los días que faltan (negativo si ya venció). */
  proximoVencimiento: { fecha: string; dias: number } | null
  vencidos: number
  porVencer: number
  estado: EstadoInsumo
}

export type Alerta = 'minimo' | 'vencimiento' | 'vencido'
export const ALERTAS: Alerta[] = ['minimo', 'vencimiento', 'vencido']

export type PaginaInsumos = {
  items: ResumenInsumo[]
  total: number
  pagina: number
  paginas: number
  porPagina: number
  /** Del inventario completo, para las tarjetas de arriba. */
  alertas: { bajoMinimo: number; porVencer: number; vencidos: number }
  /** Días de anticipación de la alerta de vencimiento (F1.5). */
  anticipacion: number
  ubicaciones: { id: string; nombre: string }[]
}

export type FiltrosInventario = {
  q: string
  tipo: TipoInsumo | ''
  ubicacion: string
  alerta: Alerta | ''
  pagina: number
}

/** 409 al registrar: ya hay un insumo con ese nombre y esa unidad (F3.1). */
export type ConflictoInsumo = { insumo: { id: string; nombre: string; unidad: string } }

// ---------- Ficha del insumo (vista 10) ----------

export type LoteInsumo = {
  codigo: string
  ingreso: string
  vence: string | null
  /** Días hasta el vencimiento; negativo si ya venció. */
  dias: number | null
  cantidad: number
  costoUnitario: number
  proveedor: string
}

export type MovimientoInsumo = {
  tipo: 'despacho' | 'recepcion'
  fecha: string
  cantidad: number | null
  /** null en los consumibles de uso general (RN-02) y en las recepciones. */
  proyecto: string | null
  lote: string
  codigo: string | null
}

/** La reposición abierta del insumo (F3.5), si hay una. */
export type ReposicionInsumo = {
  id: string
  estado: 'Borrador' | 'Pendiente de Aprobación' | 'Aprobado'
  cantidad: number | null
  fecha: string
  decididaPor: string | null
}

/** F3.7: consumo de cada mes completo y el pronóstico del mes en curso (null sin historial suficiente). */
export type PronosticoInsumo = {
  /** AAAA-MM del mes pronosticado. */
  mes: string
  historial: { mes: string; consumo: number }[]
  meses: number
  requeridos: number
  metodo: string
  valor: number | null
  minimo: number | null
  maximo: number | null
}

/** GET /api/insumos/:id (vista 10). */
export type FichaInsumo = ResumenInsumo & {
  anticipacion: number
  ubicaciones: string[]
  lotes: LoteInsumo[]
  ultimoMovimiento: MovimientoInsumo | null
  reposicion: ReposicionInsumo | null
  pronostico: PronosticoInsumo
}
