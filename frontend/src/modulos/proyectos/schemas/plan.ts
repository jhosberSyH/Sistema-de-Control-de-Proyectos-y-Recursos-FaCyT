import { z } from 'zod'
import { fechaCorta } from '@/lib/formato'

/**
 * Plan de hitos (F2.4): nombre, fecha prevista y peso entero de 1 a 100 en cada hito. La suma de 100
 * no va aquí: se muestra en vivo y solo la exige "Confirmar plan" (un borrador puede sumar menos).
 */
export const esquemaHito = z.object({
  /** Id del hito guardado; null en los que se agregan ahora. */
  hitoId: z.string().nullable(),
  /** Tiene cargas de avance: no se puede quitar (F2.5). */
  conCargas: z.boolean(),
  nombre: z.string().trim().min(1, 'Escribe el nombre del hito.').max(120, 'Usa como máximo 120 caracteres.'),
  fechaPrevista: z.string().min(1, 'Elige la fecha.'),
  peso: z
    .string()
    .trim()
    .min(1, 'Escribe el peso.')
    .regex(/^\d+$/, 'Usa un entero, sin decimales.')
    .transform(Number)
    .pipe(z.number().min(1, 'Va de 1 a 100.').max(100, 'Va de 1 a 100.')),
})

export const esquemaPlan = z.object({
  hitos: z.array(esquemaHito).min(1, 'Agrega al menos un hito.'),
})

export type EntradaPlan = z.input<typeof esquemaPlan>
export type DatosPlan = z.infer<typeof esquemaPlan>

/**
 * Carga de avance (F2.5): porcentaje entero de 0 a 100 (HU-05 rechaza 120), fecha que no sea futura
 * ni anterior a la última carga del hito, y comentario opcional.
 */
export function esquemaAvance({ hoy, ultimaCarga }: { hoy: string; ultimaCarga: string | null }) {
  return z.object({
    porcentaje: z
      .string()
      .trim()
      .min(1, 'Escribe el avance alcanzado, de 0 a 100.')
      .refine((t) => /^\d+$/.test(t), {
        error: (i) =>
          /^\d+[.,]\d+$/.test(String(i.input))
            ? 'Escribe el porcentaje sin decimales, por ejemplo 85.'
            : `Escribe un porcentaje entre 0 y 100. Escribiste ${String(i.input)}.`,
      })
      .transform(Number)
      .pipe(
        z
          .number()
          .max(100, { error: (i) => `Escribe un porcentaje entre 0 y 100. Escribiste ${String(i.input)}.` }),
      ),
    fecha: z
      .string()
      .min(1, 'Elige la fecha de la carga.')
      .refine((f) => f <= hoy, 'La fecha no puede ser posterior a hoy.')
      .refine(
        (f) => !ultimaCarga || f >= ultimaCarga,
        ultimaCarga ? `La fecha no puede ser anterior a la última carga (${fechaCorta(ultimaCarga)}).` : '',
      ),
    comentario: z.string().trim().max(300, 'Usa como máximo 300 caracteres.'),
  })
}

export type EntradaAvance = z.input<ReturnType<typeof esquemaAvance>>
export type DatosAvance = z.infer<ReturnType<typeof esquemaAvance>>
