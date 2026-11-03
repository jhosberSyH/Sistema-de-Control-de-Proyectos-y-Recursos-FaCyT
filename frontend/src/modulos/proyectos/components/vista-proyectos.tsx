import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { type Prioridad } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { Paginacion } from '@/components/ui/tabla'
import { useExportarProyectos, useProyectos } from '../api/proyectos'
import {
  AREAS,
  ESTATUS,
  PRIORIDADES,
  type Area,
  type Estatus,
  type FiltrosProyectos,
  type PaginaProyectos,
  type ResumenProyecto,
} from '../types'
import { DialogoRegistrar } from './dialogo-registrar'
import { TablaProyectos } from './tabla-proyectos'
import './proyectos.css'

type Props = {
  /** El Administrador ve todos y registra; el Coordinador ve solo los suyos (RN-07, "Mis proyectos"). */
  esAdministrador: boolean
}

function useFiltros() {
  const [params, setParams] = useSearchParams()
  const area = params.get('area') as Area | null
  const prioridad = params.get('prioridad') as Prioridad | null
  const estatus = params.get('estatus') as Estatus | null
  const filtros: FiltrosProyectos = {
    q: params.get('q') ?? '',
    area: area && AREAS.includes(area) ? area : '',
    prioridad: prioridad && PRIORIDADES.includes(prioridad) ? prioridad : '',
    estatus: estatus && ESTATUS.includes(estatus) ? estatus : '',
    pagina: Math.max(1, Number(params.get('pagina')) || 1),
  }
  const cambiar = useCallback(
    (cambios: Partial<FiltrosProyectos>) =>
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales)
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor === '' || (clave === 'pagina' && valor === 1)) nuevos.delete(clave)
            else nuevos.set(clave, String(valor))
          }
          return nuevos
        },
        { replace: true },
      ),
    [setParams],
  )
  return [filtros, cambiar] as const
}

function resumen(d: PaginaProyectos) {
  const etiqueta = `${d.total === 1 ? 'proyecto' : 'proyectos'}, ordenados por prioridad`
  if (d.paginas === 1) return `${d.total} ${etiqueta}`
  const inicio = (d.pagina - 1) * d.porPagina + 1
  return `${inicio} a ${inicio + d.items.length - 1} de ${d.total} ${etiqueta}`
}

/** Vista 06: lista de proyectos (F2.1, F2.2; muestra F2.6 y F2.7). */
export function VistaProyectos({ esAdministrador }: Props) {
  const [filtros, cambiar] = useFiltros()
  const proyectos = useProyectos(filtros)
  const exportar = useExportarProyectos()
  const [registrando, setRegistrando] = useState(false)
  const [resultado, setResultado] = useState<ReactNode>(null)
  const refFoco = useRef<HTMLElement | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (resultado) refFoco.current = refResultado.current
  }, [resultado])

  const datos = proyectos.data
  const conFiltros = Boolean(filtros.q.trim() || filtros.area || filtros.prioridad || filtros.estatus)

  function alRegistrar(p: ResumenProyecto) {
    setRegistrando(false)
    setResultado(
      <p>
        Registraste <Link to={`/proyectos/${p.codigo}`}>{p.codigo}</Link> en estatus Propuesta.{' '}
        {p.coordinador
          ? `${p.coordinador.nombre} ya lo ve en sus proyectos y puede cargar el plan de hitos.`
          : 'Asígnale un coordinador desde su ficha para que puedan cargar el plan de hitos.'}
      </p>,
    )
  }

  return (
    <>
      <EncabezadoPagina
        migas={[
          { texto: 'Inicio', a: '/inicio' },
          { texto: esAdministrador ? 'Proyectos' : 'Mis proyectos' },
        ]}
        titulo={esAdministrador ? 'Proyectos' : 'Mis proyectos'}
        subtitulo={
          esAdministrador
            ? 'Todos los proyectos de Física, Química y Biología, con su coordinador, estatus y métricas al día.'
            : 'Los proyectos que coordinas, con su estatus y métricas al día.'
        }
        acciones={
          <>
            <button
              className="btn btn-sec"
              type="button"
              aria-disabled={exportar.isPending || undefined}
              onClick={() => {
                if (!exportar.isPending) exportar.mutate(filtros)
              }}
            >
              <Icono nombre="descarga" />
              {exportar.isPending ? 'Exportando…' : 'Exportar'}
            </button>
            {esAdministrador && (
              <button
                className="btn btn-pri"
                type="button"
                onClick={(e) => {
                  refFoco.current = e.currentTarget
                  setResultado(null)
                  setRegistrando(true)
                }}
              >
                <Icono nombre="mas" />
                Registrar proyecto
              </button>
            )}
          </>
        }
      />
      {exportar.isError && (
        <Aviso tipo="err">
          <p>No pudimos exportar la lista. {exportar.error.message}</p>
        </Aviso>
      )}

      <div className="resumen-est" role="group" aria-label="Filtrar por estatus">
        {(['Todos', ...ESTATUS] as const).map((e) => {
          const elegido = e === 'Todos' ? filtros.estatus === '' : filtros.estatus === e
          return (
            <button
              key={e}
              type="button"
              aria-pressed={elegido}
              onClick={() => cambiar({ estatus: e === 'Todos' ? '' : e, pagina: 1 })}
            >
              {e} <b>{datos?.conteos[e] ?? '·'}</b>
            </button>
          )
        })}
      </div>

      <section className="tarjeta lista-p" aria-label="Lista de proyectos">
        {resultado && (
          <div className="resultado" ref={refResultado} tabIndex={-1}>
            <Aviso tipo="ok">{resultado}</Aviso>
          </div>
        )}
        <Filtros filtros={filtros} alCambiar={cambiar} conCoordinador={esAdministrador} />

        <div aria-busy={proyectos.isFetching || undefined}>
          {proyectos.isPending ? (
            <div style={{ padding: 20 }}>
              <Cargando etiqueta="Cargando los proyectos…">
                {Array.from({ length: 6 }, (_, i) => (
                  <Esqueleto key={i} alto={48} />
                ))}
              </Cargando>
            </div>
          ) : proyectos.isError ? (
            <div style={{ padding: 20 }}>
              <ErrorCarga mensaje={proyectos.error.message} alReintentar={() => proyectos.refetch()} />
            </div>
          ) : datos && datos.items.length === 0 ? (
            conFiltros ? (
              <EstadoVacio
                icono="buscar"
                titulo="Ningún proyecto coincide con los filtros"
                accion={
                  <button
                    className="btn btn-sec btn-chico"
                    type="button"
                    onClick={() => cambiar({ q: '', area: '', prioridad: '', estatus: '', pagina: 1 })}
                  >
                    Quitar los filtros
                  </button>
                }
              >
                Revisa cómo está escrito el código, el nombre o el coordinador, o mira todas las áreas y
                prioridades.
              </EstadoVacio>
            ) : (
              <EstadoVacio
                icono="proyectos"
                titulo={esAdministrador ? 'Todavía no hay proyectos' : 'No tienes proyectos asignados'}
              >
                {esAdministrador
                  ? 'Registra el primero con "Registrar proyecto".'
                  : 'Cuando el administrador te asigne un proyecto, aparecerá aquí.'}
              </EstadoVacio>
            )
          ) : datos ? (
            <TablaProyectos proyectos={datos.items} esAdministrador={esAdministrador} />
          ) : null}
        </div>

        {datos && datos.total > 0 && (
          <Paginacion
            pagina={datos.pagina}
            paginas={datos.paginas}
            alCambiar={(pagina) => cambiar({ pagina })}
            resumen={resumen(datos)}
          />
        )}
      </section>

      {registrando && (
        <DialogoRegistrar
          alCerrar={() => setRegistrando(false)}
          alRegistrar={alRegistrar}
          focoAlCerrar={refFoco}
        />
      )}
    </>
  )
}

/** Filtros del mockup 06: búsqueda (código, nombre o coordinador), área y prioridad. */
function Filtros({
  filtros,
  alCambiar,
  conCoordinador,
}: {
  filtros: FiltrosProyectos
  alCambiar: (c: Partial<FiltrosProyectos>) => void
  conCoordinador: boolean
}) {
  const [texto, setTexto] = useState(filtros.q)
  const [anterior, setAnterior] = useState(filtros.q)
  if (filtros.q !== anterior) {
    setAnterior(filtros.q)
    setTexto(filtros.q)
  }
  useEffect(() => {
    if (texto === filtros.q) return
    const t = window.setTimeout(() => alCambiar({ q: texto, pagina: 1 }), 300)
    return () => window.clearTimeout(t)
  }, [texto, filtros.q, alCambiar])

  return (
    <form className="herr" aria-label="Filtros" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="campo busq">
        <label htmlFor="q">Buscar</label>
        <Icono nombre="buscar" />
        <input
          className="entrada"
          id="q"
          type="search"
          placeholder={conCoordinador ? 'Código, nombre o coordinador' : 'Código o nombre'}
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="f-area">Área</label>
        <select
          className="entrada"
          id="f-area"
          value={filtros.area}
          onChange={(e) => alCambiar({ area: e.target.value as Area | '', pagina: 1 })}
        >
          <option value="">Todas</option>
          {AREAS.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-prio">Prioridad</label>
        <select
          className="entrada"
          id="f-prio"
          value={filtros.prioridad}
          onChange={(e) => alCambiar({ prioridad: e.target.value as Prioridad | '', pagina: 1 })}
        >
          <option value="">Todas</option>
          {PRIORIDADES.map((p) => (
            <option key={p}>{p}</option>
          ))}
        </select>
      </div>
    </form>
  )
}
