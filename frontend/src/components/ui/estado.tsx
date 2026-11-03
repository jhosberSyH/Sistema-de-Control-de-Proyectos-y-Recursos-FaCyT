import type { ReactNode } from 'react'
import { Icono, type NombreIcono } from '@/components/icono'

export type TipoEstado = 'ok' | 'warn' | 'err' | 'info' | 'neutro'

/** Ícono de cada tipo, igual que el helper est() de docs/mockups/_fuente/compartido/comun-app.js. */
const ICONO_ESTADO: Record<TipoEstado, NombreIcono> = {
  ok: 'ok',
  warn: 'reloj',
  err: 'error',
  info: 'info',
  neutro: 'lapiz',
}

/**
 * Chip de estado (.estado): el texto va en el color normal y solo el ícono lleva el color del
 * estado, así no depende del color para entenderse (WCAG 1.4.1).
 */
export function ChipEstado({ tipo, children }: { tipo: TipoEstado; children: ReactNode }) {
  return (
    <span className={`estado ${tipo}`}>
      <Icono nombre={ICONO_ESTADO[tipo]} />
      {children}
    </span>
  )
}

export type Prioridad = 'Crítica' | 'Alta' | 'Media' | 'Baja'

const CLASE_PRIORIDAD: Record<Prioridad, string> = {
  Crítica: 'critica',
  Alta: 'alta',
  Media: 'media',
  Baja: 'baja',
}

/** Prioridad del proyecto (.prio): cuadrado de color más el nombre (RF-14). */
export function ChipPrioridad({ prioridad }: { prioridad: Prioridad }) {
  return (
    <span className={`prio ${CLASE_PRIORIDAD[prioridad]}`}>
      <i aria-hidden="true" />
      {prioridad}
    </span>
  )
}
