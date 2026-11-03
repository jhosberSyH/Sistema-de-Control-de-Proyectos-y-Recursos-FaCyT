import { useEffect } from 'react'
import { Navigate, useLocation, useNavigate } from 'react-router'
import { Cargando } from '@/components/ui/estados-vista'
import { PantallaCrearClave, useSesion } from '@/modulos/autenticacion'
import { useSalir } from '../use-salir'

type Estado = { desde?: string } | null

/** Ruta /crear-clave: solo para quien entró con una contraseña temporal (F1.1). */
export function RutaCrearClave() {
  const sesion = useSesion()
  const navegar = useNavigate()
  const salir = useSalir()
  const estado = useLocation().state as Estado
  const destino = estado?.desde ?? '/inicio'

  useEffect(() => {
    document.title = 'Crea tu contraseña · Control de Proyectos FaCyT'
  }, [])

  if (sesion.isPending) return <Cargando etiqueta="Revisando tu sesión…" />
  if (!sesion.data) return <Navigate to="/iniciar-sesion" replace />
  if (!sesion.data.debeCambiarClave) return <Navigate to={destino} replace />

  return (
    <PantallaCrearClave
      nombre={sesion.data.usuario.nombre.split(' ')[0]}
      alTerminar={() => navegar(destino, { replace: true })}
      alSalir={() => salir()}
    />
  )
}
