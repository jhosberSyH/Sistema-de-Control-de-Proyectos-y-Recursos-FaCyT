import type { ComponentProps } from 'react'
import { Link, type LinkProps } from 'react-router'
import { cn } from '@/lib/utils'
import { clasesBoton, type Estilo } from './boton-clases'

export function Boton({
  variante,
  chico,
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & Estilo) {
  return <button type={type} className={clasesBoton({ variante, chico }, className)} {...props} />
}

/** Enlace con forma de botón (por ejemplo, las acciones del inicio). */
export function BotonEnlace({ variante, chico, className, ...props }: LinkProps & Estilo) {
  return <Link className={clasesBoton({ variante, chico }, className)} {...props} />
}

/** Botón cuadrado de 44 px con solo un ícono (.icono-btn). Exige un nombre accesible. */
export function BotonIcono({
  className,
  type = 'button',
  ...props
}: ComponentProps<'button'> & { 'aria-label': string }) {
  return <button type={type} className={cn('icono-btn', className)} {...props} />
}
