import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Boton, BotonEnlace } from '@/components/ui/boton'
import { ChipEstado, ChipPrioridad } from '@/components/ui/estado'
import { Contador, Lista } from '@/components/ui/listas'
import { EnvTabla } from '@/components/ui/tabla'
import { Bloque } from '@/components/ui/tarjeta'
import { esApiError } from '@/lib/api-client'
import { diaMes, hace, hora, moneda, nombreMes, numero, porcentaje, saludo } from '@/lib/formato'
import { useEnviarRecordatorio } from './api'
import { Codigo, Saludo } from './piezas'
import type { AlertaInventario, InicioAprobador, PedidoBandeja } from './tipos'

const CLASE_PEDIDO: Record<PedidoBandeja['clase'], string> = {
  retiro: 'Retiro de insumos',
  gasto: 'Gasto',
  reserva: 'Reserva de equipo',
  correccion: 'Corrección de despacho',
  reposicion: 'Reposición automática',
}

const plural = (n: number, uno: string, varios: string) => `${n} ${n === 1 ? uno : varios}`

/** "Hexano 2 L, papel de filtro cualitativo": solo el primer ítem empieza con mayúscula. */
const listaItems = (items: string[]) =>
  items.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1))).join(', ')

function detallePedido(p: PedidoBandeja) {
  switch (p.clase) {
    case 'retiro':
      return `${plural(p.items, 'insumo', 'insumos')} · ${hace(p.fecha)}`
    case 'gasto':
      return `${moneda(p.monto)} · ${hace(p.fecha)}`
    case 'reserva':
      return `${p.equipo} · ${diaMes(p.inicio)} ${hora(p.inicio)} a ${hora(p.fin)}`
    case 'correccion':
      return (
        <>
          <Codigo>{p.despacho}</Codigo>: {p.valorOriginal} en lugar de {p.valorNuevo}
        </>
      )
    case 'reposicion':
      return `${p.insumo}: quedan ${numero(p.stock, 2)} ${p.unidad}, mínimo ${numero(p.minimo, 2)} ${p.unidad}`
  }
}

function itemAlerta(a: AlertaInventario, i: number) {
  if (a.clase === 'bajo-minimo') {
    return {
      id: `a-${i}`,
      principal: a.insumo,
      secundario: `Quedan ${numero(a.stock, 2)} ${a.unidad} · mínimo ${numero(a.minimo, 2)} ${a.unidad}`,
      derecha: <ChipEstado tipo="err">Bajo el mínimo</ChipEstado>,
    }
  }
  const principal = (
    <>
      {a.insumo} · lote <Codigo>{a.lote}</Codigo>
    </>
  )
  if (a.clase === 'por-vencer') {
    return {
      id: `a-${i}`,
      principal,
      secundario: `Vence el ${diaMes(a.vence)}, ${a.dias === 0 ? 'hoy' : `en ${plural(a.dias, 'día', 'días')}`}`,
      derecha: <ChipEstado tipo="warn">Próximo a vencer</ChipEstado>,
    }
  }
  return {
    id: `a-${i}`,
    principal,
    secundario: `Venció el ${diaMes(a.vence)} · no se puede despachar`,
    derecha: <ChipEstado tipo="err">Vencido</ChipEstado>,
  }
}

/** Inicio del Aprobador / Gestor de Inventario (mockup 02, rol apr). */
export function VistaAprobador({ datos }: { datos: InicioAprobador }) {
  const recordatorio = useEnviarRecordatorio()
  const c = datos.contadores
  const resumen =
    datos.decisiones === 0 && c.despachos === 0
      ? 'No tienes decisiones ni despachos pendientes.'
      : `Tienes ${plural(datos.decisiones, 'decisión pendiente', 'decisiones pendientes')} y ${plural(c.despachos, 'despacho por entregar', 'despachos por entregar')}.`
  const cierre = datos.cierre
  const avanceCierre = cierre && cierre.total > 0 ? Math.round((cierre.confirmados / cierre.total) * 100) : 0

  return (
    <>
      <Saludo
        titulo={`${saludo()}, ${datos.nombre}`}
        resumen={resumen}
        accion={
          <BotonEnlace to="/almacen/recepcion">
            <Icono nombre="almacen" />
            Registrar recepción
          </BotonEnlace>
        }
      />

      <div className="contadores">
        <Contador
          valor={c.solicitudes}
          etiqueta={c.solicitudes === 1 ? 'solicitud pendiente' : 'solicitudes pendientes'}
          a="/bandeja?tipo=solicitud"
        />
        <Contador
          valor={c.reservas}
          etiqueta={c.reservas === 1 ? 'reserva por decidir' : 'reservas por decidir'}
          a="/bandeja?tipo=reserva"
        />
        <Contador
          valor={c.correcciones}
          etiqueta={c.correcciones === 1 ? 'corrección de despacho' : 'correcciones de despacho'}
          a="/bandeja?tipo=correccion"
        />
        <Contador
          valor={c.despachos}
          etiqueta={c.despachos === 1 ? 'despacho por entregar' : 'despachos por entregar'}
          a="/almacen/despacho"
        />
      </div>

      <div className="rejilla">
        <div className="col">
          <Bloque titulo="Bandeja de aprobación" enlace={{ texto: 'Abrir bandeja', a: '/bandeja' }}>
            {datos.bandeja.length === 0 ? (
              <p className="sec">No quedan pedidos por decidir.</p>
            ) : (
              <EnvTabla>
                <table className="band">
                  <caption className="vh">
                    Pedidos que esperan tu decisión, del más urgente al menos urgente
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Pedido</th>
                      <th scope="col">Proyecto</th>
                      <th scope="col">Prioridad</th>
                      <th scope="col">Detalle</th>
                      <th scope="col">
                        <span className="vh">Acción</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {datos.bandeja.map((p) => (
                      <tr key={p.id}>
                        <td>
                          <span className="mono">{p.id}</span>
                          <small>{CLASE_PEDIDO[p.clase]}</small>
                        </td>
                        <td className={p.clase === 'reposicion' ? undefined : 'mono'}>
                          {p.clase === 'reposicion' ? 'Inventario' : p.proyecto}
                        </td>
                        <td>
                          {p.clase === 'reposicion' ? (
                            <span className="sec">—</span>
                          ) : (
                            <ChipPrioridad prioridad={p.prioridad} />
                          )}
                        </td>
                        <td>{detallePedido(p)}</td>
                        <td>
                          <Link
                            className="btn btn-sec btn-chico"
                            to={`/bandeja?pedido=${p.id}`}
                            aria-label={`Revisar ${p.id}`}
                          >
                            Revisar
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </EnvTabla>
            )}
            {datos.decisiones > datos.bandeja.length && (
              <p className="sec" style={{ marginTop: 10 }}>
                Se muestran {datos.bandeja.length} de {datos.decisiones}.{' '}
                <Link to="/bandeja">Ver los {datos.decisiones} pedidos</Link>
              </p>
            )}
          </Bloque>

          {cierre && (
            <Bloque
              titulo={`Cierre de ${nombreMes(cierre.inicio)}`}
              enlace={{ texto: 'Ver confirmaciones', a: '/gastos-compartidos/cierre' }}
            >
              <div className="metrica">
                <div className="fila">
                  <span>
                    {cierre.confirmados} de {cierre.total} proyectos confirmaron sus cargos
                  </span>
                  <b>{porcentaje(avanceCierre)}</b>
                </div>
                <div className={avanceCierre < 50 ? 'barra-prog alto' : 'barra-prog'} role="presentation">
                  <i style={{ width: `${avanceCierre}%` }} />
                </div>
              </div>
              {recordatorio.isSuccess && (
                <Aviso tipo="ok">
                  {recordatorio.data.enviados === 0
                    ? 'No había coordinadores a quienes recordar.'
                    : `Enviamos el recordatorio a ${plural(recordatorio.data.enviados, 'coordinador', 'coordinadores')}. Les llega en sus avisos.`}
                </Aviso>
              )}
              {recordatorio.isError && (
                <Aviso tipo="err">
                  {esApiError(recordatorio.error)
                    ? recordatorio.error.message
                    : 'No se pudo enviar el recordatorio.'}
                </Aviso>
              )}
              {cierre.confirmados < cierre.total && (
                <div className="acciones">
                  <Boton
                    aria-disabled={recordatorio.isPending || undefined}
                    onClick={() => {
                      if (!recordatorio.isPending) recordatorio.mutate(cierre.periodoId)
                    }}
                  >
                    {recordatorio.isPending ? 'Enviando…' : 'Enviar recordatorio'}
                  </Boton>
                </div>
              )}
            </Bloque>
          )}
        </div>
        <div className="col">
          <Bloque titulo="Alertas de inventario" enlace={{ texto: 'Ver inventario', a: '/inventario' }}>
            {datos.alertas.length === 0 ? (
              <p className="sec">El inventario está al día: nada bajo el mínimo ni por vencer.</p>
            ) : (
              <Lista items={datos.alertas.map(itemAlerta)} />
            )}
          </Bloque>
          <Bloque titulo="Despachos por entregar" enlace={{ texto: 'Ir al almacén', a: '/almacen' }}>
            {datos.despachos.length === 0 ? (
              <p className="sec">No hay retiros aprobados por despachar.</p>
            ) : (
              <Lista
                items={datos.despachos.map((d) => ({
                  id: d.solicitud,
                  principal: (
                    <>
                      <Codigo>{d.solicitud}</Codigo> · {d.proyecto}
                    </>
                  ),
                  secundario: listaItems(d.items),
                  derecha: (
                    <Link
                      to={`/almacen/despacho?solicitud=${d.solicitud}`}
                      aria-label={`Despachar ${d.solicitud}`}
                    >
                      Despachar
                    </Link>
                  ),
                }))}
              />
            )}
          </Bloque>
        </div>
      </div>
    </>
  )
}
