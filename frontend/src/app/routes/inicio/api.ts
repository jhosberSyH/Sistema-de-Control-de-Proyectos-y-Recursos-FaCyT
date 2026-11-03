import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Inicio } from './tipos'

const CLAVE = ['inicio'] as const

/** GET /api/inicio: el resumen del rol de quien entra. */
export function useInicio() {
  return useQuery({ queryKey: CLAVE, queryFn: () => api.get<Inicio>('/inicio') })
}

/** POST /api/periodos/:id/recordatorios: avisa a los coordinadores que no confirmaron sus cargos (F7.1, L7). */
export function useEnviarRecordatorio() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (periodoId: string) =>
      api.post<{ enviados: number; sinCoordinador: number }>(`/periodos/${periodoId}/recordatorios`),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['avisos'] }),
  })
}
