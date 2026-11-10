import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { guardarArchivo } from '@/lib/descargas'
import type { CriterioReparto, Reparto, RepartoAplicado } from '../types'

/** GET /api/reparto (F7.3, F7.4): el período cerrado por repartir, con los dos criterios calculados. */
export function useReparto() {
  return useQuery({ queryKey: ['cierre', 'reparto'], queryFn: () => api.get<Reparto>('/reparto') })
}

/**
 * POST /api/periodos/:id/reparto. Cambia el gasto ejecutado de los proyectos (F2.7), así que también
 * se refrescan los proyectos, el dashboard y el inicio. El reparto ya aplicado se muestra con lo que
 * devuelve la mutación, sin esperar a la consulta.
 */
export function useAplicarReparto() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (d: { periodoId: string; criterio: CriterioReparto }) =>
      api.post<RepartoAplicado>(`/periodos/${d.periodoId}/reparto`, { criterio: d.criterio }),
    onSuccess: () =>
      Promise.all(
        [
          ['cierre'],
          ['periodos'],
          ['inicio'],
          ['proyectos'],
          ['dashboard'],
          ['navegacion', 'contadores'],
        ].map((queryKey) => cliente.invalidateQueries({ queryKey })),
      ),
  })
}

/** El resumen del reparto en PDF (F8.3): el mismo reporte de la vista de reportes. */
export function useDescargarResumen() {
  return useMutation({
    mutationFn: async (periodoId: string) => {
      const { archivo, nombre } = await api.descargar('/reportes/reparto', {
        parametros: { periodo: periodoId, formato: 'pdf' },
      })
      guardarArchivo(archivo, nombre)
    },
  })
}
