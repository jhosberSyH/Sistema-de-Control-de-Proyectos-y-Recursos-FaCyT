import { z } from 'zod'
import type { ClaveParametro } from '../types'

/** Ubicación de almacenamiento (F1.4). El servidor además impide dos activas con el mismo nombre. */
export const esquemaUbicacion = z.object({
  nombre: z
    .string()
    .trim()
    .min(3, 'Escribe el nombre de la ubicación, por ejemplo "Depósito de reactivos C".')
    .max(80, 'Usa como máximo 80 caracteres.'),
  descripcion: z.string().trim().max(160, 'Usa como máximo 160 caracteres.'),
})

export type DatosUbicacion = z.infer<typeof esquemaUbicacion>

/** Texto, unidad y rango de cada parámetro (F1.5). El servidor valida el mismo rango. */
export const PARAMETROS: Record<
  ClaveParametro,
  { etiqueta: string; unidad: string; ayuda: string; maximo: number; aplicado: (v: number) => string }
> = {
  anticipacion_vencimiento_dias: {
    etiqueta: 'Anticipación de la alerta de vencimiento',
    unidad: 'días',
    ayuda: 'Un lote aparece como "Próximo a vencer" cuando le quedan estos días o menos.',
    maximo: 365,
    aplicado: (v) => `Las alertas de vencimiento ya avisan con ${v} días de anticipación.`,
  },
  meses_minimos_pronostico: {
    etiqueta: 'Historial mínimo para mostrar el pronóstico',
    unidad: 'meses',
    ayuda:
      'Con menos meses de despachos, la ficha del insumo dice "Sin historial suficiente para pronosticar".',
    maximo: 60,
    aplicado: (v) => `El pronóstico ya pide al menos ${v} meses de historial.`,
  },
}

/** Entero positivo dentro del rango del parámetro (F1.5, HU-02: un valor negativo se rechaza). */
const entero = (maximo: number, unidad: string) =>
  z
    .string()
    .trim()
    .regex(/^\d+$/, 'Escribe un número entero mayor que cero, por ejemplo 30.')
    .refine((v) => Number(v) >= 1, 'Escribe un número entero mayor que cero, por ejemplo 30.')
    .refine((v) => Number(v) <= maximo, `Usa como máximo ${maximo} ${unidad}.`)

export const esquemaParametros = z.object({
  anticipacion_vencimiento_dias: entero(365, 'días'),
  meses_minimos_pronostico: entero(60, 'meses'),
})

export type DatosParametros = z.infer<typeof esquemaParametros>
