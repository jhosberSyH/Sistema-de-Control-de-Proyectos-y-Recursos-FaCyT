import { useSesion } from '@/modulos/autenticacion'
import { VistaPriorizacion } from '@/modulos/solicitudes'

/**
 * Ruta /priorizacion (vista 16, paso 16). Todos consultan el orden (F5.6); solo el Aprobador lo cambia
 * (F5.7). El Coordinador ve solo sus proyectos (RN-07).
 */
export function Priorizacion() {
  const sesion = useSesion()
  return <VistaPriorizacion puedeCambiar={sesion.data?.usuario.rol === 'aprobador'} />
}
