import { z } from 'zod'

/** Validación junto al campo, con el mensaje que explica cómo corregir (L4). */
export const esquemaInicioSesion = z.object({
  correo: z
    .string()
    .trim()
    .min(1, 'Escribe tu correo.')
    .pipe(
      z.email('Revisa el correo: debe tener la forma nombre@dominio, por ejemplo coord.quimica@cpq.local.'),
    ),
  clave: z.string().min(1, 'Escribe tu contraseña.'),
})

export type DatosInicioSesion = z.infer<typeof esquemaInicioSesion>
