import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type { CargosCierre, PeriodoRevision, TableroCierre, TipoPeriodo } from '../types'

/** Lo que cambia con el cierre: el tablero, los cargos, el período del encabezado, el inicio y el menú. */
function useAlCambiarCierre() {
  const cliente = useQueryClient()
  return () =>
    Promise.all(
      [['cierre'], ['periodos'], ['inicio'], ['navegacion', 'contadores']].map((queryKey) =>
        cliente.invalidateQueries({ queryKey }),
      ),
    )
}

/** GET /api/cierre/cargos (F7.1): los cargos del período de los proyectos del coordinador. */
export function useCargosCierre(proyecto: string) {
  return useQuery({
    queryKey: ['cierre', 'cargos', proyecto],
    queryFn: () =>
      api.get<CargosCierre>('/cierre/cargos', { parametros: { proyecto: proyecto || undefined } }),
    placeholderData: keepPreviousData,
  })
}

/** POST /api/cierre/confirmaciones (F7.1) */
export function useConfirmarCargos() {
  const alCambiar = useAlCambiarCierre()
  return useMutation({
    mutationFn: (proyecto: string) =>
      api.post<{ proyecto: string; confirmadoEl: string; cargos: number; monto: number }>(
        '/cierre/confirmaciones',
        {
          proyecto,
        },
      ),
    onSuccess: alCambiar,
  })
}

/** GET /api/cierre (F7.1, F7.2): el tablero de confirmaciones del aprobador. */
export function useTableroCierre() {
  return useQuery({ queryKey: ['cierre', 'tablero'], queryFn: () => api.get<TableroCierre>('/cierre') })
}

/** POST /api/periodos (F7.1): abre la revisión; 409 si el rango se cruza con otro período. */
export function useAbrirRevision() {
  const alCambiar = useAlCambiarCierre()
  return useMutation({
    mutationFn: (datos: { tipo: TipoPeriodo; inicio: string; fin: string }) =>
      api.post<PeriodoRevision>('/periodos', datos),
    onSuccess: alCambiar,
  })
}

/** POST /api/periodos/:id/recordatorios */
export function useRecordatorioCierre() {
  return useMutation({
    mutationFn: (periodoId: string) =>
      api.post<{ enviados: number; sinCoordinador: number }>(`/periodos/${periodoId}/recordatorios`),
  })
}

/** POST /api/periodos/:id/cerrar (F7.2) */
export function useCerrarPeriodo() {
  const alCambiar = useAlCambiarCierre()
  return useMutation({
    mutationFn: (periodoId: string) =>
      api.post<PeriodoRevision & { faltan: number }>(`/periodos/${periodoId}/cerrar`),
    onSuccess: alCambiar,
  })
}
