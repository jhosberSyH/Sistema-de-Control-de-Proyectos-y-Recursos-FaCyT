import { useCallback, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { useEquipos, useFinMantenimiento } from '../api/equipos'
import { ESTADOS_EQUIPO, type Equipo, type EstadoEquipo, type FiltrosEquipos, type Ubicacion } from '../types'
import { DialogoMantenimiento, DialogoRegistrarEquipo } from './dialogos-equipo'
import { TablaEquipos } from './tabla-equipos'
import './equipos.css'

function useFiltros() {
  const [params, setParams] = useSearchParams()
  const estado = params.get('estado') as EstadoEquipo | null
  const filtros: FiltrosEquipos = {
    q: params.get('q') ?? '',
    estado: estado && ESTADOS_EQUIPO.includes(estado) ? estado : '',
    ubicacion: params.get('ubicacion') ?? '',
  }
  const cambiar = useCallback(
    (cambios: Partial<FiltrosEquipos>) =>
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales)
          for (const [clave, valor] of Object.entries(cambios)) {
            if (valor === '') nuevos.delete(clave)
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

type Abierto = { tipo: 'registrar' } | { tipo: 'mantenimiento'; equipo: Equipo } | null

/** Vista 11: catálogo de equipos (F4.1, F4.2), solo para el Administrador. */
export function VistaEquipos() {
  const [filtros, cambiar] = useFiltros()
  const equipos = useEquipos(filtros)
  const fin = useFinMantenimiento()
  const [abierto, setAbierto] = useState<Abierto>(null)
  const [resultado, setResultado] = useState<ReactNode>(null)
  const refFoco = useRef<HTMLElement | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (resultado) refFoco.current = refResultado.current
  }, [resultado])

  const datos = equipos.data
  const conFiltros = Boolean(filtros.q.trim() || filtros.estado || filtros.ubicacion)
  const abrir = (a: Abierto, origen: HTMLElement) => {
    refFoco.current = origen
    setResultado(null)
    setAbierto(a)
  }

  const terminar = (e: Equipo) => {
    setResultado(null)
    fin.mutate(e.id, {
      onSuccess: (x) => {
        setResultado(
          <p>Registraste el fin del mantenimiento: {x.nombre} volvió a Disponible y ya se puede reservar.</p>,
        )
        // El botón desaparece con el cambio de estado: el foco va al resultado
        requestAnimationFrame(() => refResultado.current?.focus())
      },
    })
  }

  return (
    <>
      <EncabezadoPagina
        migas={[{ texto: 'Inicio', a: '/inicio' }, { texto: 'Catálogo de equipos' }]}
        titulo="Catálogo de equipos"
        subtitulo="Equipos y maquinaria de los laboratorios, con su estado operacional y su próxima reserva."
        acciones={
          <button
            className="btn btn-pri"
            type="button"
            aria-disabled={!datos || undefined}
            onClick={(e) => {
              if (datos) abrir({ tipo: 'registrar' }, e.currentTarget)
            }}
          >
            <Icono nombre="mas" />
            Registrar equipo
          </button>
        }
      />

      <section className="tarjeta lista-e" aria-label="Equipos">
        {resultado && (
          <div className="resultado" ref={refResultado} tabIndex={-1}>
            <Aviso tipo="ok">{resultado}</Aviso>
          </div>
        )}
        {fin.isError && (
          <div className="resultado">
            <Aviso tipo="err">
              <p>{fin.error.message}</p>
            </Aviso>
          </div>
        )}
        <Filtros filtros={filtros} ubicaciones={datos?.ubicacionesConEquipos ?? []} alCambiar={cambiar} />

        <div aria-busy={equipos.isFetching || undefined}>
          {equipos.isPending ? (
            <div style={{ padding: 20 }}>
              <Cargando etiqueta="Cargando los equipos…">
                {Array.from({ length: 5 }, (_, i) => (
                  <Esqueleto key={i} alto={48} />
                ))}
              </Cargando>
            </div>
          ) : equipos.isError ? (
            <div style={{ padding: 20 }}>
              <ErrorCarga mensaje={equipos.error.message} alReintentar={() => equipos.refetch()} />
            </div>
          ) : datos && datos.items.length === 0 ? (
            conFiltros ? (
              <EstadoVacio
                icono="buscar"
                titulo="Ningún equipo coincide con los filtros"
                accion={
                  <button
                    className="btn btn-sec btn-chico"
                    type="button"
                    onClick={() => cambiar({ q: '', estado: '', ubicacion: '' })}
                  >
                    Quitar los filtros
                  </button>
                }
              >
                Revisa cómo está escrito el nombre o el código de activo.
              </EstadoVacio>
            ) : (
              <EstadoVacio icono="equipos" titulo="Todavía no hay equipos en el catálogo">
                Registra el primero con "Registrar equipo".
              </EstadoVacio>
            )
          ) : datos ? (
            <TablaEquipos
              equipos={datos.items}
              terminando={fin.isPending ? (fin.variables ?? null) : null}
              alMantenimiento={(e, origen) => abrir({ tipo: 'mantenimiento', equipo: e }, origen)}
              alFinMantenimiento={(e, origen) => {
                refFoco.current = origen
                terminar(e)
              }}
            />
          ) : null}
        </div>
      </section>

      {abierto?.tipo === 'registrar' && datos && (
        <DialogoRegistrarEquipo
          ubicaciones={datos.ubicaciones}
          alCerrar={() => setAbierto(null)}
          focoAlCerrar={refFoco}
          alRegistrar={(e) => {
            setAbierto(null)
            setResultado(
              <p>
                Registraste {e.nombre} (<span className="mono">{e.codigo}</span>) en {e.ubicacion.nombre}.
                Nace Disponible y ya se puede reservar.
              </p>,
            )
          }}
        />
      )}
      {abierto?.tipo === 'mantenimiento' && (
        <DialogoMantenimiento
          equipo={abierto.equipo}
          alCerrar={() => setAbierto(null)}
          focoAlCerrar={refFoco}
          alListo={(r) => {
            const nombre = abierto.equipo.nombre
            setAbierto(null)
            setResultado(
              <p>
                {nombre} pasó a mantenimiento y ya no admite reservas nuevas.{' '}
                {r.reservas === 0
                  ? 'No tenía reservas aprobadas a futuro.'
                  : `Avisamos a ${r.avisados === 1 ? '1 coordinador' : `${r.avisados} coordinadores`} de ${
                      r.reservas === 1 ? 'su reserva afectada' : `sus ${r.reservas} reservas afectadas`
                    }.`}
              </p>,
            )
          }}
        />
      )}
    </>
  )
}

/** Filtros del mockup 11: búsqueda por nombre o código de activo, estado y ubicación. */
function Filtros({
  filtros,
  ubicaciones,
  alCambiar,
}: {
  filtros: FiltrosEquipos
  ubicaciones: Ubicacion[]
  alCambiar: (c: Partial<FiltrosEquipos>) => void
}) {
  const [texto, setTexto] = useState(filtros.q)
  const [anterior, setAnterior] = useState(filtros.q)
  if (filtros.q !== anterior) {
    setAnterior(filtros.q)
    setTexto(filtros.q)
  }
  useEffect(() => {
    if (texto === filtros.q) return
    const t = window.setTimeout(() => alCambiar({ q: texto }), 300)
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
          placeholder="Nombre o código de activo"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="f-est">Estado</label>
        <select
          className="entrada"
          id="f-est"
          value={filtros.estado}
          onChange={(e) => alCambiar({ estado: e.target.value as EstadoEquipo | '' })}
        >
          <option value="">Todos</option>
          {ESTADOS_EQUIPO.map((e) => (
            <option key={e}>{e}</option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-ub">Ubicación</label>
        <select
          className="entrada"
          id="f-ub"
          value={filtros.ubicacion}
          onChange={(e) => alCambiar({ ubicacion: e.target.value })}
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
