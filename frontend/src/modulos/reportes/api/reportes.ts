import { keepPreviousData, useMutation, useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { guardarArchivo } from '@/lib/descargas'
import type { FiltrosReporte, OpcionesReporte, VistaPrevia } from '../types'

/** Solo los filtros que usa cada reporte, para no pedir dos veces la misma vista previa. */
function parametros(f: FiltrosReporte) {
  if (f.tipo === 'reparto') return { periodo: f.periodo, proyectos: f.proyectos }
  if (f.tipo === 'hoja-de-vida') return { equipo: f.equipo, desde: f.desde, hasta: f.hasta }
  return { desde: f.desde, hasta: f.hasta, proyectos: f.proyectos }
}

/** GET /api/reportes/opciones */
export function useOpcionesReporte() {
  return useQuery({
    queryKey: ['reportes', 'opciones'],
    queryFn: () => api.get<OpcionesReporte>('/reportes/opciones'),
  })
}

/** GET /api/reportes/vista-previa: se pide cuando los filtros están completos. */
export function useVistaPrevia(f: FiltrosReporte, habilitada: boolean) {
  const p = parametros(f)
  return useQuery({
    queryKey: ['reportes', 'vista-previa', f.tipo, p],
    queryFn: () => api.get<VistaPrevia>('/reportes/vista-previa', { parametros: { tipo: f.tipo, ...p } }),
    enabled: habilitada,
    placeholderData: keepPreviousData,
  })
}

/** GET /api/reportes/:tipo?formato=pdf|xlsx (F8.2 a F8.4) */
export function useDescargarReporte() {
  return useMutation({
    mutationFn: async ({ filtros, formato }: { filtros: FiltrosReporte; formato: 'pdf' | 'xlsx' }) => {
      const { archivo, nombre } = await api.descargar(`/reportes/${filtros.tipo}`, {
        parametros: { formato, ...parametros(filtros) },
      })
      guardarArchivo(archivo, nombre)
      return formato
    },
  })
}
