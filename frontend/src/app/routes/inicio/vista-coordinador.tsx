import { Icono } from '@/components/icono'
import { BotonEnlace } from '@/components/ui/boton'
import { ChipEstado } from '@/components/ui/estado'
import { ESTADO_RESERVA, TIPO_ESTADO_SOLICITUD } from '@/components/ui/estados-dominio'
import { Lista, ListaPendientes } from '@/components/ui/listas'
import { Bloque } from '@/components/ui/tarjeta'
import { diaCorto, elDia, fechaIso, hora, moneda, nombreMes, saludo } from '@/lib/formato'
import { itemPendiente } from './pendientes'
import { Codigo, Saludo, TarjetaProyecto } from './piezas'
import type { InicioCoordinador } from './tipos'

const TIPO_SOLICITUD = {
  gasto: 'Gasto',
  retiro: 'Retiro de insumos',
  reposicion: 'Reposición automática',
} as const

/** Inicio del Coordinador de Proyecto (mockup 02, rol coo). Solo sus proyectos (RN-07). */
export function VistaCoordinador({ datos }: { datos: InicioCoordinador }) {
  const n = datos.pendientes.length
  const resumen = [
    n === 0 ? 'No tienes pendientes.' : `Tienes ${n} ${n === 1 ? 'pendiente' : 'pendientes'}.`,
    datos.cierrePeriodo
      ? // Ya terminado el mes, el cierre espera las confirmaciones: no se escribe una fecha pasada
        datos.cierrePeriodo < fechaIso()
        ? `El cierre de ${nombreMes(datos.cierrePeriodo)} está en revisión.`
        : `El período de ${nombreMes(datos.cierrePeriodo)} cierra ${elDia(datos.cierrePeriodo)}.`
      : '',
  ].join(' ')

  return (
    <>
      <Saludo titulo={`${saludo()}, ${datos.nombre}`} resumen={resumen.trim()} />

      <div className="acciones">
        <BotonEnlace variante="pri" to="/solicitudes?nueva=retiro">
          <Icono nombre="mas" />
          Solicitud de retiro
        </BotonEnlace>
        <BotonEnlace to="/solicitudes?nueva=gasto">
          <Icono nombre="mas" />
          Solicitud de gasto
        </BotonEnlace>
        <BotonEnlace to="/reservas">
          <Icono nombre="calendario" />
          Reservar equipo
        </BotonEnlace>
        <BotonEnlace to="/reservas/uso">
          <Icono nombre="inventario" />
          Registrar uso
        </BotonEnlace>
      </div>

      <div className="rejilla">
        <div className="col">
          <Bloque titulo="Pendientes" enlace={{ texto: 'Ver todos', a: '/solicitudes' }}>
            {n === 0 ? (
              <p className="sec">
                Estás al día. Aquí aparecen los cargos por confirmar y las decisiones sobre tus pedidos.
              </p>
            ) : (
              <ListaPendientes items={datos.pendientes.map(itemPendiente)} />
            )}
          </Bloque>
          <Bloque titulo="Mis proyectos" enlace={{ texto: 'Ver todos', a: '/proyectos' }}>
            {datos.proyectos.length === 0 ? (
              <p className="sec">No tienes proyectos en ejecución asignados.</p>
            ) : (
              <div className="proyectos">
                {datos.proyectos.map((p) => (
                  <TarjetaProyecto key={p.id} p={p} />
                ))}
              </div>
            )}
          </Bloque>
        </div>
        <div className="col">
          <Bloque titulo="Próximas reservas" enlace={{ texto: 'Calendario', a: '/reservas' }}>
            {datos.reservas.length === 0 ? (
              <p className="sec">No tienes reservas próximas.</p>
            ) : (
              <Lista
                items={datos.reservas.map((r) => ({
                  id: r.id,
                  principal: r.equipo,
                  secundario: (
                    <>
                      {diaCorto(r.inicio)} · {hora(r.inicio)} a {hora(r.fin)} · <Codigo>{r.proyecto}</Codigo>
                    </>
                  ),
                  derecha: (
                    <ChipEstado tipo={ESTADO_RESERVA[r.estado].tipo}>
                      {ESTADO_RESERVA[r.estado].texto}
                    </ChipEstado>
                  ),
                }))}
              />
            )}
          </Bloque>
          <Bloque titulo="Mis solicitudes" enlace={{ texto: 'Ver todas', a: '/solicitudes' }}>
            {datos.solicitudes.length === 0 ? (
              <p className="sec">Todavía no has creado solicitudes.</p>
            ) : (
              <Lista
                items={datos.solicitudes.map((s) => ({
                  id: s.id,
                  principal: (
                    <>
                      <Codigo>{s.numero}</Codigo> {TIPO_SOLICITUD[s.tipo]}
                    </>
                  ),
                  secundario:
                    s.tipo === 'gasto' && s.monto !== null
                      ? `${s.descripcion}, ${moneda(s.monto)}`
                      : s.descripcion,
                  derecha: <ChipEstado tipo={TIPO_ESTADO_SOLICITUD[s.estado]}>{s.estado}</ChipEstado>,
                }))}
              />
            )}
          </Bloque>
        </div>
      </div>
    </>
  )
}
