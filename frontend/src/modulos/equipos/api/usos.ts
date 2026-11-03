import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { UsoEquipo } from '../types'

const CLAVE = ['usos'] as const

/** GET /api/usos (F4.6). Sin equipo, el servidor elige el que estás usando o el de tu reserva. */
export function useUsoEquipo(equipo: string) {
  return useQuery({
    queryKey: [...CLAVE, equipo],
    queryFn: () => api.get<UsoEquipo>('/usos', { parametros: { equipo: equipo || undefined } }),
    // Al fijar el equipo en la URL cambia la clave: la vista no vuelve a "cargando" ni pierde lo escrito
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** El estado del equipo cambia en el catálogo, las reservas y el inicio. */
function useAlCambiar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE }),
      cliente.invalidateQueries({ queryKey: ['equipos'] }),
      cliente.invalidateQueries({ queryKey: ['reservas'] }),
    ])
}

/** POST /api/usos: el equipo pasa a En uso (HU-14). */
export function useIniciarUso() {
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: (datos: { equipoId: string; proyecto: string }) =>
      api.post<{ id: string; proyecto: string; inicio: string }>('/usos', datos),
    onSuccess: alCambiar,
  })
}

/** POST /api/usos/:id/cerrar: vuelve a Disponible y el uso queda en el historial (HU-14). */
export function useCerrarUso() {
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: ({ id, observaciones }: { id: string; observaciones: string }) =>
      api.post<{ id: string; proyecto: string; horas: number; equipo: string }>(`/usos/${id}/cerrar`, {
        observaciones,
      }),
    onSuccess: alCambiar,
  })
}
