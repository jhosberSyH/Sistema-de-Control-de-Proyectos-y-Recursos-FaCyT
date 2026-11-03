import { useState, type RefObject } from 'react'
import { Aviso } from '@/components/ui/aviso'
import { AreaTexto, Campo, Selector } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { useAsignarCoordinador, useCambiarEstatus, useCoordinadores } from '../api/proyectos'
import type { Estatus, FichaProyecto, ResumenProyecto } from '../types'

type Base = {
  proyecto: FichaProyecto
  alCerrar: () => void
  alListo: (p: ResumenProyecto) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

const cerrarAlSalir = (alCerrar: () => void) => (abierto: boolean) => {
  if (!abierto) alCerrar()
}

/** Qué pasa con cada estatus nuevo (mockup 07), para decidir antes de confirmar (H5). */
function efecto(codigo: string, de: Estatus, a: Estatus) {
  if (a === 'Suspendido') {
    return {
      tipo: 'warn' as const,
      titulo: `${codigo} deja de contar como proyecto activo.`,
      detalle:
        'No recibe parte de los gastos compartidos y no aparece en los indicadores. Puedes reactivarlo después.',
    }
  }
  if (a === 'Finalizado') {
    return {
      tipo: 'warn' as const,
      titulo: `${codigo} ya no admitirá solicitudes nuevas ni reservas de equipos.`,
      detalle:
        'Las solicitudes y reservas pendientes se mantienen hasta resolverse. Es un cambio definitivo.',
    }
  }
  return {
    tipo: 'info' as const,
    titulo:
      de === 'Suspendido'
        ? `${codigo} vuelve a contar como proyecto activo.`
        : `${codigo} empieza a contar como proyecto activo.`,
    detalle: 'Recibe su parte de los gastos compartidos y aparece en los indicadores.',
  }
}

/** "Cambiar estatus" (mockup 07, F2.3). Solo ofrece los cambios permitidos desde el estatus actual. */
export function DialogoEstatus({ proyecto, alCerrar, alListo, focoAlCerrar }: Base) {
  const cambiar = useCambiarEstatus(proyecto.codigo)
  const [elegido, setElegido] = useState<Estatus>(proyecto.estatus)
  const [comentario, setComentario] = useState('')
  const opciones = [{ estatus: proyecto.estatus, bloqueo: null as string | null }, ...proyecto.transiciones]
  const bloqueados = proyecto.transiciones.filter((t) => t.bloqueo)
  const hayCambio = elegido !== proyecto.estatus
  const aviso = hayCambio ? efecto(proyecto.codigo, proyecto.estatus, elegido) : null

  return (
    <Dialogo
      abierto
      alCambiar={cerrarAlSalir(alCerrar)}
      titulo={
        <>
          Cambiar estatus de <span className="mono">{proyecto.codigo}</span>
        </>
      }
      descripcion={`Estatus actual: ${proyecto.estatus}`}
      alEnviar={(e) => {
        e.preventDefault()
        if (!hayCambio || cambiar.isPending) return
        cambiar.mutate({ estatus: elegido, comentario }, { onSuccess: alListo })
      }}
      focoAlCerrar={focoAlCerrar}
    >
      <fieldset style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className="vh">Nuevo estatus</legend>
        <div className="radios">
          {opciones.map((o) => (
            <label key={o.estatus}>
              <input
                type="radio"
                name="estatus"
                value={o.estatus}
                checked={elegido === o.estatus}
                disabled={Boolean(o.bloqueo)}
                onChange={() => setElegido(o.estatus)}
              />{' '}
              {o.estatus}
            </label>
          ))}
        </div>
      </fieldset>
      {bloqueados.map((b) => (
        <Aviso key={b.estatus} tipo="info" rol="none">
          <p>
            <b>Todavía no puede pasar a {b.estatus}.</b> {b.bloqueo}
          </p>
        </Aviso>
      ))}
      {aviso && (
        <Aviso tipo={aviso.tipo}>
          <p>
            <b>{aviso.titulo}</b>
          </p>
          <p>{aviso.detalle}</p>
        </Aviso>
      )}
      <Campo etiqueta="Comentario para el historial" opcional id="est-com">
        {(c) => (
          <AreaTexto
            {...c}
            maxLength={300}
            value={comentario}
            onChange={(e) => setComentario(e.target.value)}
          />
        )}
      </Campo>
      {cambiar.isError && (
        <Aviso tipo="err">
          <p>{cambiar.error.message}</p>
        </Aviso>
      )}
      <div className="acc-form">
        <button className="btn btn-sec" type="button" onClick={alCerrar}>
          Cancelar
        </button>
        <button
          className="btn btn-pri"
          type="submit"
          aria-disabled={!hayCambio || cambiar.isPending || undefined}
        >
          {cambiar.isPending ? 'Guardando…' : hayCambio ? `Cambiar a ${elegido}` : 'Sin cambios'}
        </button>
      </div>
    </Dialogo>
  )
}

/** Asignar o cambiar el coordinador (F2.2). No estaba dibujado: mismo lenguaje que los demás diálogos. */
export function DialogoCoordinador({ proyecto, alCerrar, alListo, focoAlCerrar }: Base) {
  const asignar = useAsignarCoordinador(proyecto.codigo)
  const coordinadores = useCoordinadores(true)
  const actual = proyecto.coordinador
  const [elegido, setElegido] = useState('')
  const nuevo = coordinadores.data?.find((c) => c.id === elegido)
  const [error, setError] = useState<string | null>(null)

  return (
    <Dialogo
      abierto
      alCambiar={cerrarAlSalir(alCerrar)}
      titulo={
        <>
          {actual ? 'Cambiar coordinador' : 'Asignar coordinador'} de{' '}
          <span className="mono">{proyecto.codigo}</span>
        </>
      }
      descripcion={actual ? `Lo coordina ${actual.nombre}.` : 'Por ahora no tiene coordinador.'}
      alEnviar={(e) => {
        e.preventDefault()
        if (asignar.isPending) return
        if (!elegido) {
          setError('Elige quién va a coordinar el proyecto.')
          return
        }
        asignar.mutate(elegido, { onSuccess: alListo })
      }}
      focoAlCerrar={focoAlCerrar}
    >
      <Campo
        etiqueta="Coordinador"
        id="coord-nuevo"
        ayuda="Solo aparecen las cuentas activas con rol Coordinador de Proyecto."
        error={error ?? undefined}
      >
        {(c) => (
          <Selector
            {...c}
            value={elegido}
            onChange={(e) => {
              setElegido(e.target.value)
              setError(null)
            }}
          >
            <option value="" disabled>
              {coordinadores.isPending ? 'Cargando…' : 'Elige un coordinador'}
            </option>
            {coordinadores.data
              ?.filter((u) => u.id !== actual?.id)
              .map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                  {u.proyectos > 0 ? ` (${u.proyectos} ${u.proyectos === 1 ? 'proyecto' : 'proyectos'})` : ''}
                </option>
              ))}
          </Selector>
        )}
      </Campo>
      {nuevo && (
        <Aviso tipo="info">
          <p>
            {actual
              ? `Desde ahora lo ve ${nuevo.nombre} en sus proyectos y deja de verlo ${actual.nombre}. A los dos les llega un aviso.`
              : `Desde ahora lo ve ${nuevo.nombre} en sus proyectos y le llega un aviso.`}
          </p>
        </Aviso>
      )}
      {asignar.isError && (
        <Aviso tipo="err">
          <p>{asignar.error.message}</p>
        </Aviso>
      )}
      <div className="acc-form">
        <button className="btn btn-sec" type="button" onClick={alCerrar}>
          Cancelar
        </button>
        <button className="btn btn-pri" type="submit" aria-disabled={asignar.isPending || undefined}>
          {asignar.isPending
            ? 'Guardando…'
            : nuevo
              ? `${actual ? 'Cambiar a' : 'Asignar a'} ${nuevo.nombre}`
              : 'Asignar'}
        </button>
      </div>
    </Dialogo>
  )
}
