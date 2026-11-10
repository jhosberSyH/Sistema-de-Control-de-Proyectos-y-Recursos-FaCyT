import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Clave } from '@/components/ui/campo'
import { esApiError } from '@/lib/api-client'
import { useCambiarClave } from '../api/sesion'
import { CLAVE_MINIMO, esquemaCrearClave, type DatosCrearClave } from '../schemas/crear-clave'
import type { Sesion } from '../types'

type Props = {
  nombre: string
  alTerminar: (sesion: Sesion) => void
  /** Por si no es la persona de la cuenta: cierra la sesión. */
  alSalir: () => void
}

/**
 * "Crea tu contraseña" (F1.1). No estaba dibujada: usa el mismo formulario de la vista 01. Aparece la
 * primera vez que alguien entra con la contraseña temporal que le dio el administrador.
 */
export function FormularioCrearClave({ nombre, alTerminar, alSalir }: Props) {
  const cambiar = useCambiarClave()
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<DatosCrearClave>({
    resolver: zodResolver(esquemaCrearClave),
    defaultValues: { clave: '', repetir: '' },
  })

  // Los errores 422 del servidor van junto a su campo, como los del navegador.
  useEffect(() => {
    if (esApiError(cambiar.error) && cambiar.error.errores.clave) {
      setError('clave', { message: cambiar.error.errores.clave }, { shouldFocus: true })
    }
  }, [cambiar.error, setError])

  const errorGeneral =
    cambiar.error && !(esApiError(cambiar.error) && cambiar.error.errores.clave)
      ? (cambiar.error.message ?? 'No se pudo guardar. Inténtalo de nuevo.')
      : null

  const enviar = handleSubmit((d) => {
    if (!cambiar.isPending) cambiar.mutate(d.clave, { onSuccess: alTerminar })
  })
  // En orden de pantalla: React Hook Form enfoca el primer campo con error en el orden de registro.
  const registroClave = register('clave')
  const registroRepetir = register('repetir')

  return (
    <form className="tarjeta lg-tarjeta" noValidate aria-labelledby="t-crear-clave" onSubmit={enviar}>
      <div style={{ display: 'grid', gap: 6 }}>
        <h2 id="t-crear-clave">Crea tu contraseña</h2>
        <p className="sec">
          Hola, {nombre}. Entraste con una contraseña temporal: elige la tuya para seguir. Solo tú la vas a
          conocer.
        </p>
      </div>

      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}

      <Campo
        etiqueta="Contraseña nueva"
        id="clave-nueva"
        ayuda={`Al menos ${CLAVE_MINIMO} caracteres. Una frase que recuerdes sirve, por ejemplo tres palabras con espacios.`}
        error={errors.clave?.message}
      >
        {(control) => <Clave {...control} autoComplete="new-password" {...registroClave} />}
      </Campo>

      <Campo etiqueta="Repite la contraseña" id="clave-repetir" error={errors.repetir?.message}>
        {(control) => <Clave {...control} autoComplete="new-password" {...registroRepetir} />}
      </Campo>

      <button className="btn btn-pri" type="submit" aria-disabled={cambiar.isPending || undefined}>
        {cambiar.isPending ? 'Guardando…' : 'Guardar y entrar'}
      </button>

      <div className="lg-sesion" style={{ alignItems: 'center', justifyContent: 'space-between' }}>
        <span>¿No eres {nombre}?</span>
        <button className="btn btn-txt" type="button" onClick={alSalir}>
          Cerrar sesión
        </button>
      </div>
    </form>
  )
}
