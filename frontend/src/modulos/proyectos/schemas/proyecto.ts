import { z } from 'zod'
import { leerMonto } from '@/lib/formato'
import { AREAS, PRIORIDADES, type Area } from '../types'

/** Prefijo del código y su área: "QUI-024" es de Química. */
export const AREA_DEL_PREFIJO: Record<string, Area> = { FIS: 'Física', QUI: 'Química', BIO: 'Biología' }

/**
 * Registro de proyecto (F2.1): código único, área, nombre, presupuesto mayor que cero y prioridad.
 * El coordinador es opcional (F2.2). El servidor repite las reglas y además comprueba que el código no exista.
 */
export const esquemaProyecto = z
  .object({
    codigo: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{3}-\d{3}$/, 'Usa el formato del código institucional: área y número, como QUI-032.'),
    // Empieza vacía ("Elige el área"): un selector sin valor mostraría la primera opción como elegida.
    area: z.string().pipe(z.enum(AREAS, { error: 'Elige el área del proyecto.' })),
    nombre: z
      .string()
      .trim()
      .min(5, 'Escribe el nombre del proyecto.')
      .max(160, 'Usa como máximo 160 caracteres.'),
    presupuesto: z
      .string()
      .trim()
      .refine((t) => (leerMonto(t) ?? 0) > 0, 'Escribe un monto mayor que cero, por ejemplo 9.500,00.'),
    coordinadorId: z.string(),
    prioridad: z.enum(PRIORIDADES, { error: 'Elige la prioridad del proyecto.' }),
  })
  .refine(
    (d) => !AREA_DEL_PREFIJO[d.codigo.slice(0, 3)] || AREA_DEL_PREFIJO[d.codigo.slice(0, 3)] === d.area,
    {
      path: ['area'],
      error: (i) => {
        const d = i.input as { codigo: string }
        return `El código ${d.codigo} es de ${AREA_DEL_PREFIJO[d.codigo.slice(0, 3)]}. Cambia el área o el código.`
      },
    },
  )

export type DatosProyecto = z.infer<typeof esquemaProyecto>
export type EntradaProyecto = z.input<typeof esquemaProyecto>
