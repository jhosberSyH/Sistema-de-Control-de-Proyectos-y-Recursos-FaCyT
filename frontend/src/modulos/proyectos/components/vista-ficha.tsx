import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { ChipEstado, ChipPrioridad } from '@/components/ui/estado'
import { ESTADO_RESERVA, TIPO_ESTATUS_PROYECTO } from '@/components/ui/estados-dominio'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { Lista } from '@/components/ui/listas'
import { Pestanas } from '@/components/ui/pestanas'
import { BarraProgreso, MiniBarra } from '@/components/ui/progreso'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { diaCorto, fechaCorta, hora, moneda, porcentaje } from '@/lib/formato'
import { useFicha, usePestanaFicha } from '../api/proyectos'
import type { CargoProyecto, EventoProyecto, FichaProyecto, ReservaProyecto } from '../types'
import { DialogoCoordinador, DialogoEstatus } from './dialogos-ficha'
import { ErrorProyecto } from './error-proyecto'
import './ficha.css'

type Props = {
  codigo: string
  /** El Administrador asigna coordinador y cambia el estatus; el Coordinador carga avance y pide. */
  esAdministrador: boolean
}

type PestanaFicha = 'resumen' | 'gastos' | 'reservas' | 'historial'
const TIPO_CARGO = { gasto: 'Gasto', despacho: 'Despacho', compartido: 'Gastos compartidos' } as const

/** Vista 07: ficha del proyecto (F2.2 a F2.7). */
export function VistaFicha({ codigo, esAdministrador }: Props) {
  const ficha = useFicha(codigo)
  useTituloPagina(codigo)
  const [params, setParams] = useSearchParams()
  const [pestana, setPestana] = useState<PestanaFicha>('resumen')
  const [dialogo, setDialogo] = useState<'estatus' | 'coordinador' | null>(null)
  const [resultado, setResultado] = useState<ReactNode>(null)
  const refFoco = useRef<HTMLElement | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (resultado) refFoco.current = refResultado.current
  }, [resultado])

  // Desde la lista o el inicio: "?asignar=coordinador" abre el diálogo de asignación (F2.2).
  const pideAsignar = esAdministrador && params.get('asignar') === 'coordinador'
  const abierto = dialogo ?? (pideAsignar && ficha.data ? 'coordinador' : null)
  const cerrar = () => {
    setDialogo(null)
    if (pideAsignar) {
      setParams(
        (p) => {
          p.delete('asignar')
          return p
        },
        { replace: true },
      )
    }
  }

  const migas = [{ texto: esAdministrador ? 'Proyectos' : 'Mis proyectos', a: '/proyectos' }]

  if (ficha.isPending) {
    return (
      <Cargando etiqueta={`Cargando ${codigo}…`}>
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto ancho="60%" />
        <Esqueleto alto={140} />
        <Esqueleto alto={240} />
      </Cargando>
    )
  }
  if (ficha.isError) {
    return (
      <ErrorProyecto
        codigo={codigo}
        error={ficha.error}
        esAdministrador={esAdministrador}
        alReintentar={() => ficha.refetch()}
      />
    )
  }

  const p = ficha.data
  const abrir = (cual: 'estatus' | 'coordinador', origen: HTMLElement) => {
    refFoco.current = origen
    setResultado(null)
    setDialogo(cual)
  }

  return (
    <div className="vista-ficha">
      <div className="cab">
        <div className="cab-p">
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              {migas.map((m) => (
                <li key={m.texto}>
                  <Link to={m.a}>{m.texto}</Link>
                </li>
              ))}
              <li className="mono" aria-current="page">
                {p.codigo}
              </li>
            </ol>
          </nav>
          <span className="cod">
            {p.codigo} · {p.area}
          </span>
          <h1>{p.nombre}</h1>
          <div className="chips">
            <ChipEstado tipo={TIPO_ESTATUS_PROYECTO[p.estatus]}>{p.estatus}</ChipEstado>
            <ChipPrioridad prioridad={p.prioridad} />
          </div>
          <p className="coord">
            {p.coordinador ? (
              <>
                Coordina <b>{p.coordinador.nombre}</b>
              </>
            ) : (
              <span className="sin-coord-p">
                <Icono nombre="alerta" />
                Sin coordinador
              </span>
            )}{' '}
            · Registrado el {fechaCorta(p.registradoEl)}
          </p>
        </div>
        {esAdministrador ? (
          <div className="acc">
            {p.estatus !== 'Finalizado' && (
              <button
                className="btn btn-sec"
                type="button"
                onClick={(e) => abrir('coordinador', e.currentTarget)}
              >
                {p.coordinador ? 'Cambiar coordinador' : 'Asignar coordinador'}
              </button>
            )}
            {p.transiciones.length > 0 && (
              <button
                className="btn btn-pri"
                type="button"
                onClick={(e) => abrir('estatus', e.currentTarget)}
              >
                Cambiar estatus
              </button>
            )}
          </div>
        ) : (
          <div className="acc">
            {/* No estaban en el mockup 07: la bitácora (F6.3) y el uso de materia prima (F6.4) se abren desde el proyecto */}
            <BotonEnlace variante="txt" to={`/proyectos/bitacora?proyecto=${p.codigo}`}>
              Bitácora
            </BotonEnlace>
            {p.estatus !== 'Finalizado' && (
              <BotonEnlace variante="txt" to={`/proyectos/uso-materia-prima?proyecto=${p.codigo}`}>
                Registrar uso
              </BotonEnlace>
            )}
            {/* HU-04: un proyecto finalizado ya no admite solicitudes nuevas */}
            {p.estatus !== 'Finalizado' && (
              <BotonEnlace to={`/solicitudes?nueva=gasto&proyecto=${p.codigo}`}>Nueva solicitud</BotonEnlace>
            )}
            {p.estatus !== 'Finalizado' && (
              <BotonEnlace variante="pri" to={`/proyectos/${p.codigo}/plan`}>
                {p.planConfirmado ? 'Cargar avance' : 'Armar el plan de hitos'}
              </BotonEnlace>
            )}
          </div>
        )}
      </div>

      {resultado && (
        <div ref={refResultado} tabIndex={-1} style={{ outline: 'none' }}>
          <Aviso tipo="ok">{resultado}</Aviso>
        </div>
      )}

      <Metricas p={p} />

      <section aria-label="Detalle del proyecto">
        <Pestanas
          etiqueta="Detalle del proyecto"
          valor={pestana}
          alCambiar={(v) => setPestana(v as PestanaFicha)}
          pestanas={[
            {
              valor: 'resumen',
              etiqueta: 'Resumen',
              contenido: (
                <Resumen p={p} esAdministrador={esAdministrador} alVerTodos={() => setPestana('gastos')} />
              ),
            },
            {
              valor: 'gastos',
              etiqueta: 'Gastos y despachos',
              contenido: <Gastos codigo={p.codigo} abierta={pestana === 'gastos'} />,
            },
            {
              valor: 'reservas',
              etiqueta: 'Reservas',
              contenido: <Reservas codigo={p.codigo} abierta={pestana === 'reservas'} />,
            },
            {
              valor: 'historial',
              etiqueta: 'Historial',
              contenido: <Historial codigo={p.codigo} abierta={pestana === 'historial'} />,
            },
          ]}
        />
      </section>

      {abierto === 'estatus' && (
        <DialogoEstatus
          proyecto={p}
          alCerrar={cerrar}
          focoAlCerrar={refFoco}
          alListo={(r) => {
            cerrar()
            setResultado(
              <p>
                {r.codigo} pasó a {r.estatus}.
              </p>,
            )
          }}
        />
      )}
      {abierto === 'coordinador' && (
        <DialogoCoordinador
          proyecto={p}
          alCerrar={cerrar}
          focoAlCerrar={refFoco}
          alListo={(r) => {
            cerrar()
            setResultado(
              <p>
                {r.coordinador?.nombre} coordina {r.codigo} desde ahora. Ya lo ve en sus proyectos.
              </p>,
            )
          }}
        />
      )}
    </div>
  )
}

/** Las tres métricas del mockup: avance físico (F2.6), ejecución (F2.7) y próximo hito. */
function Metricas({ p }: { p: FichaProyecto }) {
  const completos = p.hitos.filter((h) => h.avance >= 100).length
  return (
    <div className="metricas">
      <section className="tarjeta met" aria-label="Avance físico">
        <span className="eti">Avance físico</span>
        {p.avance !== null ? (
          <>
            <span className="val">{porcentaje(p.avance)}</span>
            <BarraProgreso valor={p.avance} etiqueta={`Avance físico de ${p.codigo}`} />
            <span className="sec" style={{ fontSize: 14 }}>
              {completos} de {p.hitos.length} {p.hitos.length === 1 ? 'hito completo' : 'hitos completos'}.
              Calculado con los pesos de cada hito.
            </span>
          </>
        ) : (
          <>
            <span className="val nd">No disponible</span>
            <span className="sec" style={{ fontSize: 14 }}>
              {p.hitos.length === 0
                ? 'Todavía no hay plan de hitos.'
                : `El plan de hitos no está confirmado: los pesos suman ${p.sumaPesos} de 100.`}
            </span>
          </>
        )}
      </section>

      <section className="tarjeta met" aria-label="Ejecución presupuestaria">
        <span className="eti">Ejecución presupuestaria</span>
        <span className="val">{porcentaje(p.ejecucion)}</span>
        <BarraProgreso
          valor={p.ejecucion}
          etiqueta={`Ejecución presupuestaria de ${p.codigo}`}
          alto={p.ejecucion >= 80}
        />
        <div className="desg">
          <div>
            <span>Solicitudes de gasto ejecutadas</span>
            <b>{moneda(p.desglose.gastos)}</b>
          </div>
          <div>
            <span>Insumos despachados</span>
            <b>{moneda(p.desglose.despachos)}</b>
          </div>
          <div>
            <span>Parte de los gastos compartidos</span>
            <b>{moneda(p.desglose.compartidos)}</b>
          </div>
          <div style={{ borderTop: '1px solid var(--line)', paddingTop: 4 }}>
            <span>Gasto ejecutado de {moneda(p.presupuesto)}</span>
            <b>{moneda(p.gastoEjecutado)}</b>
          </div>
        </div>
        {/* F2.7: pasa de 100 % sin recortarse; el ícono y el monto lo dicen sin depender del color */}
        {p.gastoEjecutado > p.presupuesto && (
          <span className="sobre-p">
            <Icono nombre="alerta" />
            Supera el presupuesto en {moneda(p.gastoEjecutado - p.presupuesto)}.
          </span>
        )}
      </section>

      <section className="tarjeta met" aria-label="Próximo hito">
        <span className="eti">Próximo hito</span>
        {p.proximoHito ? (
          <>
            <span style={{ fontWeight: 600, fontSize: 17 }}>{p.proximoHito.nombre}</span>
            <MiniBarra valor={p.proximoHito.avance} etiqueta={`Avance de ${p.proximoHito.nombre}`} />
            <span className="sec" style={{ fontSize: 14 }}>
              Fecha prevista {fechaCorta(p.proximoHito.fechaPrevista)} · peso {porcentaje(p.proximoHito.peso)}
            </span>
          </>
        ) : (
          <span className="sec">
            {p.hitos.length === 0 ? 'Todavía no hay plan de hitos.' : 'Todos los hitos están completos.'}
          </span>
        )}
      </section>
    </div>
  )
}

function Resumen({
  p,
  esAdministrador,
  alVerTodos,
}: {
  p: FichaProyecto
  esAdministrador: boolean
  alVerTodos: () => void
}) {
  return (
    <div className="dos">
      <section className="tarjeta bloque" aria-labelledby="t-hitos">
        <div className="bloque-cab">
          <h2 id="t-hitos">Hitos</h2>
          {!esAdministrador && p.estatus !== 'Finalizado' && (
            <Link to={`/proyectos/${p.codigo}/plan${p.planConfirmado ? '?modo=editar' : ''}`}>
              Editar plan
            </Link>
          )}
        </div>
        {p.hitos.length === 0 ? (
          <p className="sec">
            {esAdministrador
              ? 'Su coordinador todavía no carga el plan de hitos.'
              : 'Todavía no cargas el plan de hitos. Ármalo para que el proyecto pueda pasar a En ejecución.'}
          </p>
        ) : (
          <TablaDatos apilable titulo="Hitos del proyecto" className="hitos-t">
            <thead>
              <tr>
                <th scope="col">#</th>
                <th scope="col">Hito</th>
                <th scope="col" className="n">
                  Peso
                </th>
                <th scope="col">Avance</th>
                <th scope="col">Fecha prevista</th>
              </tr>
            </thead>
            <tbody>
              {p.hitos.map((h) => (
                <tr key={h.id}>
                  <td>{h.numero}</td>
                  <td>{h.nombre}</td>
                  <td className="n" data-e="Peso:">
                    {porcentaje(h.peso)}
                  </td>
                  <td>
                    <MiniBarra valor={h.avance} etiqueta={`Avance del hito ${h.numero}`} />
                  </td>
                  <td data-e="Prevista:">{fechaCorta(h.fechaPrevista)}</td>
                </tr>
              ))}
            </tbody>
          </TablaDatos>
        )}
        {p.hitos.length > 0 && !p.planConfirmado && (
          <Aviso tipo="warn" rol="none">
            <p>
              Los pesos suman {p.sumaPesos} de 100: faltan {100 - p.sumaPesos} para confirmar el plan.
            </p>
          </Aviso>
        )}
      </section>

      <section className="tarjeta bloque" aria-labelledby="t-mov">
        <div className="bloque-cab">
          <h2 id="t-mov">Movimientos recientes</h2>
          <button className="enlace" type="button" onClick={alVerTodos}>
            Ver todos
          </button>
        </div>
        {p.movimientos.length === 0 ? (
          <p className="sec">Todavía no hay gastos, despachos ni avances.</p>
        ) : (
          <ul className="linea-t">
            {p.movimientos.map((m) => (
              <li key={m.id}>
                <time dateTime={m.fecha}>{fechaCorta(m.fecha)}</time>
                <div>
                  {m.texto}
                  <small>
                    {m.referencia && <span className="mono">{m.referencia}</span>}
                    {m.referencia && m.monto !== null && ' · '}
                    {m.monto !== null && moneda(m.monto)}
                    {m.nota && `«${m.nota}»`}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Gastos({ codigo, abierta }: { codigo: string; abierta: boolean }) {
  const gastos = usePestanaFicha<CargoProyecto[]>(codigo, 'gastos', abierta)
  return (
    <section className="tarjeta bloque" aria-label="Gastos y despachos">
      {gastos.isPending ? (
        <Cargando etiqueta="Cargando los gastos…" />
      ) : gastos.isError ? (
        <ErrorCarga mensaje={gastos.error.message} alReintentar={() => gastos.refetch()} />
      ) : gastos.data.length === 0 ? (
        <p className="sec">Este proyecto todavía no tiene gastos ni despachos.</p>
      ) : (
        <TablaDatos apilable titulo={`Gastos y despachos de ${codigo}`}>
          <thead>
            <tr>
              <th scope="col">Fecha</th>
              <th scope="col">Concepto</th>
              <th scope="col">Tipo</th>
              <th scope="col" className="n">
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {gastos.data.map((g) => (
              <tr key={g.id}>
                <td>{fechaCorta(g.fecha)}</td>
                <td>
                  {g.concepto} {g.referencia && <small className="mono">{g.referencia}</small>}
                </td>
                <td data-e="Tipo:">{TIPO_CARGO[g.tipo]}</td>
                <td className="n" data-e="Monto:">
                  {moneda(g.monto)}
                </td>
              </tr>
            ))}
          </tbody>
        </TablaDatos>
      )}
    </section>
  )
}

function Reservas({ codigo, abierta }: { codigo: string; abierta: boolean }) {
  const reservas = usePestanaFicha<ReservaProyecto[]>(codigo, 'reservas', abierta)
  return (
    <section className="tarjeta bloque" aria-label="Reservas">
      {reservas.isPending ? (
        <Cargando etiqueta="Cargando las reservas…" />
      ) : reservas.isError ? (
        <ErrorCarga mensaje={reservas.error.message} alReintentar={() => reservas.refetch()} />
      ) : reservas.data.length === 0 ? (
        <p className="sec">Este proyecto no tiene reservas de equipos.</p>
      ) : (
        <Lista
          items={reservas.data.map((r) => ({
            id: r.id,
            principal: r.equipo,
            secundario: `${diaCorto(r.inicio)} · ${hora(r.inicio)} a ${hora(r.fin)}`,
            derecha: (
              <ChipEstado tipo={ESTADO_RESERVA[r.estado].tipo}>{ESTADO_RESERVA[r.estado].texto}</ChipEstado>
            ),
          }))}
        />
      )}
    </section>
  )
}

function Historial({ codigo, abierta }: { codigo: string; abierta: boolean }) {
  const historial = usePestanaFicha<EventoProyecto[]>(codigo, 'historial', abierta)
  return (
    <section className="tarjeta bloque" aria-label="Historial">
      {historial.isPending ? (
        <Cargando etiqueta="Cargando el historial…" />
      ) : historial.isError ? (
        <ErrorCarga mensaje={historial.error.message} alReintentar={() => historial.refetch()} />
      ) : historial.data.length === 0 ? (
        <p className="sec">Todavía no hay cambios registrados.</p>
      ) : (
        <ul className="linea-t">
          {historial.data.map((e) => (
            <li key={e.id}>
              <time dateTime={e.fecha}>{fechaCorta(e.fecha)}</time>
              <div>
                {e.descripcion}
                {e.justificacion && <small>«{e.justificacion}»</small>}
                <small>{e.ip}</small>
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
