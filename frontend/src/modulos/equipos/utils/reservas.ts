import { partesCaracas, sumarDias } from '@/lib/horarios'
import type { ReservaSemana } from '../types'

/** Un bloque del calendario: una reserva o una pieza de la vista previa de la solicitud. */
export type Bloque = {
  clave: string
  fecha: string
  desde: number
  hasta: number
  clase: 'otro' | 'mio' | 'pend' | 'nuevo' | 'libre'
  /** Primera línea, en negrita: el proyecto, "Tu solicitud" o "Libre". */
  titulo: string
  /** Tercera línea, bajo el horario: "Ocupado", "Aprobada", "Choca"… */
  estado: string
  resaltada?: boolean
  /** El Aprobador decide las pendientes en la bandeja (plan §7.1). */
  enlace?: string
}

/** Cómo se ve cada reserva según quién mira (RN-07: el coordinador solo distingue las suyas). */
export function bloqueDe(r: ReservaSemana, aprobador: boolean, resaltada: string | null): Bloque {
  const a = partesCaracas(r.inicio)
  const b = partesCaracas(r.fin)
  const base = {
    clave: r.id,
    fecha: a.fecha,
    desde: a.minutos,
    hasta: b.minutos,
    resaltada: r.id === resaltada,
  }
  if (aprobador) {
    return r.estado === 'aprobada'
      ? { ...base, clase: 'mio', titulo: r.proyecto, estado: 'Aprobada' }
      : { ...base, clase: 'pend', titulo: r.proyecto, estado: 'Pendiente', enlace: '/bandeja?tipo=reserva' }
  }
  if (!r.mia) return { ...base, clase: 'otro', titulo: r.proyecto, estado: 'Ocupado' }
  return r.estado === 'aprobada'
    ? { ...base, clase: 'mio', titulo: r.proyecto, estado: 'Aprobada' }
    : { ...base, clase: 'pend', titulo: r.proyecto, estado: 'Pendiente' }
}

/** "Semana del 2 de noviembre al 7 de noviembre de 2026" */
export function tituloSemana(lunes: string) {
  const fmt = (f: string, anio: boolean) =>
    new Intl.DateTimeFormat('es-VE', {
      day: 'numeric',
      month: 'long',
      ...(anio ? { year: 'numeric' } : {}),
      timeZone: 'UTC',
    }).format(new Date(`${f}T12:00:00Z`))
  return `Semana del ${fmt(lunes, false)} al ${fmt(sumarDias(lunes, 5), true)}`
}
