import { useParams } from 'react-router'
import { useSesion } from '@/modulos/autenticacion'
import { VistaFichaInsumo } from '@/modulos/inventario'

/** Ruta /inventario/:id (vista 10, paso 10). Solo el Aprobador y el Administrador. */
export function FichaInsumo() {
  const { id = '' } = useParams()
  const sesion = useSesion()
  return (
    <VistaFichaInsumo
      key={id}
      id={id}
      rol={sesion.data?.usuario.rol === 'administrador' ? 'administrador' : 'aprobador'}
    />
  )
}
