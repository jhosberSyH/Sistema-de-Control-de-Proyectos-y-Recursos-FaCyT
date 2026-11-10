import type { ComponentProps, ReactNode } from 'react'
import { Link } from 'react-router'
import { cn } from '@/lib/utils'

export function Tarjeta({ className, ...props }: ComponentProps<'div'>) {
  return <div className={cn('tarjeta', className)} {...props} />
}

type PropsBloque = {
  titulo: string
  /** Enlace a la derecha de la cabecera, como "Ver todos". */
  enlace?: { texto: string; a: string }
  /** Otro contenido a la derecha de la cabecera, como un conteo ("6 activas"). */
  extra?: ReactNode
  children: ReactNode
  className?: string
  as?: 'section' | 'div'
}

/** Bloque con cabecera en mono mayúscula y color primario (.bloque + .bloque-cab). */
export function Bloque({
  titulo,
  enlace,
  extra,
  children,
  className,
  as: Etiqueta = 'section',
}: PropsBloque) {
  return (
    <Etiqueta
      className={cn('tarjeta bloque', className)}
      aria-label={Etiqueta === 'section' ? titulo : undefined}
    >
      <div className="bloque-cab">
        <h2>{titulo}</h2>
        {enlace && <Link to={enlace.a}>{enlace.texto}</Link>}
        {extra}
      </div>
      {children}
    </Etiqueta>
  )
}
