import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, type RefObject } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { OpcionesTarjeta } from '@/components/ui/opciones'
import { esApiError } from '@/lib/api-client'
import { momentoRelativo } from '@/lib/formato'
import { NOMBRE_ROL, NOMBRE_ROL_CORTO, ROLES } from '@/types/roles'
import { useCrearCuenta, useEditarCuenta, useImpacto } from '../api/cuentas'
import { esquemaCuenta, type DatosCuenta } from '../schemas/cuenta'
import type { ConflictoCorreo, Cuenta, CuentaConClave } from '../types'
import { ProyectosEnMono } from './proyectos-en-mono'

export type ResultadoEdicion = { cuenta: Cuenta; rolAnterior: Cuenta['rol']; sinCoordinador: string[] }

type Props = {
  /** Sin cuenta: crear (F1.1). Con cuenta: su ficha, para editar (F1.2) y llegar a desactivar (F1.3). */
  cuenta: Cuenta | null
  alCerrar: () => void
  alCrear: (resultado: CuentaConClave) => void
  alEditar: (resultado: ResultadoEdicion) => void
  /** El correo ya es de otra cuenta: la lista la muestra. */
  alVerCuenta: (correo: string) => void
  alRestablecer: (cuenta: Cuenta) => void
  alDesactivar: (cuenta: Cuenta) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

const ID_CONFLICTO = 'cuenta-conflicto'

/** "Crear cuenta" y "Editar cuenta" (mockup 04, capa "Cambiar rol"). */
export function DialogoCuenta({
  cuenta,
  alCerrar,
  alCrear,
  alEditar,
  alVerCuenta,
  alRestablecer,
  alDesactivar,
  focoAlCerrar,
}: Props) {
  const crear = useCrearCuenta()
  const editar = useEditarCuenta()
  const guardar = cuenta ? editar : crear
  const impacto = useImpacto(cuenta?.id ?? null)

  const {
    register,
    control,
    handleSubmit,
    setError,
    setValue,
    formState: { errors },
  } = useForm<DatosCuenta>({
    resolver: zodResolver(esquemaCuenta),
    defaultValues: cuenta
      ? { nombre: cuenta.nombre, correo: cuenta.correo, rol: cuenta.rol }
      : { nombre: '', correo: '', rol: undefined },
  })
  // En orden de pantalla: al enviar con errores se enfoca el primero.
  const registroNombre = register('nombre')
  const registroCorreo = register('correo')

  const rol = useWatch({ control, name: 'rol' })
  const cambiaRol = Boolean(cuenta && rol && rol !== cuenta.rol)
  const afectados = cuenta?.rol === 'coordinador' ? (impacto.data?.proyectos.map((p) => p.codigo) ?? []) : []
  const nombre = cuenta?.nombre ?? ''

  // Errores del servidor: los de campo van junto al campo (422); el correo repetido muestra la otra cuenta (409).
  const error = guardar.error
  const conflicto =
    esApiError(error) && error.status === 409 && (error.conflicto as ConflictoCorreo | undefined)?.cuenta
      ? (error.conflicto as ConflictoCorreo).cuenta
      : null
  useEffect(() => {
    if (!esApiError(error)) return
    for (const [campo, mensaje] of Object.entries(error.errores)) {
      if (campo === 'nombre' || campo === 'correo' || campo === 'rol') {
        setError(campo, { message: mensaje }, { shouldFocus: true })
      }
    }
  }, [error, setError])
  const errorGeneral =
    error && !conflicto && !(esApiError(error) && Object.keys(error.errores).length > 0)
      ? error.message
      : null

  const enviar = handleSubmit((datos) => {
    if (guardar.isPending) return
    if (!cuenta) {
      crear.mutate(datos, { onSuccess: alCrear })
      return
    }
    editar.mutate(
      { id: cuenta.id, datos },
      {
        onSuccess: (editada) =>
          alEditar({ cuenta: editada, rolAnterior: cuenta.rol, sinCoordinador: cambiaRol ? afectados : [] }),
      },
    )
  })

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo={cuenta ? 'Editar cuenta' : 'Crear cuenta'}
      descripcion={
        cuenta ? cuenta.nombre : 'Al guardar verás una contraseña temporal para entregársela a la persona.'
      }
      alEnviar={enviar}
      focoAlCerrar={focoAlCerrar}
    >
      <div className="form-rejilla">
        <Campo className="ancho" etiqueta="Nombre" id="cuenta-nombre" error={errors.nombre?.message}>
          {(c) => <Entrada {...c} autoComplete="off" {...registroNombre} />}
        </Campo>
        <Campo
          className="ancho"
          etiqueta="Correo"
          id="cuenta-correo"
          ayuda={cuenta ? undefined : 'Con este correo entra al sistema. No puede ser el de otra cuenta.'}
          error={errors.correo?.message}
          invalido={Boolean(conflicto)}
          describidoPor={conflicto ? ID_CONFLICTO : undefined}
        >
          {(c) => <Entrada {...c} type="email" autoComplete="off" spellCheck={false} {...registroCorreo} />}
        </Campo>
        <div className="ancho">
          <Controller
            control={control}
            name="rol"
            render={({ field, fieldState }) => (
              <OpcionesTarjeta
                leyenda="Rol"
                nombre="cuenta-rol"
                valor={field.value}
                alCambiar={field.onChange}
                refControl={field.ref}
                error={fieldState.error?.message}
                opciones={ROLES.map((r) => ({
                  valor: r,
                  etiqueta: NOMBRE_ROL_CORTO[r],
                  // Nadie se quita a sí mismo el rol de administrador (evita quedarse sin acceso).
                  deshabilitada: Boolean(cuenta?.esPropia && r !== cuenta.rol),
                }))}
              />
            )}
          />
          {cuenta?.esPropia && (
            <p className="ayuda" style={{ marginTop: 6 }}>
              Es tu cuenta: no puedes cambiar tu propio rol. Si hace falta, pídeselo a otro administrador.
            </p>
          )}
        </div>
      </div>

      {conflicto && (
        <Aviso tipo="err" id={ID_CONFLICTO}>
          <p>
            <b>Ya existe una cuenta con ese correo:</b> {conflicto.nombre}, {NOMBRE_ROL[conflicto.rol]},{' '}
            {conflicto.activo ? 'activa' : 'desactivada'}.
          </p>
          <p>Usa otro correo o abre esa cuenta en lugar de crear una nueva.</p>
          <p style={{ marginTop: 8 }}>
            <button
              className="btn btn-sec btn-chico"
              type="button"
              onClick={() => alVerCuenta(conflicto.correo)}
            >
              Ver esa cuenta
            </button>
          </p>
        </Aviso>
      )}
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}

      {/* F1.2: si deja de ser Coordinador, qué proyectos quedan sin coordinador, antes de confirmar */}
      {cambiaRol && afectados.length > 0 && (
        <Aviso tipo="warn">
          <p>
            <b>
              Si cambias el rol, <ProyectosEnMono codigos={afectados} />{' '}
              {afectados.length === 1 ? 'se queda' : 'se quedan'} sin coordinador.
            </b>
          </p>
          <p>
            Lo verás en tu bandeja para {afectados.length === 1 ? 'asignarle' : 'asignarles'} otro. El cambio
            aplica desde la siguiente acción de {nombre} y se cierran sus sesiones abiertas.
          </p>
        </Aviso>
      )}
      {cambiaRol && afectados.length === 0 && (
        <Aviso tipo="info">
          <p>
            El cambio aplica desde la siguiente acción de {nombre} y se cierran sus sesiones abiertas.
            {impacto.data?.unicoDeSuRol && cuenta?.rol === 'aprobador'
              ? ` Es la única cuenta activa de ${NOMBRE_ROL.aprobador}: mientras no haya otra, nadie podrá aprobar pedidos ni despachar.`
              : ''}
          </p>
        </Aviso>
      )}

      {cuenta && !cambiaRol && (
        <div className="acceso-cuenta">
          <div>
            <b>Acceso a la cuenta</b>
            <span className="sec">
              {cuenta.esPropia
                ? 'Para restablecer tu contraseña o desactivar tu cuenta, pídeselo a otro administrador.'
                : cuenta.ultimoAcceso
                  ? `Último acceso: ${momentoRelativo(cuenta.ultimoAcceso)}`
                  : 'Todavía no entra al sistema.'}
            </span>
          </div>
          {!cuenta.esPropia && (
            <div className="botones">
              <button className="btn btn-sec btn-chico" type="button" onClick={() => alRestablecer(cuenta)}>
                Restablecer contraseña
              </button>
              <button
                className="btn btn-sec btn-chico peligro"
                type="button"
                onClick={() => alDesactivar(cuenta)}
              >
                Desactivar cuenta
              </button>
            </div>
          )}
        </div>
      )}

      <div className="acc-form">
        {cambiaRol && afectados.length > 0 ? (
          <button className="btn btn-sec" type="button" onClick={() => setValue('rol', cuenta!.rol)}>
            Conservar el rol actual
          </button>
        ) : (
          <button className="btn btn-sec" type="button" onClick={alCerrar}>
            Cancelar
          </button>
        )}
        <button className="btn btn-pri" type="submit" aria-disabled={guardar.isPending || undefined}>
          {guardar.isPending
            ? 'Guardando…'
            : !cuenta
              ? 'Crear cuenta'
              : cambiaRol
                ? 'Cambiar rol y guardar'
                : 'Guardar cambios'}
        </button>
      </div>
    </Dialogo>
  )
}
