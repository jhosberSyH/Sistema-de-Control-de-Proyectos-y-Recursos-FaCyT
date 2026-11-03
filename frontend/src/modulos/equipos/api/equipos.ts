import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Equipo, FiltrosEquipos, ListaEquipos, ReservaAfectada } from '../types'

const CLAVE = ['equipos'] as const

/** GET /api/equipos (F4.1, F4.2). */
export function useEquipos(f: FiltrosEquipos) {
  return useQuery({
    queryKey: [...CLAVE, 'lista', f],
    queryFn: ({ signal }) =>
      api.get<ListaEquipos>('/equipos', {
        parametros: {
          q: f.q.trim() || undefined,
          estado: f.estado || undefined,
          ubicacion: f.ubicacion || undefined,
        },
        senal: signal,
      }),
    placeholderData: keepPreviousData,
  })
}

function useAlCambiar() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE }),
      // Cambian las ubicaciones que tienen equipos (paso 5) y las reservas (vista 12)
      cliente.invalidateQueries({ queryKey: ['ubicaciones'] }),
      cliente.invalidateQueries({ queryKey: ['reservas'] }),
    ])
}

/** POST /api/equipos (F4.1): nace Disponible. */
export function useRegistrarEquipo() {
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: (datos: { nombre: string; codigo: string; ubicacionId: string }) =>
      api.post<Equipo>('/equipos', datos),
    onSuccess: alCambiar,
  })
}

/** GET /api/equipos/:id/reservas-afectadas, al abrir "Pasar a mantenimiento" (HU-12). */
export function useReservasAfectadas(id: string) {
  return useQuery({
    queryKey: [...CLAVE, id, 'afectadas'],
    queryFn: () => api.get<ReservaAfectada[]>(`/equipos/${id}/reservas-afectadas`),
  })
}

/** POST /api/equipos/:id/mantenimiento (F4.2): avisa a cada coordinador afectado. */
export function usePasarAMantenimiento(id: string) {
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: (motivo: string) =>
      api.post<{ equipo: Equipo; avisados: number; reservas: number }>(`/equipos/${id}/mantenimiento`, {
        motivo,
      }),
    onSuccess: alCambiar,
  })
}

/** POST /api/equipos/:id/fin-mantenimiento (F4.2): vuelve a Disponible. */
export function useFinMantenimiento() {
  const alCambiar = useAlCambiar()
  return useMutation({
    mutationFn: (id: string) => api.post<Equipo>(`/equipos/${id}/fin-mantenimiento`),
    onSuccess: alCambiar,
  })
}
