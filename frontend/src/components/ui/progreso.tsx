import { Icono } from '@/components/icono'
import { porcentaje } from '@/lib/formato'
import { cn } from '@/lib/utils'

type Props = {
  /** Valor en porcentaje. Puede pasar de 100 (ejecución presupuestaria, F2.7): la barra se llena y el número se muestra tal cual. */
  valor: number
  /** Nombre accesible, por ejemplo "Avance físico de QUI-024". */
  etiqueta: string
  /** Barra en color de advertencia (.barra-prog.alto). */
  alto?: boolean
}

/** Barra de progreso de 8 px (.barra-prog). */
export function BarraProgreso({ valor, etiqueta, alto }: Props) {
  const lleno = Math.max(0, Math.min(100, valor))
  return (
    <div
      className={cn('barra-prog', alto && 'alto')}
      role="progressbar"
      aria-label={etiqueta}
      aria-valuemin={0}
      // Si pasa de 100 (ejecución presupuestaria), el máximo sube: aria-valuenow no puede quedar fuera del rango.
      aria-valuemax={Math.max(100, Math.round(valor))}
      aria-valuenow={Math.round(valor)}
      aria-valuetext={porcentaje(valor)}
    >
      <i style={{ width: `${lleno}%` }} />
    </div>
  )
}

/**
 * Barra con el porcentaje a la derecha (.mini-barra), para columnas de tabla. Si pasa de 100 lleva el
 * ícono de alerta, para no depender solo del color (WCAG 1.4.1, plan §7.4).
 */
export function MiniBarra(props: Props) {
  const pasa = props.valor > 100
  return (
    <div className="mini-barra">
      <BarraProgreso {...props} />
      <b className={pasa ? 'pasa' : undefined}>
        {pasa && <Icono nombre="alerta" />}
        {porcentaje(props.valor)}
        {pasa && ' '}
        {pasa && <span className="vh">(pasa del 100 %)</span>}
      </b>
    </div>
  )
}
