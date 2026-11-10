import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { Campo, Entrada, Selector } from '@/components/ui/campo'
import { ChipEstado } from '@/components/ui/estado'
import { TIPO_ESTADO_EQUIPO } from '@/components/ui/estados-dominio'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { Lista } from '@/components/ui/listas'
import { Bloque as BloqueTarjeta } from '@/components/ui/tarjeta'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { diaCorto, diaMes, diaYFecha, fechaIso, hora } from '@/lib/formato'
import {
  APERTURA,
  CIERRE,
  diaSemana,
  horaDe,
  instante,
  lunesDe,
  minutosDe,
  partesCaracas,
  rangosLibres,
  seCruzan,
  sumarDias,
} from '@/lib/horarios'
import { useSemanaEquipo, useSolicitarReserva } from '../api/reservas'
import type { ChoqueReserva, SemanaEquipo } from '../types'
import { bloqueDe, tituloSemana, type Bloque } from '../utils/reservas'
import { CalendarioSemana } from './calendario-semana'
import './reservas.css'

type Props = {
  /** El Coordinador pide reservas para sus proyectos; el Aprobador consulta el mismo calendario (plan §7.1). */
  rol: 'coordinador' | 'aprobador'
}

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** Hoy, o el lunes si hoy es domingo (los laboratorios cierran). */
function primerDiaHabil() {
  const hoy = fechaIso()
  return diaSemana(hoy) === 0 ? sumarDias(hoy, 1) : hoy
}

/** Vista 12: reservas de equipos (F4.3, F4.4), con el calendario de consulta del Aprobador. */
export function VistaReservas({ rol }: Props) {
  const [params, setParams] = useSearchParams()
  const consulta = {
    equipo: params.get('equipo') ?? '',
    semana: params.get('semana') ?? '',
    reserva: params.get('reserva') ?? '',
  }
  const semana = useSemanaEquipo(consulta)
  useTituloPagina('Reservas')
  const aprobador = rol === 'aprobador'
  // Sin equipo en la URL, el servidor elige uno: queda fijo, para que no cambie al pedir una reserva
  const elegido = semana.data?.equipo.id
  useEffect(() => {
    if (elegido && !params.get('equipo')) {
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.set('equipo', elegido)
          return n
        },
        { replace: true },
      )
    }
  }, [elegido, params, setParams])

  // Cambia el equipo o la semana; "?reserva=" (desde el inicio) solo vale para la primera vista.
  const ir = useCallback(
    (cambios: { equipo?: string; semana?: string }) =>
      setParams(
        (p) => {
          const n = new URLSearchParams(p)
          n.delete('reserva')
          if (cambios.equipo !== undefined) n.set('equipo', cambios.equipo)
          if (cambios.semana !== undefined) n.set('semana', cambios.semana)
          return n
        },
        { replace: true },
      ),
    [setParams],
  )

  if (semana.isPending) {
    return (
      <Cargando etiqueta="Cargando el calendario…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto ancho="50%" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (semana.isError) {
    return <ErrorCarga mensaje={semana.error.message} alReintentar={() => semana.refetch()} />
  }

  const d = semana.data
  const e = d.equipo
  return (
    <div className="vista-reservas">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/reservas">Equipos y reservas</Link>
              </li>
              <li aria-current="page">{e.nombre}</li>
            </ol>
          </nav>
          <h1>{aprobador ? e.nombre : `Reservar ${minuscula(e.nombre)}`}</h1>
          <p className="sub">
            <span className="mono">{e.codigo}</span> · {e.ubicacion} ·{' '}
            <ChipEstado tipo={TIPO_ESTADO_EQUIPO[e.estado]}>{e.estado}</ChipEstado>
          </p>
        </div>
        <div className="acc">
          <Campo etiqueta="Equipo" id="eq">
            {(c) => (
              <Selector {...c} value={e.id} onChange={(ev) => ir({ equipo: ev.target.value })}>
                {d.equipos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                    {x.estado === 'En mantenimiento' ? ' (en mantenimiento)' : ''}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
        </div>
      </div>

      {e.mantenimiento && (
        <Aviso tipo="warn" rol="none">
          <p>
            <b>El equipo está en mantenimiento desde el {diaMes(e.mantenimiento.desde)}.</b>
          </p>
          <p>
            No admite reservas nuevas hasta que vuelva a Disponible. «
            {e.mantenimiento.motivo.replace(/\.$/, '')}», según el administrador.
          </p>
        </Aviso>
      )}

      {aprobador ? (
        <div className="dos">
          <Calendario
            datos={d}
            bloques={d.reservas.map((r) => bloqueDe(r, true, d.resaltada))}
            ir={ir}
            aprobador
          />
          <Pendientes datos={d} />
        </div>
      ) : (
        // key: al cambiar de equipo el formulario empieza de cero (y la vista previa con él)
        <>
          <Solicitud key={e.id} datos={d} ir={ir} semanaPedida={consulta.semana} />
          <Rechazadas datos={d} ir={ir} />
        </>
      )}
    </div>
  )
}

function Calendario({
  datos,
  bloques,
  ir,
  aprobador,
  alElegir,
  alCambiarSemana,
}: {
  datos: SemanaEquipo
  bloques: Bloque[]
  ir: (c: { semana: string }) => void
  aprobador?: boolean
  alElegir?: (fecha: string, minutos: number) => void
  /** El formulario sigue a la semana que se mira. */
  alCambiarSemana?: (lunes: string) => void
}) {
  const cambiar = (lunes: string) => {
    ir({ semana: lunes })
    alCambiarSemana?.(lunes)
  }
  return (
    <section className="tarjeta cal-tarjeta" aria-labelledby="t-sem">
      <div className="cal-nav">
        <h2 id="t-sem">{tituloSemana(datos.semana)}</h2>
        <div className="flechas">
          <button
            className="btn btn-sec btn-chico"
            type="button"
            aria-label="Semana anterior"
            onClick={() => cambiar(sumarDias(datos.semana, -7))}
          >
            ‹
          </button>
          <button
            className="btn btn-sec btn-chico"
            type="button"
            onClick={() => cambiar(lunesDe(fechaIso()))}
          >
            Hoy
          </button>
          <button
            className="btn btn-sec btn-chico"
            type="button"
            aria-label="Semana siguiente"
            onClick={() => cambiar(sumarDias(datos.semana, 7))}
          >
            ›
          </button>
        </div>
      </div>
      <CalendarioSemana semana={datos.semana} bloques={bloques} alElegir={alElegir} />
      <div className="leyenda">
        {aprobador ? (
          <>
            <span>
              <i aria-hidden="true" style={{ background: 'var(--primary)' }} />
              Aprobada
            </span>
            <span>
              <i aria-hidden="true" style={{ border: '2px dashed var(--primary)' }} />
              Pendiente de aprobación
            </span>
          </>
        ) : (
          <>
            <span>
              <i
                aria-hidden="true"
                style={{ background: 'var(--surface-2)', border: '1px solid var(--border)' }}
              />
              Ocupado por otro proyecto
            </span>
            <span>
              <i aria-hidden="true" style={{ background: 'var(--primary)' }} />
              Tu reserva aprobada
            </span>
            <span>
              <i aria-hidden="true" style={{ border: '2px dashed var(--primary)' }} />
              Tu reserva pendiente
            </span>
            <span>
              <i aria-hidden="true" style={{ border: '2px dashed var(--ok)' }} />
              Horario libre sugerido
            </span>
          </>
        )}
      </div>
    </section>
  )
}

/** Aprobador: las pendientes de este equipo, que se deciden en la bandeja (una sola forma de decidir, L2). */
function Pendientes({ datos }: { datos: SemanaEquipo }) {
  return (
    <section className="tarjeta form-r" aria-labelledby="t-pend">
      <h2 id="t-pend">Pendientes de aprobación</h2>
      {datos.pendientes.length === 0 ? (
        <p className="sec">Este equipo no tiene reservas por decidir.</p>
      ) : (
        <ul className="pend-lista">
          {datos.pendientes.map((r) => (
            <li key={r.id}>
              <div>
                {diaCorto(r.inicio)} · {hora(r.inicio)} a {hora(r.fin)}
              </div>
              <span className="mono">{r.proyecto}</span>
            </li>
          ))}
        </ul>
      )}
      <BotonEnlace variante="pri" to="/bandeja?tipo=reserva">
        Decidir en la bandeja
      </BotonEnlace>
    </section>
  )
}

/** Coordinador: sus reservas rechazadas, con el motivo. El horario queda libre (HU-13). */
function Rechazadas({ datos, ir }: { datos: SemanaEquipo; ir: (c: { equipo: string }) => void }) {
  if (datos.rechazadas.length === 0) return null
  return (
    <BloqueTarjeta titulo="Reservas rechazadas" extra={<span className="conteo">Últimos 30 días</span>}>
      <Lista
        items={datos.rechazadas.map((r) => ({
          id: r.id,
          principal: (
            <>
              {r.equipo} · {diaCorto(r.inicio)}, {hora(r.inicio)} a {hora(r.fin)}
            </>
          ),
          secundario: (
            <>
              <span className="mono">{r.proyecto}</span> · «{r.motivo}»
            </>
          ),
          derecha: (
            <button className="btn btn-txt" type="button" onClick={() => ir({ equipo: r.equipoId })}>
              Ver equipo
            </button>
          ),
        }))}
      />
    </BloqueTarjeta>
  )
}

type Errores = Partial<Record<'proyecto' | 'fecha' | 'desde' | 'hasta', string>>

/** Coordinador: calendario y "Solicitar reserva" (F4.3), con la vista previa del choque (F4.4). */
function Solicitud({
  datos,
  ir,
  semanaPedida,
}: {
  datos: SemanaEquipo
  ir: (c: { semana: string }) => void
  /** La semana que ya está en la URL, aunque todavía no llegue: evita pedirla dos veces. */
  semanaPedida: string
}) {
  const solicitar = useSolicitarReserva()
  const e = datos.equipo
  const enMantenimiento = e.estado === 'En mantenimiento'
  // UUID del proyecto elegido; el selector muestra el código
  const [proyecto, setProyecto] = useState(datos.misProyectos[0]?.id ?? '')
  const [fecha, setFecha] = useState(() => {
    const hoy = primerDiaHabil()
    return lunesDe(hoy) === datos.semana ? hoy : datos.semana
  })
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [errores, setErrores] = useState<Errores>({})
  const [resultado, setResultado] = useState<ReactNode>(null)
  // "Ahora", para no ofrecer horarios que ya pasaron; se actualiza cada minuto
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 60_000)
    return () => window.clearInterval(t)
  }, [])
  const refResultado = useRef<HTMLDivElement>(null)
  const refEnviar = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (resultado) refResultado.current?.focus()
  }, [resultado])

  // El calendario sigue a la fecha del formulario
  const lunes = fecha && /^\d{4}-\d{2}-\d{2}$/.test(fecha) ? lunesDe(fecha) : datos.semana
  useEffect(() => {
    if (lunes !== datos.semana && lunes !== semanaPedida) ir({ semana: lunes })
  }, [lunes, datos.semana, semanaPedida, ir])

  const ini = minutosDe(desde)
  const fin = minutosDe(hasta)
  const enHorario =
    Boolean(fecha) &&
    diaSemana(fecha) !== 0 &&
    ini !== null &&
    fin !== null &&
    fin > ini &&
    ini >= APERTURA &&
    fin <= CIERRE
  const pedida = enHorario ? { inicio: instante(fecha, desde), fin: instante(fecha, hasta) } : null
  const futura = pedida !== null && Date.parse(pedida.inicio) > ahora
  const visible = lunes === datos.semana

  // Choque: el que dijo el servidor para estos mismos valores, o el que se ve en el calendario
  const enviada = solicitar.variables
  const delServidor =
    esApiError(solicitar.error) &&
    solicitar.error.status === 409 &&
    enviada?.inicio === pedida?.inicio &&
    enviada?.fin === pedida?.fin &&
    (solicitar.error.conflicto as ChoqueReserva | undefined)?.choque
      ? (solicitar.error.conflicto as ChoqueReserva)
      : null
  const local =
    pedida && futura && visible && !enMantenimiento
      ? datos.reservas.find((r) => seCruzan(r, pedida))
      : undefined
  const ocupadosDelDia = datos.reservas
    .map((r) => ({ a: partesCaracas(r.inicio), b: partesCaracas(r.fin) }))
    .filter(({ a }) => a.fecha === fecha)
    .map(({ a, b }) => ({ desde: a.minutos, hasta: b.minutos }))
  const choque: ChoqueReserva | null =
    delServidor ??
    (local
      ? {
          choque: {
            proyecto: local.proyecto,
            proyectoId: local.proyectoId,
            inicio: local.inicio,
            fin: local.fin,
          },
          libres: rangosLibres(ocupadosDelDia, ini ?? APERTURA)
            .slice(0, 3)
            .map((r) => ({
              inicio: instante(fecha, horaDe(r.desde)),
              fin: instante(fecha, horaDe(r.hasta)),
            })),
        }
      : null)

  // Vista previa en el calendario: la solicitud y, si choca, los horarios libres sugeridos
  const previa: Bloque[] = []
  if (pedida && futura && visible && !enMantenimiento && ini !== null && fin !== null) {
    if (choque) {
      previa.push({
        clave: 'nueva',
        fecha,
        desde: ini,
        hasta: fin,
        clase: 'nuevo',
        titulo: 'Tu solicitud',
        estado: 'Choca',
      })
      for (const l of choque.libres) {
        const a = partesCaracas(l.inicio)
        const b = partesCaracas(l.fin)
        previa.push({
          clave: `libre-${a.minutos}`,
          fecha,
          desde: a.minutos,
          hasta: b.minutos,
          clase: 'libre',
          titulo: 'Libre',
          estado: 'Horario sugerido',
        })
      }
    } else {
      previa.push({
        clave: 'nueva',
        fecha,
        desde: ini,
        hasta: fin,
        clase: 'libre',
        titulo: 'Tu solicitud',
        estado: 'Libre',
      })
    }
  }

  const limpiar = () => {
    setErrores({})
    setResultado(null)
  }

  // Elegir un horario libre sugerido: mantiene la duración pedida si cabe
  const usarLibre = (l: { inicio: string; fin: string }) => {
    const a = partesCaracas(l.inicio).minutos
    const b = partesCaracas(l.fin).minutos
    const duracion = ini !== null && fin !== null && fin > ini ? fin - ini : 60
    setDesde(horaDe(a))
    setHasta(horaDe(Math.min(b, a + duracion)))
    limpiar()
    solicitar.reset()
    refEnviar.current?.focus()
  }

  const enviar = () => {
    if (solicitar.isPending || enMantenimiento) return
    const err: Errores = {}
    if (!proyecto) err.proyecto = 'Elige el proyecto.'
    if (!fecha) err.fecha = 'Elige la fecha.'
    else if (diaSemana(fecha) === 0) err.fecha = 'Los domingos los laboratorios están cerrados.'
    if (ini === null) err.desde = 'Elige la hora de inicio.'
    if (fin === null) err.hasta = 'Elige la hora de fin.'
    else if (ini !== null && fin <= ini) err.hasta = 'La hora de fin tiene que ser después del inicio.'
    if (!err.desde && !err.hasta && ini !== null && fin !== null && (ini < APERTURA || fin > CIERRE)) {
      err.desde = `Los laboratorios atienden de ${horaDe(APERTURA)} a ${horaDe(CIERRE)}.`
    }
    if (!err.fecha && !err.desde && pedida && !futura)
      err.desde = 'La reserva tiene que empezar más tarde que ahora.'
    setErrores(err)
    setResultado(null)
    const primero = (['proyecto', 'fecha', 'desde', 'hasta'] as const).find((k) => err[k])
    if (primero || !pedida) {
      document.getElementById(`r-${primero ?? 'desde'}`)?.focus()
      return
    }
    solicitar.mutate(
      { equipoId: e.id, proyectoId: proyecto, inicio: pedida.inicio, fin: pedida.fin },
      {
        onSuccess: (r) => {
          setDesde('')
          setHasta('')
          setResultado(
            <p>
              {/* La reserva no tiene código visible (su id es un UUID): se nombra por equipo y proyecto */}
              Solicitaste {r.equipo} para <span className="mono">{r.proyecto}</span>: el {diaYFecha(r.inicio)}{' '}
              de {hora(r.inicio)} a {hora(r.fin)}. Queda pendiente hasta que la apruebe el aprobador, y te
              llegará un aviso cuando decida.
            </p>,
          )
        },
      },
    )
  }

  // 422 del servidor, junto a cada campo
  const delCampo =
    esApiError(solicitar.error) && solicitar.error.status === 422 ? solicitar.error.errores : {}
  const errorDe = (campo: keyof Errores) =>
    errores[campo] ??
    (campo === 'desde'
      ? delCampo.inicio
      : campo === 'hasta'
        ? delCampo.fin
        : campo === 'proyecto'
          ? delCampo.proyectoId
          : delCampo[campo]) ??
    undefined
  const errorGeneral =
    solicitar.error && !delServidor && !(esApiError(solicitar.error) && solicitar.error.status === 422)
      ? solicitar.error.message
      : null

  return (
    <div className="dos">
      <Calendario
        datos={datos}
        bloques={[...datos.reservas.map((r) => bloqueDe(r, false, datos.resaltada)), ...previa]}
        ir={ir}
        alElegir={
          enMantenimiento
            ? undefined
            : (f, minutos) => {
                setFecha(f)
                setDesde(horaDe(minutos))
                setHasta(horaDe(Math.min(minutos + 120, CIERRE)))
                limpiar()
              }
        }
        alCambiarSemana={(nuevo) => {
          // Mismo día de la semana en la semana nueva
          if (fecha) setFecha(sumarDias(nuevo, (diaSemana(fecha) + 6) % 7))
          limpiar()
        }}
      />

      <form
        className="tarjeta form-r"
        noValidate
        aria-labelledby="t-form"
        onSubmit={(ev) => {
          ev.preventDefault()
          enviar()
        }}
      >
        <h2 id="t-form">Solicitar reserva</h2>
        {datos.misProyectos.length === 0 ? (
          <p className="sec">No tienes proyectos vigentes para reservar equipos.</p>
        ) : (
          <>
            <Campo etiqueta="Proyecto" id="r-proyecto" error={errorDe('proyecto')}>
              {(c) => (
                <Selector {...c} value={proyecto} onChange={(ev) => setProyecto(ev.target.value)}>
                  <option value="" disabled>
                    Elige el proyecto
                  </option>
                  {datos.misProyectos.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.codigo} · {p.nombre}
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <Campo etiqueta="Fecha" id="r-fecha" error={errorDe('fecha')}>
              {(c) => (
                <Entrada
                  {...c}
                  type="date"
                  min={fechaIso()}
                  value={fecha}
                  onChange={(ev) => {
                    setFecha(ev.target.value)
                    limpiar()
                  }}
                />
              )}
            </Campo>
            <div className="horas-f">
              <Campo etiqueta="Desde" id="r-desde" error={errorDe('desde')}>
                {(c) => (
                  <Entrada
                    {...c}
                    type="time"
                    min={horaDe(APERTURA)}
                    max={horaDe(CIERRE)}
                    step={900}
                    value={desde}
                    onChange={(ev) => {
                      setDesde(ev.target.value)
                      limpiar()
                    }}
                  />
                )}
              </Campo>
              <Campo etiqueta="Hasta" id="r-hasta" error={errorDe('hasta')}>
                {(c) => (
                  <Entrada
                    {...c}
                    type="time"
                    min={horaDe(APERTURA)}
                    max={horaDe(CIERRE)}
                    step={900}
                    value={hasta}
                    onChange={(ev) => {
                      setHasta(ev.target.value)
                      limpiar()
                    }}
                  />
                )}
              </Campo>
            </div>

            {resultado ? (
              <div ref={refResultado} tabIndex={-1} className="resultado">
                <Aviso tipo="ok">{resultado}</Aviso>
              </div>
            ) : enMantenimiento ? null : choque ? (
              <Aviso tipo="err">
                <p>
                  <b>
                    Choca con la reserva de <span className="mono">{choque.choque.proyecto}</span>
                  </b>{' '}
                  el {diaYFecha(choque.choque.inicio)} de {hora(choque.choque.inicio)} a{' '}
                  {hora(choque.choque.fin)}.
                </p>
                {choque.libres.length > 0 ? (
                  <>
                    <p>Horarios libres ese día:</p>
                    <div className="libres" style={{ marginTop: 8 }}>
                      {choque.libres.map((l) => (
                        <button key={l.inicio} type="button" onClick={() => usarLibre(l)}>
                          {hora(l.inicio)} a {hora(l.fin)}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p>Ese día no quedan horarios libres. Prueba con otro día.</p>
                )}
              </Aviso>
            ) : pedida && futura ? (
              <Aviso tipo="ok">
                <p>
                  El horario está libre. La reserva queda pendiente hasta que la apruebe el aprobador; te
                  llegará un aviso cuando decida.
                </p>
              </Aviso>
            ) : (
              <p className="sec" style={{ fontSize: 14 }}>
                Elige un horario libre: escríbelo aquí o haz clic en el calendario. Los laboratorios atienden
                de lunes a sábado, de {horaDe(APERTURA)} a {horaDe(CIERRE)}.
              </p>
            )}
            {errorGeneral && (
              <Aviso tipo="err">
                <p>{errorGeneral}</p>
              </Aviso>
            )}
            <button
              ref={refEnviar}
              className="btn btn-pri"
              type="submit"
              aria-disabled={enMantenimiento || solicitar.isPending || undefined}
            >
              {enMantenimiento
                ? 'No admite reservas'
                : solicitar.isPending
                  ? 'Enviando…'
                  : 'Solicitar reserva'}
            </button>
          </>
        )}
      </form>
    </div>
  )
}
