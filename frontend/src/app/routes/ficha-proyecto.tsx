import { useParams } from 'react-router'
import { useSesion } from '@/modulos/autenticacion'
import { VistaFicha } from '@/modulos/proyectos'

/** Ruta /proyectos/:codigo (vista 07, paso 7). El coordinador solo abre los suyos (RN-07, en el servidor). */
export function FichaProyecto() {
  const { codigo = '' } = useParams()
  const sesion = useSesion()
  // key: al pasar de un proyecto a otro la ficha empieza de cero (pestaña, diálogos, avisos)
  return (
    <VistaFicha
      key={codigo}
      codigo={codigo.toUpperCase()}
      esAdministrador={sesion.data?.usuario.rol === 'administrador'}
    />
  )
}
