import { z } from 'zod'
import { leerMonto } from '@/lib/formato'

/** Lo que da un campo de fecha: AAAA-MM-DD. El navegador deja escribir años de cinco cifras. */
const FECHA = /^\d{4}-\d{2}-\d{2}$/

const positivo = (mensaje: string) =>
  z
    .string()
    .trim()
    .refine((t) => (leerMonto(t) ?? 0) > 0, mensaje)

/**
 * Recepción de lote (F6.1): los datos del lote son obligatorios, salvo el vencimiento en los insumos que
 * no vencen y la solicitud asociada. Que el vencimiento no haya pasado lo revisa la vista en vivo (mockup
 * 17) y también el servidor.
 */
export const esquemaLote = z.object({
  solicitud: z.string(),
  insumoId: z.string().min(1, 'Elige el insumo.'),
  loteProveedor: z.string().trim().min(1, 'Escribe el número de lote que trae el proveedor.').max(40),
  cantidad: positivo('Escribe la cantidad recibida, mayor que cero.'),
  costoUnitario: positivo('Escribe el costo unitario, mayor que cero, por ejemplo 13,25.'),
  proveedor: z.string().trim().min(1, 'Escribe el proveedor.').max(120),
  ingreso: z.string().regex(FECHA, 'Elige la fecha de ingreso.'),
  vence: z.string().refine((t) => !t || FECHA.test(t), 'Escribe una fecha de vencimiento válida.'),
  ubicacionId: z.string().min(1, 'Elige dónde se guarda el lote.'),
})

export type EntradaLote = z.input<typeof esquemaLote>
export type FormLote = z.output<typeof esquemaLote>
