import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Boton } from '@/components/ui/boton'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { diaCorto, hora, moneda, numero } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useBandeja } from '../api/bandeja'
import type { FiltroBandeja, Pedido } from '../types/bandeja'
import {
  codigoPedido,
  etiquetaPedido,
  coincide,
  cuandoLista,
  esFiltro,
  FILTROS,
  GRUPOS,
  minuscula,
} from '../utils/bandeja'
import { DetalleEjecutar, DetallePedido } from './detalle-pedido'
import './bandeja.css'

/** Segunda y tercera línea de cada pedido en la lista (mockup 15). */
function lineas(p: Pedido): [string, ReactNode] {
  const proyecto = p.proyecto?.codigo ?? ''
  switch (p.clase) {
    case 'gasto':
      return [`Gasto · ${proyecto}`, moneda(p.monto)]
    case 'retiro':
      return [
        `Retiro de insumos · ${proyecto}`,
        p.lineas.length === 1 ? '1 insumo' : `${p.lineas.length} insumos`,
      ]
    case 'reserva':
      return [
        `Reserva · ${minuscula(p.equipo.nombre)} · ${proyecto}`,
        `${diaCorto(p.inicio)} · ${hora(p.inicio)} a ${hora(p.fin)}`,
      ]
    case 'correccion':
      return [`Corrección de despacho · ${proyecto}`, <span className="mono">{p.despacho.codigo}</span>]
    case 'reposicion': {
      const u = p.insumo.unidad
      return [
        `Reposición · ${minuscula(p.insumo.nombre)}`,
        `Queda ${numero(p.insumo.stock, 3)} ${u}, mínimo ${numero(p.insumo.minimo, 3)} ${u}`,
      ]
    }
  }
}

type Hecho = { texto: string; siguiente: string | null }

/**
 * Vista 15: bandeja de aprobación (F3.5, F4.5, F5.4, F6.6) y los gastos aprobados por ejecutar (F5.5).
 * La URL guarda el filtro (?tipo=) y el pedido abierto (?pedido=), así los avisos y el inicio llevan
 * directo a cada uno (L8). En el teléfono la lista y el detalle son dos pasos.
 */
export function VistaBandeja() {
  const [params, setParams] = useSearchParams()
  const bandeja = useBandeja()
  useTituloPagina('Bandeja de aprobación')
  const pedidoUrl = params.get('pedido')
  const [paso, setPaso] = useState<'lista' | 'detalle'>(() => (pedidoUrl ? 'detalle' : 'lista'))
  const [hecho, setHecho] = useState<Hecho | null>(null)
  const refHecho = useRef<HTMLDivElement>(null)
  const refLista = useRef<HTMLDivElement>(null)
  const volviendo = useRef(false)

  useEffect(() => {
    if (hecho) refHecho.current?.focus()
  }, [hecho])
  useEffect(() => {
    if (paso !== 'lista' || !volviendo.current) return
    volviendo.current = false
    refLista.current?.querySelector<HTMLButtonElement>('[aria-current="true"]')?.focus()
  }, [paso])

  if (bandeja.isPending) {
    return (
      <Cargando etiqueta="Cargando la bandeja…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (bandeja.isError)
    return <ErrorCarga mensaje={bandeja.error.message} alReintentar={() => bandeja.refetch()} />

  const { pendientes, porEjecutar } = bandeja.data
  const pedidoPorEjecutar = porEjecutar.some((p) => p.id === pedidoUrl)
  const tipoUrl = params.get('tipo')
  // Un gasto por ejecutar abre su segmento aunque la URL no lo diga (el aviso lleva solo el código)
  const filtro: FiltroBandeja = pedidoPorEjecutar
    ? 'ejecutar'
    : esFiltro(tipoUrl) && !(tipoUrl === 'ejecutar' && pendientes.some((p) => p.id === pedidoUrl))
      ? tipoUrl
      : 'todos'
  const visibles: Pedido[] =
    filtro === 'ejecutar' ? porEjecutar : pendientes.filter((p) => coincide(p, filtro))
  const ausente =
    pedidoUrl && !pendientes.some((p) => p.id === pedidoUrl) && !pedidoPorEjecutar ? pedidoUrl : null
  const seleccionado = visibles.find((p) => p.id === pedidoUrl) ?? (ausente ? null : (visibles[0] ?? null))
  const contar = (f: FiltroBandeja) =>
    f === 'ejecutar' ? porEjecutar.length : pendientes.filter((p) => coincide(p, f)).length

  function cambiarFiltro(f: FiltroBandeja) {
    const nuevos = f === 'ejecutar' ? porEjecutar : pendientes.filter((p) => coincide(p, f))
    setParams(
      () => {
        const n = new URLSearchParams()
        if (f !== 'todos') n.set('tipo', f)
        if (seleccionado && nuevos.some((p) => p.id === seleccionado.id)) n.set('pedido', seleccionado.id)
        return n
      },
      { replace: true },
    )
  }

  function elegir(id: string) {
    setHecho(null)
    setPaso('detalle')
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        n.set('pedido', id)
        return n
      },
      { replace: true },
    )
    // En el teléfono el detalle reemplaza a la lista: se vuelve al inicio y el foco pasa al título
    if (window.matchMedia?.('(max-width: 760px)').matches) {
      requestAnimationFrame(() => {
        document.getElementById('contenido')?.scrollIntoView({ block: 'start' })
        document.getElementById('detalle-titulo')?.focus()
      })
    }
  }

  function resuelto(p: Pedido, texto: string) {
    const siguiente = visibles.find((x) => x.id !== p.id) ?? null
    setParams(
      (prev) => {
        const n = new URLSearchParams(prev)
        if (siguiente) n.set('pedido', siguiente.id)
        else n.delete('pedido')
        return n
      },
      { replace: true },
    )
    setHecho({ texto, siguiente: siguiente ? codigoPedido(siguiente) : null })
  }

  const total = pendientes.length

  return (
    <div className="vista-bandeja">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/inicio">Inicio</Link>
              </li>
              <li aria-current="page">Bandeja de aprobación</li>
            </ol>
          </nav>
          <h1>Bandeja de aprobación</h1>
          <p className="sub">
            {total === 0
              ? 'No tienes decisiones pendientes.'
              : `${total} ${total === 1 ? 'decisión pendiente' : 'decisiones pendientes'}, ordenadas por la prioridad del proyecto y luego por antigüedad.`}
          </p>
        </div>
      </div>

      <section className="bandeja" data-paso={paso} aria-label="Pedidos pendientes">
        <div className="filtros" role="group" aria-label="Tipo de pedido">
          {FILTROS.map((f) => (
            <button
              key={f.valor}
              type="button"
              className={cn(f.valor === 'ejecutar' && 'ejecutar')}
              aria-pressed={f.valor === filtro}
              onClick={() => cambiarFiltro(f.valor)}
            >
              {f.etiqueta} <span className="n">{contar(f.valor)}</span>
            </button>
          ))}
        </div>

        <div className="tarjeta col-lista" ref={refLista}>
          {visibles.length === 0 ? (
            <p className="vacio-lista">
              {filtro === 'ejecutar'
                ? 'No hay gastos aprobados por ejecutar.'
                : 'No quedan pedidos de este tipo.'}
            </p>
          ) : (
            GRUPOS.map((g) => {
              const del = visibles.filter((p) => p.grupo === g.grupo)
              if (del.length === 0) return null
              return (
                <div key={g.grupo}>
                  <h2 className={`grupo-cab ${g.clase}`}>
                    <i aria-hidden="true" />
                    {g.etiqueta} · {del.length}
                  </h2>
                  <ul className="pedidos">
                    {del.map((p) => {
                      const [l2, l3] = lineas(p)
                      return (
                        <li key={p.id}>
                          <button
                            type="button"
                            aria-current={p.id === seleccionado?.id}
                            onClick={() => elegir(p.id)}
                          >
                            <span className="l1">
                              <b>{etiquetaPedido(p)}</b>
                              <span>{cuandoLista(p.fecha)}</span>
                            </span>
                            <span className="l2">{l2}</span>
                            <span className="l3">{l3}</span>
                          </button>
                        </li>
                      )
                    })}
                  </ul>
                </div>
              )
            })
          )}
        </div>

        <div className="tarjeta col-det">
          <Boton
            variante="txt"
            className="volver"
            onClick={() => {
              volviendo.current = true
              setPaso('lista')
            }}
          >
            <Icono nombre="flecha" />
            Volver a la bandeja
          </Boton>
          {hecho && (
            <div ref={refHecho} tabIndex={-1} className="hecho">
              <Aviso tipo="ok">
                <p>
                  <b>{hecho.texto}</b>
                  {hecho.siguiente && ` Sigue ${hecho.siguiente}.`}
                </p>
              </Aviso>
            </div>
          )}
          <div className="detalle">
            {ausente && !hecho && (
              <Aviso tipo="info">
                {/* La URL lleva el UUID de una solicitud, que no se muestra */}
                <p>Ese pedido ya no está en la bandeja: alguien ya lo decidió.</p>
              </Aviso>
            )}
            {seleccionado ? (
              filtro === 'ejecutar' && seleccionado.clase === 'gasto' ? (
                <DetalleEjecutar
                  key={seleccionado.id}
                  p={seleccionado}
                  alResuelto={(t) => resuelto(seleccionado, t)}
                />
              ) : (
                <DetallePedido
                  key={seleccionado.id}
                  p={seleccionado}
                  alResuelto={(t) => resuelto(seleccionado, t)}
                />
              )
            ) : (
              <p className="vacio-lista">
                {visibles.length === 0 ? 'Nada por decidir aquí.' : 'Elige un pedido de la lista.'}
              </p>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}
