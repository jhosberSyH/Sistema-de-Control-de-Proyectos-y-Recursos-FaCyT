import { numero } from '@/lib/formato'

const SINGULAR: Record<string, string> = {
  cajas: 'caja',
  rollos: 'rollo',
  bolsas: 'bolsa',
  unidades: 'unidad',
}

/** "2 L", "1 caja", "4 cajas", "0,25 L": la unidad del catálogo en singular cuando es una. */
export function cantidad(n: number, unidad: string) {
  return `${numero(n, 3)} ${n === 1 ? (SINGULAR[unidad] ?? unidad) : unidad}`
}

/** "Hexano grado reactivo" → "hexano grado reactivo", para usarlo dentro de una frase. */
export const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
