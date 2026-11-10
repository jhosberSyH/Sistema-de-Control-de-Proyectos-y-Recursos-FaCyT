import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ReservaCreada, SemanaEquipo } from '../types'

const CLAVE = ['reservas'] as const

export type ConsultaSemana = { equipo: string; semana: string; reserva: string }

/** GET /api/reservas: sin equipo ni semana, el servidor elige los del usuario (su próxima reserva). */
export function useSemanaEquipo(c: ConsultaSemana) {
  return useQuery({
    queryKey: [...CLAVE, 'semana', c],
    queryFn: ({ signal }) =>
      api.get<SemanaEquipo>('/reservas', {
        parametros: {
          equipo: c.equipo || undefined,
          semana: c.semana || undefined,
          reserva: c.reserva || undefined,
        },
        senal: signal,
      }),
    placeholderData: keepPreviousData,
    retry: false,
  })
}

/** POST /api/reservas (F4.3): queda pendiente en la bandeja del aprobador. 409 si choca (F4.4). */
export function useSolicitarReserva() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: { equipoId: string; proyectoId: string; inicio: string; fin: string }) =>
      api.post<ReservaCreada>('/reservas', datos),
    onSuccess: () =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: CLAVE }),
        cliente.invalidateQueries({ queryKey: ['equipos'] }),
        cliente.invalidateQueries({ queryKey: ['inicio'] }),
        cliente.invalidateQueries({ queryKey: ['proyectos'] }),
      ]),
  })
}
