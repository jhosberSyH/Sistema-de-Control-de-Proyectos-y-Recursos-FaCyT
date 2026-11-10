import { useId, type ReactNode, type Ref } from 'react'
import { Icono } from '@/components/icono'

export type Opcion<T extends string> = { valor: T; etiqueta: ReactNode; deshabilitada?: boolean }

type Props<T extends string> = {
  leyenda: ReactNode
  opciones: Opcion<T>[]
  valor: T | undefined
  alCambiar: (valor: T) => void
  nombre?: string
  /** Texto de ayuda bajo las opciones (.ayuda), como en el alta de insumos (mockup 09). */
  ayuda?: ReactNode
  error?: ReactNode
  /**
   * Para React Hook Form (field.ref): apunta a la opción elegida o, si no hay, a la primera disponible,
   * así un error de validación lleva el foco al grupo.
   */
  refControl?: Ref<HTMLInputElement>
}

/**
 * Opciones tipo tarjeta (.radios): radios nativos dentro de etiquetas de 44 px; la elegida se
 * resalta con el borde primario. Se usa en prioridad, rol, criterio de reparto, etc.
 */
export function OpcionesTarjeta<T extends string>({
  leyenda,
  opciones,
  valor,
  alCambiar,
  nombre,
  ayuda,
  error,
  refControl,
}: Props<T>) {
  const generado = useId()
  const grupo = nombre ?? `op${generado}`
  const idError = error ? `${grupo}-error` : undefined
  const idAyuda = ayuda ? `${grupo}-ayuda` : undefined
  const conRef = opciones.find((o) => o.valor === valor) ?? opciones.find((o) => !o.deshabilitada)
  return (
    <fieldset
      className={error ? 'campo error' : 'campo'}
      style={{ border: 0, padding: 0, margin: 0, minWidth: 0 }}
      aria-describedby={[idError, idAyuda].filter(Boolean).join(' ') || undefined}
    >
      <legend style={{ fontWeight: 600, fontSize: 15, padding: 0, marginBottom: 6 }}>{leyenda}</legend>
      <div className="radios">
        {opciones.map((o) => (
          <label key={o.valor}>
            <input
              ref={o === conRef ? refControl : undefined}
              type="radio"
              name={grupo}
              value={o.valor}
              checked={valor === o.valor}
              disabled={o.deshabilitada}
              onChange={() => alCambiar(o.valor)}
            />
            {o.etiqueta}
          </label>
        ))}
      </div>
      {ayuda && (
        <span className="ayuda" id={idAyuda}>
          {ayuda}
        </span>
      )}
      {error && (
        <p className="msg-error" id={idError}>
          <Icono nombre="error" />
          <span>{error}</span>
        </p>
      )}
    </fieldset>
  )
}
