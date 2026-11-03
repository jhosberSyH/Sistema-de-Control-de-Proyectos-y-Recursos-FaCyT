import { DESPACHOS } from './despachos'
import { dia, momento } from './fechas'

/** Registros del audit_log (RF-34), con los textos de la actividad reciente del mockup 02. */
export type AuditoriaSemilla = {
  id: string
  fecha: string
  usuarioId: string
  ip: string
  accion: 'creacion' | 'edicion' | 'cambio-estado' | 'sesion'
  descripcion: string
  detalle: string | null
  justificacion: string | null
  entidad: string | null
  valorAnterior?: string | null
  valorNuevo?: string | null
}

const REGISTROS: AuditoriaSemilla[] = [
  {
    id: 'aud-0981',
    fecha: momento(0, '08:42'),
    usuarioId: 'u-apr',
    ip: '10.20.4.17',
    accion: 'edicion',
    descripcion: 'Carmen Pérez cambió la prioridad de BIO-011 de Alta a Crítica',
    detalle: null,
    justificacion: 'La entrega del informe al consejo de facultad se adelantó al 15/11',
    entidad: 'proyecto:BIO-011',
    valorAnterior: 'Alta',
    valorNuevo: 'Crítica',
  },
  // "Último cambio: 02/09/2026, desde Baja" de FIS-008 en la priorización (mockup 16)
  {
    id: 'aud-0644',
    fecha: momento(-60, '09:50'),
    usuarioId: 'u-apr',
    ip: '10.20.4.17',
    accion: 'edicion',
    descripcion: 'Carmen Pérez cambió la prioridad de FIS-008 de Baja a Media',
    detalle: null,
    justificacion: 'El laboratorio aliado adelantó las mediciones de conductividad',
    entidad: 'proyecto:FIS-008',
    valorAnterior: 'Baja',
    valorNuevo: 'Media',
  },
  {
    id: 'aud-0975',
    fecha: momento(-1, '16:05'),
    usuarioId: 'u-qui',
    ip: '10.20.6.33',
    accion: 'cambio-estado',
    descripcion: 'Daniela Rivas envió la solicitud SOL-119 a aprobación',
    detalle: null,
    justificacion: null,
    entidad: 'solicitud:SOL-119',
    valorAnterior: 'Borrador',
    valorNuevo: 'Pendiente de Aprobación',
  },
  // El sistema crea las reposiciones automáticas (F3.5): sin usuario ni IP, como en el mockup 25
  {
    id: 'aud-0958',
    fecha: momento(-1, '07:10'),
    usuarioId: 'sistema',
    ip: '—',
    accion: 'cambio-estado',
    descripcion: 'El sistema creó la reposición REP-014 en Borrador: el stock de acetona bajó del mínimo',
    detalle: null,
    justificacion: null,
    entidad: 'solicitud:REP-014',
    valorAnterior: null,
    valorNuevo: 'Borrador',
  },
  {
    id: 'aud-0969',
    fecha: momento(-1, '11:20'),
    usuarioId: 'u-apr',
    ip: '10.20.4.17',
    accion: 'creacion',
    descripcion: 'Carmen Pérez registró la recepción del lote L-0431',
    detalle: 'Etanol 96 %, 20 L',
    justificacion: null,
    entidad: 'lote:L-0431',
  },
  {
    id: 'aud-0951',
    fecha: momento(-2, '10:15'),
    usuarioId: 'u-adm',
    ip: '10.20.2.15',
    accion: 'edicion',
    descripcion:
      'José Rodríguez cambió el rol de Luis Mendoza de Coordinador de Proyecto a Aprobador / Gestor de Inventario',
    detalle: 'BIO-015 quedó sin coordinador',
    justificacion: null,
    entidad: 'usuario:u-lme',
  },
  {
    id: 'aud-0912',
    fecha: momento(-19, '10:30'),
    usuarioId: 'u-adm',
    ip: '10.20.2.15',
    accion: 'edicion',
    descripcion: 'José Rodríguez cambió la anticipación de la alerta de vencimiento de 45 a 30 días',
    detalle: null,
    justificacion: null,
    entidad: 'parametro:anticipacion_vencimiento_dias',
    valorAnterior: '45',
    valorNuevo: '30',
  },
  // Historia de QUI-024 (mockup 07, pestaña Historial)
  {
    id: 'aud-0402',
    fecha: momento(-109, '09:12'),
    usuarioId: 'u-adm',
    ip: '10.20.4.11',
    accion: 'cambio-estado',
    descripcion: 'José Rodríguez cambió el estatus de QUI-024 de Propuesta a En ejecución',
    detalle: null,
    justificacion: null,
    entidad: 'proyecto:QUI-024',
    valorAnterior: 'Propuesta',
    valorNuevo: 'En ejecución',
  },
  {
    id: 'aud-0398',
    fecha: momento(-113, '16:40'),
    usuarioId: 'u-qui',
    ip: '10.20.6.33',
    accion: 'edicion',
    descripcion: 'Daniela Rivas confirmó el plan de hitos de QUI-024 (5 hitos, 100 %)',
    detalle: null,
    justificacion: null,
    entidad: 'proyecto:QUI-024',
  },
  {
    id: 'aud-0311',
    fecha: momento(-150, '10:05'),
    usuarioId: 'u-adm',
    ip: '10.20.4.11',
    accion: 'creacion',
    descripcion: 'José Rodríguez registró el proyecto QUI-024 y asignó a Daniela Rivas',
    detalle: null,
    justificacion: null,
    entidad: 'proyecto:QUI-024',
  },
  // QUI-035 (mockup 08): registrado hace una semana, con el plan de hitos en borrador
  {
    id: 'aud-0471',
    fecha: momento(-2, '15:10'),
    usuarioId: 'u-qui',
    ip: '10.20.6.33',
    accion: 'edicion',
    descripcion: 'Daniela Rivas guardó el borrador del plan de hitos de QUI-035 (4 hitos, 90 %)',
    detalle: null,
    justificacion: null,
    entidad: 'proyecto:QUI-035',
  },
  {
    id: 'aud-0466',
    fecha: momento(-6, '11:20'),
    usuarioId: 'u-adm',
    ip: '10.20.4.11',
    accion: 'creacion',
    descripcion: 'José Rodríguez registró el proyecto QUI-035 y asignó a Daniela Rivas',
    detalle: null,
    justificacion: null,
    entidad: 'proyecto:QUI-035',
  },
]

const IP: Record<string, string> = {
  'u-adm': '10.20.2.15',
  'u-apr': '10.20.4.17',
  'u-qui': '10.20.6.33',
  'u-bio': '10.20.7.41',
  'u-fis': '10.20.5.22',
}

/** Quién entra cada día hábil y a qué hora, más o menos. */
const SESIONES: [string, string, string, number][] = [
  ['u-apr', 'Carmen Pérez', 'aprobador@cpq.local', 7 * 60 + 48],
  ['u-adm', 'José Rodríguez', 'admin@cpq.local', 8 * 60 + 5],
  ['u-qui', 'Daniela Rivas', 'coord.quimica@cpq.local', 8 * 60 + 25],
  ['u-bio', 'María Fernanda Ochoa', 'coord.biologia@cpq.local', 9 * 60 + 2],
  ['u-fis', 'Andrés Salazar', 'coord.fisica@cpq.local', 10 * 60 + 10],
]

const hhmm = (minutos: number) =>
  `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`

/**
 * Historial de fondo de los últimos dos meses, para que la auditoría (vista 25) tenga el volumen de un
 * sistema en uso: los inicios de sesión de cada día hábil y el registro de cada despacho de la bitácora.
 * Termina hace tres días, así no cambia la actividad reciente del inicio (mockup 02).
 */
function historial(): AuditoriaSemilla[] {
  const registros: AuditoriaSemilla[] = []
  for (let d = -60; d <= -3; d++) {
    const semana = new Date(`${dia(d)}T12:00:00Z`).getUTCDay()
    if (semana === 0 || semana === 6) continue
    SESIONES.forEach(([id, nombre, correo, minutos], i) => {
      registros.push({
        id: `aud-ses${d}-${id}`,
        fecha: momento(d, hhmm(minutos + ((d * 7 + i * 3) % 13))),
        usuarioId: id,
        ip: IP[id],
        accion: 'sesion',
        descripcion: `${nombre} inició sesión`,
        detalle: correo,
        justificacion: null,
        entidad: `sesion:${id}`,
      })
    })
  }
  const vistos = new Set<string>()
  for (const l of DESPACHOS) {
    if (vistos.has(l.codigo) || l.fecha > momento(-3, '23:59')) continue
    vistos.add(l.codigo)
    const lineas = DESPACHOS.filter((x) => x.codigo === l.codigo).length
    registros.push({
      id: `aud-${l.codigo.toLowerCase()}`,
      fecha: l.fecha,
      usuarioId: 'u-apr',
      ip: IP['u-apr'],
      accion: 'creacion',
      descripcion: `Carmen Pérez registró el despacho ${l.codigo}`,
      detalle: `${l.proyecto ?? 'Uso general'} · ${lineas} ${lineas === 1 ? 'línea' : 'líneas'}`,
      justificacion: null,
      entidad: `despacho:${l.codigo}`,
    })
  }
  return registros
}

export const AUDITORIA = [...REGISTROS, ...historial()].map((r) => ({
  ...r,
  valorAnterior: r.valorAnterior ?? null,
  valorNuevo: r.valorNuevo ?? null,
}))
