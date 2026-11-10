import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { FiltrosAuditoria, PaginaAuditoria } from '../types'

/** GET /api/auditoria (F8.5, F8.6): lo más reciente primero; al cambiar de página se mantiene la anterior. */
export function useAuditoria(f: FiltrosAuditoria, pagina: number) {
  return useQuery({
    queryKey: ['auditoria', f, pagina],
    queryFn: () =>
      api.get<PaginaAuditoria>('/auditoria', {
        parametros: {
          usuario: f.usuario || undefined,
          accion: f.accion || undefined,
          objeto: f.objeto || undefined,
          desde: f.desde || undefined,
          pagina,
        },
      }),
    placeholderData: keepPreviousData,
  })
}
