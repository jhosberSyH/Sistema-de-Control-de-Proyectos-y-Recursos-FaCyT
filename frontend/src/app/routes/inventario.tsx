import { useSesion } from '@/modulos/autenticacion'
import { VistaInventario } from '@/modulos/inventario'

/**
 * Ruta /inventario (vista 09, paso 9). El Aprobador y el Administrador gestionan; el Coordinador solo
 * consulta para pedir retiros (plan §7.1).
 */
export function Inventario() {
  const sesion = useSesion()
  return <VistaInventario rol={sesion.data?.usuario.rol ?? 'coordinador'} />
}
