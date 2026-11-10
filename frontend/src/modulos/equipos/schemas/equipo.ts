import { z } from 'zod'

/**
 * Alta de equipo (F4.1): nombre, código de activo y ubicación del catálogo (F1.4). El servidor además
 * impide dos equipos con el mismo código.
 */
export const esquemaEquipo = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'Escribe el nombre del equipo.')
    .max(120, 'Usa como máximo 120 caracteres.'),
  codigo: z
    .string()
    .trim()
    .toUpperCase()
    .regex(/^[A-Z0-9][A-Z0-9-]{2,23}$/, 'Escribe el código de la placa del equipo, como UC-FACYT-0457.'),
  // Empieza vacía ("Elige la ubicación"), para no dar por elegida la primera opción.
  ubicacionId: z.string().min(1, 'Elige la ubicación del equipo.'),
})

export type DatosEquipo = z.infer<typeof esquemaEquipo>
export type EntradaEquipo = z.input<typeof esquemaEquipo>

/** Motivo del mantenimiento: va en el aviso a los coordinadores afectados (F4.2). */
export const esquemaMotivo = z
  .string()
  .trim()
  .min(5, 'Escribe el motivo: se incluye en el aviso a los coordinadores.')
  .max(300, 'Usa como máximo 300 caracteres.')
