import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Periodo } from '../types'

/** GET /api/periodos/actual: el período contable en curso (o null si no hay ninguno abierto). */
export function usePeriodoActual(habilitado = true) {
  return useQuery({
    queryKey: ['periodos', 'actual'],
    queryFn: () => api.get<Periodo | null>('/periodos/actual'),
    enabled: habilitado,
    staleTime: 5 * 60_000,
  })
}
