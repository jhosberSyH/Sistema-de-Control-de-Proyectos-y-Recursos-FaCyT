import type { Prioridad } from '@/components/ui/estado'

/*
 * Contrato de GET /api/inicio (vista 02). El servidor junta los datos de varios módulos para el
 * rol de quien pide; los textos de la interfaz se arman en el frontend a partir de estos datos.
 */

export type EstatusProyecto = 'Propuesta' | 'En ejecución' | 'Suspendido' | 'Finalizado'
export type EstadoSolicitud = 'Borrador' | 'Pendiente de Aprobación' | 'Aprobado' | 'Rechazado' | 'Ejecutado'

/**
 * Pendientes del coordinador y del administrador; cada clase tiene su texto y su acción. En cada
 * referencia a un proyecto, "proyecto" es su código (se muestra) y "proyectoId" su UUID (para enlazar).
 * Igual con las solicitudes: "solicitud" es su número (SOL-2026-0001) y "solicitudId" su UUID.
 */
export type Pendiente =
  | {
      clase: 'confirmar-cargos'
      proyecto: string
      proyectoId: string
      cargos: number
      monto: number
      cierre: string
    }
  | {
      clase: 'solicitud-rechazada'
      solicitud: string
      solicitudId: string
      decididaPor: string
      motivo: string
    }
  | {
      clase: 'reserva-aprobada'
      reserva: string
      equipo: string
      proyecto: string
      proyectoId: string
      inicio: string
      fin: string
    }
  | { clase: 'sin-coordinador'; proyecto: string; proyectoId: string; motivo: string; fecha: string }
  | { clase: 'plan-confirmado'; proyecto: string; proyectoId: string }

export type ResumenProyecto = {
  id: string
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
  proyectoId: string
  inicio: string
  fin: string
  /** cancelada: el equipo pasó a mantenimiento (F4.2). */
  estado: 'pendiente' | 'aprobada' | 'rechazada' | 'cancelada'
}

export type ResumenSolicitud = {
  /** UUID (para enlazar) y número (SOL-2026-0001, se muestra). */
  id: string
  numero: string
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

/**
 * Un pedido de la bandeja del aprobador, con lo justo para describirlo en una línea. La fecha es la del envío.
 * En las solicitudes (retiro, gasto, reposición) "id" es el UUID (para enlazar) y "numero" lo que se muestra;
 * las reservas y las correcciones se muestran con su "id".
 */
export type PedidoBandeja =
  | {
      clase: 'retiro'
      id: string
      numero: string
      proyecto: string
      proyectoId: string
      prioridad: Prioridad
      items: number
      fecha: string
    }
  | {
      clase: 'gasto'
      id: string
      numero: string
      proyecto: string
      proyectoId: string
      prioridad: Prioridad
      monto: number
      fecha: string
    }
  | {
      clase: 'reserva'
      id: string
      proyecto: string
      proyectoId: string
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
      proyectoId: string
      prioridad: Prioridad
      despacho: string
      valorOriginal: string
      valorNuevo: string
      fecha: string
    }
  | {
      clase: 'reposicion'
      id: string
      numero: string
      insumo: string
      stock: number
      minimo: number
      unidad: string
    }

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
  /** solicitud: número del retiro (se muestra); solicitudId: su UUID (para enlazar). */
  despachos: {
    solicitud: string
    solicitudId: string
    proyecto: string
    proyectoId: string
    items: string[]
  }[]
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
  prioridades: { id: string; codigo: string; nombre: string; prioridad: Prioridad }[]
  accesos: { cuentasActivas: number; anticipacionVencimiento: number }
}

export type Inicio = InicioCoordinador | InicioAprobador | InicioAdministrador
