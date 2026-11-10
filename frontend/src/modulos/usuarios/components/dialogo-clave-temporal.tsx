import { useRef, useState, type RefObject } from 'react'
import { Aviso } from '@/components/ui/aviso'
import { Dialogo } from '@/components/ui/dialogo'
import { NOMBRE_ROL } from '@/types/roles'
import type { CuentaConClave } from '../types'

type Props = {
  resultado: CuentaConClave
  motivo: 'creada' | 'restablecida'
  alCerrar: () => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

/**
 * Contraseña temporal recién generada (F1.1). Se muestra una sola vez: el servidor solo guarda su
 * hash. La persona la usa para entrar y en ese momento crea la suya.
 */
export function DialogoClaveTemporal({ resultado, motivo, alCerrar, focoAlCerrar }: Props) {
  const [copiada, setCopiada] = useState<'si' | 'no' | null>(null)
  const refCopiar = useRef<HTMLButtonElement>(null)
  const { cuenta, claveTemporal } = resultado

  async function copiar() {
    try {
      await navigator.clipboard.writeText(claveTemporal)
      setCopiada('si')
    } catch {
      setCopiada('no')
    }
  }

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo={motivo === 'creada' ? 'Cuenta creada' : 'Contraseña restablecida'}
      descripcion={cuenta.nombre}
      focoAlCerrar={focoAlCerrar}
      focoInicial={refCopiar}
    >
      <Aviso tipo="ok" rol="none">
        <p>
          {motivo === 'creada'
            ? `La cuenta quedó activa como ${NOMBRE_ROL[cuenta.rol]}.`
            : 'La contraseña anterior ya no sirve y sus sesiones abiertas se cerraron.'}
        </p>
      </Aviso>
      <div className="clave-temporal">
        <div>
          <span className="etq" id="etq-clave">
            Contraseña temporal
          </span>
          <span className="valor" aria-describedby="etq-clave">
            {claveTemporal}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span className="copiada" role="status">
            {copiada === 'si' ? 'Copiada' : copiada === 'no' ? 'No se pudo copiar: anótala' : ''}
          </span>
          <button ref={refCopiar} className="btn btn-sec btn-chico" type="button" onClick={copiar}>
            Copiar <span className="vh">la contraseña temporal</span>
          </button>
        </div>
      </div>
      <p className="sec">
        Entrégasela en persona o por un medio privado. Solo se muestra esta vez: si se pierde, restablécela
        desde su ficha. Al entrar con ella, tendrá que crear su propia contraseña.
      </p>
      <div className="acc-form">
        <button className="btn btn-pri" type="button" onClick={alCerrar}>
          Listo
        </button>
      </div>
    </Dialogo>
  )
}
