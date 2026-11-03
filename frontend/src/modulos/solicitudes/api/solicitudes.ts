import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { ContenidoBorrador, ListaSolicitudes, Solicitud, TipoSolicitud } from '../types'

const CLAVE = ['solicitudes'] as const

/** GET /api/solicitudes (RN-07: las de sus proyectos), con sus proyectos y los insumos que se pueden pedir. */
export function useSolicitudes(estado = '') {
  return useQuery({
    queryKey: [...CLAVE, 'lista', estado],
    queryFn: () => api.get<ListaSolicitudes>('/solicitudes', { parametros: { estado: estado || undefined } }),
  })
}

/** GET /api/solicitudes/:id */
export function useSolicitud(id: string | null) {
  return useQuery({
    queryKey: [...CLAVE, 'detalle', id],
    queryFn: () => api.get<Solicitud>(`/solicitudes/${id}`),
    enabled: Boolean(id),
    retry: false,
  })
}

/**
 * Guarda el borrador mientras se escribe (F5.1): lo crea la primera vez y después lo actualiza. La
 * respuesta queda en la caché del detalle, así la URL puede pasar a ?id= sin volver a pedirlo.
 */
export function useGuardarBorrador() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: ({
      id,
      tipo,
      contenido,
    }: {
      id: string | null
      tipo: TipoSolicitud
      contenido: ContenidoBorrador
    }) =>
      id
        ? api.patch<Solicitud>(`/solicitudes/${id}`, contenido)
        : api.post<Solicitud>('/solicitudes', { tipo, ...contenido }),
    onSuccess: (s) => {
      cliente.setQueryData([...CLAVE, 'detalle', s.id], s)
      return cliente.invalidateQueries({ queryKey: [...CLAVE, 'lista'] })
    },
  })
}

/** POST /api/solicitudes/:id/enviar (F5.3): pasa a Pendiente de Aprobación y llega a la bandeja. */
export function useEnviarSolicitud() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<Solicitud>(`/solicitudes/${id}/enviar`),
    onSuccess: (s) => {
      cliente.setQueryData([...CLAVE, 'detalle', s.id], s)
      return Promise.all([
        cliente.invalidateQueries({ queryKey: [...CLAVE, 'lista'] }),
        cliente.invalidateQueries({ queryKey: ['inicio'] }),
        cliente.invalidateQueries({ queryKey: ['navegacion', 'contadores'] }),
      ])
    },
  })
}

/** DELETE /api/solicitudes/:id: descarta un borrador. */
export function useDescartarBorrador() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.delete<void>(`/solicitudes/${id}`),
    onSuccess: () => cliente.invalidateQueries({ queryKey: [...CLAVE, 'lista'] }),
  })
}
