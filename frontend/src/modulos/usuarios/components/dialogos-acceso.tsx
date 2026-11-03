import type { RefObject } from 'react'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { ConCodigos } from '@/components/ui/con-codigos'
import { DialogoAlerta } from '@/components/ui/dialogo'
import { Cargando } from '@/components/ui/estados-vista'
import { NOMBRE_ROL } from '@/types/roles'
import { useCambiarEstadoCuenta, useImpacto, useRestablecerClave } from '../api/cuentas'
import type { Cuenta, CuentaConClave } from '../types'
import { enLista, textoProyectos } from './textos'

type Base = {
  cuenta: Cuenta
  alCerrar: () => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

const cerrarAlSalir = (alCerrar: () => void) => (abierto: boolean) => {
  if (!abierto) alCerrar()
}

/**
 * "¿Desactivar la cuenta de…?" (mockup 04, capa "Desactivar"; F1.3). Muestra qué pasa con lo que la
 * persona tiene a su cargo antes de confirmar. El foco empieza en "Conservar la cuenta activa".
 */
export function DialogoDesactivar({
  cuenta,
  alCerrar,
  alListo,
  focoAlCerrar,
}: Base & { alListo: (cuenta: Cuenta, sinCoordinador: string[]) => void }) {
  const impacto = useImpacto(cuenta.id)
  const desactivar = useCambiarEstadoCuenta()
  const nombre = cuenta.nombre
  const datos = impacto.data
  const proyectos = cuenta.rol === 'coordinador' ? (datos?.proyectos ?? []) : []
  const solicitudes = datos?.solicitudesPendientes ?? []

  return (
    <DialogoAlerta
      abierto
      alCambiar={cerrarAlSalir(alCerrar)}
      titulo={`¿Desactivar la cuenta de ${cuenta.nombre}?`}
      descripcion={`${nombre} pierde el acceso de inmediato. Esto es lo que pasa con lo que tiene a su cargo:`}
      cancelar="Conservar la cuenta activa"
      confirmar={desactivar.isPending ? 'Desactivando…' : 'Desactivar cuenta'}
      peligro
      ocupado={!datos || desactivar.isPending}
      alConfirmar={() =>
        desactivar.mutate(
          { id: cuenta.id, activo: false },
          {
            onSuccess: (c) =>
              alListo(
                c,
                proyectos.map((p) => p.codigo),
              ),
          },
        )
      }
      focoAlCerrar={focoAlCerrar}
    >
      {impacto.isPending ? (
        <Cargando etiqueta="Revisando lo que tiene a su cargo…" />
      ) : impacto.isError ? (
        <Aviso tipo="err">
          <p>No pudimos revisar lo que tiene a su cargo. Cierra este aviso e inténtalo de nuevo.</p>
        </Aviso>
      ) : (
        <ul className="impacto">
          {proyectos.length > 0 && (
            <li>
              <Icono nombre="proyectos" />
              <span>
                <ConCodigos texto={textoProyectos(proyectos)} />{' '}
                {proyectos.length === 1
                  ? 'Quedará en tu bandeja para asignarle otro coordinador.'
                  : 'Quedarán en tu bandeja para asignarles otro coordinador.'}
              </span>
            </li>
          )}
          {solicitudes.length > 0 && (
            <li>
              <Icono nombre="solicitudes" />
              <span>
                <ConCodigos
                  texto={
                    solicitudes.length === 1
                      ? `Tiene 1 solicitud en Pendiente de Aprobación (${solicitudes[0]}). Sigue su curso.`
                      : `Tiene ${solicitudes.length} solicitudes en Pendiente de Aprobación (${enLista(solicitudes)}). Siguen su curso.`
                  }
                />
              </span>
            </li>
          )}
          {datos?.unicoDeSuRol && cuenta.rol === 'aprobador' && (
            <li>
              <Icono nombre="alerta" />
              <span>
                Es la única cuenta activa de {NOMBRE_ROL.aprobador}: mientras no haya otra, nadie podrá
                aprobar pedidos ni despachar.
              </span>
            </li>
          )}
          <li>
            <Icono nombre="auditoria" />
            <span>Su historial de solicitudes, despachos y auditoría se conserva con su nombre.</span>
          </li>
        </ul>
      )}
      <p className="sec">
        Puedes reactivar la cuenta desde la lista, con el filtro de estado en Desactivadas.
      </p>
      {desactivar.isError && (
        <Aviso tipo="err">
          <p>{desactivar.error.message}</p>
        </Aviso>
      )}
    </DialogoAlerta>
  )
}

/** Reactivar una cuenta desactivada (F1.3). Vuelve con su rol y su contraseña de antes. */
export function DialogoReactivar({
  cuenta,
  alCerrar,
  alListo,
  focoAlCerrar,
}: Base & { alListo: (cuenta: Cuenta) => void }) {
  const reactivar = useCambiarEstadoCuenta()
  const nombre = cuenta.nombre
  return (
    <DialogoAlerta
      abierto
      alCambiar={cerrarAlSalir(alCerrar)}
      titulo={`¿Reactivar la cuenta de ${cuenta.nombre}?`}
      descripcion={`${nombre} vuelve a entrar con su rol de ${NOMBRE_ROL[cuenta.rol]} y su contraseña de antes.`}
      confirmar={reactivar.isPending ? 'Reactivando…' : 'Reactivar cuenta'}
      ocupado={reactivar.isPending}
      alConfirmar={() => reactivar.mutate({ id: cuenta.id, activo: true }, { onSuccess: alListo })}
      focoAlCerrar={focoAlCerrar}
    >
      <ul className="impacto">
        {cuenta.rol === 'coordinador' && (
          <li>
            <Icono nombre="proyectos" />
            <span>
              No recupera los proyectos que coordinaba. Si debe volver a coordinar alguno, asígnaselo desde
              Proyectos.
            </span>
          </li>
        )}
        <li>
          <Icono nombre="candado" />
          <span>Si no recuerda su contraseña, restablécela después desde su ficha.</span>
        </li>
      </ul>
      {reactivar.isError && (
        <Aviso tipo="err">
          <p>{reactivar.error.message}</p>
        </Aviso>
      )}
    </DialogoAlerta>
  )
}

/** Restablecer la contraseña: se genera una temporal y la actual deja de servir. */
export function DialogoRestablecer({
  cuenta,
  alCerrar,
  alListo,
  focoAlCerrar,
}: Base & { alListo: (resultado: CuentaConClave) => void }) {
  const restablecer = useRestablecerClave()
  const nombre = cuenta.nombre
  return (
    <DialogoAlerta
      abierto
      alCambiar={cerrarAlSalir(alCerrar)}
      titulo={`¿Restablecer la contraseña de ${cuenta.nombre}?`}
      descripcion={`Se genera una contraseña temporal y la actual deja de servir. Se cierran las sesiones abiertas de ${nombre} y, al entrar, tendrá que crear una nueva.`}
      confirmar={restablecer.isPending ? 'Generando…' : 'Generar contraseña temporal'}
      ocupado={restablecer.isPending}
      alConfirmar={() => restablecer.mutate(cuenta.id, { onSuccess: alListo })}
      focoAlCerrar={focoAlCerrar}
    >
      {restablecer.isError && (
        <Aviso tipo="err">
          <p>{restablecer.error.message}</p>
        </Aviso>
      )}
    </DialogoAlerta>
  )
}
