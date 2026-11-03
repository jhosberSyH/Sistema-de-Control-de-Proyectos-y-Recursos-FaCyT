import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Cargando } from '@/components/ui/estados-vista'
import { PantallaInicioSesion, useSesion } from '@/modulos/autenticacion'

type Estado = { desde?: string; motivo?: 'inactividad' } | null

/** Ruta /iniciar-sesion (vista 01). Con sesión abierta lleva directo al inicio. */
export function RutaIniciarSesion() {
  const sesion = useSesion()
  const navegar = useNavigate()
  const estado = useLocation().state as Estado
  const destino = estado?.desde && estado.desde !== '/iniciar-sesion' ? estado.desde : '/inicio'

  useEffect(() => {
    document.title = 'Inicio de sesión · Control de Proyectos FaCyT'
  }, [])

  if (sesion.isPending) return <Cargando etiqueta="Revisando tu sesión…" />
  if (sesion.data) return <Navigate to={destino} replace />

  return (
    <PantallaInicioSesion
      alEntrar={() => navegar(destino, { replace: true })}
      avisoPrevio={
        estado?.motivo === 'inactividad'
          ? 'Tu sesión se cerró tras 30 minutos sin actividad. Vuelve a iniciar sesión para continuar.'
          : sesion.isError
            ? 'No pudimos comprobar si ya tenías la sesión abierta porque el servidor no responde. Intenta entrar; si el problema sigue, avísale al administrador del sistema.'
            : undefined
      }
    />
  )
}
