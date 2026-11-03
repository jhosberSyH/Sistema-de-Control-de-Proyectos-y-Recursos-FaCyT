import { diaSemana, instante, lunesDe, sumarDias } from '@/lib/horarios'
import { dia, momento } from './fechas'

/**
 * Equipos (F4.1, F4.2) con los nombres, códigos de activo, laboratorios y estados del mockup 11, y sus
 * reservas (F4.3 a F4.5). Los laboratorios son ubicaciones del catálogo de F1.4 (datos/ubicaciones.ts).
 */
export type EquipoSemilla = {
  id: string
  nombre: string
  codigo: string
  ubicacionId: string
  estado: 'Disponible' | 'En uso' | 'En mantenimiento'
  /** Mientras está en mantenimiento: por qué y desde cuándo (F4.2). */
  mantenimiento: { motivo: string; desde: string } | null
}

const e = (
  id: string,
  nombre: string,
  codigo: string,
  ubicacionId: string,
  estado: EquipoSemilla['estado'] = 'Disponible',
  mantenimiento: EquipoSemilla['mantenimiento'] = null,
): EquipoSemilla => ({ id: `eq-${id}`, nombre, codigo, ubicacionId, estado, mantenimiento })

export const EQUIPOS: EquipoSemilla[] = [
  e('uvvis', 'Espectrofotómetro UV-Vis', 'UC-FACYT-0457', 'ub-lab-qa'),
  e('drx', 'Difractómetro de rayos X', 'UC-FACYT-0312', 'ub-lab-fes'),
  e('rotavapor', 'Rotavapor R-300', 'UC-FACYT-0521', 'ub-lab-qo', 'En uso'),
  e('centrifuga', 'Centrífuga refrigerada', 'UC-FACYT-0498', 'ub-lab-mic'),
  e('cabina', 'Cabina de flujo laminar', 'UC-FACYT-0388', 'ub-lab-mic', 'En mantenimiento', {
    motivo: 'Cambio de los filtros HEPA y certificación.',
    desde: dia(-3),
  }),
  e('potenciostato', 'Potenciostato', 'UC-FACYT-0544', 'ub-lab-elq'),
  e('mufla', 'Horno mufla 1200 °C', 'UC-FACYT-0275', 'ub-lab-qa', 'En uso'),
]

/**
 * Las reservas van ancladas al lunes de la semana en curso (o de la que viene, si hoy es domingo), así
 * caen en los mismos días de la semana que en los mockups y nunca en domingo, cuando cierran los
 * laboratorios. Con hoy domingo 01/11: lunes 02/11 + d días. Un día que ya pasó esta semana se corre a la siguiente, para que siempre sean a futuro.
 */
const en = (d: number, hora: string) => {
  const lunes = lunesDe(dia(0))
  // Toda la semana junta: si su primer día (martes) ya no queda por delante de la reserva más cercana, pasa entera
  // a la semana siguiente, así los bloques de un equipo nunca se reparten entre dos semanas
  const desplazar = sumarDias(lunes, 1) <= primerDiaHabil()
  return instante(sumarDias(lunes, d + (desplazar ? 7 : 0)), hora)
}

/** Primer día hábil después de hoy: mañana, o el lunes si mañana es domingo. */
export function primerDiaHabil() {
  const manana = sumarDias(dia(0), 1)
  return diaSemana(manana) === 0 ? sumarDias(manana, 1) : manana
}

/**
 * Las reservas próximas (las del inicio y la bandeja) van a d días del primer día hábil, saltando los
 * domingos. Así la primera, RES-050, siempre es la más cercana cualquier día que se pruebe la app.
 */
const pronto = (d: number, hora: string) => {
  const fecha = sumarDias(primerDiaHabil(), d)
  return instante(diaSemana(fecha) === 0 ? sumarDias(fecha, 1) : fecha, hora)
}

/** Reservas de equipos (F4.3 a F4.5), con las de los mockups 02, 11 y 12. */
export type ReservaSemilla = {
  id: string
  equipoId: string
  proyecto: string
  inicio: string
  fin: string
  estado: 'pendiente' | 'aprobada' | 'rechazada'
  pedidaPor: string
  /** Cuándo la pidió el coordinador */
  pedidaEl: string
  /** Fecha de la decisión del aprobador */
  decididaEl: string | null
  /** Solo en las rechazadas */
  motivoRechazo?: string | null
}

export const RESERVAS: ReservaSemilla[] = [
  {
    id: 'RES-050',
    equipoId: 'eq-uvvis',
    proyecto: 'QUI-024',
    inicio: pronto(0, '10:00'),
    fin: pronto(0, '12:00'),
    estado: 'aprobada',
    pedidaPor: 'u-qui',
    pedidaEl: momento(-2, '14:30'),
    decididaEl: momento(-1, '11:05'),
  },
  {
    id: 'RES-051',
    equipoId: 'eq-rotavapor',
    proyecto: 'QUI-031',
    inicio: pronto(2, '08:00'),
    fin: pronto(2, '11:00'),
    estado: 'pendiente',
    pedidaPor: 'u-qui',
    pedidaEl: momento(-1, '17:45'),
    decididaEl: null,
  },
  {
    id: 'RES-052',
    equipoId: 'eq-centrifuga',
    proyecto: 'FIS-008',
    inicio: pronto(3, '14:00'),
    fin: pronto(3, '16:00'),
    estado: 'pendiente',
    pedidaPor: 'u-fis',
    pedidaEl: momento(-1, '09:10'),
    decididaEl: null,
  },
  // Rechazada hace 3 días: el coordinador la ve en sus reservas con el motivo (HU-13)
  {
    id: 'RES-053',
    equipoId: 'eq-potenciostato',
    proyecto: 'QUI-024',
    inicio: en(5, '09:00'),
    fin: en(5, '11:00'),
    estado: 'rechazada',
    pedidaPor: 'u-qui',
    pedidaEl: momento(-4, '10:00'),
    decididaEl: momento(-3, '15:30'),
    motivoRechazo:
      'Ese día se calibra el equipo con el proveedor. Elige otro horario de la semana siguiente.',
  },
  // Las dos del difractómetro que quedan afectadas si pasa a mantenimiento (mockup 11)
  {
    id: 'RES-046',
    equipoId: 'eq-drx',
    proyecto: 'QUI-024',
    inicio: pronto(7, '08:00'),
    fin: pronto(7, '12:00'),
    estado: 'aprobada',
    pedidaPor: 'u-qui',
    pedidaEl: momento(-10, '11:00'),
    decididaEl: momento(-9, '15:20'),
  },
  {
    id: 'RES-047',
    equipoId: 'eq-drx',
    proyecto: 'FIS-008',
    inicio: pronto(9, '13:00'),
    fin: pronto(9, '17:00'),
    estado: 'aprobada',
    pedidaPor: 'u-fis',
    pedidaEl: momento(-9, '16:40'),
    decididaEl: momento(-8, '10:10'),
  },
  {
    id: 'RES-048',
    equipoId: 'eq-mufla',
    proyecto: 'QUI-024',
    inicio: pronto(4, '07:00'),
    fin: pronto(4, '11:00'),
    estado: 'aprobada',
    pedidaPor: 'u-qui',
    pedidaEl: momento(-8, '08:20'),
    decididaEl: momento(-7, '09:40'),
  },
  // La semana del espectrofotómetro del mockup 12 (de martes a sábado de la semana que se ve al abrir
  // la vista): lo ocupan otros proyectos casi todos los días. Ya aprobadas y no recientes, para no
  // cambiar los pendientes del inicio (mockup 02).
  ...(
    [
      ['RES-040', 'BIO-011', 1, '08:00', '10:00', 'u-bio'],
      ['RES-041', 'FIS-008', 2, '13:00', '16:00', 'u-fis'],
      ['RES-042', 'BIO-011', 3, '09:00', '11:00', 'u-bio'],
      ['RES-043', 'QUI-031', 4, '14:00', '17:00', 'u-qui'],
      ['RES-044', 'QUI-027', 5, '08:00', '12:00', 'u-rli'],
    ] as const
  ).map(([id, proyecto, d, desde, hasta, pedidaPor]): ReservaSemilla => ({
    id,
    equipoId: 'eq-uvvis',
    proyecto,
    inicio: en(d, desde),
    fin: en(d, hasta),
    estado: 'aprobada',
    pedidaPor,
    pedidaEl: momento(-7, '10:00'),
    decididaEl: momento(-6, '12:00'),
  })),
]

export type UsoSemilla = {
  id: string
  equipoId: string
  proyecto: string
  usuarioId: string
  inicio: string
  fin: string | null
  observaciones: string | null
  reservaId: string | null
}

/** Hace h horas y m minutos, para los usos abiertos: el reloj del mockup 13 marca 02:41 al abrir. */
const hace = (h: number, m: number) => new Date(Date.now() - (h * 60 + m) * 60_000).toISOString()

const u = (
  id: string,
  equipoId: string,
  proyecto: string,
  usuarioId: string,
  dias: number,
  desde: string,
  hasta: string,
  observaciones: string,
): UsoSemilla => ({
  id,
  equipoId,
  proyecto,
  usuarioId,
  inicio: momento(dias, desde),
  fin: momento(dias, hasta),
  observaciones,
  reservaId: null,
})

/**
 * Usos de equipos (F4.6). El horno mufla y el rotavapor están En uso (mockup 11) porque tienen un uso
 * abierto. Los del horno para QUI-024 y QUI-031 son la tabla del mockup 13 (14,5 h en octubre).
 */
export const USOS: UsoSemilla[] = [
  {
    id: 'USO-120',
    equipoId: 'eq-mufla',
    proyecto: 'QUI-024',
    usuarioId: 'u-qui',
    inicio: hace(2, 41),
    fin: null,
    observaciones: null,
    reservaId: null,
  },
  {
    id: 'USO-119',
    equipoId: 'eq-rotavapor',
    proyecto: 'QUI-027',
    usuarioId: 'u-rli',
    inicio: hace(1, 15),
    fin: null,
    observaciones: null,
    reservaId: null,
  },
  u('USO-114', 'eq-mufla', 'QUI-024', 'u-qui', -9, '08:00', '12:00', 'Calcinación a 450 °C, lote de prueba'),
  u('USO-108', 'eq-mufla', 'QUI-031', 'u-qui', -16, '13:00', '16:30', 'Secado de TiO₂ dopado'),
  u('USO-101', 'eq-mufla', 'QUI-024', 'u-qui', -23, '07:30', '12:30', 'Calcinación a 500 °C'),
  u('USO-095', 'eq-mufla', 'QUI-024', 'u-qui', -30, '09:00', '11:00', 'Rampa de calibración'),
  // De otro proyecto: el coordinador de Química no la ve (RN-07)
  u('USO-110', 'eq-mufla', 'QUI-027', 'u-rli', -12, '08:00', '10:00', 'Secado de material vegetal'),
]
