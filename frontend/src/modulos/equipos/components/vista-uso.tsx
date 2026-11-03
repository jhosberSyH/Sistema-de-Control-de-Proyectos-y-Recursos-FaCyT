import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { AreaTexto, Campo, Selector } from '@/components/ui/campo'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { diaMes, fechaCorta, hora, mayuscula, nombreMes } from '@/lib/formato'
import { useCerrarUso, useIniciarUso, useUsoEquipo } from '../api/usos'
import type { UsoEquipo } from '../types'
import './uso.css'

/** 2,7 → "2,7"; 4 → "4,0" (horas, como el mockup) */
const horas = (h: number) => h.toFixed(1).replace('.', ',')

/** Tiempo transcurrido "02:41" (horas y minutos). */
function transcurrido(desde: string, ahora: number) {
  const minutos = Math.max(0, Math.floor((ahora - Date.parse(desde)) / 60_000))
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/** Vista 13: registro de uso de un equipo (F4.6) para el Coordinador; pensada para el teléfono. */
export function VistaUso() {
  const [params, setParams] = useSearchParams()
  const uso = useUsoEquipo(params.get('equipo') ?? '')
  useTituloPagina(uso.data?.equipo.nombre ?? 'Uso de equipo')
  // Sin equipo en la URL, el servidor elige uno: queda fijo, para que no cambie al cerrar el uso
  const elegido = uso.data?.equipo.id
  useEffect(() => {
    if (elegido && !params.get('equipo')) setParams({ equipo: elegido }, { replace: true })
  }, [elegido, params, setParams])

  if (uso.isPending) {
    return (
      <Cargando etiqueta="Cargando el equipo…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto ancho="40%" />
        <Esqueleto alto={300} />
      </Cargando>
    )
  }
  if (uso.isError) return <ErrorCarga mensaje={uso.error.message} alReintentar={() => uso.refetch()} />

  const d = uso.data
  const e = d.equipo
  return (
    <div className="vista-uso">
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
          <h1>{e.nombre}</h1>
          <p className="sub">
            <span className="mono">{e.codigo}</span> · {e.ubicacion}
          </p>
        </div>
        <div className="acc">
          <Campo etiqueta="Equipo" id="u-eq">
            {(c) => (
              <Selector
                {...c}
                value={e.id}
                onChange={(ev) => setParams({ equipo: ev.target.value }, { replace: true })}
              >
                {d.equipos.map((x) => (
                  <option key={x.id} value={x.id}>
                    {x.nombre}
                  </option>
                ))}
              </Selector>
            )}
          </Campo>
          <BotonEnlace to={`/reservas?equipo=${e.id}`}>
            <Icono nombre="calendario" />
            Reservar
          </BotonEnlace>
          {/* F8.4: la hoja de vida se genera en Reportes (vista 24), con el equipo ya elegido */}
          <BotonEnlace to={`/reportes?tipo=hoja-de-vida&equipo=${e.id}`}>
            <Icono nombre="descarga" />
            Hoja de vida
          </BotonEnlace>
        </div>
      </div>

      <div className="dos">
        {/* key: al cambiar de equipo, el registro empieza de cero */}
        <Registro key={e.id} datos={d} />
        <Historial datos={d} />
      </div>
    </div>
  )
}

/** Tarjeta de registro (mockup 13): iniciar el uso o, si está abierto, el reloj y el cierre. */
function Registro({ datos: d }: { datos: UsoEquipo }) {
  const iniciar = useIniciarUso()
  const cerrar = useCerrarUso()
  const e = d.equipo
  const a = d.abierto
  const r = d.reservaHoy
  const [proyecto, setProyecto] = useState(r?.proyecto ?? d.misProyectos[0]?.codigo ?? '')
  const [observaciones, setObservaciones] = useState('')
  const [resultado, setResultado] = useState<ReactNode>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  const refEstado = useRef<HTMLDivElement>(null)
  // El reloj avanza cada 30 s
  const [ahora, setAhora] = useState(() => Date.now())
  useEffect(() => {
    const t = window.setInterval(() => setAhora(Date.now()), 30_000)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => {
    if (resultado) refResultado.current?.focus()
  }, [resultado])
  // Al iniciar, el botón desaparece: el foco va al nuevo estado ("En uso por ti")
  const enfocarEstado = useRef(false)
  useEffect(() => {
    if (enfocarEstado.current && a?.mio) {
      enfocarEstado.current = false
      refEstado.current?.focus()
    }
  }, [a?.id, a?.mio])

  const error = iniciar.error ?? cerrar.error
  let contenido: ReactNode

  if (a?.mio) {
    contenido = (
      <>
        <div className="estado-g ocupado" ref={refEstado} tabIndex={-1}>
          <span className="ic">
            <Icono nombre="reloj" />
          </span>
          <div>
            <b>En uso por ti</b>
            <span className="sec">
              Desde las {hora(a.inicio)} para <span className="mono">{a.proyecto}</span>
            </span>
          </div>
        </div>
        <div>
          <span className="sec" style={{ fontSize: 14 }} id="t-reloj">
            Tiempo transcurrido
          </span>
          <div className="reloj" role="timer" aria-labelledby="t-reloj">
            {transcurrido(a.inicio, ahora)}
          </div>
        </div>
        <Campo etiqueta="Observaciones" opcional id="obs">
          {(c) => (
            <AreaTexto
              {...c}
              maxLength={500}
              value={observaciones}
              onChange={(ev) => setObservaciones(ev.target.value)}
            />
          )}
        </Campo>
        <button
          className="btn btn-pri"
          type="button"
          aria-disabled={cerrar.isPending || undefined}
          onClick={() => {
            if (cerrar.isPending) return
            cerrar.mutate(
              { id: a.id, observaciones },
              {
                onSuccess: (x) => {
                  setObservaciones('')
                  setResultado(
                    <p>
                      Cerraste el registro: {horas(x.horas)} h para <span className="mono">{x.proyecto}</span>
                      .{' '}
                      {e.estado === 'En mantenimiento'
                        ? `${x.equipo} sigue en mantenimiento.`
                        : `${x.equipo} quedó Disponible.`}
                    </p>,
                  )
                },
              },
            )
          }}
        >
          {cerrar.isPending ? 'Cerrando…' : 'Cerrar registro de uso'}
        </button>
        <p className="sec" style={{ fontSize: 14 }}>
          {r
            ? `Tu reserva termina a las ${hora(r.fin)}. Si te vas antes, cierra el registro para que el equipo quede Disponible.`
            : 'Cuando termines, cierra el registro para que el equipo quede Disponible.'}
        </p>
      </>
    )
  } else if (a) {
    contenido = (
      <>
        <div className="estado-g ocupado">
          <span className="ic">
            <Icono nombre="reloj" />
          </span>
          <div>
            <b>En uso por {a.usuario}</b>
            <span className="sec">
              Desde las {hora(a.inicio)} para <span className="mono">{a.proyecto}</span>
            </span>
          </div>
        </div>
        <p className="sec">Cuando termine y cierre su registro, el equipo vuelve a Disponible.</p>
      </>
    )
  } else if (e.mantenimiento) {
    contenido = (
      <>
        <div className="estado-g mant">
          <span className="ic">
            <Icono nombre="alerta" />
          </span>
          <div>
            <b>En mantenimiento</b>
            <span className="sec">Desde el {diaMes(e.mantenimiento.desde)}</span>
          </div>
        </div>
        <p className="sec">
          «{e.mantenimiento.motivo.replace(/\.$/, '')}». No se puede usar hasta que el administrador registre
          el fin del mantenimiento.
        </p>
      </>
    )
  } else {
    contenido = (
      <>
        <div className="estado-g libre" ref={refEstado} tabIndex={-1}>
          <span className="ic">
            <Icono nombre="ok" />
          </span>
          <div>
            <b>Disponible</b>
            <span className="sec">
              {r
                ? `Tienes una reserva hoy de ${hora(r.inicio)} a ${hora(r.fin)}`
                : 'No tienes una reserva hoy para este equipo'}
            </span>
          </div>
        </div>
        {d.misProyectos.length === 0 ? (
          <p className="sec">No tienes proyectos vigentes para registrar un uso.</p>
        ) : (
          <>
            <Campo
              etiqueta="Proyecto"
              id="u-proy"
              ayuda={r && proyecto === r.proyecto ? 'Propuesto desde tu reserva de hoy.' : undefined}
            >
              {(c) => (
                <Selector {...c} value={proyecto} onChange={(ev) => setProyecto(ev.target.value)}>
                  {d.misProyectos.map((p) => (
                    <option key={p.codigo} value={p.codigo}>
                      {p.codigo} · {p.nombre}
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <button
              className="btn btn-pri"
              type="button"
              aria-disabled={iniciar.isPending || undefined}
              onClick={() => {
                if (iniciar.isPending || !proyecto) return
                setResultado(null)
                enfocarEstado.current = true
                iniciar.mutate(
                  { equipoId: e.id, proyecto },
                  {
                    onError: () => {
                      enfocarEstado.current = false
                    },
                  },
                )
              }}
            >
              {iniciar.isPending ? 'Iniciando…' : 'Iniciar uso'}
            </button>
          </>
        )}
      </>
    )
  }

  return (
    <section className="tarjeta uso" aria-labelledby="t-uso" aria-live="polite">
      <h2 id="t-uso" className="vh">
        Registro de uso
      </h2>
      {resultado && (
        <div className="resultado" ref={refResultado} tabIndex={-1}>
          <Aviso tipo="ok" rol="none">
            {resultado}
          </Aviso>
        </div>
      )}
      {contenido}
      {error && (
        <Aviso tipo="err">
          <p>{error.message}</p>
        </Aviso>
      )}
    </section>
  )
}

/** "Usos de tus proyectos": solo los de los proyectos del coordinador (RN-07). */
function Historial({ datos: d }: { datos: UsoEquipo }) {
  return (
    <section className="tarjeta bloque" aria-labelledby="t-hist">
      <div className="bloque-cab">
        <h2 id="t-hist">Usos de tus proyectos</h2>
        {d.mes && (
          <span className="conteo">
            {mayuscula(nombreMes(`${d.mes.mes}-15`))}: {horas(d.mes.horas)} h
          </span>
        )}
      </div>
      {d.historial.length === 0 ? (
        <p className="sec">Tus proyectos todavía no registran usos de este equipo.</p>
      ) : (
        <TablaDatos apilable titulo={`Usos de ${d.equipo.nombre} en tus proyectos`}>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Proyecto</th>
              <th scope="col" className="n">
                Horas
              </th>
              <th scope="col">Observaciones</th>
            </tr>
          </thead>
          <tbody>
            {d.historial.map((u) => (
              <tr key={u.id}>
                <td>{fechaCorta(u.inicio)}</td>
                <td className="mono">{u.proyecto}</td>
                <td className="n" data-e="Horas:">
                  {horas(u.horas)}
                </td>
                <td>{u.observaciones ?? <span className="sec">Sin observaciones</span>}</td>
              </tr>
            ))}
          </tbody>
        </TablaDatos>
      )}
      <p className="sec" style={{ fontSize: 14 }}>
        Ves solo los usos de tus proyectos. La hoja de vida completa la exportan el aprobador y el
        administrador.
      </p>
    </section>
  )
}
