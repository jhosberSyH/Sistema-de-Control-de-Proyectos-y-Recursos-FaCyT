import { useSesion } from '@/modulos/autenticacion'
import { VistaProyectos } from '@/modulos/proyectos'

/** Ruta /proyectos (vista 06, paso 6). El Administrador ve todos; el Coordinador, "Mis proyectos" (RN-07). */
export function Proyectos() {
  const sesion = useSesion()
  return <VistaProyectos esAdministrador={sesion.data?.usuario.rol === 'administrador'} />
}
