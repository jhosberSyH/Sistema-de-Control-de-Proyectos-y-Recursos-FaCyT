import type { ReactNode } from 'react'
import { Icono, type NombreIcono } from '@/components/icono'
import { cn } from '@/lib/utils'

export type TipoAviso = 'info' | 'warn' | 'err' | 'ok'

const ICONO_AVISO: Record<TipoAviso, NombreIcono> = { info: 'info', warn: 'alerta', err: 'error', ok: 'ok' }

type Props = {
  tipo?: TipoAviso
  children: ReactNode
  className?: string
  id?: string
  /**
   * Cómo lo anuncia un lector de pantalla cuando aparece sin cambiar de página (WCAG 4.1.3).
   * Por defecto: "alert" para errores, "status" para el resto.
   */
  rol?: 'alert' | 'status' | 'none'
}

/** Aviso en línea (.aviso): fondo de superficie destacada, borde izquierdo de color e ícono. */
export function Aviso({ tipo = 'info', children, className, id, rol }: Props) {
  const role = rol ?? (tipo === 'err' ? 'alert' : 'status')
  return (
    <div className={cn('aviso', tipo, className)} id={id} role={role === 'none' ? undefined : role}>
      <Icono nombre={ICONO_AVISO[tipo]} />
      <div>{children}</div>
    </div>
  )
}
