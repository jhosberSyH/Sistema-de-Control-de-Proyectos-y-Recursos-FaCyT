import { useSesion } from '@/modulos/autenticacion'
import { VistaBitacora } from '@/modulos/almacen'

/**
 * Ruta /proyectos/bitacora (vista 19, paso 19). El Coordinador ve sus proyectos y pide correcciones
 * (F6.5); el Aprobador la consulta completa.
 */
export function Bitacora() {
  const sesion = useSesion()
  return <VistaBitacora puedePedir={sesion.data?.usuario.rol === 'coordinador'} />
}
