import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DatosCuenta } from '../schemas/cuenta'
import type { Cuenta, CuentaConClave, FiltrosCuentas, Impacto, PaginaCuentas } from '../types'

const CLAVE = ['usuarios'] as const

/** GET /api/usuarios. Al cambiar de filtro o de página se mantiene la lista anterior hasta que llega la nueva. */
export function useCuentas(f: FiltrosCuentas) {
  return useQuery({
    queryKey: [...CLAVE, 'lista', f],
    queryFn: ({ signal }) =>
      api.get<PaginaCuentas>('/usuarios', {
        parametros: {
          q: f.q.trim() || undefined,
          rol: f.rol || undefined,
          estado: f.estado,
          pagina: f.pagina,
        },
        senal: signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/** GET /api/usuarios/:id/impacto: se pide al abrir la ficha o la desactivación, siempre al día. */
export function useImpacto(id: string | null) {
  return useQuery({
    queryKey: [...CLAVE, 'impacto', id],
    queryFn: () => api.get<Impacto>(`/usuarios/${id}/impacto`),
    enabled: id !== null,
    staleTime: 0,
  })
}

/**
 * Lo que cambia una cuenta se ve en la lista, en el inicio del administrador (proyectos sin
 * coordinador, cuentas activas) y en los contadores del menú.
 */
function useAlTerminar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE }),
      cliente.invalidateQueries({ queryKey: ['inicio'] }),
      cliente.invalidateQueries({ queryKey: ['navegacion', 'contadores'] }),
    ])
}

/** POST /api/usuarios (F1.1). */
export function useCrearCuenta() {
  const alTerminar = useAlTerminar()
  return useMutation({
    mutationFn: (datos: DatosCuenta) => api.post<CuentaConClave>('/usuarios', datos),
    onSuccess: alTerminar,
  })
}

/** PATCH /api/usuarios/:id (F1.2). */
export function useEditarCuenta() {
  const alTerminar = useAlTerminar()
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: DatosCuenta }) =>
      api.patch<Cuenta>(`/usuarios/${id}`, datos),
    onSuccess: alTerminar,
  })
}

/** PATCH /api/usuarios/:id/estado: desactiva o reactiva (F1.3). */
export function useCambiarEstadoCuenta() {
  const alTerminar = useAlTerminar()
  return useMutation({
    mutationFn: ({ id, activo }: { id: string; activo: boolean }) =>
      api.patch<Cuenta>(`/usuarios/${id}/estado`, { activo }),
    onSuccess: alTerminar,
  })
}

/** POST /api/usuarios/:id/clave-temporal: la contraseña actual deja de servir. */
export function useRestablecerClave() {
  const alTerminar = useAlTerminar()
  return useMutation({
    mutationFn: (id: string) => api.post<CuentaConClave>(`/usuarios/${id}/clave-temporal`),
    onSuccess: alTerminar,
  })
}
