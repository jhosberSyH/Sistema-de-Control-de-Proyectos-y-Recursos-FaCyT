import type { Sesion } from '../types'
import { FormularioCrearClave } from './formulario-crear-clave'
import { MarcoAcceso } from './marco-acceso'

type Props = {
  nombre: string
  alTerminar: (sesion: Sesion) => void
  alSalir: () => void
}

/** Primera entrada con contraseña temporal: el mismo marco de la vista 01 con "Crea tu contraseña". */
export function PantallaCrearClave(props: Props) {
  return (
    <MarcoAcceso primerCampo="clave-nueva">
      <FormularioCrearClave {...props} />
    </MarcoAcceso>
  )
}
