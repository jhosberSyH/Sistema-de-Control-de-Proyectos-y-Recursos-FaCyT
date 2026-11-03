import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { AreaTexto, Campo, Entrada, Selector } from '@/components/ui/campo'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { diaMes, fechaCorta, fechaIso, leerMonto, nombreMes, numero } from '@/lib/formato'
import { useRegistrarUso, useUsoMateria } from '../api/almacen'
import type { UsoMateria } from '../types'
import { minuscula } from '../utils/cantidad'
import './almacen.css'

const cant = (n: number, unidad: string) => `${n < 0 ? '−' : ''}${numero(Math.abs(n), 3)} ${unidad}`
const pct = (n: number) => `${Math.max(0, Math.min(100, n * 100))}%`

/**
 * Vista 20: registrar el uso de materia prima (F6.4). Muestra lo despachado al proyecto y lo ya usado en
 * el mes; si el uso supera lo despachado avisa, pero deja guardar (el aprobador verá la diferencia).
 */
export function VistaUsoMateria() {
  const [params, setParams] = useSearchParams()
  const [fecha, setFecha] = useState(fechaIso())
  const filtros = { proyecto: params.get('proyecto') ?? '', insumo: params.get('insumo') ?? '', fecha }
  const datos = useUsoMateria(filtros)
  useTituloPagina('Registrar uso de materia prima')

  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />

  return (
    <Formulario
      d={datos.data}
      fecha={fecha}
      alCambiarFecha={setFecha}
      alElegir={(c) =>
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
        )
      }
    />
  )
}

function Formulario({
  d,
  fecha,
  alCambiarFecha,
  alElegir,
}: {
  d: UsoMateria
  fecha: string
  alCambiarFecha: (f: string) => void
  alElegir: (c: { proyecto?: string; insumo?: string }) => void
}) {
  const navigate = useNavigate()
  const registrar = useRegistrarUso()
  const [texto, setTexto] = useState('')
  const [observaciones, setObservaciones] = useState('')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [hecho, setHecho] = useState<string | null>(null)
  const refCantidad = useRef<HTMLInputElement>(null)
  const refHecho = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (hecho) refHecho.current?.focus()
  }, [hecho])

  const insumo = d.insumos.find((i) => i.id === d.insumo)
  const u = insumo?.unidad ?? ''
  const nuevo = Math.max(0, leerMonto(texto) ?? 0)
  const total = d.usado + nuevo
  const exceso = Math.round((total - d.despachado) * 1000) / 1000
  const base = Math.max(d.despachado, total) || 1

  async function guardar(e: FormEvent) {
    e.preventDefault()
    if (registrar.isPending || !d.proyecto || !insumo) return
    if (!(nuevo > 0)) {
      setErrores({ cantidad: 'Escribe la cantidad usada, mayor que cero.' })
      refCantidad.current?.focus()
      return
    }
    try {
      await registrar.mutateAsync({
        proyecto: d.proyecto,
        insumoId: insumo.id,
        cantidad: nuevo,
        fecha,
        observaciones,
      })
      setHecho(`Registraste ${cant(nuevo, u)} de ${minuscula(insumo.nombre)} en ${d.proyecto}.`)
      setTexto('')
      setObservaciones('')
      setErrores({})
    } catch (err) {
      if (esApiError(err) && err.status === 422) setErrores(err.errores)
    }
  }
  const errorGeneral =
    registrar.isError && !(esApiError(registrar.error) && registrar.error.status === 422)
      ? registrar.error.message
      : null

  return (
    <div className="vista-uso-materia">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/proyectos">Mis proyectos</Link>
              </li>
              {d.proyecto && (
                <li className="mono">
                  <Link to={`/proyectos/${d.proyecto}`}>{d.proyecto}</Link>
                </li>
              )}
              <li aria-current="page">Registrar uso</li>
            </ol>
          </nav>
          <h1>Registrar uso de materia prima</h1>
          <p className="sub">Lo que el proyecto consumió de lo que se le despachó.</p>
        </div>
      </div>

      {hecho && (
        <div ref={refHecho} tabIndex={-1} className="hecho">
          <Aviso tipo="ok">
            <p>{hecho}</p>
          </Aviso>
        </div>
      )}

      {d.proyectos.length === 0 ? (
        <EstadoVacio icono="proyectos" titulo="No tienes proyectos vigentes">
          El uso de materia prima se registra en tus proyectos.
        </EstadoVacio>
      ) : (
        <div className="dos">
          <form className="tarjeta form-u" noValidate aria-label="Uso de materia prima" onSubmit={guardar}>
            {errorGeneral && (
              <Aviso tipo="err">
                <p>{errorGeneral}</p>
              </Aviso>
            )}
            <Campo etiqueta="Proyecto" error={errores.proyecto}>
              {(c) => (
                <Selector
                  {...c}
                  value={d.proyecto ?? ''}
                  onChange={(e) => alElegir({ proyecto: e.target.value, insumo: '' })}
                >
                  {d.proyectos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} · {p.nombre}
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <Campo
              etiqueta="Insumo"
              ayuda={
                d.insumos.length === 0
                  ? 'A este proyecto todavía no se le despachó materia prima.'
                  : 'Solo aparecen los insumos despachados a este proyecto.'
              }
              error={errores.insumoId}
            >
              {(c) => (
                <Selector
                  {...c}
                  value={d.insumo ?? ''}
                  disabled={d.insumos.length === 0}
                  onChange={(e) => alElegir({ insumo: e.target.value })}
                >
                  {d.insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad})
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <div className="form-rejilla">
              <Campo etiqueta="Cantidad usada" error={errores.cantidad}>
                {(c) => (
                  <div className="con-unidad">
                    <Entrada
                      {...c}
                      ref={refCantidad}
                      className="num"
                      inputMode="decimal"
                      autoComplete="off"
                      style={{ textAlign: 'right', fontSize: 20 }}
                      value={texto}
                      onChange={(e) => {
                        setTexto(e.target.value)
                        setErrores((x) => ({ ...x, cantidad: '' }))
                      }}
                    />
                    <span className="sec" aria-hidden="true">
                      {u}
                    </span>
                  </div>
                )}
              </Campo>
              <Campo etiqueta="Fecha" error={errores.fecha}>
                {(c) => (
                  <Entrada
                    {...c}
                    type="date"
                    max={fechaIso()}
                    value={fecha}
                    onChange={(e) => e.target.value && alCambiarFecha(e.target.value)}
                  />
                )}
              </Campo>
            </div>
            <Campo etiqueta="Observaciones" opcional>
              {(c) => (
                <AreaTexto
                  {...c}
                  className="obs-u"
                  maxLength={300}
                  value={observaciones}
                  onChange={(e) => setObservaciones(e.target.value)}
                />
              )}
            </Campo>
            {insumo && exceso > 0 && nuevo > 0 && (
              <Aviso tipo="warn">
                <p>
                  <b>El uso supera lo despachado en {cant(exceso, u)}.</b>
                </p>
                <p>
                  Revisa la cantidad. Si de verdad se usó más, puedes guardarlo; el aprobador verá la
                  diferencia. Si falta material,{' '}
                  <Link to={`/solicitudes?nueva=retiro&proyecto=${d.proyecto}&insumo=${insumo.id}`}>
                    crea una solicitud de retiro
                  </Link>
                  .
                </p>
              </Aviso>
            )}
            <div className="acc-form">
              <button
                className="btn btn-sec"
                type="button"
                onClick={() => navigate(d.proyecto ? `/proyectos/${d.proyecto}` : '/proyectos')}
              >
                Cancelar
              </button>
              <button
                className="btn btn-pri"
                type="submit"
                disabled={!insumo}
                aria-disabled={registrar.isPending || undefined}
              >
                {registrar.isPending
                  ? 'Guardando…'
                  : exceso > 0 && nuevo > 0
                    ? 'Guardar con la diferencia'
                    : 'Guardar uso'}
              </button>
            </div>
          </form>

          <aside className="tarjeta balance" aria-label="Despachado y usado" aria-live="polite">
            {insumo ? (
              <>
                <h2>
                  {insumo.nombre} en <span className="mono">{d.proyecto}</span>,{' '}
                  {d.mes.inicio.slice(0, 7) === d.mes.fin.slice(0, 7)
                    ? nombreMes(d.mes.inicio)
                    : `desde el ${diaMes(d.mes.inicio)}`}
                </h2>
                <div className="cifras">
                  <div>
                    <span>Despachado</span>
                    <b>{cant(d.despachado, u)}</b>
                  </div>
                  <div>
                    <span>Usado hasta hoy</span>
                    <b>{cant(d.usado, u)}</b>
                  </div>
                  <div>
                    <span>{exceso > 0 ? 'Diferencia' : 'Queda sin registrar'}</span>
                    <b>{cant(-exceso, u)}</b>
                  </div>
                </div>
                <div className="barra-b" role="presentation">
                  <span
                    className="usado"
                    style={{ width: pct(Math.min(d.usado, Math.max(d.despachado, d.usado)) / base) }}
                  />
                  {nuevo > 0 && (
                    <span
                      className="nuevo"
                      style={{
                        left: pct(d.usado / base),
                        width: pct(Math.max(0, Math.min(nuevo, d.despachado - d.usado)) / base),
                      }}
                    />
                  )}
                  {exceso > 0 && (
                    <span
                      className="exceso"
                      style={{
                        left: pct(Math.max(d.despachado, d.usado) / base),
                        width: pct((total - Math.max(d.despachado, d.usado)) / base),
                      }}
                    />
                  )}
                </div>
                <div className="leyenda">
                  <span>■ Usado</span>
                  <span>▨ Este registro</span>
                  {exceso > 0 && <span className="exc">▨ Exceso sobre lo despachado (en rojo)</span>}
                </div>
                {d.usos.length === 0 ? (
                  <p className="sec">Todavía no hay usos registrados este mes.</p>
                ) : (
                  <ul className="lista" style={{ fontSize: 15 }}>
                    {d.usos.map((x) => (
                      <li key={x.id}>
                        <div className="izq">
                          {fechaCorta(x.fecha)} · {cant(x.cantidad, u)}
                          {x.observaciones && <small>{x.observaciones}</small>}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            ) : (
              <p className="sec">Elige un insumo despachado para ver cuánto se usó.</p>
            )}
          </aside>
        </div>
      )}
    </div>
  )
}
