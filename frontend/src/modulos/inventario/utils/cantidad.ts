import { mayuscula, nombreMes, numero } from '@/lib/formato'

/** Cantidad con su unidad: "2,5 L", "480 g", "3 cajas". */
export const cantidad = (valor: number, unidad: string) => `${numero(valor, 2)} ${unidad}`

/** Nombre de la unidad para el subtítulo de la ficha: "Materia prima · litros · …" (mockup 10). */
export const UNIDAD_LARGA: Record<string, string> = {
  L: 'litros',
  mL: 'mililitros',
  g: 'gramos',
  kg: 'kilogramos',
  unidades: 'unidades',
  cajas: 'cajas',
  bolsas: 'bolsas',
  rollos: 'rollos',
}

/** "2026-11" → "noviembre" */
export const mesLargo = (mes: string) => nombreMes(`${mes}-15`)

/** "2026-04" → "Abr" (eje del gráfico) */
export const mesCorto = (mes: string) => mayuscula(mesLargo(mes).slice(0, 3))

/** "2026-04" → "Abril de 2026" (tabla y tooltip) */
export const mesConAnio = (mes: string) => `${mayuscula(mesLargo(mes))} de ${mes.slice(0, 4)}`
