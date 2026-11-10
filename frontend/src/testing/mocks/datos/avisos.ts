import { diaCorto, nombreMes } from '@/lib/formato'
import { horaDe, partesCaracas } from '@/lib/horarios'
import { RESERVAS } from './equipos'
import { mesEnRevision, momento } from './fechas'
import { idProyecto } from './proyectos'
import { idSolicitudSemilla } from './solicitudes'

/** Día y horario de la reserva RES-050, tal como figuran en el calendario. */
function horarioReserva() {
  const r = RESERVAS.find((x) => x.id === 'RES-050')!
  const ini = partesCaracas(r.inicio)
  return `${diaCorto(ini.fecha)}, de ${horaDe(ini.minutos)} a ${horaDe(partesCaracas(r.fin).minutos)}`
}

/**
 * Avisos de la bandeja interna por usuario, coherentes con la semilla de proyectos, solicitudes,
 * reservas e inventario. Cada enlace lleva a la vista donde se resuelve (L8).
 */
type Aviso = {
  id: string
  usuarioId: string
  tipo: 'ok' | 'warn' | 'err' | 'info'
  titulo: string
  detalle?: string
  enlace: string
  fecha: string
  leido: boolean
}

export const AVISOS: Aviso[] = [
  // Daniela Rivas, coordinadora de Química
  {
    id: 'av-1',
    usuarioId: 'u-qui',
    tipo: 'warn',
    titulo: `Confirma los cargos de ${nombreMes(mesEnRevision().fin)} de QUI-024`,
    detalle: '12 cargos por US$ 1.284,50 antes del cierre del período.',
    enlace: `/cierre/cargos?proyecto=${idProyecto('QUI-024')}`,
    fecha: momento(0, '06:10'),
    leido: false,
  },
  {
    id: 'av-2',
    usuarioId: 'u-qui',
    tipo: 'err',
    titulo: 'Carmen Pérez rechazó tu solicitud SOL-118',
    detalle: '«Falta la cotización del proveedor». Puedes crear una nueva con lo que faltaba.',
    enlace: `/solicitudes?id=${idSolicitudSemilla('SOL-118')}`,
    fecha: momento(-1, '16:42'),
    leido: false,
  },
  {
    id: 'av-3',
    usuarioId: 'u-qui',
    tipo: 'ok',
    titulo: 'Reserva aprobada: espectrofotómetro UV-Vis',
    detalle: `${horarioReserva()}, para QUI-024.`,
    enlace: '/reservas?reserva=RES-050',
    fecha: momento(-1, '11:05'),
    leido: false,
  },
  // Carmen Pérez, aprobadora
  {
    id: 'av-4',
    usuarioId: 'u-apr',
    tipo: 'warn',
    titulo: '9 pedidos esperan tu decisión',
    detalle: 'El más antiguo es SOL-122, gasto de FIS-010.',
    enlace: '/bandeja',
    fecha: momento(0, '07:30'),
    leido: false,
  },
  {
    id: 'av-5',
    usuarioId: 'u-apr',
    tipo: 'info',
    titulo: 'Reposición automática en Borrador: acetona grado analítico',
    detalle: 'El stock bajó del mínimo. Revisa la cantidad sugerida antes de aprobar.',
    enlace: '/bandeja?tipo=reposicion',
    fecha: momento(0, '06:55'),
    leido: false,
  },
  {
    id: 'av-6',
    usuarioId: 'u-apr',
    tipo: 'warn',
    titulo: 'El lote L-0425 de medio LB agar vence en 9 días',
    detalle: 'Quedan 0,5 kg en el Depósito de reactivos B.',
    enlace: '/inventario?alerta=vencimiento',
    fecha: momento(-1, '18:00'),
    leido: false,
  },
  {
    id: 'av-7',
    usuarioId: 'u-apr',
    tipo: 'warn',
    titulo: '2 despachos por entregar',
    detalle: 'Retiros aprobados de QUI-024 y FIS-008.',
    enlace: '/almacen/despacho',
    fecha: momento(-1, '15:20'),
    leido: false,
  },
  {
    id: 'av-8',
    usuarioId: 'u-apr',
    tipo: 'info',
    titulo: '2 de 7 proyectos confirmaron sus cargos del mes',
    detalle: 'Puedes enviar un recordatorio a los coordinadores que faltan.',
    enlace: '/gastos-compartidos/cierre',
    fecha: momento(-1, '09:00'),
    leido: false,
  },
  // José Rodríguez, administrador
  {
    id: 'av-9',
    usuarioId: 'u-adm',
    tipo: 'warn',
    titulo: 'BIO-015 no tiene coordinador',
    detalle: 'Asígnale uno para que pueda cargar hitos y pedir insumos.',
    enlace: `/proyectos/${idProyecto('BIO-015')}`,
    fecha: momento(-2, '10:15'),
    leido: false,
  },
  {
    id: 'av-10',
    usuarioId: 'u-adm',
    tipo: 'info',
    titulo: 'FIS-012 tiene su plan de hitos confirmado',
    detalle: 'Está en Propuesta. Puedes pasarlo a En ejecución.',
    enlace: `/proyectos/${idProyecto('FIS-012')}`,
    fecha: momento(-1, '14:30'),
    leido: false,
  },
]
