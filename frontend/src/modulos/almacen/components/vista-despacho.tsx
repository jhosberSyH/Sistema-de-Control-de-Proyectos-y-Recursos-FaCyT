import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { Campo, Entrada } from '@/components/ui/campo'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { diaMes, fechaCorta, fechaIso, hora, moneda } from '@/lib/formato'
import { useNuevoDespacho, useRegistrarDespacho } from '../api/almacen'
import type { DespachoRegistrado, NuevoDespacho } from '../types'
import { cantidad, minuscula } from '../utils/cantidad'
import './almacen.css'

/** "hoy a las 08:15", "ayer a las 16:05" o "el 26/10 a las 09:00" */
function cuando(fecha: string) {
  const dia = fechaIso(fecha)
  if (dia === fechaIso()) return `hoy a las ${hora(fecha)}`
  if (dia === fechaIso(new Date(Date.now() - 86_400_000))) return `ayer a las ${hora(fecha)}`
  return `el ${diaMes(fecha)} a las ${hora(fecha)}`
}

/**
 * Vista 18: despachar un retiro aprobado (F6.2, F6.3). ?solicitud= (UUID) elige el retiro; sin él, el más
 * antiguo de los aprobados. Al terminar muestra el despacho registrado y lleva al siguiente.
 */
export function VistaDespacho() {
  const [params] = useSearchParams()
  const solicitud = params.get('solicitud')
  // Otra solicitud empieza de cero (lotes, quién retira y el resultado anterior)
  return <Despacho key={solicitud ?? 'primero'} solicitud={solicitud} />
}

function Despacho({ solicitud }: { solicitud: string | null }) {
  const datos = useNuevoDespacho(solicitud)
  const [hecho, setHecho] = useState<DespachoRegistrado | null>(null)
  const navigate = useNavigate()
  const id = datos.data?.solicitud?.id
  const numero = datos.data?.solicitud?.numero
  // El título muestra el número (SOL-…), nunca el UUID
  useTituloPagina(numero ? `Despachar ${numero}` : 'Despacho')

  // Sin ?solicitud=, la URL fija la que se abrió: así un recargo no salta a otra
  useEffect(() => {
    if (!solicitud && id && !hecho) navigate(`?solicitud=${id}`, { replace: true })
  }, [solicitud, id, hecho, navigate])

  if (hecho) return <Exito d={hecho} />
  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando el despacho…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (datos.isError) {
    return (
      <div className="vista-despacho">
        {/* La URL trae el UUID, que no se muestra */}
        <Cabecera numero={null} />
        <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
        <p>
          <Link to="/almacen">Volver al almacén</Link>
        </p>
      </div>
    )
  }
  if (!datos.data.solicitud) {
    return (
      <div className="vista-despacho">
        <Cabecera numero={null} />
        <EstadoVacio
          icono="almacen"
          titulo="No hay despachos por entregar"
          accion={<BotonEnlace to="/almacen">Volver al almacén</BotonEnlace>}
        >
          Los retiros se aprueban en la bandeja; cuando haya uno, aparece aquí.
        </EstadoVacio>
      </div>
    )
  }
  return <Formulario d={datos.data} alListo={setHecho} />
}

/** numero: el de la solicitud que se despacha (SOL-2026-0001), o null mientras no se sabe. */
function Cabecera({ numero, sub }: { numero: string | null; sub?: ReactNode }) {
  return (
    <div className="cab">
      <div>
        <nav aria-label="Ruta de navegación">
          <ol className="migas">
            <li>
              <Link to="/almacen">Almacén</Link>
            </li>
            <li>Despachos por entregar</li>
            {numero && (
              <li aria-current="page" className="mono">
                {numero}
              </li>
            )}
          </ol>
        </nav>
        <h1>
          {numero ? (
            <>
              Despachar <span className="mono">{numero}</span>
            </>
          ) : (
            'Despacho'
          )}
        </h1>
        {sub && <p className="sub">{sub}</p>}
      </div>
    </div>
  )
}

function Formulario({ d, alListo }: { d: NuevoDespacho; alListo: (r: DespachoRegistrado) => void }) {
  const s = d.solicitud!
  const navigate = useNavigate()
  const registrar = useRegistrarDespacho()
  const [lotes, setLotes] = useState<Record<string, string>>(() =>
    Object.fromEntries(d.lineas.map((l) => [l.insumoId, l.lotes.find((x) => x.sugerido)?.codigo ?? ''])),
  )
  const [retiro, setRetiro] = useState(d.personas[0] ?? '')
  const [observacion, setObservacion] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const refRetiro = useRef<HTMLInputElement>(null)
  const sinLote = d.lineas.filter((l) => !l.lotes.some((x) => !x.vencido && x.cantidad >= l.cantidad))

  async function confirmar(e: FormEvent) {
    e.preventDefault()
    if (registrar.isPending) return
    if (!retiro.trim()) {
      setErrores({ retiro: 'Escribe quién retira los insumos.' })
      refRetiro.current?.focus()
      return
    }
    try {
      alListo(await registrar.mutateAsync({ solicitud: s.id, lotes, retiro: retiro.trim(), observacion }))
    } catch (err) {
      if (esApiError(err) && err.status === 422) setErrores(err.errores)
    }
  }
  const errorGeneral =
    registrar.isError && !(esApiError(registrar.error) && registrar.error.status === 422)
      ? registrar.error.message
      : null

  const resumen = d.lineas
    .map((l) => `${cantidad(l.cantidad, l.unidad)} de ${lotes[l.insumoId] || 'un lote'}`)
    .join(' y ')

  return (
    <div className="vista-despacho">
      <Cabecera
        numero={s.numero}
        sub={
          <>
            Retiro aprobado para <span className="mono">{s.proyecto}</span>
            {s.coordinador ? `, ${s.coordinador}` : ''} · aprobado {cuando(s.aprobadaEl)}
          </>
        }
      />
      <div className="vista-form">
        <Aviso tipo="info" rol="none">
          <p>
            Marcamos el lote que vence primero de cada insumo. Puedes cambiarlo; los lotes vencidos se ven,
            pero no se pueden elegir.
          </p>
        </Aviso>

        {d.lineas.map((l) => {
          const idTitulo = `t-${l.insumoId}`
          const error = errores[`lotes.${l.insumoId}`]
          return (
            <section key={l.insumoId} className="tarjeta insumo-d" aria-labelledby={idTitulo}>
              <div className="cab-i">
                <h2 id={idTitulo}>
                  {l.insumo} · {cantidad(l.cantidad, l.unidad)}
                </h2>
                <span className="sec">
                  Stock total {cantidad(l.stock, l.unidad)}
                  {l.vence ? '' : ' · no vence'}
                </span>
              </div>
              {error && (
                <Aviso tipo="err" className="error-lote">
                  <p>{error}</p>
                </Aviso>
              )}
              {sinLote.includes(l) && (
                <Aviso tipo="warn" rol="none" className="error-lote">
                  <p>
                    Ningún lote vigente tiene {cantidad(l.cantidad, l.unidad)}. Despacha este retiro cuando
                    llegue la reposición.
                  </p>
                </Aviso>
              )}
              <div className="lotes" role="radiogroup" aria-labelledby={idTitulo}>
                {l.lotes.map((x) => {
                  const noAlcanza = !x.vencido && x.cantidad < l.cantidad
                  const bloqueado = x.vencido || noAlcanza
                  const elegido = lotes[l.insumoId] === x.codigo
                  return (
                    <div key={x.codigo}>
                      <label className={`lote${elegido ? ' sel' : ''}${bloqueado ? ' bloq' : ''}`}>
                        <input
                          type="radio"
                          name={l.insumoId}
                          value={x.codigo}
                          checked={elegido}
                          disabled={bloqueado}
                          onChange={() => {
                            setLotes((v) => ({ ...v, [l.insumoId]: x.codigo }))
                            setErrores((e) => ({ ...e, [`lotes.${l.insumoId}`]: '' }))
                          }}
                        />
                        <span className="mono">{x.codigo}</span>
                        <span>
                          {x.vencido ? (
                            <ChipEstado tipo="err">Vencido el {fechaCorta(x.vence!)}</ChipEstado>
                          ) : (
                            <>
                              {x.vence
                                ? `Vence el ${fechaCorta(x.vence)}`
                                : `Ingresó el ${fechaCorta(x.ingreso)}`}{' '}
                              {x.sugerido && (
                                <span className="sug">
                                  <Icono nombre="ok" />
                                  {x.vence ? 'Vence primero' : 'Ingresó primero'}
                                </span>
                              )}
                            </>
                          )}
                        </span>
                        <span className="n">
                          {cantidad(x.cantidad, l.unidad)}
                          {x.vencido ? '' : noAlcanza ? ', no alcanza' : ' disponibles'}
                        </span>
                        <span className="n">{x.ubicacion}</span>
                      </label>
                    </div>
                  )
                })}
              </div>
            </section>
          )
        })}

        <form className="tarjeta confirmar" noValidate aria-label="Confirmar despacho" onSubmit={confirmar}>
          {errorGeneral && (
            <Aviso tipo="err">
              <p>{errorGeneral}</p>
            </Aviso>
          )}
          <div className="form-rejilla">
            <Campo
              etiqueta="Quién retira"
              ayuda="El personal de laboratorio no tiene cuenta, pero su nombre queda en la bitácora."
              error={errores.retiro || undefined}
            >
              {(c) => (
                <>
                  <Entrada
                    {...c}
                    ref={refRetiro}
                    list="personas"
                    autoComplete="off"
                    value={retiro}
                    onChange={(e) => {
                      setRetiro(e.target.value)
                      setErrores((x) => ({ ...x, retiro: '' }))
                    }}
                  />
                  <datalist id="personas">
                    {d.personas.map((p) => (
                      <option key={p} value={p} />
                    ))}
                  </datalist>
                </>
              )}
            </Campo>
            <Campo etiqueta="Observación" opcional>
              {(c) => (
                <Entrada
                  {...c}
                  maxLength={300}
                  value={observacion}
                  onChange={(e) => setObservacion(e.target.value)}
                />
              )}
            </Campo>
          </div>
          <p className="resumen-d">
            Al confirmar se registra el despacho en la bitácora, se descuentan {resumen}, y{' '}
            <span className="mono">{s.numero}</span> pasa a Ejecutado. Todo en una sola operación.
          </p>
          <div className="acc-form">
            <button className="btn btn-sec" type="button" onClick={() => navigate('/almacen')}>
              Volver
            </button>
            <button
              className="btn btn-pri"
              type="submit"
              disabled={sinLote.length > 0}
              aria-disabled={registrar.isPending || undefined}
            >
              {registrar.isPending ? 'Registrando…' : 'Confirmar despacho'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

/** "Despacho registrado" del mockup: qué salió, de qué lote, quién retiró y cuánto subió el gasto. */
function Exito({ d }: { d: DespachoRegistrado }) {
  const ref = useRef<HTMLElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <div className="vista-despacho">
      <Cabecera
        numero={d.solicitud}
        sub={
          <>
            Retiro aprobado para <span className="mono">{d.proyecto}</span>
            {d.coordinador ? `, ${d.coordinador}` : ''} · aprobado {cuando(d.aprobadaEl)}
          </>
        }
      />
      <div className="vista-ok">
        <section className="tarjeta exito" role="status" tabIndex={-1} ref={ref}>
          <Icono nombre="ok" />
          <h2 style={{ fontSize: 22 }}>
            Despacho <span className="mono">{d.codigo}</span> registrado
          </h2>
          <p>
            {d.lineas.map((l, i) => (
              <span key={l.lote + i}>
                {i > 0 && (i === d.lineas.length - 1 ? ' y ' : ', ')}
                {i === 0 ? l.insumo : minuscula(l.insumo)} {cantidad(l.cantidad, l.unidad)} del lote{' '}
                <span className="mono">{l.lote}</span>
              </span>
            ))}
            , retirados por {d.retiro} hoy a las {hora(d.fecha)}. <span className="mono">{d.solicitud}</span>{' '}
            quedó en Ejecutado y el gasto de <span className="mono">{d.proyecto}</span> subió{' '}
            {moneda(d.monto)}.
          </p>
          <div className="acc-form" style={{ justifyContent: 'flex-start' }}>
            <BotonEnlace variante="pri" to={`/proyectos/bitacora?despacho=${d.codigo}`}>
              Ver en la bitácora
            </BotonEnlace>
            {d.siguiente && d.siguienteId ? (
              <BotonEnlace to={`/almacen/despacho?solicitud=${d.siguienteId}`}>
                Siguiente despacho: <span className="mono">{d.siguiente}</span>
              </BotonEnlace>
            ) : (
              <BotonEnlace to="/almacen">Volver al almacén</BotonEnlace>
            )}
          </div>
        </section>
      </div>
    </div>
  )
}
