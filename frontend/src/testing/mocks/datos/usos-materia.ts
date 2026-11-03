import { momento } from './fechas'

/**
 * Uso de materia prima (F6.4) que ya registró la coordinadora de QUI-024: el etanol del mockup 20
 * ("20/10 · 1,2 L, extracción de precursores" y "09/10 · 1 L, lavado de material").
 */
export type UsoMateriaSemilla = {
  id: string
  proyecto: string
  insumoId: string
  cantidad: number
  fecha: string
  observaciones: string | null
  usuarioId: string
}

export const USOS_MATERIA: UsoMateriaSemilla[] = [
  {
    id: 'um-1',
    proyecto: 'QUI-024',
    insumoId: 'ins-etanol',
    cantidad: 1,
    fecha: momento(-23, '12:00').slice(0, 10),
    observaciones: 'Lavado de material',
    usuarioId: 'u-qui',
  },
  {
    id: 'um-2',
    proyecto: 'QUI-024',
    insumoId: 'ins-etanol',
    cantidad: 1.2,
    fecha: momento(-12, '12:00').slice(0, 10),
    observaciones: 'Extracción de precursores',
    usuarioId: 'u-qui',
  },
]
