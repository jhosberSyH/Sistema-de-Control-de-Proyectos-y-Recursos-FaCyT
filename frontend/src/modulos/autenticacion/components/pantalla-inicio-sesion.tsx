import type { Sesion } from '../types'
import { FormularioInicioSesion } from './formulario-inicio-sesion'
import { MarcoAcceso } from './marco-acceso'

type Props = {
  alEntrar: (sesion: Sesion) => void
  avisoPrevio?: string
}

/** Vista 01 (docs/mockups/01-inicio-sesion): banda institucional, nombre del sistema y formulario. */
export function PantallaInicioSesion({ alEntrar, avisoPrevio }: Props) {
  return (
    <MarcoAcceso primerCampo="correo">
      <FormularioInicioSesion alEntrar={alEntrar} avisoPrevio={avisoPrevio} />
    </MarcoAcceso>
  )
}
