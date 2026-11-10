import { useParams } from 'react-router'
import { useSesion } from '@/modulos/autenticacion'
import { VistaFicha } from '@/modulos/proyectos'

/**
 * Ruta /proyectos/:id (vista 07, paso 7). El id es el UUID del proyecto; la ficha muestra su código.
 * El coordinador solo abre los suyos (RN-07, en el servidor).
 */
export function FichaProyecto() {
  const { id = '' } = useParams()
  const sesion = useSesion()
  // key: al pasar de un proyecto a otro la ficha empieza de cero (pestaña, diálogos, avisos)
  return <VistaFicha key={id} id={id} esAdministrador={sesion.data?.usuario.rol === 'administrador'} />
}
