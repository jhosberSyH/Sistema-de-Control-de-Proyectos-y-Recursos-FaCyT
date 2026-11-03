import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { BotonEnlace } from '@/components/ui/boton'
import { ChipPrioridad } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { Contador, Lista, ListaPendientes } from '@/components/ui/listas'
import { Bloque } from '@/components/ui/tarjeta'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { cuandoCorto, fechaCorta, numero } from '@/lib/formato'
import { useAlmacen } from '../api/almacen'
import './almacen.css'

const plural = (n: number, uno: string, varios: string) => (n === 1 ? uno : varios)

/** "Hexano 2 L, papel de filtro cualitativo": solo el primer ítem empieza con mayúscula. */
const listaItems = (items: string[]) =>
  items.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1))).join(', ')

/**
 * Entrada del almacén (paso 17). No estaba dibujada: muestra las tareas del día con los contadores y
 * las listas de la vista 02 (plan §7.1): despachos por entregar, reposiciones por recibir y lotes que
 * vigilar, más las últimas recepciones.
 */
export function VistaAlmacen() {
  const datos = useAlmacen()
  useTituloPagina('Almacén')
  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando el almacén…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={360} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
  const d = datos.data

  return (
    <div className="vista-almacen">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/inicio">Inicio</Link>
              </li>
              <li aria-current="page">Almacén</li>
            </ol>
          </nav>
          <h1>Almacén</h1>
          <p className="sub">Entradas y salidas de insumos: cada movimiento cambia el stock en el momento.</p>
        </div>
        <div className="acc">
          <BotonEnlace to="/almacen/despacho">
            <Icono nombre="solicitudes" />
            Despachar
          </BotonEnlace>
          <BotonEnlace variante="pri" to="/almacen/recepcion">
            <Icono nombre="almacen" />
            Registrar recepción
          </BotonEnlace>
        </div>
      </div>

      <div className="contadores">
        <Contador
          valor={d.despachos.length}
          etiqueta={plural(d.despachos.length, 'despacho por entregar', 'despachos por entregar')}
          a="/almacen/despacho"
        />
        <Contador
          valor={d.porRecibir.length}
          etiqueta={plural(d.porRecibir.length, 'reposición por recibir', 'reposiciones por recibir')}
          a="/almacen/recepcion"
        />
        <Contador
          valor={d.lotesPorVencer}
          etiqueta={plural(d.lotesPorVencer, 'lote próximo a vencer', 'lotes próximos a vencer')}
          a="/inventario?alerta=vencimiento"
        />
        <Contador
          valor={d.lotesVencidos}
          etiqueta={plural(d.lotesVencidos, 'lote vencido por devolver', 'lotes vencidos por devolver')}
          a="/inventario?alerta=vencido"
        />
      </div>

      <div className="rejilla">
        <div className="col">
          <Bloque titulo="Despachos por entregar">
            {d.despachos.length === 0 ? (
              <p className="sec">No hay retiros aprobados por despachar.</p>
            ) : (
              <ListaPendientes
                items={d.despachos.map((x) => ({
                  id: x.solicitud,
                  tipo: 'info',
                  icono: 'almacen',
                  titulo: (
                    <>
                      <span className="mono">{x.solicitud}</span> · <span className="mono">{x.proyecto}</span>{' '}
                      <ChipPrioridad prioridad={x.prioridad} />
                    </>
                  ),
                  detalle: `${listaItems(x.items)} · aprobada ${cuandoCorto(x.aprobadaEl)}`,
                  accion: {
                    texto: 'Despachar',
                    a: `/almacen/despacho?solicitud=${x.solicitud}`,
                    primaria: true,
                  },
                }))}
              />
            )}
          </Bloque>
          <Bloque titulo="Reposiciones por recibir">
            {d.porRecibir.length === 0 ? (
              <p className="sec">No hay compras aprobadas esperando la entrega.</p>
            ) : (
              <ListaPendientes
                items={d.porRecibir.map((r) => ({
                  id: r.id,
                  tipo: 'ok',
                  icono: 'inventario',
                  titulo: (
                    <>
                      <span className="mono">{r.id}</span> · {r.insumo}
                    </>
                  ),
                  detalle: `${numero(r.cantidad, 3)} ${r.unidad} · aprobada ${cuandoCorto(r.aprobadaEl)}`,
                  accion: { texto: 'Registrar recepción', a: `/almacen/recepcion?solicitud=${r.id}` },
                }))}
              />
            )}
          </Bloque>
        </div>
        <div className="col">
          <Bloque titulo="Últimas recepciones" enlace={{ texto: 'Ver inventario', a: '/inventario' }}>
            {d.recientes.length === 0 ? (
              <p className="sec">Todavía no hay recepciones.</p>
            ) : (
              <Lista
                items={d.recientes.map((l) => ({
                  id: l.codigo,
                  principal: (
                    <>
                      <span className="mono">{l.codigo}</span> ·{' '}
                      <Link to={`/inventario/${l.insumoId}`}>{l.insumo}</Link>
                    </>
                  ),
                  secundario: `${fechaCorta(l.ingreso)} · ${l.proveedor}`,
                  // La cantidad que queda en el lote, no la recibida: los despachos ya pudieron sacar parte
                  derecha: (
                    <span className="num sec">
                      Quedan {numero(l.cantidad, 3)} {l.unidad}
                    </span>
                  ),
                }))}
              />
            )}
          </Bloque>
        </div>
      </div>
    </div>
  )
}
