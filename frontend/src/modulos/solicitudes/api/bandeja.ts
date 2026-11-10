import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { Bandeja, Decision } from '../types/bandeja'

const CLAVE = ['bandeja'] as const

/** GET /api/bandeja: lo que espera una decisión del aprobador y los gastos por ejecutar. */
export function useBandeja() {
  return useQuery({ queryKey: CLAVE, queryFn: () => api.get<Bandeja>('/bandeja') })
}

/** Una decisión cambia el inicio, el menú, el inventario, las reservas y el gasto de los proyectos. */
function useAlDecidir() {
  const cliente = useQueryClient()
  return () =>
    Promise.all(
      [
        CLAVE,
        ['inicio'],
        ['navegacion', 'contadores'],
        ['insumos'],
        ['reservas'],
        ['proyectos'],
        ['avisos'],
        ['bitacora'],
        ['almacen'],
      ].map((queryKey) => cliente.invalidateQueries({ queryKey })),
    )
}

/** La ruta de cada decisión según el tipo de pedido (F3.5, F4.5, F5.4, F6.6). */
function rutaDecision({ pedido, aprobar }: Decision) {
  if (pedido.clase === 'reserva') return `/reservas/${pedido.id}/${aprobar ? 'aprobar' : 'rechazar'}`
  if (pedido.clase === 'correccion') return `/correcciones/${pedido.id}/${aprobar ? 'aprobar' : 'denegar'}`
  return `/solicitudes/${pedido.id}/${aprobar ? 'aprobar' : 'rechazar'}`
}

export function useDecidir() {
  const alDecidir = useAlDecidir()
  return useMutation({
    mutationFn: (d: Decision) =>
      api.post<{ id: string; estado: string }>(
        rutaDecision(d),
        d.aprobar
          ? d.pedido.clase === 'reposicion'
            ? { cantidad: d.cantidad }
            : {}
          : d.pedido.clase === 'correccion'
            ? { nota: d.motivo }
            : { motivo: d.motivo },
      ),
    onSuccess: alDecidir,
  })
}

/** POST /api/solicitudes/:id/ejecutar (F5.5): el monto real se carga al proyecto. */
export function useEjecutarGasto() {
  const alDecidir = useAlDecidir()
  return useMutation({
    mutationFn: ({ id, montoReal }: { id: string; montoReal: number }) =>
      api.post<{ id: string; estado: string; montoReal: number }>(`/solicitudes/${id}/ejecutar`, {
        montoReal,
      }),
    onSuccess: alDecidir,
  })
}
