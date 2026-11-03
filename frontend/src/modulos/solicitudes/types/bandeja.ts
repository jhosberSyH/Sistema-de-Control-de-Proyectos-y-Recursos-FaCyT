import type { Prioridad } from '@/components/ui/estado'

/** Grupo de la bandeja: la prioridad del proyecto, o las reposiciones automáticas al final. */
export type GrupoBandeja = Prioridad | 'auto'

type Base = {
  id: string
  grupo: GrupoBandeja
  /** Cuándo se pidió (envío de la solicitud, pedido de la reserva o de la corrección, alta de la reposición). */
  fecha: string
  /** null en las reposiciones, que crea el sistema. */
  pedidaPor: string | null
  proyecto: { codigo: string; nombre: string } | null
}

export type PedidoGasto = Base & {
  clase: 'gasto'
  estado: 'Pendiente de Aprobación' | 'Aprobado'
  insumoServicio: string
  cantidad: string | null
  monto: number
  descripcion: string | null
  cotizacion: string | null
  presupuesto: number
  gastoEjecutado: number
  decididaPor: string | null
}

export type PedidoRetiro = Base & {
  clase: 'retiro'
  lineas: {
    insumo: string
    unidad: string
    cantidad: number
    disponible: number
    reposicion: string | null
  }[]
  proposito: string | null
  valor: number
}

export type PedidoReserva = Base & {
  clase: 'reserva'
  equipo: { id: string; nombre: string; estado: 'Disponible' | 'En uso' | 'En mantenimiento' }
  inicio: string
  fin: string
  /** Otra reserva ya aprobada que ocupa ese horario (F4.4): no se puede aprobar. */
  choque: { id: string; proyecto: string; inicio: string; fin: string } | null
}

export type PedidoCorreccion = Base & {
  clase: 'correccion'
  despacho: { codigo: string; fecha: string | null }
  insumo: string
  lote: string
  campo: 'cantidad' | 'proyecto'
  valorOriginal: string
  valorNuevo: string
  motivo: string
  /** Lo que cambia si se aprueba: devuelve al lote, descuenta de más o traslada el cargo. */
  efecto: { tipo: 'devolucion' | 'descuento' | 'traslado'; cantidad: string | null; monto: number } | null
}

export type PedidoReposicion = Base & {
  clase: 'reposicion'
  insumo: { id: string; nombre: string; unidad: string; stock: number; minimo: number }
  sugerida: number
  /** Consumo pronosticado de las próximas 8 semanas (F3.7); null sin historial suficiente. */
  consumoPrevisto: number | null
}

export type Pedido = PedidoGasto | PedidoRetiro | PedidoReserva | PedidoCorreccion | PedidoReposicion

/** GET /api/bandeja */
export type Bandeja = {
  pendientes: Pedido[]
  /** Gastos aprobados que esperan el pago (F5.5). */
  porEjecutar: PedidoGasto[]
}

/** Filtro de la bandeja, en la URL como ?tipo= (los enlaces del inicio ya lo usan). */
export type FiltroBandeja = 'todos' | 'solicitud' | 'reserva' | 'correccion' | 'reposicion' | 'ejecutar'

export type Decision =
  { pedido: Pedido; aprobar: true; cantidad?: number } | { pedido: Pedido; aprobar: false; motivo: string }
