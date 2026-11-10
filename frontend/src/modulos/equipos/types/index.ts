export type EstadoEquipo = 'Disponible' | 'En uso' | 'En mantenimiento'
export const ESTADOS_EQUIPO: EstadoEquipo[] = ['Disponible', 'En uso', 'En mantenimiento']

/** Un equipo del catálogo (GET /api/equipos). */
export type Equipo = {
  id: string
  nombre: string
  /** Código de activo, único (F4.1). */
  codigo: string
  ubicacion: { id: string; nombre: string }
  estado: EstadoEquipo
  /** Mientras está en mantenimiento: por qué y desde cuándo (F4.2). */
  mantenimiento: { motivo: string; desde: string } | null
  /** proyecto: código (se muestra); proyectoId: UUID. */
  proximaReserva: { inicio: string; proyecto: string; proyectoId: string; aprobada: boolean } | null
}

export type Ubicacion = { id: string; nombre: string }

export type ListaEquipos = {
  items: Equipo[]
  total: number
  /** Para el filtro: los lugares donde hay equipos. */
  ubicacionesConEquipos: Ubicacion[]
  /** Para el alta: todas las ubicaciones activas del catálogo (F1.4). */
  ubicaciones: Ubicacion[]
}

export type FiltrosEquipos = { q: string; estado: EstadoEquipo | ''; ubicacion: string }

/**
 * Reserva pendiente o aprobada que todavía no termina: si el equipo pasa a mantenimiento, se cancela y su
 * coordinador recibe un aviso (F4.2).
 */
export type ReservaAfectada = {
  id: string
  inicio: string
  fin: string
  proyecto: string
  proyectoId: string
  coordinador: string
}

/** 409 al registrar: el código de activo ya es de otro equipo (F4.1). */
export type ConflictoEquipo = { equipo: { id: string; nombre: string } }

// ---------- Reservas (vista 12) ----------

export type ReservaSemana = {
  id: string
  /** Código del proyecto (se muestra) y su UUID. */
  proyecto: string
  proyectoId: string
  inicio: string
  fin: string
  /**
   * La semana trae las que ocupan el horario (pendientes y aprobadas); una cancelada (el equipo pasó a
   * mantenimiento, F4.2) ya no lo ocupa y se dibuja aparte si llega.
   */
  estado: 'pendiente' | 'aprobada' | 'cancelada'
  /** Es de un proyecto del coordinador que mira (RN-07); las demás se ven como "Ocupado". */
  mia: boolean
}

/** GET /api/reservas: el equipo, sus reservas de la semana y los proyectos para pedir. */
export type SemanaEquipo = {
  equipo: {
    id: string
    nombre: string
    codigo: string
    ubicacion: string
    estado: EstadoEquipo
    mantenimiento: { motivo: string; desde: string } | null
  }
  equipos: { id: string; nombre: string; estado: EstadoEquipo }[]
  /** Lunes de la semana (AAAA-MM-DD). */
  semana: string
  reservas: ReservaSemana[]
  /** Para pedir: el UUID va al servidor, el código y el nombre se muestran. */
  misProyectos: { id: string; codigo: string; nombre: string }[]
  resaltada: string | null
  /** Solo para el Coordinador (HU-13): sus reservas rechazadas de los últimos 30 días, con el motivo. */
  rechazadas: {
    id: string
    equipoId: string
    equipo: string
    proyecto: string
    proyectoId: string
    inicio: string
    fin: string
    decididaEl: string
    motivo: string
  }[]
  /** Solo para el Aprobador: las pendientes de este equipo, que decide en la bandeja. */
  pendientes: { id: string; proyecto: string; proyectoId: string; inicio: string; fin: string }[]
}

/** 409 al pedir: la reserva con la que choca y los horarios libres más cercanos de ese día (F4.4). */
export type ChoqueReserva = {
  choque: { proyecto: string; proyectoId: string; inicio: string; fin: string }
  libres: { inicio: string; fin: string }[]
}

export type ReservaCreada = {
  id: string
  equipo: string
  proyecto: string
  proyectoId: string
  inicio: string
  fin: string
  /** Toda reserva nueva espera la decisión del aprobador (RN-03). */
  estado: 'pendiente'
}

// ---------- Uso de equipo (vista 13) ----------

/** GET /api/usos: el equipo, su uso abierto, la reserva de hoy y los usos de los proyectos del coordinador. */
export type UsoEquipo = {
  equipo: SemanaEquipo['equipo']
  equipos: SemanaEquipo['equipos']
  /** Uso en curso; `mio` si lo inició quien mira. */
  abierto: {
    id: string
    proyecto: string
    proyectoId: string
    inicio: string
    mio: boolean
    usuario: string
  } | null
  reservaHoy: { id: string; proyecto: string; proyectoId: string; inicio: string; fin: string } | null
  misProyectos: SemanaEquipo['misProyectos']
  /** RN-07: solo los usos de sus proyectos. */
  historial: {
    id: string
    inicio: string
    proyecto: string
    proyectoId: string
    horas: number
    observaciones: string | null
  }[]
  /** Horas del mes del último uso (AAAA-MM). */
  mes: { mes: string; horas: number } | null
}
