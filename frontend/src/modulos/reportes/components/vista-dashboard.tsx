import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Icono, type NombreIcono } from '@/components/icono'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { GraficoColumnas } from '@/components/ui/grafico-columnas'
import { EnvTabla } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { fechaCorta, numero, porcentaje } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useDashboard } from '../api/dashboard'
import type { Dashboard } from '../types'
import './dashboard.css'

/** Escala de las barras de ejecución: de 0 a 120 % (mockup 03). */
const ESC_MAX = 120
// Sin marca en el 120 %: quedaba encima del 100 % (el mockup las superpone). La escala igual llega a 120 %.
const MARCAS = [0, 25, 50, 75, 100]

const usd = (n: number) => `US$ ${numero(Math.round(n))}`
const pct = (n: number) => porcentaje(Math.round(n))
const SINGULAR: Record<string, string> = {
  cajas: 'caja',
  bolsas: 'bolsa',
  rollos: 'rollo',
  unidades: 'unidad',
}
const cantidad = (n: number, unidad: string) =>
  `${numero(n, 2)} ${n === 1 ? (SINGULAR[unidad] ?? unidad) : unidad}`
/** "8,8 mil" sobre cada columna del gasto por mes. */
const enMiles = (n: number) => (n >= 1000 ? `${numero(n / 1000, 1)} mil` : numero(Math.round(n)))

type Kpi = 'activos' | 'presupuesto' | 'stock' | 'venc'

/**
 * Vista 03: dashboard ejecutivo (F8.1). Resumen arriba y detalle abajo; cada indicador abre la lista que
 * lo forma. Una sola escala por gráfico y una serie en el color primario; cada gráfico tiene su tabla.
 */
export function VistaDashboard() {
  const [periodo, setPeriodo] = useState('')
  const [prioridad, setPrioridad] = useState('')
  const [abierto, setAbierto] = useState<Kpi | null>(null)
  const datos = useDashboard(periodo, prioridad)
  useTituloPagina('Dashboard')

  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando el dashboard…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={130} />
        <Esqueleto alto={360} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
  const d = datos.data
  const presupuesto = d.proyectos.reduce((t, p) => t + p.presupuesto, 0)
  const gasto = d.proyectos.reduce((t, p) => t + p.gasto, 0)
  const vencidos = d.vencimientos.filter((v) => v.dias < 0).length
  const porVencer = d.vencimientos.length - vencidos

  const kpis: { id: Kpi; clase?: string; icono: NombreIcono; eti: string; val: ReactNode; sub: string }[] = [
    {
      id: 'activos',
      icono: 'proyectos',
      eti: 'Proyectos activos',
      val: d.proyectos.length,
      sub: prioridad ? `Con prioridad ${prioridad}` : 'En ejecución, según RN-05',
    },
    {
      id: 'presupuesto',
      icono: 'prorrateo',
      eti: 'Presupuesto global ejecutado',
      val: presupuesto ? pct((gasto / presupuesto) * 100) : '—',
      sub: `${usd(gasto)} de ${usd(presupuesto)}`,
    },
    {
      id: 'stock',
      clase: 'alerta',
      icono: 'alerta',
      eti: 'Alertas críticas de stock',
      val: d.stock.length,
      sub: 'Insumos bajo su mínimo',
    },
    {
      id: 'venc',
      clase: 'espera',
      icono: 'reloj',
      eti: 'Lotes próximos a vencer',
      val: porVencer,
      sub:
        vencidos === 0
          ? 'Ninguno vencido'
          : `Y ${vencidos} ${vencidos === 1 ? 'lote vencido' : 'lotes vencidos'}`,
    },
  ]

  return (
    <div className="vista-dashboard">
      <div className="cab-dash">
        <div>
          <h1>Dashboard ejecutivo</h1>
          <p>
            Proyectos activos, presupuesto y alertas críticas. Haz clic en un indicador para ver su detalle.
          </p>
        </div>
        <form className="filtros" aria-label="Filtros" onSubmit={(e) => e.preventDefault()}>
          <div className="campo">
            <label htmlFor="f-periodo">Período</label>
            <select
              className="entrada"
              id="f-periodo"
              value={d.periodo}
              onChange={(e) => setPeriodo(e.target.value)}
            >
              {d.periodos.map((p) => (
                <option key={p.valor} value={p.valor}>
                  {p.etiqueta}
                </option>
              ))}
            </select>
          </div>
          <div className="campo">
            <label htmlFor="f-prio">Prioridad</label>
            <select
              className="entrada"
              id="f-prio"
              value={prioridad}
              onChange={(e) => setPrioridad(e.target.value)}
            >
              <option value="">Todas</option>
              {['Crítica', 'Alta', 'Media', 'Baja'].map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </div>
        </form>
      </div>

      <section className="kpis" aria-label="Indicadores" aria-busy={datos.isPlaceholderData || undefined}>
        {kpis.map((k) => (
          <button
            key={k.id}
            type="button"
            className={cn('tarjeta kpi', k.clase)}
            aria-expanded={abierto === k.id}
            aria-controls="detalle"
            onClick={() => setAbierto((a) => (a === k.id ? null : k.id))}
          >
            <span className="eti">
              <Icono nombre={k.icono} />
              {k.eti}
            </span>
            <span className="val">{k.val}</span>
            <span className="sub">{k.sub}</span>
            <span className="ver">
              Ver detalle
              <Icono nombre="abajo" />
            </span>
          </button>
        ))}
      </section>
      <section className="tarjeta detalle" id="detalle" hidden={!abierto} aria-live="polite">
        {abierto && <Detalle id={abierto} d={d} alCerrar={() => setAbierto(null)} />}
      </section>

      <div className="graficos">
        <Ejecucion d={d} />
        <GastoPorMes d={d} />
      </div>

      <div className="tablas">
        <section className="tarjeta graf" aria-labelledby="t-stock">
          <div className="graf-cab">
            <div>
              <h2 id="t-stock">Alertas críticas de stock</h2>
              <p>Insumos por debajo de su stock mínimo.</p>
            </div>
            <Link to="/inventario?alerta=minimo">Ver inventario</Link>
          </div>
          <TablaStock d={d} />
        </section>
        <section className="tarjeta graf" aria-labelledby="t-venc">
          <div className="graf-cab">
            <div>
              <h2 id="t-venc">Vencimiento de lotes</h2>
              <p>Lotes con stock dentro de los {d.anticipacion} días de anticipación.</p>
            </div>
            <Link to="/inventario?alerta=vencimiento">Ver lotes</Link>
          </div>
          <TablaVencimientos d={d} />
        </section>
      </div>
    </div>
  )
}

const ejecucion = (p: { gasto: number; presupuesto: number }) => (p.gasto / p.presupuesto) * 100

function TablaProyectos({ d }: { d: Dashboard }) {
  return (
    <EnvTabla>
      <table className="datos">
        <caption className="vh">Proyectos activos con su ejecución</caption>
        <thead>
          <tr>
            <th scope="col">Proyecto</th>
            <th scope="col">Prioridad</th>
            <th scope="col">Estatus</th>
            <th scope="col" className="n">
              Ejecución
            </th>
          </tr>
        </thead>
        <tbody>
          {d.proyectos.map((p) => (
            <tr key={p.codigo}>
              <td>
                <Link to={`/proyectos/${p.codigo}`} className="mono">
                  {p.codigo}
                </Link>{' '}
                {p.nombre}
              </td>
              <td>{p.prioridad}</td>
              <td>
                <ChipEstado tipo="ok">En ejecución</ChipEstado>
              </td>
              <td className="n">{pct(ejecucion(p))}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </EnvTabla>
  )
}

function TablaStock({ d, conReposicion }: { d: Dashboard; conReposicion?: boolean }) {
  if (d.stock.length === 0) return <p className="sec">Ningún insumo está por debajo de su mínimo.</p>
  return (
    <EnvTabla>
      <table className="datos">
        <caption className="vh">Insumos por debajo de su mínimo</caption>
        <thead>
          <tr>
            <th scope="col">Insumo</th>
            <th scope="col" className="n">
              Stock
            </th>
            <th scope="col" className="n">
              Mínimo
            </th>
            <th scope="col">{conReposicion ? 'Reposición' : 'Estado'}</th>
          </tr>
        </thead>
        <tbody>
          {d.stock.map((s) => (
            <tr key={s.id}>
              <td>{s.nombre}</td>
              <td className="n">{cantidad(s.stock, s.unidad)}</td>
              <td className="n">{cantidad(s.minimo, s.unidad)}</td>
              <td>
                {!conReposicion ? (
                  <ChipEstado tipo="err">Bajo el mínimo</ChipEstado>
                ) : !s.reposicion ? (
                  <ChipEstado tipo="neutro">Sin reposición</ChipEstado>
                ) : s.reposicion.estado === 'Borrador' ? (
                  <ChipEstado tipo="info">Borrador creado ({s.reposicion.id})</ChipEstado>
                ) : s.reposicion.estado === 'Aprobado' ? (
                  <ChipEstado tipo="ok">Aprobada ({s.reposicion.id})</ChipEstado>
                ) : (
                  <ChipEstado tipo="warn">Pendiente de Aprobación</ChipEstado>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </EnvTabla>
  )
}

function TablaVencimientos({ d }: { d: Dashboard }) {
  if (d.vencimientos.length === 0) return <p className="sec">Ningún lote vence en los próximos días.</p>
  return (
    <EnvTabla>
      <table className="datos">
        <caption className="vh">Lotes por vencer</caption>
        <thead>
          <tr>
            <th scope="col">Lote</th>
            <th scope="col">Insumo</th>
            <th scope="col">Vence</th>
            <th scope="col">Estado</th>
          </tr>
        </thead>
        <tbody>
          {d.vencimientos.map((v) => (
            <tr key={v.lote}>
              <td className="mono">{v.lote}</td>
              <td>{v.insumo}</td>
              <td>
                {fechaCorta(v.vence)}
                {v.dias >= 0 && ` · ${v.dias === 1 ? '1 día' : `${v.dias} días`}`}
              </td>
              <td>
                {v.dias < 0 ? (
                  <ChipEstado tipo="err">Vencido</ChipEstado>
                ) : (
                  <ChipEstado tipo="warn">Próximo a vencer</ChipEstado>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </EnvTabla>
  )
}

const TITULO: Record<Kpi, string> = {
  activos: 'Proyectos activos',
  presupuesto: 'Presupuesto por proyecto',
  stock: 'Insumos bajo su mínimo',
  venc: 'Lotes por vencer y vencidos',
}

/** Lo que forma cada indicador (F8.1: "cada indicador permite ver el detalle que lo forma"). */
function Detalle({ id, d, alCerrar }: { id: Kpi; d: Dashboard; alCerrar: () => void }) {
  const ref = useRef<HTMLHeadingElement>(null)
  useEffect(() => ref.current?.focus(), [id])
  return (
    <>
      <div className="graf-cab">
        <h2 style={{ fontSize: 19 }} tabIndex={-1} ref={ref}>
          {TITULO[id]}
        </h2>
        <button className="btn btn-sec btn-chico" type="button" onClick={alCerrar}>
          Cerrar detalle
        </button>
      </div>
      {id === 'activos' || id === 'presupuesto' ? (
        d.proyectos.length > 0 ? (
          <TablaProyectos d={d} />
        ) : (
          <p className="sec">No hay proyectos activos con esa prioridad.</p>
        )
      ) : id === 'stock' ? (
        <TablaStock d={d} conReposicion />
      ) : (
        <TablaVencimientos d={d} />
      )}
    </>
  )
}

/** Botón "Ver como tabla" de cada gráfico (WCAG 1.1.1). */
function useVerTabla() {
  const [abierta, setAbierta] = useState(false)
  const boton = (id: string) => (
    <button
      className="btn btn-sec btn-chico"
      type="button"
      aria-expanded={abierta}
      aria-controls={id}
      onClick={() => setAbierta((a) => !a)}
    >
      {abierta ? 'Ocultar tabla' : 'Ver como tabla'}
    </button>
  )
  return { abierta, boton }
}

/** Barras horizontales de ejecución presupuestaria, como el mockup: escala 0 a 120 % y la línea del 100 %. */
function Ejecucion({ d }: { d: Dashboard }) {
  const { abierta, boton } = useVerTabla()
  const [tip, setTip] = useState<{ codigo: string; left: number; top: number } | null>(null)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!tip) return
    const alTeclear = (e: globalThis.KeyboardEvent) => e.key === 'Escape' && setTip(null)
    document.addEventListener('keydown', alTeclear)
    return () => document.removeEventListener('keydown', alTeclear)
  }, [tip])

  const mostrar = (codigo: string, el: HTMLElement) => {
    const caja = ref.current!.getBoundingClientRect()
    const r = el.getBoundingClientRect()
    setTip({ codigo, left: r.left - caja.left + r.width / 2, top: r.top - caja.top })
  }
  const p = tip && d.proyectos.find((x) => x.codigo === tip.codigo)

  return (
    <section className="tarjeta graf" aria-labelledby="t-ejec">
      <div className="graf-cab">
        <div>
          <h2 id="t-ejec">Ejecución presupuestaria por proyecto</h2>
          <p>Gasto ejecutado sobre presupuesto asignado. La línea marca el 100 %.</p>
        </div>
        {boton('tb-ejec')}
      </div>
      <div className="barras" ref={ref}>
        {d.proyectos.length === 0 ? (
          <p className="sec">No hay proyectos activos con esa prioridad.</p>
        ) : (
          d.proyectos.map((x) => {
            const v = ejecucion(x)
            const sobre = v > 100
            return (
              <div
                key={x.codigo}
                className="fila-b"
                tabIndex={0}
                aria-label={`${x.codigo}: ${pct(v)} del presupuesto`}
                onMouseEnter={(e) => mostrar(x.codigo, e.currentTarget)}
                onMouseLeave={() => setTip(null)}
                onFocus={(e) => mostrar(x.codigo, e.currentTarget)}
                onBlur={() => setTip(null)}
              >
                <div className="nom">
                  <span className="mono">{x.codigo}</span>
                  <small>{x.nombre}</small>
                </div>
                <div className="pista" aria-hidden="true">
                  <span className="marca-b" style={{ width: `${(Math.min(v, ESC_MAX) / ESC_MAX) * 100}%` }} />
                  <span className="ref" style={{ left: `${(100 / ESC_MAX) * 100}%` }} />
                </div>
                <div className={cn('v', sobre && 'sobre')}>
                  {sobre && <Icono nombre="alerta" />}
                  {pct(v)}
                </div>
              </div>
            )
          })
        )}
        {p && (
          <div
            className="tip"
            role="tooltip"
            style={{ left: tip.left, top: tip.top, transform: 'translate(-50%, calc(-100% - 8px))' }}
          >
            <b>
              {p.codigo} · {p.nombre}
            </b>
            {usd(p.gasto)} de {usd(p.presupuesto)} · {pct(ejecucion(p))}
            {p.gasto > p.presupuesto && (
              <>
                <br />
                Supera el presupuesto en {usd(p.gasto - p.presupuesto)}
              </>
            )}
          </div>
        )}
      </div>
      <div className="eje-b" aria-hidden="true">
        <span />
        <div className="esc">
          {MARCAS.map((t) => (
            <span key={t} style={{ left: `${(t / ESC_MAX) * 100}%` }}>
              {t} %
            </span>
          ))}
        </div>
        <span />
      </div>
      <div className="leyenda">
        <span>
          <i aria-hidden="true" />
          Ejecución
        </span>
        <span>
          <i className="ref" aria-hidden="true" />
          Presupuesto asignado (100 %)
        </span>
      </div>
      <EnvTabla id="tb-ejec" hidden={!abierta}>
        <table className="datos">
          <caption>Ejecución presupuestaria por proyecto</caption>
          <thead>
            <tr>
              <th scope="col">Proyecto</th>
              <th scope="col">Prioridad</th>
              <th scope="col" className="n">
                Presupuesto
              </th>
              <th scope="col" className="n">
                Gasto
              </th>
              <th scope="col" className="n">
                Ejecución
              </th>
            </tr>
          </thead>
          <tbody>
            {d.proyectos.map((x) => (
              <tr key={x.codigo}>
                <td>
                  <span className="mono">{x.codigo}</span> {x.nombre}
                </td>
                <td>{x.prioridad}</td>
                <td className="n">{usd(x.presupuesto)}</td>
                <td className="n">{usd(x.gasto)}</td>
                <td className="n">{pct(ejecucion(x))}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </EnvTabla>
    </section>
  )
}

function GastoPorMes({ d }: { d: Dashboard }) {
  const { abierta, boton } = useVerTabla()
  const enCurso = d.meses.find((m) => m.hasta)
  return (
    <section className="tarjeta graf" aria-labelledby="t-mes">
      <div className="graf-cab">
        <div>
          <h2 id="t-mes">Gasto ejecutado por mes</h2>
          <p>
            Todos los proyectos activos, en US$.
            {enCurso &&
              ` ${enCurso.etiquetaLarga.replace(/ de \d{4}$/, '')} va hasta el ${fechaCorta(enCurso.hasta!).slice(0, 5)}.`}
          </p>
        </div>
        {boton('tb-mes')}
      </div>
      <GraficoColumnas
        columnas={d.meses.map((m) => ({
          clave: m.clave,
          etiqueta: m.etiqueta,
          etiquetaLarga: m.hasta
            ? `${m.etiquetaLarga}, hasta el ${fechaCorta(m.hasta).slice(0, 5)}`
            : m.etiquetaLarga,
          valor: m.valor,
          enCurso: Boolean(m.hasta),
        }))}
        formato={usd}
        formatoEje={(v) => numero(v)}
        etiquetaValor={enMiles}
      />
      <div className="leyenda">
        <span>
          <i aria-hidden="true" />
          Mes cerrado
        </span>
        <span>
          <i
            aria-hidden="true"
            style={{
              background: 'repeating-linear-gradient(135deg,var(--primary) 0 4px,transparent 4px 6px)',
              outline: '1px solid var(--primary)',
            }}
          />
          Mes en curso
        </span>
      </div>
      <EnvTabla id="tb-mes" hidden={!abierta}>
        <table className="datos">
          <caption>Gasto ejecutado por mes</caption>
          <thead>
            <tr>
              <th scope="col">Mes</th>
              <th scope="col" className="n">
                Gasto
              </th>
            </tr>
          </thead>
          <tbody>
            {d.meses.map((m) => (
              <tr key={m.clave}>
                <td>
                  {m.etiquetaLarga}
                  {m.hasta && ' (en curso)'}
                </td>
                <td className="n">{usd(m.valor)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </EnvTabla>
    </section>
  )
}
