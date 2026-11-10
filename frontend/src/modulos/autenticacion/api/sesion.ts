import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ApiError, api, establecerTokenCsrf } from '@/lib/api-client'
import { CLAVE_SESION } from '@/lib/query-client'
import type { DatosInicioSesion } from '../schemas/inicio-sesion'
import type { Sesion } from '../types'

/** GET /api/auth/sesion. Sin sesión (401) devuelve null en lugar de fallar. */
async function obtenerSesion(): Promise<Sesion | null> {
  try {
    const sesion = await api.get<Sesion>('/auth/sesion')
    establecerTokenCsrf(sesion.csrf)
    return sesion
  } catch (e) {
    if (e instanceof ApiError && e.status === 401) {
      establecerTokenCsrf(null)
      return null
    }
    throw e
  }
}

export function useSesion() {
  return useQuery({
    queryKey: CLAVE_SESION,
    queryFn: obtenerSesion,
    staleTime: Infinity,
    refetchOnWindowFocus: false,
    // Si el servidor no responde, un solo reintento corto: la pantalla no puede quedar en blanco varios segundos.
    retry: (intentos, error) => !(error instanceof ApiError && error.status === 401) && intentos < 1,
    retryDelay: 500,
  })
}

/** Renueva la sesión en el servidor (botón "Seguir trabajando" del aviso de inactividad). */
export function useRenovarSesion() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: obtenerSesion,
    onSuccess: (sesion) => cliente.setQueryData(CLAVE_SESION, sesion),
  })
}

export function useIniciarSesion() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: DatosInicioSesion) => api.post<Sesion>('/auth/iniciar-sesion', datos),
    onSuccess: (sesion) => {
      establecerTokenCsrf(sesion.csrf)
      // Al cambiar de usuario no puede quedar nada en caché del anterior.
      cliente.clear()
      cliente.setQueryData(CLAVE_SESION, sesion)
    },
  })
}

export function useCerrarSesion() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/auth/cerrar-sesion'),
    onSettled: () => {
      establecerTokenCsrf(null)
      cliente.clear()
      cliente.setQueryData(CLAVE_SESION, null)
    },
  })
}

/** POST /api/auth/cambiar-clave: la persona crea su contraseña tras entrar con una temporal (F1.1). */
export function useCambiarClave() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (clave: string) => api.post<Sesion>('/auth/cambiar-clave', { clave }),
    onSuccess: (sesion) => {
      // Contraseña nueva, sesión nueva: el servidor entrega otro token CSRF.
      establecerTokenCsrf(sesion.csrf)
      cliente.setQueryData(CLAVE_SESION, sesion)
    },
  })
}
