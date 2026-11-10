import { QueryCache, QueryClient } from '@tanstack/react-query'
import { ApiError } from './api-client'

export const CLAVE_SESION = ['sesion'] as const

/**
 * Configuración de TanStack Query.
 * - Vuelve a pedir los datos al regresar a la pestaña, así el stock se ve al día (RNF-10, D13).
 * - Reintenta solo los fallos de red o del servidor; un 4xx no cambia por reintentar.
 * - Un 401 en cualquier consulta vacía la sesión y la app vuelve al inicio de sesión.
 */
export const queryClient: QueryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, consulta) => {
      if (error instanceof ApiError && error.status === 401 && consulta.queryKey[0] !== CLAVE_SESION[0]) {
        queryClient.setQueryData(CLAVE_SESION, null)
      }
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: true,
      retry: (intentos, error) => {
        const reintentable = !(error instanceof ApiError) || error.status === 0 || error.status >= 500
        return reintentable && intentos < 2
      },
    },
    mutations: { retry: false },
  },
})
