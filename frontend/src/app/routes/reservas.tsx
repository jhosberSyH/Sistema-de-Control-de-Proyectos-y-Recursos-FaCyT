import { useSesion } from '@/modulos/autenticacion'
import { VistaReservas } from '@/modulos/equipos'

/**
 * Ruta /reservas (vista 12, paso 12). El Coordinador pide reservas; el Aprobador consulta el mismo
 * calendario y decide en la bandeja (plan §7.1).
 */
export function Reservas() {
  const sesion = useSesion()
  return <VistaReservas rol={sesion.data?.usuario.rol === 'aprobador' ? 'aprobador' : 'coordinador'} />
}
