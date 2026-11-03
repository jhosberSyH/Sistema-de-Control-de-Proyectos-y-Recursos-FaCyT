import { useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import escudoUc from '@/assets/logos/escudo-uc.png'
import logoFacyt from '@/assets/logos/facyt-logo.png'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada, Selector } from '@/components/ui/campo'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { useDescargarReporte, useOpcionesReporte, useVistaPrevia } from '../api/reportes'
import type { FiltrosReporte, OpcionesReporte, TipoReporte } from '../types'
import './reportes.css'

const TIPOS: { valor: TipoReporte; titulo: string; detalle: string }[] = [
  {
    valor: 'gastos',
    titulo: 'Análisis de gastos',
    detalle: 'Gastos ejecutados, despachos valorizados y gastos compartidos por proyecto y período.',
  },
  {
    valor: 'reparto',
    titulo: 'Resumen del reparto de gastos compartidos',
    detalle: 'Criterio usado, total repartido y monto, consumo y porcentaje de cada proyecto.',
  },
  {
    valor: 'hoja-de-vida',
    titulo: 'Hoja de vida de un equipo',
    detalle: 'Datos, cambios de estado, reservas y horas de uso por proyecto.',
  },
]

/**
 * Vista 24: reportes formales (F8.2 a F8.4). Un formulario con el tipo, los filtros y dos botones de
 * descarga; el alcance del rol a la vista (RN-07) y, si el filtro no tiene datos, un aviso en lugar de un
 * archivo vacío. La vista previa muestra la primera página del PDF con los datos reales.
 */
export function VistaReportes() {
  const opciones = useOpcionesReporte()
  const [params] = useSearchParams()
  useTituloPagina('Reportes')

  if (opciones.isPending) {
    return (
      <Cargando etiqueta="Cargando los reportes…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={480} />
      </Cargando>
    )
  }
  if (opciones.isError) {
    return <ErrorCarga mensaje={opciones.error.message} alReintentar={() => opciones.refetch()} />
  }
  const o = opciones.data
  // Desde la ficha del equipo (vista 13) llega ?tipo=hoja-de-vida&equipo=
  const pedido = TIPOS.find((t) => t.valor === params.get('tipo'))?.valor ?? 'gastos'
  const equipo = o.equipos.find((e) => e.id === params.get('equipo'))?.id ?? o.equipos[0]?.id ?? ''
  return (
    <div className="vista-reportes">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/inicio">Inicio</Link>
              </li>
              <li aria-current="page">Reportes</li>
            </ol>
          </nav>
          <h1>Reportes</h1>
          <p className="sub">Reportes formales en PDF para presentar y en Excel para trabajar los datos.</p>
        </div>
      </div>
      <Formulario
        o={o}
        inicial={{
          tipo: pedido,
          desde: o.sugerido.desde,
          hasta: o.sugerido.hasta,
          proyectos: 'todos',
          periodo: o.periodos.find((p) => p.repartido)?.id ?? '',
          equipo,
        }}
      />
    </div>
  )
}

function Formulario({ o, inicial }: { o: OpcionesReporte; inicial: FiltrosReporte }) {
  const [f, setF] = useState(inicial)
  const descargar = useDescargarReporte()
  const cambiar = (c: Partial<FiltrosReporte>) => {
    setF((x) => ({ ...x, ...c }))
    descargar.reset()
  }
  const propios = o.alcance === 'propios'
  const conFechas = f.tipo !== 'reparto'
  const errorFechas = conFechas && f.desde && f.hasta && f.hasta < f.desde
  const completo =
    (!conFechas || (Boolean(f.desde) && Boolean(f.hasta) && !errorFechas)) &&
    (f.tipo !== 'reparto' || Boolean(f.periodo)) &&
    (f.tipo !== 'hoja-de-vida' || Boolean(f.equipo))
  const previa = useVistaPrevia(f, completo)
  const vacio = completo ? previa.data?.vacio : null
  const bloqueado = !completo || Boolean(vacio)
  const activos = o.proyectos.filter((p) => p.estatus === 'En ejecución').length
  // Mientras llega la siguiente, se ve la anterior (keepPreviousData)
  const hoja = previa.data

  const alcance =
    f.tipo === 'hoja-de-vida'
      ? propios
        ? 'Ves solo los usos y las reservas de tus proyectos.'
        : 'Ves los usos y las reservas de todos los proyectos.'
      : propios
        ? 'Ves y exportas solo tus proyectos asignados.'
        : 'Con tu rol exportas todos los proyectos.'

  const proyectos = (
    <Campo etiqueta="Proyectos" className="ancho">
      {(c) => (
        <Selector {...c} value={f.proyectos} onChange={(e) => cambiar({ proyectos: e.target.value })}>
          {propios ? (
            <option value="todos">
              {o.proyectos.length === 1
                ? `Mi proyecto (${o.proyectos[0].codigo})`
                : `Mis ${o.proyectos.length} proyectos (${o.proyectos.map((p) => p.codigo).join(', ')})`}
            </option>
          ) : (
            <>
              <option value="todos">Todos los proyectos ({o.proyectos.length})</option>
              <option value="activos">Solo activos ({activos})</option>
            </>
          )}
          {o.proyectos.map((p) => (
            <option key={p.codigo} value={p.codigo}>
              {p.codigo} · {p.nombre}
            </option>
          ))}
        </Selector>
      )}
    </Campo>
  )
  const fechas = (
    <>
      <Campo etiqueta="Desde">
        {(c) => (
          <Entrada {...c} type="date" value={f.desde} onChange={(e) => cambiar({ desde: e.target.value })} />
        )}
      </Campo>
      <Campo etiqueta="Hasta" error={errorFechas ? 'El fin tiene que ser después del inicio.' : undefined}>
        {(c) => (
          <Entrada
            {...c}
            type="date"
            value={f.hasta}
            min={f.desde || undefined}
            onChange={(e) => cambiar({ hasta: e.target.value })}
          />
        )}
      </Campo>
    </>
  )

  return (
    <div className="dos">
      <form
        className="tarjeta form-rep"
        noValidate
        aria-label="Generar reporte"
        onSubmit={(e) => e.preventDefault()}
      >
        <fieldset style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}>
          <legend style={{ fontWeight: 600, fontSize: 15, marginBottom: 8, padding: 0 }}>Reporte</legend>
          <div className="tipos">
            {TIPOS.map((t) => (
              <label key={t.valor} className="tipo-r">
                <input
                  type="radio"
                  name="reporte"
                  value={t.valor}
                  checked={f.tipo === t.valor}
                  onChange={() => cambiar({ tipo: t.valor })}
                />
                <div>
                  <b>{t.titulo}</b>
                  <span>{t.detalle}</span>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        <div className="form-rejilla">
          {f.tipo === 'gastos' && (
            <>
              {fechas}
              {proyectos}
            </>
          )}
          {f.tipo === 'reparto' &&
            (o.periodos.some((p) => p.repartido) ? (
              <>
                <Campo etiqueta="Período repartido">
                  {(c) => (
                    <Selector {...c} value={f.periodo} onChange={(e) => cambiar({ periodo: e.target.value })}>
                      {o.periodos.map((p) => (
                        <option key={p.id} value={p.id} disabled={!p.repartido}>
                          {p.nombre.charAt(0).toUpperCase() + p.nombre.slice(1)}
                          {p.repartido ? '' : ' (sin repartir)'}
                        </option>
                      ))}
                    </Selector>
                  )}
                </Campo>
                {proyectos}
                {o.periodos.some((p) => !p.repartido) && (
                  <p className="sec ancho">
                    Los períodos «sin repartir» no tienen resumen todavía: el Aprobador debe repartir sus
                    gastos compartidos primero.
                  </p>
                )}
              </>
            ) : (
              <p className="sec ancho">
                Todavía no se repartió ningún período: no hay resúmenes que exportar.
              </p>
            ))}
          {f.tipo === 'hoja-de-vida' && (
            <>
              <Campo etiqueta="Equipo" className="ancho">
                {(c) => (
                  <Selector {...c} value={f.equipo} onChange={(e) => cambiar({ equipo: e.target.value })}>
                    {o.equipos.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.nombre} · {e.codigo}
                      </option>
                    ))}
                  </Selector>
                )}
              </Campo>
              {fechas}
            </>
          )}
        </div>

        <p className="alcance">
          <Icono nombre="info" />
          <span>{alcance}</span>
        </p>

        {vacio && (
          <Aviso tipo="warn">
            <p>
              <b>{vacio.titulo}</b>
            </p>
            <p>{vacio.detalle}</p>
          </Aviso>
        )}
        {previa.isError && completo && (
          <Aviso tipo="err">
            <p>{previa.error.message}</p>
          </Aviso>
        )}
        {descargar.isError && (
          <Aviso tipo="err">
            <p>{descargar.error.message}</p>
          </Aviso>
        )}
        {descargar.isSuccess && (
          <Aviso tipo="ok">
            <p>Descargaste el reporte en {descargar.data === 'pdf' ? 'PDF' : 'Excel'}.</p>
          </Aviso>
        )}

        <div className="descargas">
          {(['pdf', 'xlsx'] as const).map((formato) => (
            <button
              key={formato}
              className={formato === 'pdf' ? 'btn btn-pri' : 'btn btn-sec'}
              type="button"
              disabled={bloqueado}
              aria-disabled={descargar.isPending || undefined}
              onClick={() => !descargar.isPending && descargar.mutate({ filtros: f, formato })}
            >
              <Icono nombre="descarga" />
              {descargar.isPending && descargar.variables?.formato === formato
                ? 'Preparando…'
                : formato === 'pdf'
                  ? 'Descargar PDF'
                  : 'Descargar Excel'}
            </button>
          ))}
        </div>
      </form>

      <aside aria-label="Vista previa del PDF" style={{ display: 'grid', gap: 8 }}>
        <span className="sec" style={{ fontSize: 14 }}>
          Vista previa de la primera página
        </span>
        {hoja ? (
          <div className="hoja" aria-hidden="true">
            <div className="enc">
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <img src={escudoUc} alt="" />
                <img src={logoFacyt} alt="" />
              </div>
              <div className="t">
                Universidad de Carabobo
                <br />
                Facultad Experimental de Ciencias y Tecnología
                <br />
                Control de Proyectos y Recursos
              </div>
            </div>
            <h3>{hoja.titulo}</h3>
            <div>
              {hoja.lineas.map((l, i) => (
                <span key={l}>
                  {i > 0 && <br />}
                  {l}
                </span>
              ))}
            </div>
            <table>
              <thead>
                <tr>
                  {hoja.columnas.map((c) => (
                    <th key={c.titulo} className={c.numerica ? 'n' : undefined}>
                      {c.titulo}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {hoja.filas.length === 0 ? (
                  <tr>
                    <td colSpan={hoja.columnas.length}>Sin datos con estos filtros.</td>
                  </tr>
                ) : (
                  hoja.filas.map((fila) => (
                    <tr key={fila.join('|')}>
                      {fila.map((v, i) => (
                        <td
                          key={hoja.columnas[i].titulo}
                          className={hoja.columnas[i].numerica ? 'n' : undefined}
                        >
                          {v}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            {hoja.nota && <p>{hoja.nota}</p>}
            <div className="pie">
              Documento generado por el sistema.
              {hoja.paginas > 0 && ` Página 1 de ${hoja.paginas}.`}
            </div>
          </div>
        ) : (
          <Esqueleto alto={460} />
        )}
      </aside>
    </div>
  )
}
