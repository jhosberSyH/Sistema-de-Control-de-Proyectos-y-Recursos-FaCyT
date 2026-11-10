import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, type RefObject } from 'react'
import { useForm } from 'react-hook-form'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada } from '@/components/ui/campo'
import { Dialogo, DialogoAlerta } from '@/components/ui/dialogo'
import { esApiError } from '@/lib/api-client'
import { useCambiarEstadoUbicacion, useEditarUbicacion, useEliminarUbicacion } from '../api/catalogos'
import { esquemaUbicacion, type DatosUbicacion } from '../schemas/catalogos'
import type { Ubicacion } from '../types'

type Base = {
  ubicacion: Ubicacion
  alCerrar: () => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

const alCambiar = (alCerrar: () => void) => (abierto: boolean) => {
  if (!abierto) alCerrar()
}

const lotesTexto = (n: number) => (n === 1 ? '1 lote' : `${n} lotes`)
const equiposTexto = (n: number) => (n === 1 ? '1 equipo' : `${n} equipos`)

/** "Guarda 6 lotes con existencia.", "Tiene 2 equipos.", "Nunca tuvo lotes." */
function usoTexto(u: Ubicacion) {
  const partes = [
    u.lotes > 0 ? `guarda ${lotesTexto(u.lotes)} con existencia` : null,
    u.equipos > 0 ? `tiene ${equiposTexto(u.equipos)}` : null,
  ].filter(Boolean)
  if (partes.length > 0) {
    const texto = partes.join(' y ')
    return `${texto.charAt(0).toUpperCase()}${texto.slice(1)}.`
  }
  return u.usada ? 'No guarda lotes ahora, pero ya tuvo.' : 'Nunca tuvo lotes.'
}

/**
 * Ficha de una ubicación (no estaba dibujada; mismo lenguaje que "Editar cuenta"): nombre,
 * descripción y, abajo, desactivar o, si nunca tuvo lotes, eliminar (F1.4).
 */
export function DialogoEditarUbicacion({
  ubicacion,
  alCerrar,
  alListo,
  alDesactivar,
  alEliminar,
  focoAlCerrar,
}: Base & {
  alListo: (u: Ubicacion) => void
  alDesactivar: (u: Ubicacion) => void
  alEliminar: (u: Ubicacion) => void
}) {
  const editar = useEditarUbicacion()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DatosUbicacion>({
    resolver: zodResolver(esquemaUbicacion),
    defaultValues: { nombre: ubicacion.nombre, descripcion: ubicacion.descripcion },
  })
  const registroNombre = register('nombre')
  const registroDescripcion = register('descripcion')

  // 409 (nombre repetido) y 422 van junto a su campo.
  useEffect(() => {
    const e = editar.error
    if (!esApiError(e)) return
    if (e.status === 409) setError('nombre', { message: e.message }, { shouldFocus: true })
    for (const [campo, mensaje] of Object.entries(e.errores)) {
      if (campo === 'nombre' || campo === 'descripcion')
        setError(campo, { message: mensaje }, { shouldFocus: true })
    }
  }, [editar.error, setError])
  const errorGeneral =
    editar.error &&
    !(esApiError(editar.error) && (editar.error.status === 409 || editar.error.status === 422))
      ? editar.error.message
      : null

  const enviar = handleSubmit((datos) => {
    if (!editar.isPending) editar.mutate({ id: ubicacion.id, datos }, { onSuccess: alListo })
  })

  return (
    <Dialogo
      abierto
      alCambiar={alCambiar(alCerrar)}
      titulo="Editar ubicación"
      descripcion={ubicacion.nombre}
      alEnviar={enviar}
      focoAlCerrar={focoAlCerrar}
    >
      <div className="form-rejilla">
        <Campo className="ancho" etiqueta="Nombre" id="ubic-nombre" error={errors.nombre?.message}>
          {(c) => <Entrada {...c} autoComplete="off" {...registroNombre} />}
        </Campo>
        <Campo
          className="ancho"
          etiqueta="Descripción"
          opcional
          id="ubic-descripcion"
          error={errors.descripcion?.message}
        >
          {(c) => <Entrada {...c} autoComplete="off" {...registroDescripcion} />}
        </Campo>
      </div>
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}
      <div className="uso-ubic">
        <div>
          <b>Uso</b>
          <span className="sec">{usoTexto(ubicacion)}</span>
        </div>
        <div className="botones">
          {!ubicacion.usada && (
            <button
              className="btn btn-sec btn-chico peligro"
              type="button"
              onClick={() => alEliminar(ubicacion)}
            >
              Eliminar ubicación
            </button>
          )}
          <button
            className="btn btn-sec btn-chico peligro"
            type="button"
            onClick={() => alDesactivar(ubicacion)}
          >
            Desactivar ubicación
          </button>
        </div>
      </div>
      <div className="acc-form">
        <button className="btn btn-sec" type="button" onClick={alCerrar}>
          Cancelar
        </button>
        <button className="btn btn-pri" type="submit" aria-disabled={editar.isPending || undefined}>
          {editar.isPending ? 'Guardando…' : 'Guardar cambios'}
        </button>
      </div>
    </Dialogo>
  )
}

/** Desactivar: deja de aparecer al registrar recepciones; sus lotes siguen ahí (F1.4, F6.1). */
export function DialogoDesactivarUbicacion({
  ubicacion,
  alCerrar,
  alListo,
  focoAlCerrar,
}: Base & { alListo: (u: Ubicacion) => void }) {
  const cambiar = useCambiarEstadoUbicacion()
  return (
    <DialogoAlerta
      abierto
      alCambiar={alCambiar(alCerrar)}
      titulo={`¿Desactivar ${ubicacion.nombre}?`}
      descripcion="Deja de aparecer como opción al registrar la recepción de un lote o un equipo nuevo."
      cancelar="Conservarla activa"
      confirmar={cambiar.isPending ? 'Desactivando…' : 'Desactivar ubicación'}
      peligro
      ocupado={cambiar.isPending}
      alConfirmar={() => cambiar.mutate({ id: ubicacion.id, activa: false }, { onSuccess: alListo })}
      focoAlCerrar={focoAlCerrar}
    >
      {ubicacion.lotes > 0 && (
        <p>
          {ubicacion.lotes === 1
            ? 'Su lote sigue guardado ahí y se puede despachar con normalidad.'
            : `Sus ${ubicacion.lotes} lotes siguen guardados ahí y se pueden despachar con normalidad.`}
        </p>
      )}
      {ubicacion.equipos > 0 && (
        <p>
          {ubicacion.equipos === 1
            ? 'Su equipo sigue ahí y se puede reservar, pero no aparecerá para ubicar equipos nuevos.'
            : `Sus ${ubicacion.equipos} equipos siguen ahí y se pueden reservar, pero no aparecerá para ubicar equipos nuevos.`}
        </p>
      )}
      <p className="sec">Puedes reactivarla cuando quieras desde la lista.</p>
      {cambiar.isError && (
        <Aviso tipo="err">
          <p>{cambiar.error.message}</p>
        </Aviso>
      )}
    </DialogoAlerta>
  )
}

/** Eliminar: solo si nunca tuvo lotes (F1.4). */
export function DialogoEliminarUbicacion({
  ubicacion,
  alCerrar,
  alListo,
  focoAlCerrar,
}: Base & { alListo: () => void }) {
  const eliminar = useEliminarUbicacion()
  return (
    <DialogoAlerta
      abierto
      alCambiar={alCambiar(alCerrar)}
      titulo={`¿Eliminar ${ubicacion.nombre}?`}
      descripcion="Nunca tuvo lotes, así que se puede quitar del catálogo. El registro queda en la auditoría."
      confirmar={eliminar.isPending ? 'Eliminando…' : 'Eliminar ubicación'}
      peligro
      ocupado={eliminar.isPending}
      alConfirmar={() => eliminar.mutate(ubicacion.id, { onSuccess: alListo })}
      focoAlCerrar={focoAlCerrar}
    >
      {eliminar.isError && (
        <Aviso tipo="err">
          <p>{eliminar.error.message}</p>
        </Aviso>
      )}
    </DialogoAlerta>
  )
}

/** Reactivar una ubicación desactivada. */
export function DialogoReactivarUbicacion({
  ubicacion,
  alCerrar,
  alListo,
  focoAlCerrar,
}: Base & { alListo: (u: Ubicacion) => void }) {
  const cambiar = useCambiarEstadoUbicacion()
  return (
    <DialogoAlerta
      abierto
      alCambiar={alCambiar(alCerrar)}
      titulo={`¿Reactivar ${ubicacion.nombre}?`}
      descripcion="Vuelve a aparecer como opción al registrar la recepción de un lote."
      confirmar={cambiar.isPending ? 'Reactivando…' : 'Reactivar ubicación'}
      ocupado={cambiar.isPending}
      alConfirmar={() => cambiar.mutate({ id: ubicacion.id, activa: true }, { onSuccess: alListo })}
      focoAlCerrar={focoAlCerrar}
    >
      {cambiar.isError && (
        <Aviso tipo="err">
          <p>{cambiar.error.message}</p>
        </Aviso>
      )}
    </DialogoAlerta>
  )
}
