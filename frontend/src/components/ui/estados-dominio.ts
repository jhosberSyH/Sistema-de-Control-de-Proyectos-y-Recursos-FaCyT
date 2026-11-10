import type { TipoEstado } from './estado'

/**
 * Tipo de chip de cada estado del dominio, igual que en los mockups
 * (06 L103, 14 L129-134, 11 L97, 02 y 07 para reservas).
 */
export const TIPO_ESTATUS_PROYECTO: Record<string, TipoEstado> = {
  'En ejecución': 'ok',
  Propuesta: 'neutro',
  Suspendido: 'warn',
  Finalizado: 'info',
}

export const TIPO_ESTADO_SOLICITUD: Record<string, TipoEstado> = {
  Borrador: 'neutro',
  'Pendiente de Aprobación': 'warn',
  Aprobado: 'ok',
  Rechazado: 'err',
  Ejecutado: 'ok',
}

export const ESTADO_RESERVA: Record<string, { tipo: TipoEstado; texto: string }> = {
  pendiente: { tipo: 'warn', texto: 'Pendiente' },
  aprobada: { tipo: 'ok', texto: 'Aprobada' },
  rechazada: { tipo: 'err', texto: 'Rechazada' },
  // El equipo pasó a mantenimiento (F4.2): no la decidió nadie, por eso no va en rojo
  cancelada: { tipo: 'neutro', texto: 'Cancelada' },
}

export const TIPO_ESTADO_EQUIPO: Record<string, TipoEstado> = {
  Disponible: 'ok',
  'En uso': 'info',
  'En mantenimiento': 'warn',
}
