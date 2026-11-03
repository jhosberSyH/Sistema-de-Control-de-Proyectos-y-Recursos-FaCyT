import { useCallback, useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { AreaTexto, Campo, Entrada, Selector } from '@/components/ui/campo'
import { DialogoAlerta } from '@/components/ui/dialogo'
import { esApiError } from '@/lib/api-client'
import { hora, leerMonto, monto as formatoMonto, numero, porcentaje } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useDescartarBorrador, useEnviarSolicitud, useGuardarBorrador } from '../api/solicitudes'
import type { ContenidoBorrador, InsumoPedido, ProyectoPropio, Solicitud, TipoSolicitud } from '../types'

type Linea = { clave: number; insumoId: string; cantidad: string }

type Props = {
  tipo: TipoSolicitud
  /** El borrador que se sigue editando, o null si es nuevo. */
  inicial: Solicitud | null
  /** Datos para empezar: proyecto o insumo de la URL, o una solicitud rechazada que se copia. */
  semilla: { proyecto?: string; insumo?: string; copia?: Solicitud | null }
  misProyectos: ProyectoPropio[]
  insumos: InsumoPedido[]
  /** El borrador ya existe: la URL pasa a ?id= (HU-15: al volver sigue ahí). */
  alCrear: (id: string) => void
  alEnviada: (s: Solicitud) => void
  alDescartado: (id: string) => void
  alVolver: () => void
}

const cantidad = (v: number, unidad: string) => `${numero(v, 3)} ${unidad}`
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const MAX_ADJUNTO = 5 * 1024 * 1024
let siguiente = 0

/**
 * Formulario de la vista 14 para una solicitud de retiro (F5.2) o de gasto (F5.1). Se guarda solo
 * mientras se escribe; "Enviar a aprobación" valida los datos obligatorios y pide confirmación (F5.3).
 */
export function FormularioSolicitud({
  tipo,
  inicial,
  semilla,
  misProyectos,
  insumos,
  alCrear,
  alEnviada,
  alDescartado,
  alVolver,
}: Props) {
  const base = inicial ?? semilla.copia ?? null
  const guardar = useGuardarBorrador()
  const enviar = useEnviarSolicitud()
  const descartar = useDescartarBorrador()

  const [id, setId] = useState<string | null>(inicial?.id ?? null)
  const [proyecto, setProyecto] = useState(
    () =>
      [base?.proyecto, semilla.proyecto].find((p) => p && misProyectos.some((x) => x.codigo === p)) ??
      misProyectos[0]?.codigo ??
      '',
  )
  const [lineas, setLineas] = useState<Linea[]>(() => {
    const desde = base?.lineas.length
      ? base.lineas.map((l) => ({ insumoId: l.insumoId, cantidad: numero(l.cantidad, 3) }))
      : [
          {
            insumoId: semilla.insumo && insumos.some((i) => i.id === semilla.insumo) ? semilla.insumo : '',
            cantidad: '',
          },
        ]
    return desde.map((l) => ({ ...l, clave: siguiente++ }))
  })
  const [proposito, setProposito] = useState(base?.proposito ?? '')
  const [insumoServicio, setInsumoServicio] = useState(base?.insumoServicio ?? '')
  const [cantidadGasto, setCantidadGasto] = useState(base?.cantidadGasto ?? '')
  const [montoTexto, setMontoTexto] = useState(base?.monto ? formatoMonto(base.monto) : '')
  const [justificacion, setJustificacion] = useState(base?.justificacion ?? '')
  const [cotizacion, setCotizacion] = useState<string | null>(base?.cotizacion ?? null)

  const [guardado, setGuardado] = useState<{
    estado: 'nada' | 'guardando' | 'guardado' | 'error'
    hora: string | null
  }>({ estado: inicial ? 'guardado' : 'nada', hora: inicial?.fecha ?? null })
  const [version, setVersion] = useState(0)
  const [errores, setErrores] = useState<Record<string, string>>({})
  const [faltan, setFaltan] = useState<number | null>(null)
  const [confirmando, setConfirmando] = useState<null | 'enviar' | 'descartar'>(null)

  const contenido: ContenidoBorrador =
    tipo === 'retiro'
      ? {
          proyecto,
          proposito,
          lineas: lineas
            .filter((l) => l.insumoId)
            .map((l) => ({ insumoId: l.insumoId, cantidad: leerMonto(l.cantidad) ?? 0 })),
        }
      : {
          proyecto,
          insumoServicio,
          cantidadGasto,
          monto: leerMonto(montoTexto),
          justificacion,
          cotizacion,
        }

  // ---------- Guardado automático (F5.1) ----------
  // Las peticiones van en fila: la primera crea el borrador y las siguientes lo actualizan.
  const refContenido = useRef(contenido)
  const refId = useRef(id)
  useEffect(() => {
    refContenido.current = contenido
  })
  const cola = useRef<Promise<string | null>>(Promise.resolve(id))
  const guardarAhora = useCallback(() => {
    cola.current = cola.current.then(async () => {
      setGuardado((g) => ({ ...g, estado: 'guardando' }))
      try {
        const s = await guardar.mutateAsync({ id: refId.current, tipo, contenido: refContenido.current })
        if (!refId.current) {
          refId.current = s.id
          setId(s.id)
          alCrear(s.id)
        }
        setGuardado({ estado: 'guardado', hora: s.fecha })
        return s.id
      } catch {
        setGuardado((g) => ({ ...g, estado: 'error' }))
        return refId.current
      }
    })
    return cola.current
  }, [guardar, tipo, alCrear])
  const sinGuardar = useRef(false)
  useEffect(() => {
    if (version === 0) return
    sinGuardar.current = true
    const t = window.setTimeout(() => {
      sinGuardar.current = false
      void guardarAhora()
    }, 700)
    return () => window.clearTimeout(t)
  }, [version, guardarAhora])

  /** Cada cambio del usuario: borra el error de ese campo y programa el guardado. */
  const cambio = (campo?: string) => {
    setVersion((v) => v + 1)
    if (campo && errores[campo]) {
      setErrores((e) => {
        const resto = { ...e }
        delete resto[campo]
        return resto
      })
    }
  }

  // ---------- Envío (F5.3) ----------
  function faltantes() {
    const e: Record<string, string> = {}
    if (!proyecto) e.proyecto = 'Elige el proyecto.'
    if (tipo === 'gasto') {
      if (!insumoServicio.trim()) e.insumoServicio = 'Escribe qué insumo o servicio necesitas.'
      if (!cantidadGasto.trim()) e.cantidadGasto = 'Escribe la cantidad, por ejemplo 1 frasco.'
      if (!((leerMonto(montoTexto) ?? 0) > 0))
        e.monto = 'Escribe el monto estimado. Si tienes cotización, usa ese valor.'
      if (!justificacion.trim())
        e.justificacion = 'Escribe para qué se necesita: el aprobador decide con esto.'
    } else {
      lineas.forEach((l, i) => {
        if (!l.insumoId) e[`lineas.${i}.insumoId`] = 'Elige el insumo.'
        if (!((leerMonto(l.cantidad) ?? 0) > 0))
          e[`lineas.${i}.cantidad`] = 'Escribe una cantidad mayor que cero.'
      })
      if (lineas.length === 0) e.lineas = 'Agrega al menos un insumo.'
    }
    return e
  }

  /** Lleva el foco al primer dato faltante, en orden de pantalla. */
  function enfocar(e: Record<string, string>) {
    const orden =
      tipo === 'gasto'
        ? ['proyecto', 'insumoServicio', 'cantidadGasto', 'monto', 'justificacion']
        : [
            'proyecto',
            ...lineas.flatMap((_, i) => [`lineas.${i}.insumoId`, `lineas.${i}.cantidad`]),
            'lineas',
          ]
    const primero = orden.find((k) => e[k])
    const ids: Record<string, string> = {
      proyecto: tipo === 'gasto' ? 'g-proy' : 'r-proy',
      insumoServicio: 'g-tipo',
      cantidadGasto: 'g-cant',
      monto: 'g-monto',
      justificacion: 'g-desc',
      lineas: 'agregar-insumo',
    }
    const m = primero ? /^lineas\.(\d+)\.(insumoId|cantidad)$/.exec(primero) : null
    const destino = m
      ? `${m[2] === 'insumoId' ? 'i' : 'c'}${lineas[Number(m[1])].clave}`
      : primero && ids[primero]
    if (destino) document.getElementById(destino)?.focus()
  }

  async function intentarEnviar() {
    if (enviar.isPending) return
    const e = faltantes()
    // El borrador se guarda igual, aunque falten datos ("Tu borrador sigue guardado")
    const guardadoId = await guardarAhora()
    if (Object.keys(e).length > 0) {
      setErrores(e)
      setFaltan(Object.keys(e).length)
      enfocar(e)
      return
    }
    setErrores({})
    setFaltan(null)
    if (guardadoId) setConfirmando('enviar')
  }

  // mutateAsync y no los callbacks de mutate: al quedar Pendiente, la vista deja de mostrar el formulario
  // y TanStack Query no llama los callbacks de un componente desmontado.
  async function confirmarEnvio() {
    if (!id || enviar.isPending) return
    try {
      alEnviada(await enviar.mutateAsync(id))
    } catch (err) {
      setConfirmando(null)
      if (esApiError(err) && err.status === 422) {
        setErrores(err.errores)
        setFaltan(Object.keys(err.errores).length)
        enfocar(err.errores)
      }
    }
  }

  const proyectoActual = misProyectos.find((p) => p.codigo === proyecto)
  const insumoDe = (insumoId: string) => insumos.find((i) => i.id === insumoId)
  const excedidos = lineas
    .map((l) => ({ i: insumoDe(l.insumoId), c: leerMonto(l.cantidad) }))
    .filter((x): x is { i: InsumoPedido; c: number } => Boolean(x.i) && x.c !== null && x.c > x.i!.disponible)
  /** "acetona grado analítico" o "acetona grado analítico y metanol grado HPLC" */
  const nombres = (lista: InsumoPedido[]) => {
    const n = lista.map((i) => minuscula(i.nombre))
    return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : n[0]
  }
  const errorGeneral =
    (guardar.error && !esApiError(guardar.error)) ||
    (enviar.error && !(esApiError(enviar.error) && enviar.error.status === 422))
      ? (enviar.error ?? guardar.error)?.message
      : null

  return (
    <>
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/solicitudes">Solicitudes</Link>
              </li>
              <li aria-current="page">Nueva solicitud de {tipo}</li>
            </ol>
          </nav>
          <h1>Nueva solicitud de {tipo}</h1>
          <p className="sub" aria-live="polite">
            {guardado.estado === 'guardando' ? (
              <span className="guardado">Guardando…</span>
            ) : guardado.estado === 'error' ? (
              <span className="guardado error">
                <Icono nombre="error" />
                No pudimos guardar el borrador.{' '}
                <button type="button" onClick={() => void guardarAhora()}>
                  Reintentar
                </button>
              </span>
            ) : guardado.estado === 'guardado' && id && guardado.hora ? (
              <span className="guardado">
                <Icono nombre="ok" />
                Borrador <span className="mono">{id}</span> guardado a las {hora(guardado.hora)}
              </span>
            ) : (
              <span className="guardado">Se guarda sola mientras escribes.</span>
            )}
          </p>
        </div>
      </div>

      <form
        className="tarjeta form-s"
        noValidate
        aria-label={`Solicitud de ${tipo}`}
        onSubmit={(ev) => {
          ev.preventDefault()
          void intentarEnviar()
        }}
      >
        {faltan !== null && (
          <div className="aviso-envio">
            <Aviso tipo="err">
              <p>
                <b>{faltan === 1 ? 'Falta 1 dato para enviar.' : `Faltan ${faltan} datos para enviar.`}</b>{' '}
                {faltan === 1 ? 'Lo marcamos abajo.' : 'Los marcamos abajo.'} Tu borrador sigue guardado.
              </p>
            </Aviso>
          </div>
        )}

        {tipo === 'retiro' ? (
          <>
            <div className="form-rejilla">
              <Campo etiqueta="Proyecto" id="r-proy" error={errores.proyecto}>
                {(c) => (
                  <Selector
                    {...c}
                    value={proyecto}
                    onChange={(e) => {
                      setProyecto(e.target.value)
                      cambio('proyecto')
                    }}
                  >
                    {misProyectos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.codigo} · {p.nombre}
                      </option>
                    ))}
                  </Selector>
                )}
              </Campo>
              <Campo etiqueta="Para qué se usará" opcional id="r-uso">
                {(c) => (
                  <Entrada
                    {...c}
                    maxLength={200}
                    value={proposito}
                    onChange={(e) => {
                      setProposito(e.target.value)
                      cambio()
                    }}
                  />
                )}
              </Campo>
            </div>
            <div>
              <h2 style={{ fontSize: 17, fontFamily: 'var(--f-body)', marginBottom: 10 }}>Insumos</h2>
              {lineas.length > 0 && (
                <div className="items">
                  {lineas.map((l, n) => {
                    const ins = insumoDe(l.insumoId)
                    const c = leerMonto(l.cantidad)
                    const excede = Boolean(ins && c !== null && c > ins.disponible)
                    return (
                      <div key={l.clave} className={cn('item', excede && 'excede')}>
                        <Campo etiqueta="Insumo" id={`i${l.clave}`} error={errores[`lineas.${n}.insumoId`]}>
                          {(cc) => (
                            <Selector
                              {...cc}
                              value={l.insumoId}
                              onChange={(e) => {
                                setLineas((ls) =>
                                  ls.map((x) =>
                                    x.clave === l.clave ? { ...x, insumoId: e.target.value } : x,
                                  ),
                                )
                                cambio(`lineas.${n}.insumoId`)
                              }}
                            >
                              <option value="" disabled>
                                Elige el insumo
                              </option>
                              {insumos.map((i) => (
                                <option
                                  key={i.id}
                                  value={i.id}
                                  // Un insumo va en una sola línea
                                  disabled={i.id !== l.insumoId && lineas.some((x) => x.insumoId === i.id)}
                                >
                                  {i.nombre}
                                </option>
                              ))}
                            </Selector>
                          )}
                        </Campo>
                        <Campo
                          etiqueta={ins ? `Cantidad (${ins.unidad})` : 'Cantidad'}
                          id={`c${l.clave}`}
                          error={errores[`lineas.${n}.cantidad`]}
                        >
                          {(cc) => (
                            <Entrada
                              {...cc}
                              className="num"
                              inputMode="decimal"
                              autoComplete="off"
                              style={{ textAlign: 'right' }}
                              value={l.cantidad}
                              onChange={(e) => {
                                setLineas((ls) =>
                                  ls.map((x) =>
                                    x.clave === l.clave ? { ...x, cantidad: e.target.value } : x,
                                  ),
                                )
                                cambio(`lineas.${n}.cantidad`)
                              }}
                            />
                          )}
                        </Campo>
                        <p className="disp" aria-live="polite">
                          {ins &&
                            (excede ? (
                              <span className="estado warn">
                                <Icono nombre="alerta" />
                                Pides {cantidad(c!, ins.unidad)} y hay {cantidad(ins.disponible, ins.unidad)}
                              </span>
                            ) : (
                              <>
                                Disponible <b>{cantidad(ins.disponible, ins.unidad)}</b>
                              </>
                            ))}
                        </p>
                        <button
                          className="quitar"
                          type="button"
                          aria-label={`Quitar ${ins ? minuscula(ins.nombre) : `insumo ${n + 1}`}`}
                          onClick={() => {
                            setLineas((ls) => ls.filter((x) => x.clave !== l.clave))
                            setErrores({})
                            cambio()
                            document.getElementById('agregar-insumo')?.focus()
                          }}
                        >
                          <Icono nombre="error" />
                        </button>
                      </div>
                    )
                  })}
                </div>
              )}
              <button
                className="btn btn-txt"
                type="button"
                id="agregar-insumo"
                style={{ marginTop: 8 }}
                onClick={() => {
                  const clave = siguiente++
                  setLineas((ls) => [...ls, { clave, insumoId: '', cantidad: '' }])
                  if (errores.lineas) {
                    setErrores((e) => {
                      const resto = { ...e }
                      delete resto.lineas
                      return resto
                    })
                  }
                  window.setTimeout(() => document.getElementById(`i${clave}`)?.focus())
                }}
              >
                <Icono nombre="mas" />
                Agregar insumo
              </button>
              {errores.lineas && (
                <p className="msg-error">
                  <Icono nombre="error" />
                  <span>{errores.lineas}</span>
                </p>
              )}
            </div>
            {/* F5.2: pedir más de lo disponible se avisa, pero no se bloquea */}
            {excedidos.length > 0 && (
              <Aviso tipo="warn">
                <p>
                  Puedes enviarla así: el aprobador verá que {nombres(excedidos.map((x) => x.i))}{' '}
                  {excedidos.length === 1 ? 'no alcanza' : 'no alcanzan'}.
                  {excedidos
                    .filter((x) => x.i.reposicionEnCurso)
                    .map((x) => ` Ya hay una reposición de ${minuscula(x.i.nombre)} en curso.`)
                    .join('')}
                </p>
              </Aviso>
            )}
          </>
        ) : (
          <>
            <div className="form-rejilla">
              <Campo etiqueta="Proyecto" id="g-proy" error={errores.proyecto}>
                {(c) => (
                  <Selector
                    {...c}
                    value={proyecto}
                    onChange={(e) => {
                      setProyecto(e.target.value)
                      cambio('proyecto')
                    }}
                  >
                    {misProyectos.map((p) => (
                      <option key={p.codigo} value={p.codigo}>
                        {p.codigo} · {p.nombre}
                      </option>
                    ))}
                  </Selector>
                )}
              </Campo>
              <Campo etiqueta="Insumo o servicio" id="g-tipo" error={errores.insumoServicio}>
                {(c) => (
                  <Entrada
                    {...c}
                    maxLength={160}
                    value={insumoServicio}
                    onChange={(e) => {
                      setInsumoServicio(e.target.value)
                      cambio('insumoServicio')
                    }}
                  />
                )}
              </Campo>
              <Campo etiqueta="Cantidad" id="g-cant" error={errores.cantidadGasto}>
                {(c) => (
                  <Entrada
                    {...c}
                    maxLength={60}
                    value={cantidadGasto}
                    onChange={(e) => {
                      setCantidadGasto(e.target.value)
                      cambio('cantidadGasto')
                    }}
                  />
                )}
              </Campo>
              <Campo etiqueta="Monto estimado (US$)" id="g-monto" error={errores.monto}>
                {(c) => (
                  <Entrada
                    {...c}
                    className="num"
                    inputMode="decimal"
                    autoComplete="off"
                    value={montoTexto}
                    onChange={(e) => {
                      setMontoTexto(e.target.value)
                      cambio('monto')
                    }}
                    onBlur={(e) => {
                      const n = leerMonto(e.target.value)
                      if (n !== null && n > 0) setMontoTexto(formatoMonto(n))
                    }}
                  />
                )}
              </Campo>
              <Campo className="ancho" etiqueta="Descripción" id="g-desc" error={errores.justificacion}>
                {(c) => (
                  <AreaTexto
                    {...c}
                    maxLength={600}
                    value={justificacion}
                    onChange={(e) => {
                      setJustificacion(e.target.value)
                      cambio('justificacion')
                    }}
                  />
                )}
              </Campo>
              <Campo
                className="ancho"
                etiqueta={
                  <>
                    Cotización <span className="obligatorio">(opcional, ayuda a que la aprueben)</span>
                  </>
                }
                id="g-adj"
                ayuda="PDF o imagen, de hasta 5 MB."
                error={errores.cotizacion}
              >
                {(c) =>
                  cotizacion ? (
                    <div className="adjunto">
                      <Icono nombre="ok" />
                      <span>
                        Adjuntaste <b>{cotizacion}</b>
                      </span>
                      <button
                        className="btn btn-txt btn-chico"
                        type="button"
                        onClick={() => {
                          setCotizacion(null)
                          cambio()
                          window.setTimeout(() => document.getElementById('g-adj')?.focus())
                        }}
                      >
                        Quitar <span className="vh">la cotización</span>
                      </button>
                    </div>
                  ) : (
                    <Entrada
                      {...c}
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      style={{ paddingTop: 10 }}
                      onChange={(e) => {
                        const archivo = e.target.files?.[0]
                        if (!archivo) return
                        if (archivo.size > MAX_ADJUNTO) {
                          setErrores((x) => ({
                            ...x,
                            cotizacion: 'El archivo pesa más de 5 MB. Prueba con uno más liviano.',
                          }))
                          e.target.value = ''
                          return
                        }
                        setCotizacion(archivo.name)
                        cambio('cotizacion')
                      }}
                    />
                  )
                }
              </Campo>
            </div>
            {proyectoActual && (
              <p className="sec" style={{ fontSize: 14 }}>
                {proyectoActual.codigo} lleva {porcentaje(proyectoActual.ejecucion)} de ejecución
                presupuestaria. El aprobador lo verá junto a tu solicitud.
              </p>
            )}
          </>
        )}

        {errorGeneral && (
          <Aviso tipo="err">
            <p>{errorGeneral}</p>
          </Aviso>
        )}
        <div className="acc-form">
          {id && (
            <button className="btn btn-txt izq" type="button" onClick={() => setConfirmando('descartar')}>
              Descartar borrador
            </button>
          )}
          <button
            className="btn btn-sec"
            type="button"
            onClick={async () => {
              // Lo escrito en los últimos instantes también queda guardado
              if (sinGuardar.current) await guardarAhora()
              alVolver()
            }}
          >
            Volver a mis solicitudes
          </button>
          <button className="btn btn-pri" type="submit" aria-disabled={enviar.isPending || undefined}>
            {enviar.isPending ? 'Enviando…' : 'Enviar a aprobación'}
          </button>
        </div>
      </form>

      <DialogoAlerta
        abierto={confirmando === 'enviar'}
        alCambiar={(abierto) => {
          if (!abierto) setConfirmando(null)
        }}
        titulo={`¿Enviar ${id} a aprobación?`}
        descripcion="Llega a la bandeja del aprobador y ya no se puede editar."
        confirmar={enviar.isPending ? 'Enviando…' : 'Enviar a aprobación'}
        ocupado={enviar.isPending}
        alConfirmar={() => void confirmarEnvio()}
      />
      <DialogoAlerta
        abierto={confirmando === 'descartar'}
        alCambiar={(abierto) => {
          if (!abierto) setConfirmando(null)
        }}
        titulo={`¿Descartar el borrador ${id}?`}
        descripcion="Se borra lo que escribiste. No llega al aprobador."
        confirmar={descartar.isPending ? 'Descartando…' : 'Descartar borrador'}
        peligro
        ocupado={descartar.isPending}
        alConfirmar={() => {
          if (id) descartar.mutate(id, { onSuccess: () => alDescartado(id) })
        }}
      />
    </>
  )
}
