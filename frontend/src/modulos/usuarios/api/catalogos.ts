import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { DatosUbicacion } from '../schemas/catalogos'
import type { ClaveParametro, Parametro, Ubicacion } from '../types'

const UBICACIONES = ['ubicaciones'] as const
const PARAMETROS = ['parametros'] as const

/** GET /api/ubicaciones (F1.4). */
export function useUbicaciones() {
  return useQuery({
    queryKey: UBICACIONES,
    queryFn: () => api.get<{ items: Ubicacion[] }>('/ubicaciones').then((r) => r.items),
  })
}

/** Las ubicaciones también se eligen en el inventario (filtro) y al registrar equipos (F4.1). */
function useRefrescarUbicaciones() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: UBICACIONES }),
      cliente.invalidateQueries({ queryKey: ['equipos'] }),
      cliente.invalidateQueries({ queryKey: ['insumos'] }),
    ])
}

export function useCrearUbicacion() {
  const refrescar = useRefrescarUbicaciones()
  return useMutation({
    mutationFn: (datos: DatosUbicacion) => api.post<Ubicacion>('/ubicaciones', datos),
    onSuccess: refrescar,
  })
}

export function useEditarUbicacion() {
  const refrescar = useRefrescarUbicaciones()
  return useMutation({
    mutationFn: ({ id, datos }: { id: string; datos: DatosUbicacion }) =>
      api.patch<Ubicacion>(`/ubicaciones/${id}`, datos),
    onSuccess: refrescar,
  })
}

/** Desactiva o reactiva. Desactivada, deja de aparecer al registrar recepciones (F6.1). */
export function useCambiarEstadoUbicacion() {
  const refrescar = useRefrescarUbicaciones()
  return useMutation({
    mutationFn: ({ id, activa }: { id: string; activa: boolean }) =>
      api.patch<Ubicacion>(`/ubicaciones/${id}/estado`, { activa }),
    onSuccess: refrescar,
  })
}

/** Solo una ubicación que nunca tuvo lotes se elimina (F1.4). */
export function useEliminarUbicacion() {
  const refrescar = useRefrescarUbicaciones()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/ubicaciones/${id}`),
    onSuccess: refrescar,
  })
}

/** GET /api/parametros (F1.5). */
export function useParametros() {
  return useQuery({
    queryKey: PARAMETROS,
    queryFn: () => api.get<{ items: Parametro[] }>('/parametros').then((r) => r.items),
  })
}

/** PUT /api/parametros: aplica desde ese momento, así que se refrescan las alertas del inicio y el menú. */
export function useGuardarParametros() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (valores: Partial<Record<ClaveParametro, number>>) =>
      api.put<{ items: Parametro[] }>('/parametros', { valores }).then((r) => r.items),
    onSuccess: (items) => {
      cliente.setQueryData(PARAMETROS, items)
      return Promise.all([
        cliente.invalidateQueries({ queryKey: ['inicio'] }),
        cliente.invalidateQueries({ queryKey: ['navegacion', 'contadores'] }),
      ])
    },
  })
}
