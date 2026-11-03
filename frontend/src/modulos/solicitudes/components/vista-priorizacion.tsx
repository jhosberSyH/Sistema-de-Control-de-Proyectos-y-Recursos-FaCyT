import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { Boton } from '@/components/ui/boton'
import { ConCodigos } from '@/components/ui/con-codigos'
import { AreaTexto, Campo, Selector } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { ChipEstado, ChipPrioridad, type Prioridad } from '@/components/ui/estado'
import { TIPO_ESTATUS_PROYECTO } from '@/components/ui/estados-dominio'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { OpcionesTarjeta } from '@/components/ui/opciones'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { fechaCorta, fechaIso, hora } from '@/lib/formato'
import { useCambiarPrioridad, usePriorizacion } from '../api/priorizacion'
import type { ProyectoPriorizado } from '../types/priorizacion'
import { enumerar } from '../utils/bandeja'
import './priorizacion.css'

const PRIORIDADES: Prioridad[] = ['Crítica', 'Alta', 'Media', 'Baja']
const NIVEL: Record<Prioridad, number> = { Crítica: 0, Alta: 1, Media: 2, Baja: 3 }

/** "Hoy 08:42, desde Alta" o "14/07/2026, al registrarlo" (mockup 16). */
function ultimo({ fecha, desde }: ProyectoPriorizado['ultimoCambio']) {
  const cuando =
    fecha.length > 10 && fechaIso(fecha) === fechaIso() ? `Hoy ${hora(fecha)}` : fechaCorta(fecha)
  return `${cuando}, ${desde ? `desde ${desde}` : 'al registrarlo'}`
}

/**
 * Qué cambia en la bandeja de aprobación con la nueva prioridad, entre los proyectos en ejecución:
 * al subir, pasa delante de los que quedan por debajo; al bajar, los que quedan por encima le pasan.
 */
function efecto(p: ProyectoPriorizado, nueva: Prioridad, activos: ProyectoPriorizado[]) {
  const otros = activos.filter((x) => x.codigo !== p.codigo)
  const antes = NIVEL[p.prioridad]
  const despues = NIVEL[nueva]
  if (despues < antes) {
    const pasa = otros.filter((x) => NIVEL[x.prioridad] > despues && NIVEL[x.prioridad] <= antes)
    return pasa.length
      ? `Con ${nueva}, ${p.codigo} pasa delante de ${enumerar(pasa.map((x) => x.codigo))} en la bandeja de aprobación.`
      : `Con ${nueva}, ${p.codigo} queda primero en la bandeja de aprobación.`
  }
  const pasan = otros.filter((x) => NIVEL[x.prioridad] < despues && NIVEL[x.prioridad] >= antes)
  return pasan.length
    ? `Con ${nueva}, ${enumerar(pasan.map((x) => x.codigo))} ${pasan.length === 1 ? 'pasa' : 'pasan'} delante de ${p.codigo} en la bandeja de aprobación.`
    : `Con ${nueva}, ${p.codigo} sigue en el mismo lugar de la bandeja de aprobación.`
}

/**
 * Vista 16: priorización de proyectos (F5.6, F5.7). Todos consultan el orden (el Coordinador, solo sus
 * proyectos, RN-07); solo el Aprobador lo cambia, siempre con una justificación (RN-04).
 */
export function VistaPriorizacion({ puedeCambiar }: { puedeCambiar: boolean }) {
  const [todos, setTodos] = useState(false)
  const datos = usePriorizacion(todos)
  const [editando, setEditando] = useState<ProyectoPriorizado | null>(null)
  const [hecho, setHecho] = useState<string | null>(null)
  const refHecho = useRef<HTMLDivElement>(null)
  useTituloPagina('Priorización')

  useEffect(() => {
    if (hecho) refHecho.current?.focus()
  }, [hecho])

  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando la priorización…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />

  const proyectos = datos.data.proyectos
  const activos = proyectos.filter((p) => p.estatus === 'En ejecución')

  return (
    <div className="vista-priorizacion">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/inicio">Inicio</Link>
              </li>
              <li aria-current="page">Priorización</li>
            </ol>
          </nav>
          <h1>Priorización de proyectos</h1>
          <p className="sub">
            El orden define qué proyecto se atiende primero en la bandeja de aprobación. Todo cambio de
            prioridad lleva una justificación que queda en la auditoría.
          </p>
        </div>
        <div className="acc">
          <Campo etiqueta="Estatus" className="filtro-estatus">
            {(c) => (
              <Selector
                {...c}
                value={todos ? 'todos' : 'en-ejecucion'}
                onChange={(e) => setTodos(e.target.value === 'todos')}
              >
                <option value="en-ejecucion">En ejecución</option>
                <option value="todos">Todos</option>
              </Selector>
            )}
          </Campo>
        </div>
      </div>

      {hecho && (
        <div ref={refHecho} tabIndex={-1} className="hecho">
          <Aviso tipo="ok">
            <p>{hecho}</p>
          </Aviso>
        </div>
      )}

      <div className="grupos">
        {PRIORIDADES.map((nivel) => {
          const del = proyectos.filter((p) => p.prioridad === nivel)
          return (
            <section key={nivel} className="tarjeta grupo" aria-label={`Prioridad ${nivel}`}>
              <div className="grupo-cab">
                <h2>
                  <ChipPrioridad prioridad={nivel} />
                </h2>
                <span className="conteo">
                  {del.length} {del.length === 1 ? 'proyecto' : 'proyectos'}
                </span>
              </div>
              {del.length === 0 ? (
                <p className="fila-p vacia">Ningún proyecto con esta prioridad.</p>
              ) : (
                del.map((p) => (
                  <div key={p.codigo} className="fila-p">
                    <Link className="mono" to={`/proyectos/${p.codigo}`}>
                      {p.codigo}
                    </Link>
                    <div className="nom">
                      {p.nombre}
                      <small>{p.coordinador ?? 'Sin coordinador'}</small>
                    </div>
                    <span className="ultimo">Último cambio: {ultimo(p.ultimoCambio)}</span>
                    <span>
                      <ChipEstado tipo={TIPO_ESTATUS_PROYECTO[p.estatus]}>{p.estatus}</ChipEstado>
                    </span>
                    {puedeCambiar && p.estatus !== 'Finalizado' ? (
                      <Boton chico onClick={() => setEditando(p)}>
                        Cambiar prioridad <span className="vh">de {p.codigo}</span>
                      </Boton>
                    ) : (
                      <span aria-hidden="true" />
                    )}
                  </div>
                ))
              )}
            </section>
          )
        })}
      </div>

      {editando && (
        <DialogoPrioridad
          p={editando}
          activos={activos}
          alCerrar={() => setEditando(null)}
          alListo={(texto) => {
            setEditando(null)
            setHecho(texto)
          }}
        />
      )}
    </div>
  )
}

function DialogoPrioridad({
  p,
  activos,
  alCerrar,
  alListo,
}: {
  p: ProyectoPriorizado
  activos: ProyectoPriorizado[]
  alCerrar: () => void
  alListo: (texto: string) => void
}) {
  const cambiar = useCambiarPrioridad()
  const [nueva, setNueva] = useState<Prioridad | undefined>()
  const [justificacion, setJustificacion] = useState('')
  const [errores, setErrores] = useState<{ prioridad?: string; justificacion?: string }>({})
  const refJustificacion = useRef<HTMLTextAreaElement>(null)
  const refOpcion = useRef<HTMLInputElement>(null)
  const errorGeneral = cambiar.isError && !(esApiError(cambiar.error) && cambiar.error.status === 422)

  async function enviar() {
    const e: typeof errores = {}
    if (!nueva) e.prioridad = 'Elige la nueva prioridad.'
    if (!justificacion.trim()) {
      e.justificacion = 'Escribe por qué cambias la prioridad. Sin justificación el cambio no se guarda.'
    }
    setErrores(e)
    if (e.prioridad) return refOpcion.current?.focus()
    if (e.justificacion) return refJustificacion.current?.focus()
    try {
      await cambiar.mutateAsync({ codigo: p.codigo, prioridad: nueva!, justificacion: justificacion.trim() })
      alListo(
        `Cambiaste ${p.codigo} de ${p.prioridad} a ${nueva}.${p.coordinador ? ` ${p.coordinador} recibe el aviso.` : ''}`,
      )
    } catch (err) {
      if (esApiError(err) && err.status === 422) setErrores(err.errores)
    }
  }

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo={
        <>
          Cambiar prioridad de <span className="mono">{p.codigo}</span>
        </>
      }
      descripcion={`${p.nombre} · hoy es ${p.prioridad}`}
      alEnviar={(e) => {
        e.preventDefault()
        if (!cambiar.isPending) void enviar()
      }}
    >
      <OpcionesTarjeta
        leyenda="Nueva prioridad"
        opciones={PRIORIDADES.map((x) => ({
          valor: x,
          etiqueta: x === p.prioridad ? `${x} (actual)` : x,
          deshabilitada: x === p.prioridad,
        }))}
        valor={nueva}
        alCambiar={(v) => {
          setNueva(v)
          setErrores((e) => ({ ...e, prioridad: undefined }))
        }}
        error={errores.prioridad}
        refControl={refOpcion}
      />
      <Campo
        etiqueta="Justificación"
        ayuda="Queda en la auditoría con tu nombre, la fecha, el nivel anterior y el nuevo."
        error={errores.justificacion}
      >
        {(c) => (
          <AreaTexto
            {...c}
            ref={refJustificacion}
            className="justificacion"
            maxLength={500}
            value={justificacion}
            onChange={(e) => {
              setJustificacion(e.target.value)
              setErrores((x) => ({ ...x, justificacion: undefined }))
            }}
          />
        )}
      </Campo>
      {nueva && p.estatus === 'En ejecución' && (
        <Aviso tipo="info" rol="none">
          <p className="efecto-prio">
            <ConCodigos texto={efecto(p, nueva, activos)} />
          </p>
        </Aviso>
      )}
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{cambiar.error?.message}</p>
        </Aviso>
      )}
      <div className="acc-form">
        <button className="btn btn-sec" type="button" onClick={alCerrar}>
          Cancelar
        </button>
        <button className="btn btn-pri" type="submit" aria-disabled={cambiar.isPending || undefined}>
          {cambiar.isPending ? 'Guardando…' : nueva ? `Cambiar a ${nueva}` : 'Cambiar prioridad'}
        </button>
      </div>
    </Dialogo>
  )
}
