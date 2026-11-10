import { cn } from '@/lib/utils'

export type VarianteBoton = 'pri' | 'sec' | 'txt' | 'peligro'

export type Estilo = { variante?: VarianteBoton; chico?: boolean }

/** Clases del botón del mockup: .btn + .btn-pri | .btn-sec | .btn-txt | .btn-peligro (+ .btn-chico). */
export function clasesBoton({ variante = 'sec', chico = false }: Estilo, extra?: string) {
  return cn('btn', `btn-${variante}`, chico && 'btn-chico', extra)
}
