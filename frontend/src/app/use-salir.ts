import { useCallback } from 'react'
import { useNavigate } from 'react-router'
import { useCerrarSesion } from '@/modulos/autenticacion'

/** Cierra la sesión en el servidor y vuelve al inicio de sesión (con el motivo, si se cerró por inactividad). */
export function useSalir() {
  const { mutate } = useCerrarSesion()
  const navegar = useNavigate()
  return useCallback(
    (motivo?: 'inactividad') =>
      mutate(undefined, {
        onSettled: () =>
          navegar('/iniciar-sesion', { replace: true, state: motivo ? { motivo } : undefined }),
      }),
    [mutate, navegar],
  )
}
