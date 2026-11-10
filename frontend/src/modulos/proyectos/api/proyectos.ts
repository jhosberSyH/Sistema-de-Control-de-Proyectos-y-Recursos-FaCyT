import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import { guardarArchivo } from '@/lib/descargas'
import type {
  CargaAvance,
  Coordinador,
  Estatus,
  FichaProyecto,
  FiltrosProyectos,
  PaginaProyectos,
  PlanProyecto,
  ResultadoCarga,
  ResumenProyecto,
} from '../types'

const CLAVE = ['proyectos'] as const

const parametros = (f: FiltrosProyectos) => ({
  q: f.q.trim() || undefined,
  area: f.area || undefined,
  prioridad: f.prioridad || undefined,
  estatus: f.estatus || undefined,
})

/** GET /api/proyectos. El servidor aplica RN-07: el coordinador solo recibe los suyos. */
export function useProyectos(f: FiltrosProyectos) {
  return useQuery({
    queryKey: [...CLAVE, 'lista', f],
    queryFn: ({ signal }) =>
      api.get<PaginaProyectos>('/proyectos', {
        parametros: { ...parametros(f), pagina: f.pagina },
        senal: signal,
      }),
    placeholderData: keepPreviousData,
  })
}

/** GET /api/proyectos/coordinadores (F2.2), solo al abrir el registro. */
export function useCoordinadores(activo: boolean) {
  return useQuery({
    queryKey: [...CLAVE, 'coordinadores'],
    queryFn: () => api.get<Coordinador[]>('/proyectos/coordinadores'),
    enabled: activo,
  })
}

export type DatosRegistro = {
  codigo: string
  nombre: string
  area: string
  presupuesto: number
  prioridad: string
  coordinadorId: string | null
}

/** POST /api/proyectos (F2.1). Un proyecto nuevo cambia la lista, el inicio y los contadores del menú. */
export function useRegistrarProyecto() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: DatosRegistro) => api.post<ResumenProyecto>('/proyectos', datos),
    onSuccess: () =>
      Promise.all([
        cliente.invalidateQueries({ queryKey: CLAVE }),
        cliente.invalidateQueries({ queryKey: ['inicio'] }),
        cliente.invalidateQueries({ queryKey: ['navegacion', 'contadores'] }),
      ]),
  })
}

/** GET /api/proyectos/exportar: la lista con los filtros actuales, en CSV. */
export function useExportarProyectos() {
  return useMutation({
    mutationFn: async (f: FiltrosProyectos) => {
      const { archivo, nombre } = await api.descargar('/proyectos/exportar', { parametros: parametros(f) })
      guardarArchivo(archivo, nombre)
    },
  })
}

// ---------- Ficha (vista 07) ----------

/** GET /api/proyectos/:id. 403 si el coordinador abre uno que no es suyo (RN-07). */
export function useFicha(id: string) {
  return useQuery({
    queryKey: [...CLAVE, 'ficha', id],
    queryFn: () => api.get<FichaProyecto>(`/proyectos/${id}`),
    retry: false,
  })
}

/** Las pestañas piden sus datos solo cuando se abren. */
export function usePestanaFicha<T>(
  id: string,
  pestana: 'gastos' | 'reservas' | 'historial',
  abierta: boolean,
) {
  return useQuery({
    queryKey: [...CLAVE, 'ficha', id, pestana],
    queryFn: () => api.get<T>(`/proyectos/${id}/${pestana}`),
    enabled: abierta,
  })
}

function useAlCambiarProyecto() {
  const cliente = useQueryClient()
  return () =>
    Promise.all([
      cliente.invalidateQueries({ queryKey: CLAVE }),
      cliente.invalidateQueries({ queryKey: ['inicio'] }),
      cliente.invalidateQueries({ queryKey: ['navegacion', 'contadores'] }),
    ])
}

/** PATCH /api/proyectos/:id/estatus (F2.3), con comentario opcional para el historial. */
export function useCambiarEstatus(id: string) {
  const alCambiar = useAlCambiarProyecto()
  return useMutation({
    mutationFn: (datos: { estatus: Estatus; comentario: string }) =>
      api.patch<ResumenProyecto>(`/proyectos/${id}/estatus`, datos),
    onSuccess: alCambiar,
  })
}

/** PATCH /api/proyectos/:id/coordinador (F2.2). */
export function useAsignarCoordinador(id: string) {
  const alCambiar = useAlCambiarProyecto()
  return useMutation({
    mutationFn: (coordinadorId: string) =>
      api.patch<ResumenProyecto>(`/proyectos/${id}/coordinador`, { coordinadorId }),
    onSuccess: alCambiar,
  })
}

// ---------- Plan de hitos y avance (vista 08) ----------

/** GET /api/proyectos/:id/plan. 403 si el proyecto no es del coordinador (RN-07). */
export function usePlan(id: string) {
  return useQuery({
    queryKey: [...CLAVE, 'plan', id],
    queryFn: () => api.get<PlanProyecto>(`/proyectos/${id}/plan`),
    retry: false,
  })
}

export type HitoGuardar = { id: string | null; nombre: string; fechaPrevista: string; peso: number }

/** PUT /api/proyectos/:id/hitos (F2.4): borrador, o confirmado si los pesos suman 100. */
export function useGuardarPlan(id: string) {
  const cliente = useQueryClient()
  const alCambiar = useAlCambiarProyecto()
  return useMutation({
    mutationFn: (datos: { hitos: HitoGuardar[]; confirmar: boolean }) =>
      api.put<PlanProyecto>(`/proyectos/${id}/hitos`, datos),
    // La respuesta ya es el plan como quedó: la vista cambia de modo sin esperar otra consulta.
    onSuccess: (plan) => {
      cliente.setQueryData([...CLAVE, 'plan', id], plan)
      return alCambiar()
    },
  })
}

/** GET /api/proyectos/:id/hitos/:hitoId/avances: las cargas anteriores, al abrir el diálogo. */
export function useCargasHito(id: string, hitoId: string) {
  return useQuery({
    queryKey: [...CLAVE, 'plan', id, 'cargas', hitoId],
    queryFn: () => api.get<CargaAvance[]>(`/proyectos/${id}/hitos/${hitoId}/avances`),
  })
}

/** POST /api/proyectos/:id/hitos/:hitoId/avances (F2.5). Cambia el avance en la ficha, la lista y el inicio. */
export function useCargarAvance(id: string, hitoId: string) {
  const alCambiar = useAlCambiarProyecto()
  return useMutation({
    mutationFn: (datos: { porcentaje: number; fecha: string; comentario: string }) =>
      api.post<ResultadoCarga>(`/proyectos/${id}/hitos/${hitoId}/avances`, datos),
    onSuccess: alCambiar,
  })
}
