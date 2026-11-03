import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef } from 'react'
import { useForm } from 'react-hook-form'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Clave, Entrada } from '@/components/ui/campo'
import { esApiError } from '@/lib/api-client'
import { useIniciarSesion } from '../api/sesion'
import { esquemaInicioSesion, type DatosInicioSesion } from '../schemas/inicio-sesion'
import type { Sesion } from '../types'

type Props = {
  /** Se llama con la sesión nueva; la ruta decide a dónde llevar al usuario. */
  alEntrar: (sesion: Sesion) => void
  /** Aviso previo, por ejemplo cuando la sesión se cerró por inactividad. */
  avisoPrevio?: string
}

const ID_ALERTA = 'alerta-inicio'

/** Formulario de la vista 01: correo, contraseña con mostrar u ocultar, ayuda y nota de la sesión. */
export function FormularioInicioSesion({ alEntrar, avisoPrevio }: Props) {
  const iniciar = useIniciarSesion()
  const refClave = useRef<HTMLInputElement | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<DatosInicioSesion>({
    resolver: zodResolver(esquemaInicioSesion),
    defaultValues: { correo: '', clave: '' },
  })

  const errorServidor = iniciar.error && esApiError(iniciar.error) ? iniciar.error : null
  // 401: el correo o la contraseña no coinciden. Se marca la contraseña, como en el mockup.
  const credencialesMal = errorServidor?.status === 401

  useEffect(() => {
    if (credencialesMal) refClave.current?.focus()
  }, [credencialesMal, iniciar.submittedAt])

  const enviar = handleSubmit((datos) => {
    if (!iniciar.isPending) iniciar.mutate(datos, { onSuccess: alEntrar })
  })
  // En orden de pantalla: al enviar con errores, React Hook Form enfoca el primero que se registró.
  const registroCorreo = register('correo')
  const { ref: refRegistroClave, ...registroClave } = register('clave')

  return (
    <form className="tarjeta lg-tarjeta" noValidate aria-labelledby="t-login" onSubmit={enviar}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 id="t-login">Inicia sesión</h2>
        <p className="sec">Usa el correo y la contraseña de tu cuenta.</p>
      </div>

      {avisoPrevio && !iniciar.error && <Aviso tipo="info">{avisoPrevio}</Aviso>}

      {iniciar.error && (
        <Aviso tipo="err" id={ID_ALERTA}>
          <p>
            {errorServidor?.message ??
              'No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.'}
          </p>
        </Aviso>
      )}

      <Campo
        etiqueta="Correo"
        id="correo"
        ayuda="El que te dio el administrador del sistema."
        error={errors.correo?.message}
      >
        {(control) => (
          <Entrada {...control} type="email" autoComplete="username" inputMode="email" {...registroCorreo} />
        )}
      </Campo>

      <Campo
        etiqueta="Contraseña"
        id="clave"
        error={errors.clave?.message}
        invalido={credencialesMal}
        describidoPor={credencialesMal ? ID_ALERTA : undefined}
      >
        {(control) => (
          <Clave
            {...control}
            autoComplete="current-password"
            {...registroClave}
            ref={(el) => {
              refRegistroClave(el)
              refClave.current = el
            }}
          />
        )}
      </Campo>

      <button className="btn btn-pri" type="submit" aria-disabled={iniciar.isPending || undefined}>
        {iniciar.isPending ? 'Entrando…' : 'Iniciar sesión'}
      </button>

      <p className="lg-ayuda">
        ¿Olvidaste tu contraseña o todavía no tienes cuenta? Pídela al administrador del sistema de la
        facultad.
      </p>
      <p className="lg-sesion">
        <Icono nombre="candado" />
        <span>
          La sesión se cierra tras 30 minutos sin actividad. Te avisamos 2 minutos antes y tu borrador queda
          guardado.
        </span>
      </p>
    </form>
  )
}
