import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icono, type NombreIcono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { Paginacion } from '@/components/ui/tabla'
import { useExportarInventario, useInsumos } from '../api/insumos'
import {
  ALERTAS,
  TIPOS,
  type Alerta,
  type FiltrosInventario,
  type PaginaInsumos,
  type ResumenInsumo,
  type TipoInsumo,
} from '../types'
import { cantidad } from '../utils/cantidad'
import { DialogoRegistrarInsumo } from './dialogo-registrar-insumo'
import { TablaInsumos } from './tabla-insumos'
import './inventario.css'

type Props = {
  /** Administrador: registra insumos. Aprobador: consulta y exporta. Coordinador: solo consulta y pide retiros. */
  rol: 'administrador' | 'aprobador' | 'coordinador'
}

function useFiltros() {
  const [params, setParams] = useSearchParams()
  const tipo = params.get('tipo') as TipoInsumo | null
  const alerta = params.get('alerta') as Alerta | null
  const filtros: FiltrosInventario = {
    q: params.get('q') ?? '',
    tipo: tipo && TIPOS.includes(tipo) ? tipo : '',
    ubicacion: params.get('ubicacion') ?? '',
    alerta: alerta && ALERTAS.includes(alerta) ? alerta : '',
    pagina: Math.max(1, Number(params.get('pagina')) || 1),
  }
  const cambiar = useCallback(
    (cambios: Partial<FiltrosInventario>) =>
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

function resumen(d: PaginaInsumos) {
  const etiqueta = d.total === 1 ? 'insumo' : 'insumos'
  if (d.paginas === 1) return `${d.total} ${etiqueta}`
  const inicio = (d.pagina - 1) * d.porPagina + 1
  return `${inicio} a ${inicio + d.items.length - 1} de ${d.total} ${etiqueta}`
}

/** Las tres tarjetas del mockup: filtran la lista por su alerta y se vuelven a pulsar para quitarla. */
function TarjetasAlerta({
  datos,
  alerta,
  alCambiar,
}: {
  datos: PaginaInsumos | undefined
  alerta: Alerta | ''
  alCambiar: (a: Alerta | '') => void
}) {
  const a = datos?.alertas
  const tarjetas: {
    clave: Alerta
    tipo: 'err' | 'warn'
    icono: NombreIcono
    valor?: number
    texto: string
  }[] = [
    {
      clave: 'minimo',
      tipo: 'err',
      icono: 'alerta',
      valor: a?.bajoMinimo,
      texto: a?.bajoMinimo === 1 ? 'insumo bajo su mínimo' : 'insumos bajo su mínimo',
    },
    {
      clave: 'vencimiento',
      tipo: 'warn',
      icono: 'reloj',
      valor: a?.porVencer,
      texto: `${a?.porVencer === 1 ? 'lote próximo' : 'lotes próximos'} a vencer (${datos?.anticipacion ?? 30} días)`,
    },
    {
      clave: 'vencido',
      tipo: 'err',
      icono: 'error',
      valor: a?.vencidos,
      texto:
        a?.vencidos === 1
          ? 'lote vencido, bloqueado para despacho'
          : 'lotes vencidos, bloqueados para despacho',
    },
  ]
  return (
    <div className="alertas-r" role="group" aria-label="Filtrar por alerta">
      {tarjetas.map((t) => (
        <button
          key={t.clave}
          type="button"
          className={`tarjeta al ${t.tipo}`}
          aria-pressed={alerta === t.clave}
          onClick={() => alCambiar(alerta === t.clave ? '' : t.clave)}
        >
          <span className="ic">
            <Icono nombre={t.icono} />
          </span>
          <div>
            <b>{t.valor ?? '·'}</b>
            <span>{t.texto}</span>
          </div>
        </button>
      ))}
    </div>
  )
}

/** Vista 09: inventario (F3.1, F3.4, F3.6), con la entrada de solo consulta del Coordinador. */
export function VistaInventario({ rol }: Props) {
  const [filtros, cambiar] = useFiltros()
  const insumos = useInsumos(filtros)
  const exportar = useExportarInventario()
  const [registrando, setRegistrando] = useState(false)
  const [resultado, setResultado] = useState<ReactNode>(null)
  const refFoco = useRef<HTMLElement | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (resultado) refFoco.current = refResultado.current
  }, [resultado])

  const esAdministrador = rol === 'administrador'
  const soloConsulta = rol === 'coordinador'
  const datos = insumos.data
  const conFiltros = Boolean(filtros.q.trim() || filtros.tipo || filtros.ubicacion || filtros.alerta)

  function alRegistrar(i: ResumenInsumo, reposicion: string | null) {
    setRegistrando(false)
    setResultado(
      <>
        <p>
          Registraste <Link to={`/inventario/${i.id}`}>{i.nombre}</Link> con stock cero y mínimo de{' '}
          {cantidad(i.stockMinimo, i.unidad)}.
          {i.tipo === 'Consumible de uso general' &&
            ' Como es de uso general, su costo se reparte entre los proyectos al cerrar cada período.'}
        </p>
        {reposicion && (
          <p>
            Ya aparece bajo su mínimo, así que se creó la reposición{' '}
            <span className="mono">{reposicion}</span> en Borrador para el aprobador.
          </p>
        )}
      </>,
    )
  }

  return (
    <div className="vista-inventario">
      <EncabezadoPagina
        migas={[{ texto: 'Inicio', a: '/inicio' }, { texto: 'Inventario' }]}
        titulo="Inventario"
        subtitulo={
          soloConsulta
            ? 'Lo que hay en el almacén, con su stock al día. Para usar un insumo en tu proyecto, pídelo con una solicitud de retiro.'
            : 'Materia prima y consumibles en un solo catálogo. El stock cambia en el momento en que se registra cada recepción o despacho.'
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
                Registrar insumo
              </button>
            )}
            {soloConsulta && (
              <BotonEnlace variante="pri" to="/solicitudes?nueva=retiro">
                Pedir retiro
              </BotonEnlace>
            )}
          </>
        }
      />
      {exportar.isError && (
        <Aviso tipo="err">
          <p>No pudimos exportar el inventario. {exportar.error.message}</p>
        </Aviso>
      )}

      {/* Las alertas son trabajo del Aprobador y del Administrador; el Coordinador ve el estado en la tabla (H8) */}
      {!soloConsulta && (
        <TarjetasAlerta
          datos={datos}
          alerta={filtros.alerta}
          alCambiar={(alerta) => cambiar({ alerta, pagina: 1 })}
        />
      )}

      <section className="tarjeta lista-i" aria-label="Catálogo de insumos">
        {resultado && (
          <div className="resultado" ref={refResultado} tabIndex={-1}>
            <Aviso tipo="ok">{resultado}</Aviso>
          </div>
        )}
        <Filtros filtros={filtros} ubicaciones={datos?.ubicaciones ?? []} alCambiar={cambiar} />

        <div aria-busy={insumos.isFetching || undefined}>
          {insumos.isPending ? (
            <div style={{ padding: 20 }}>
              <Cargando etiqueta="Cargando el inventario…">
                {Array.from({ length: 6 }, (_, i) => (
                  <Esqueleto key={i} alto={48} />
                ))}
              </Cargando>
            </div>
          ) : insumos.isError ? (
            <div style={{ padding: 20 }}>
              <ErrorCarga mensaje={insumos.error.message} alReintentar={() => insumos.refetch()} />
            </div>
          ) : datos && datos.items.length === 0 ? (
            conFiltros ? (
              <EstadoVacio
                icono="buscar"
                titulo="Ningún insumo coincide con los filtros"
                accion={
                  <button
                    className="btn btn-sec btn-chico"
                    type="button"
                    onClick={() => cambiar({ q: '', tipo: '', ubicacion: '', alerta: '', pagina: 1 })}
                  >
                    Quitar los filtros
                  </button>
                }
              >
                Revisa cómo está escrito el nombre o el número de lote, o mira todos los tipos y ubicaciones.
              </EstadoVacio>
            ) : (
              <EstadoVacio icono="inventario" titulo="Todavía no hay insumos en el catálogo">
                {esAdministrador
                  ? 'Registra el primero con "Registrar insumo".'
                  : 'El administrador todavía no los registra.'}
              </EstadoVacio>
            )
          ) : datos ? (
            <TablaInsumos
              insumos={datos.items}
              anticipacion={datos.anticipacion}
              soloConsulta={soloConsulta}
            />
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
        <DialogoRegistrarInsumo
          alCerrar={() => setRegistrando(false)}
          alRegistrar={alRegistrar}
          focoAlCerrar={refFoco}
        />
      )}
    </div>
  )
}

/** Filtros del mockup 09: búsqueda por nombre o lote, tipo y ubicación. */
function Filtros({
  filtros,
  ubicaciones,
  alCambiar,
}: {
  filtros: FiltrosInventario
  ubicaciones: { id: string; nombre: string }[]
  alCambiar: (c: Partial<FiltrosInventario>) => void
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
          placeholder="Nombre del insumo o número de lote"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="f-tipo">Tipo</label>
        <select
          className="entrada"
          id="f-tipo"
          value={filtros.tipo}
          onChange={(e) => alCambiar({ tipo: e.target.value as TipoInsumo | '', pagina: 1 })}
        >
          <option value="">Todos</option>
          {TIPOS.map((t) => (
            <option key={t}>{t}</option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-ub">Ubicación</label>
        <select
          className="entrada"
          id="f-ub"
          value={filtros.ubicacion}
          onChange={(e) => alCambiar({ ubicacion: e.target.value, pagina: 1 })}
        >
          <option value="">Todas</option>
          {ubicaciones.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>
    </form>
  )
}
