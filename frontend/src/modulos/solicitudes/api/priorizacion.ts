import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import type { Prioridad } from '@/components/ui/estado'
import { api } from '@/lib/api-client'
import type { ProyectoPriorizado } from '../types/priorizacion'

const CLAVE = ['priorizacion'] as const

/** GET /api/priorizacion (F5.6): en ejecución, o todos los estatus. */
export function usePriorizacion(todos: boolean) {
  return useQuery({
    queryKey: [...CLAVE, todos ? 'todos' : 'en-ejecucion'],
    queryFn: () =>
      api.get<{ proyectos: ProyectoPriorizado[] }>('/priorizacion', {
        parametros: { estatus: todos ? 'todos' : undefined },
      }),
  })
}

/** PATCH /api/proyectos/:codigo/prioridad (F5.7): cambia el orden de la bandeja y de los proyectos. */
export function useCambiarPrioridad() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({ codigo, ...datos }: { codigo: string; prioridad: Prioridad; justificacion: string }) =>
      api.patch<{ codigo: string; prioridad: Prioridad; anterior: Prioridad }>(
        `/proyectos/${codigo}/prioridad`,
        datos,
      ),
    onSuccess: () =>
      Promise.all(
        [CLAVE, ['bandeja'], ['proyectos'], ['inicio']].map((queryKey) =>
          cliente.invalidateQueries({ queryKey }),
        ),
      ),
  })
}
