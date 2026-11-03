import { useState, type RefObject } from 'react'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { esApiError } from '@/lib/api-client'
import { leerMonto, numero } from '@/lib/formato'
import { useCambiarMinimo } from '../api/insumos'
import type { FichaInsumo } from '../types'
import { cantidad, mesLargo } from '../utils/cantidad'

type Props = {
  insumo: FichaInsumo
  alCerrar: () => void
  alListo: (r: { stockMinimo: number; reposicion: string | null }) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

/**
 * "Cambiar stock mínimo" (F3.2), solo para el Administrador (plan §7.3). Antes de guardar dice si el
 * stock actual queda bajo el nuevo mínimo: entonces la alerta aparece de inmediato (HU-07).
 */
export function DialogoMinimo({ insumo: i, alCerrar, alListo, focoAlCerrar }: Props) {
  const cambiar = useCambiarMinimo(i.id)
  const [texto, setTexto] = useState(numero(i.stockMinimo, 3))
  const [error, setError] = useState<string | null>(null)
  const valor = leerMonto(texto)
  const valido = valor !== null && valor > 0
  const errorServidor =
    esApiError(cambiar.error) && cambiar.error.status === 422 ? cambiar.error.errores.stockMinimo : null

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo="Cambiar stock mínimo"
      descripcion={i.nombre}
      alEnviar={(e) => {
        e.preventDefault()
        if (cambiar.isPending) return
        if (!valido) {
          setError('Escribe un número mayor que cero, por ejemplo 5 o 0,5.')
          return
        }
        cambiar.mutate(valor, { onSuccess: alListo })
      }}
      focoAlCerrar={focoAlCerrar}
    >
      <Campo
        etiqueta="Stock mínimo"
        id="nuevo-min"
        ayuda={`Hoy es ${cantidad(i.stockMinimo, i.unidad)}. Stock actual: ${cantidad(i.stock, i.unidad)}.${
          i.pronostico.valor !== null
            ? ` Consumo pronosticado para ${mesLargo(i.pronostico.mes)}: ${cantidad(i.pronostico.valor, i.unidad)}.`
            : ''
        }`}
        error={error ?? errorServidor ?? undefined}
      >
        {(c) => (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <Entrada
              {...c}
              className="num"
              inputMode="decimal"
              autoComplete="off"
              style={{ textAlign: 'right', maxWidth: 160 }}
              value={texto}
              onChange={(e) => {
                setTexto(e.target.value)
                setError(null)
              }}
            />
            <span className="sec" aria-hidden="true">
              {i.unidad}
            </span>
          </div>
        )}
      </Campo>
      {valido && valor !== i.stockMinimo && (
        <Aviso tipo={i.stock < valor ? 'warn' : 'info'}>
          {i.stock < valor ? (
            <p>
              El stock actual ({cantidad(i.stock, i.unidad)}) queda bajo este mínimo: la alerta aparece de
              inmediato
              {i.reposicion ? '.' : ' y se crea una reposición en Borrador para el aprobador.'}
            </p>
          ) : (
            <p>El stock actual ({cantidad(i.stock, i.unidad)}) queda sobre este mínimo: no hay alerta.</p>
          )}
        </Aviso>
      )}
      {cambiar.isError && !errorServidor && (
        <Aviso tipo="err">
          <p>{cambiar.error.message}</p>
        </Aviso>
      )}
      <div className="acc-form">
        <button className="btn btn-sec" type="button" onClick={alCerrar}>
          Cancelar
        </button>
        <button className="btn btn-pri" type="submit" aria-disabled={cambiar.isPending || undefined}>
          {cambiar.isPending ? 'Guardando…' : 'Guardar mínimo'}
        </button>
      </div>
    </Dialogo>
  )
}
