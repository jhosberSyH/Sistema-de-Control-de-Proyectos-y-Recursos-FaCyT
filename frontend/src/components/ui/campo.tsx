import { useId, useState, type ComponentProps, type ReactNode } from 'react'
import { Icono } from '@/components/icono'
import { cn } from '@/lib/utils'

/** Atributos que el campo le pasa a su control para enlazar etiqueta, ayuda y error (WCAG 1.3.1, 3.3.1). */
export type PropsControl = {
  id: string
  'aria-invalid': boolean | undefined
  'aria-describedby': string | undefined
}

type PropsCampo = {
  etiqueta: ReactNode
  /** Texto de ayuda bajo el control (.ayuda). */
  ayuda?: ReactNode
  /** Mensaje de error: marca el campo (.campo.error) y explica cómo corregirlo (L4). Puede llevar un enlace. */
  error?: ReactNode
  /** Marca el campo con error sin un mensaje propio, cuando el mensaje está en un aviso general (mockup 01). */
  invalido?: boolean
  /** Ids de otros textos que describen el control, como ese aviso general. */
  describidoPor?: string
  /** Muestra "(opcional)" junto a la etiqueta. */
  opcional?: boolean
  className?: string
  id?: string
  children: (control: PropsControl) => ReactNode
}

/** Campo de formulario del mockup: etiqueta, control, ayuda y mensaje de error con su ícono. */
export function Campo({
  etiqueta,
  ayuda,
  error,
  invalido,
  describidoPor,
  opcional,
  className,
  id,
  children,
}: PropsCampo) {
  const generado = useId()
  const idControl = id ?? `c${generado}`
  const idAyuda = ayuda ? `${idControl}-ayuda` : undefined
  const idError = error ? `${idControl}-error` : undefined
  const describe = [idError, describidoPor, idAyuda].filter(Boolean).join(' ') || undefined
  const conError = Boolean(error) || invalido

  return (
    <div className={cn('campo', conError && 'error', className)}>
      <label htmlFor={idControl}>
        {etiqueta}
        {opcional && <span className="obligatorio"> (opcional)</span>}
      </label>
      {children({ id: idControl, 'aria-invalid': conError ? true : undefined, 'aria-describedby': describe })}
      {ayuda && (
        <span className="ayuda" id={idAyuda}>
          {ayuda}
        </span>
      )}
      {error && (
        <p className="msg-error" id={idError}>
          <Icono nombre="error" />
          <span>{error}</span>
        </p>
      )}
    </div>
  )
}

export function Entrada({ className, ...props }: ComponentProps<'input'>) {
  return <input className={cn('entrada', className)} {...props} />
}

export function Selector({ className, ...props }: ComponentProps<'select'>) {
  return <select className={cn('entrada', className)} {...props} />
}

export function AreaTexto({ className, ...props }: ComponentProps<'textarea'>) {
  return <textarea className={cn('entrada', className)} {...props} />
}

/** Contraseña con el botón para mostrarla u ocultarla (mockup 01). */
export function Clave({ className, ...props }: Omit<ComponentProps<'input'>, 'type'>) {
  const [visible, setVisible] = useState(false)
  return (
    <div className="clave">
      <input className={cn('entrada', className)} type={visible ? 'text' : 'password'} {...props} />
      <button
        className="ver-clave"
        type="button"
        aria-label={visible ? 'Ocultar contraseña' : 'Mostrar contraseña'}
        aria-pressed={visible}
        onClick={() => setVisible((v) => !v)}
      >
        <Icono nombre="ojo" />
      </button>
    </div>
  )
}

/** Entrada con un prefijo fijo, como "US$" (mockups 06 y 17). */
export function EntradaPrefijo({
  prefijo,
  className,
  ...props
}: ComponentProps<'input'> & { prefijo: string }) {
  return (
    <div className="prefijo">
      <span aria-hidden="true">{prefijo}</span>
      <input className={cn('entrada', className)} {...props} />
    </div>
  )
}
