import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { guardarArchivo } from '@/lib/descargas'
import type { FichaInsumo, FiltrosInventario, PaginaInsumos, ResumenInsumo, TipoInsumo } from '../types'

const CLAVE = ['insumos'] as const

const parametros = (f: FiltrosInventario) => ({
  q: f.q.trim() || undefined,
  tipo: f.tipo || undefined,
  ubicacion: f.ubicacion || undefined,
  alerta: f.alerta || undefined,
})

/** GET /api/insumos (F3.1, F3.4, F3.6). Mantiene la lista anterior en pantalla mientras llega la nueva. */
export function useInsumos(f: FiltrosInventario) {
  return useQuery({
    queryKey: [...CLAVE, 'lista', f],
    queryFn: ({ signal }) =>
      api.get<PaginaInsumos>('/insumos', {
        parametros: { ...parametros(f), pagina: f.pagina },
        senal: signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/** GET /api/insumos/exportar: el catálogo con los filtros actuales, en CSV. */
export function useExportarInventario() {
  return useMutation({
    mutationFn: async (f: FiltrosInventario) => {
      const { archivo, nombre } = await api.descargar('/insumos/exportar', { parametros: parametros(f) })
      guardarArchivo(archivo, nombre)
    },
  })
}

export type DatosRegistroInsumo = { nombre: string; unidad: string; stockMinimo: number; tipo: TipoInsumo }

/**
 * POST /api/insumos (F3.1). Nace con stock cero: si queda bajo su mínimo, el servidor crea la
 * reposición en Borrador (F3.5), que cambia la bandeja y el inicio del aprobador.
 */
export function useRegistrarInsumo() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: DatosRegistroInsumo) =>
      api.post<{ insumo: ResumenInsumo; reposicion: string | null }>('/insumos', datos),
    onSuccess: () =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: CLAVE }),
        cliente.invalidateQueries({ queryKey: ['inicio'] }),
        cliente.invalidateQueries({ queryKey: ['navegacion', 'contadores'] }),
      ]),
  })
}

// ---------- Ficha del insumo (vista 10) ----------

/** GET /api/insumos/:id. */
export function useFichaInsumo(id: string) {
  return useQuery({
    queryKey: [...CLAVE, 'ficha', id],
    queryFn: () => api.get<FichaInsumo>(`/insumos/${id}`),
    retry: false,
  })
}

function useAlCambiarInventario() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE }),
      cliente.invalidateQueries({ queryKey: ['inicio'] }),
      cliente.invalidateQueries({ queryKey: ['navegacion', 'contadores'] }),
      // Una reposición decidida o creada aquí también cambia la bandeja del aprobador (vista 15)
      cliente.invalidateQueries({ queryKey: ['bandeja'] }),
    ])
}

/** PATCH /api/insumos/:id/minimo (F3.2, solo el Administrador). Puede crear una reposición (HU-07). */
export function useCambiarMinimo(id: string) {
  const alCambiar = useAlCambiarInventario()
  return useMutation({
    mutationFn: (stockMinimo: number) =>
      api.patch<{ stockMinimo: number; reposicion: string | null }>(`/insumos/${id}/minimo`, { stockMinimo }),
    onSuccess: alCambiar,
  })
}

/** POST /api/solicitudes/:id/aprobar: la reposición pasa a Aprobado en un paso (F3.5). */
export function useAprobarReposicion(reposicion: string) {
  const alCambiar = useAlCambiarInventario()
  return useMutation({
    mutationFn: (cantidad: number) =>
      api.post<{ id: string; estado: string; cantidad: number }>(`/solicitudes/${reposicion}/aprobar`, {
        cantidad,
      }),
    onSuccess: alCambiar,
  })
}

/** POST /api/solicitudes/:id/rechazar: se descarta; no se compra nada y la alerta sigue (HU-09). */
export function useDescartarReposicion(reposicion: string) {
  const alCambiar = useAlCambiarInventario()
  return useMutation({
    mutationFn: () => api.post<{ id: string; estado: string }>(`/solicitudes/${reposicion}/rechazar`, {}),
    onSuccess: alCambiar,
  })
}
