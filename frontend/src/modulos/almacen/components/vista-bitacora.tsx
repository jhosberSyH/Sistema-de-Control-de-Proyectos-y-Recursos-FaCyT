import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Boton } from '@/components/ui/boton'
import { AreaTexto, Campo, Entrada, Selector } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { OpcionesTarjeta } from '@/components/ui/opciones'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { fechaCorta, hora, leerMonto } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useBitacora, usePedirCorreccion } from '../api/almacen'
import type { Bitacora, FiltrosBitacora, LineaBitacora } from '../types'
import { cantidad } from '../utils/cantidad'
import './almacen.css'

/** "1 L", "−20 g": los movimientos de corrección van con signo. */
const conSigno = (n: number, unidad: string) => `${n < 0 ? '−' : ''}${cantidad(Math.abs(n), unidad)}`

/**
 * Vista 19: bitácora de despachos (F6.3) y pedido de corrección (F6.5). Nadie edita ni borra un registro
 * (RN-06): un error se corrige con un movimiento nuevo, enlazado al original. El Coordinador ve sus
 * proyectos (RN-07) y pide correcciones; el Aprobador la consulta completa.
 */
export function VistaBitacora({ puedePedir }: { puedePedir: boolean }) {
  const [params, setParams] = useSearchParams()
  const filtros: FiltrosBitacora = {
    proyecto: params.get('proyecto') ?? '',
    desde: params.get('desde') ?? '',
    hasta: params.get('hasta') ?? '',
    q: params.get('q') ?? '',
    despacho: params.get('despacho') ?? '',
  }
  const datos = useBitacora(filtros)
  const [corrigiendo, setCorrigiendo] = useState<LineaBitacora | null>(null)
  const [enviada, setEnviada] = useState<{ id: string; despacho: string } | null>(null)
  const refEnviada = useRef<HTMLDivElement>(null)
  useTituloPagina('Bitácora de despachos')

  // Desde "Pedir corrección" de la revisión de cargos (vista 21): ?despacho=…&corregir=1 abre el diálogo si
  // el despacho tiene una sola línea que se pueda corregir; si tiene varias, queda resaltado para elegir.
  const [autoAbierto, setAutoAbierto] = useState(false)
  if (!autoAbierto && params.get('corregir') && datos.data) {
    setAutoAbierto(true)
    const lineas = datos.data.filas.filter((f) => f.codigo === datos.data.resaltado && f.puedeCorregir)
    if (lineas.length === 1) setCorrigiendo(lineas[0])
  }

  useEffect(() => {
    if (enviada) refEnviada.current?.focus()
  }, [enviada])
  // Un enlace a un despacho (desde Mis solicitudes o el despacho registrado) lo deja a la vista
  const resaltado = datos.data?.resaltado
  useEffect(() => {
    if (resaltado) document.querySelector('tr.resaltado')?.scrollIntoView?.({ block: 'center' })
  }, [resaltado])

  const alCambiar = useCallback(
    (c: Partial<FiltrosBitacora>) =>
      setParams(
        (prev) => {
          const n = new URLSearchParams(prev)
          for (const [k, v] of Object.entries(c)) {
            if (v) n.set(k, v)
            else n.delete(k)
          }
          return n
        },
        { replace: true },
      ),
    [setParams],
  )

  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando la bitácora…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
  const d = datos.data

  return (
    <div className="vista-bitacora">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                {/* El Aprobador llega desde el almacén: no tiene la lista de proyectos */}
                <Link to={puedePedir ? '/proyectos' : '/almacen'}>
                  {puedePedir ? 'Mis proyectos' : 'Almacén'}
                </Link>
              </li>
              <li aria-current="page">Bitácora de despachos</li>
            </ol>
          </nav>
          <h1>Bitácora de despachos</h1>
          <p className="sub">
            {puedePedir
              ? 'Cada salida del almacén hacia tus proyectos.'
              : 'Cada salida del almacén hacia los proyectos.'}{' '}
            <span className="candado">
              <Icono nombre="candado" />
              Nadie puede editar ni borrar un registro.
              {puedePedir ? ' Si hay un error, pide una corrección.' : ''}
            </span>
          </p>
        </div>
      </div>

      {enviada && (
        <div ref={refEnviada} tabIndex={-1} className="hecho">
          <Aviso tipo="ok">
            <p>
              Enviaste la corrección <span className="mono">{enviada.id}</span> de{' '}
              <span className="mono">{enviada.despacho}</span>. Queda pendiente en la bandeja del aprobador;
              te llegará un aviso cuando decida.
            </p>
          </Aviso>
        </div>
      )}

      <section className="tarjeta bit" aria-label="Despachos">
        <Filtros d={d} filtros={filtros} alCambiar={alCambiar} />
        {d.filas.length === 0 ? (
          <EstadoVacio icono="almacen" titulo="No hay despachos en este rango">
            Cambia las fechas, el proyecto o el insumo.
          </EstadoVacio>
        ) : (
          <TablaDatos apilable titulo="Despachos">
            <thead>
              <tr>
                <th scope="col">Despacho</th>
                <th scope="col">Fecha y hora</th>
                <th scope="col">Proyecto</th>
                <th scope="col">Insumo y lote</th>
                <th scope="col" className="n">
                  Cantidad
                </th>
                <th scope="col">Retiró</th>
                <th scope="col">
                  <span className="vh">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.filas.map((f) => (
                <tr key={f.id} className={cn(f.corrige && 'comp', f.codigo === d.resaltado && 'resaltado')}>
                  <td className="mono">{f.codigo}</td>
                  <td data-e="Fecha:">
                    {fechaCorta(f.fecha)} {hora(f.fecha)}
                  </td>
                  <td className="mono" data-e="Proyecto:">
                    {f.proyecto ?? '—'}
                  </td>
                  <td>
                    {f.insumo}
                    {f.corrige ? (
                      <small>
                        <span className="enlace-c">
                          <Icono nombre="flecha" />
                          Corrige a <span className="mono">{f.corrige}</span>
                          {f.aprobadaPor ? `, aprobada por ${f.aprobadaPor}` : ''}
                        </span>
                        {' · '}
                        <span className="mono">{f.lote}</span>
                      </small>
                    ) : (
                      <small className="mono">{f.lote}</small>
                    )}
                  </td>
                  <td className="n" data-e="Cantidad:">
                    {conSigno(f.cantidad, f.unidad)}
                  </td>
                  <td data-e={f.corrige ? '' : 'Retiró:'}>
                    {f.corrige ? 'Movimiento de corrección' : (f.retiro ?? '—')}
                  </td>
                  <td className="acc-fila">
                    <Accion f={f} alPedir={() => setCorrigiendo(f)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </TablaDatos>
        )}
      </section>

      {corrigiendo && (
        <DialogoCorreccion
          f={corrigiendo}
          proyectos={d.proyectos.filter((p) => p.codigo !== corrigiendo.proyecto)}
          alCerrar={() => setCorrigiendo(null)}
          alEnviar={(id) => {
            setEnviada({ id, despacho: corrigiendo.codigo })
            setCorrigiendo(null)
          }}
        />
      )}
    </div>
  )
}

function Accion({ f, alPedir }: { f: LineaBitacora; alPedir: () => void }) {
  if (f.corregidoPor) {
    return (
      <span className="enlace-c">
        Corregido por <span className="mono">{f.corregidoPor}</span>
      </span>
    )
  }
  if (f.correccionPendiente) return <ChipEstado tipo="warn">Corrección pendiente</ChipEstado>
  if (!f.puedeCorregir) return null
  return (
    <Boton chico onClick={alPedir}>
      Pedir corrección{' '}
      <span className="vh">
        de {f.codigo}, {f.insumo}
      </span>
    </Boton>
  )
}

/** Filtros del mockup: proyecto, rango de fechas e insumo (con espera al escribir). */
function Filtros({
  d,
  filtros,
  alCambiar,
}: {
  d: Bitacora
  filtros: FiltrosBitacora
  alCambiar: (c: Partial<FiltrosBitacora>) => void
}) {
  const [texto, setTexto] = useState(filtros.q)
  const [anterior, setAnterior] = useState(filtros.q)
  if (filtros.q !== anterior) {
    setAnterior(filtros.q)
    setTexto(filtros.q)
  }
  useEffect(() => {
    if (texto === filtros.q) return
    const t = window.setTimeout(() => alCambiar({ q: texto }), 300)
    return () => window.clearTimeout(t)
  }, [texto, filtros.q, alCambiar])

  return (
    <form className="herr" aria-label="Filtros" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="campo">
        <label htmlFor="f-proy">Proyecto</label>
        <select
          className="entrada"
          id="f-proy"
          value={filtros.proyecto}
          onChange={(e) => alCambiar({ proyecto: e.target.value })}
        >
          <option value="">{d.proyectos.length <= 4 ? 'Todos mis proyectos' : 'Todos los proyectos'}</option>
          {d.proyectos.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.codigo}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-desde">Desde</label>
        <input
          className="entrada"
          id="f-desde"
          type="date"
          value={filtros.desde || d.desde}
          max={filtros.hasta || d.hasta}
          onChange={(e) => alCambiar({ desde: e.target.value, despacho: '' })}
        />
      </div>
      <div className="campo">
        <label htmlFor="f-hasta">Hasta</label>
        <input
          className="entrada"
          id="f-hasta"
          type="date"
          value={filtros.hasta || d.hasta}
          min={filtros.desde || d.desde}
          onChange={(e) => alCambiar({ hasta: e.target.value, despacho: '' })}
        />
      </div>
      <div className="campo busq">
        <label htmlFor="q">Insumo</label>
        <Icono nombre="buscar" />
        <input
          className="entrada"
          id="q"
          type="search"
          placeholder="Nombre del insumo"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
    </form>
  )
}

/** "Pedir corrección" (mockup 19, F6.5): la cantidad o el proyecto, con el motivo obligatorio. */
function DialogoCorreccion({
  f,
  proyectos,
  alCerrar,
  alEnviar,
}: {
  f: LineaBitacora
  proyectos: { codigo: string; nombre: string }[]
  alCerrar: () => void
  alEnviar: (id: string) => void
}) {
  const pedir = usePedirCorreccion()
  const [campo, setCampo] = useState<'cantidad' | 'proyecto'>('cantidad')
  const [texto, setTexto] = useState('')
  const [destino, setDestino] = useState('')
  const [motivo, setMotivo] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const refCantidad = useRef<HTMLInputElement>(null)
  const refProyecto = useRef<HTMLSelectElement>(null)
  const refMotivo = useRef<HTMLTextAreaElement>(null)
  const nueva = leerMonto(texto)
  const diferencia = nueva !== null ? nueva - f.cantidad : null

  async function enviar() {
    const e: Record<string, string> = {}
    if (campo === 'cantidad') {
      if (nueva === null) e.cantidadNueva = 'Escribe la cantidad correcta, por ejemplo 0,5.'
      else if (nueva === f.cantidad) e.cantidadNueva = 'Es la misma cantidad registrada.'
    } else if (!destino) e.proyectoNuevo = 'Elige el proyecto correcto.'
    if (!motivo.trim()) e.motivo = 'Escribe el motivo de la corrección. Sin motivo no se puede enviar.'
    setErrores(e)
    if (e.cantidadNueva) return refCantidad.current?.focus()
    if (e.proyectoNuevo) return refProyecto.current?.focus()
    if (e.motivo) return refMotivo.current?.focus()
    try {
      const r = await pedir.mutateAsync(
        campo === 'cantidad'
          ? { lineaId: f.id, campo, cantidadNueva: nueva!, motivo: motivo.trim() }
          : { lineaId: f.id, campo, proyectoNuevo: destino, motivo: motivo.trim() },
      )
      alEnviar(r.id)
    } catch (err) {
      if (esApiError(err) && err.status === 422) setErrores(err.errores)
    }
  }
  const errorGeneral =
    pedir.isError && !(esApiError(pedir.error) && pedir.error.status === 422) ? pedir.error.message : null

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo={
        <>
          Pedir corrección de <span className="mono">{f.codigo}</span>
        </>
      }
      descripcion={
        <>
          {f.insumo} · lote <span className="mono">{f.lote}</span> · {fechaCorta(f.fecha)} {hora(f.fecha)}
        </>
      }
      alEnviar={(e) => {
        e.preventDefault()
        if (!pedir.isPending) void enviar()
      }}
    >
      <OpcionesTarjeta
        leyenda="Qué está mal"
        opciones={[
          { valor: 'cantidad', etiqueta: 'La cantidad' },
          { valor: 'proyecto', etiqueta: 'El proyecto', deshabilitada: proyectos.length === 0 },
        ]}
        valor={campo}
        alCambiar={(v) => {
          setCampo(v)
          setErrores({})
        }}
      />
      <div className="form-rejilla">
        <div className="campo-orig">
          <span>Registrado</span>
          <b className={campo === 'proyecto' ? 'mono' : undefined}>
            {campo === 'cantidad' ? cantidad(f.cantidad, f.unidad) : f.proyecto}
          </b>
        </div>
        {campo === 'cantidad' ? (
          <Campo etiqueta="Cantidad correcta" error={errores.cantidadNueva}>
            {(c) => (
              <div className="con-unidad">
                <Entrada
                  {...c}
                  ref={refCantidad}
                  className="num"
                  inputMode="decimal"
                  autoComplete="off"
                  style={{ textAlign: 'right' }}
                  value={texto}
                  onChange={(e) => {
                    setTexto(e.target.value)
                    setErrores((x) => ({ ...x, cantidadNueva: '' }))
                  }}
                />
                <span className="sec" aria-hidden="true">
                  {f.unidad}
                </span>
              </div>
            )}
          </Campo>
        ) : (
          <Campo etiqueta="Proyecto correcto" error={errores.proyectoNuevo}>
            {(c) => (
              <Selector
                {...c}
                ref={refProyecto}
                value={destino}
                onChange={(e) => {
                  setDestino(e.target.value)
                  setErrores((x) => ({ ...x, proyectoNuevo: '' }))
                }}
              >
                <option value="">Elige el proyecto</option>
                {proyectos.map((p) => (
                  <option key={p.codigo} value={p.codigo}>
                    {p.codigo} · {p.nombre}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
        )}
        <Campo
          className="ancho"
          etiqueta="Motivo"
          ayuda="El aprobador lo verá junto al despacho original."
          error={errores.motivo}
        >
          {(c) => (
            <AreaTexto
              {...c}
              ref={refMotivo}
              className="motivo-c"
              maxLength={500}
              value={motivo}
              onChange={(e) => {
                setMotivo(e.target.value)
                setErrores((x) => ({ ...x, motivo: '' }))
              }}
            />
          )}
        </Campo>
      </div>
      <Aviso tipo="info" rol="none">
        <p>
          El despacho original no cambia. Si el aprobador acepta, se registra un movimiento nuevo
          {campo === 'cantidad'
            ? diferencia !== null && diferencia !== 0
              ? ` de ${conSigno(diferencia, f.unidad)}`
              : ''
            : destino
              ? ` que pasa el cargo a ${destino}`
              : ''}{' '}
          enlazado a este.
        </p>
      </Aviso>
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}
      <div className="acc-form">
        <button className="btn btn-sec" type="button" onClick={alCerrar}>
          Cancelar
        </button>
        <button className="btn btn-pri" type="submit" aria-disabled={pedir.isPending || undefined}>
          {pedir.isPending ? 'Enviando…' : 'Enviar corrección'}
        </button>
      </div>
    </Dialogo>
  )
}
