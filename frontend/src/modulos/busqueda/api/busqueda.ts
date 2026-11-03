import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { RespuestaBusqueda } from '../types'

/** GET /api/buscar: lo que coincide con el texto y el rol puede abrir. */
export function useBusqueda(q: string) {
  return useQuery({
    queryKey: ['busqueda', q],
    queryFn: () => api.get<RespuestaBusqueda>('/buscar', { parametros: { q } }),
    placeholderData: keepPreviousData,
  })
}
