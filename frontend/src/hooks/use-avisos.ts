import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'

/**
 * Avisos de la bandeja interna (README §16: no hay correo) y contadores del menú.
 * Son transversales a todos los módulos, por eso viven en los hooks compartidos.
 */

export type TipoAvisoUsuario = 'ok' | 'warn' | 'err' | 'info'

export type AvisoUsuario = {
  id: string
  tipo: TipoAvisoUsuario
  titulo: string
  detalle?: string
  /** Ruta de la app que abre el elemento del aviso, ya filtrada (L8). */
  enlace: string
  /** Fecha y hora ISO */
  fecha: string
  leido: boolean
}

/** Pendientes por entrada del menú, con la clave de cada ítem (por ejemplo { bandeja: 9 }). */
export type Contadores = Record<string, number>

const CLAVE_AVISOS = ['avisos'] as const
const CLAVE_CONTADORES = ['navegacion', 'contadores'] as const

export function useAvisos(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_AVISOS,
    queryFn: () => api.get<AvisoUsuario[]>('/avisos'),
    enabled: habilitado,
    refetchInterval: 60_000,
  })
}

export function useContadores(habilitado = true) {
  return useQuery({
    queryKey: CLAVE_CONTADORES,
    queryFn: () => api.get<Contadores>('/navegacion/contadores'),
    enabled: habilitado,
    refetchInterval: 60_000,
  })
}

export function useMarcarAvisoLeido() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => api.post<void>(`/avisos/${id}/leido`),
    onMutate: async (id) => {
      await cliente.cancelQueries({ queryKey: CLAVE_AVISOS })
      cliente.setQueryData<AvisoUsuario[]>(CLAVE_AVISOS, (avisos) =>
        avisos?.map((a) => (a.id === id ? { ...a, leido: true } : a)),
      )
    },
    onSettled: () => cliente.invalidateQueries({ queryKey: CLAVE_AVISOS }),
  })
}

export function useMarcarTodosLeidos() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: () => api.post<void>('/avisos/leidos'),
    onSettled: () => cliente.invalidateQueries({ queryKey: CLAVE_AVISOS }),
  })
}
