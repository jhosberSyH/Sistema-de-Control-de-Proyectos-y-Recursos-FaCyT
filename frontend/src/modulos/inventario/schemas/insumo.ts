import { z } from 'zod'
import { leerMonto } from '@/lib/formato'
import { TIPOS } from '../types'

/**
 * Alta de insumo (F3.1, F3.2): nombre, unidad, stock mínimo mayor que cero y tipo. El servidor además
 * impide dos insumos con el mismo nombre y la misma unidad.
 */
export const esquemaInsumo = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'Escribe el nombre del insumo.')
    .max(120, 'Usa como máximo 120 caracteres.'),
  // Empieza vacía ("Elige la unidad"), para no dar por elegida la primera opción.
  unidad: z.string().min(1, 'Elige la unidad de medida.'),
  stockMinimo: z
    .string()
    .trim()
    .refine((t) => (leerMonto(t) ?? 0) > 0, 'Escribe un número mayor que cero, por ejemplo 5 o 0,5.'),
  tipo: z.enum(TIPOS, { error: 'Elige el tipo de insumo.' }),
})

export type DatosInsumo = z.infer<typeof esquemaInsumo>
export type EntradaInsumo = z.input<typeof esquemaInsumo>
