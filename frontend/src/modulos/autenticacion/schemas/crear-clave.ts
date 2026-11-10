import { z } from 'zod'

/** Largo mínimo de la contraseña propia: el mismo que valida el servidor (NIST SP 800-63B). */
export const CLAVE_MINIMO = 12

/**
 * Contraseña propia tras entrar con una temporal (F1.1). Sin reglas de mayúsculas ni símbolos: el
 * largo protege más y una frase se recuerda mejor (NIST SP 800-63B, §3.1.1.2).
 */
export const esquemaCrearClave = z
  .object({
    clave: z
      .string()
      .min(CLAVE_MINIMO, `Usa al menos ${CLAVE_MINIMO} caracteres.`)
      .max(128, 'Usa como máximo 128 caracteres.'),
    repetir: z.string().min(1, 'Escríbela otra vez para confirmar que no hay errores.'),
  })
  .refine((d) => d.clave === d.repetir, {
    path: ['repetir'],
    message: 'Las dos contraseñas no coinciden. Escríbela otra vez.',
  })

export type DatosCrearClave = z.infer<typeof esquemaCrearClave>
