import { z } from 'zod'
import { ROLES } from '@/types/roles'

/** Datos de una cuenta (F1.1, F1.2). Los mensajes dicen cómo corregir (L4); el servidor repite la validación. */
export const esquemaCuenta = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'Escribe el nombre y el apellido de la persona.')
    .max(120, 'Usa como máximo 120 caracteres.'),
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, 'Escribe el correo con el que va a entrar.')
    .pipe(z.email('Escribe un correo válido, como nombre@uc.edu.ve.')),
  rol: z.enum(ROLES, { error: 'Elige el rol de la cuenta.' }),
})

export type DatosCuenta = z.infer<typeof esquemaCuenta>
