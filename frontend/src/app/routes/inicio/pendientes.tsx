import type { Pendiente as ItemPendiente } from '@/components/ui/listas'
import { diaCorto, diaMes, elDia, fechaIso, hora, moneda, nombreMes } from '@/lib/formato'
import { Codigo } from './piezas'
import type { Pendiente } from './tipos'

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** Texto, ícono y acción de cada pendiente (mockup 02, bloques "Pendientes"). Cada acción lleva al detalle (L8). */
export function itemPendiente(p: Pendiente, i: number): ItemPendiente {
  const id = `${p.clase}-${i}`
  switch (p.clase) {
    case 'confirmar-cargos':
      return {
        id,
        tipo: 'warn',
        icono: 'reloj',
        titulo: (
          <>
            Confirma los cargos de {nombreMes(p.cierre)} de <Codigo>{p.proyecto}</Codigo>
          </>
        ),
        // Ya terminado el mes, el cierre espera las confirmaciones: no se escribe una fecha pasada
        detalle: `${p.cargos} cargos por ${moneda(p.monto)}. ${
          p.cierre < fechaIso()
            ? 'El aprobador cierra el período en cuanto confirmen todos.'
            : `El aprobador cierra el período ${elDia(p.cierre)}.`
        }`,
        accion: { texto: 'Revisar cargos', a: `/cierre/cargos?proyecto=${p.proyecto}`, primaria: true },
      }
    case 'solicitud-rechazada':
      return {
        id,
        tipo: 'err',
        icono: 'error',
        titulo: (
          <>
            {p.decididaPor} rechazó tu solicitud <Codigo>{p.solicitud}</Codigo>
          </>
        ),
        detalle: `«${p.motivo}». Puedes crear una nueva con lo que faltaba.`,
        accion: { texto: 'Ver solicitud', a: `/solicitudes?id=${p.solicitud}` },
      }
    case 'reserva-aprobada':
      return {
        id,
        tipo: 'ok',
        icono: 'ok',
        titulo: `Reserva aprobada: ${minuscula(p.equipo)}`,
        detalle: (
          <>
            {diaCorto(p.inicio)}, de {hora(p.inicio)} a {hora(p.fin)}, para <Codigo>{p.proyecto}</Codigo>.
          </>
        ),
        accion: { texto: 'Ver en el calendario', a: `/reservas?reserva=${p.reserva}` },
      }
    case 'sin-coordinador':
      return {
        id,
        tipo: 'warn',
        icono: 'usuarios',
        titulo: (
          <>
            <Codigo>{p.proyecto}</Codigo> no tiene coordinador
          </>
        ),
        detalle: p.motivo
          ? `Quedó sin coordinador ${p.motivo}${p.fecha ? ` el ${diaMes(p.fecha)}` : ''}.`
          : 'Asígnale uno para que pueda cargar hitos y pedir insumos.',
        accion: {
          texto: 'Asignar coordinador',
          a: `/proyectos/${p.proyecto}?asignar=coordinador`,
          primaria: true,
        },
      }
    case 'plan-confirmado':
      return {
        id,
        tipo: 'info',
        icono: 'info',
        titulo: (
          <>
            <Codigo>{p.proyecto}</Codigo> tiene su plan de hitos confirmado
          </>
        ),
        detalle: 'Está en Propuesta. Puedes pasarlo a En ejecución.',
        accion: { texto: 'Cambiar estatus', a: `/proyectos/${p.proyecto}?cambiar=estatus` },
      }
  }
}
