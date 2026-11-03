import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Dashboard } from '../types'

/** GET /api/dashboard (F8.1): al cambiar un filtro se mantienen los datos anteriores mientras llegan. */
export function useDashboard(periodo: string, prioridad: string) {
  return useQuery({
    queryKey: ['dashboard', periodo, prioridad],
    queryFn: () =>
      api.get<Dashboard>('/dashboard', {
        parametros: { periodo: periodo || undefined, prioridad: prioridad || undefined },
      }),
    placeholderData: keepPreviousData,
  })
}
