import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api-client'
import type {
  Almacen,
  Bitacora,
  DatosLote,
  DespachoRegistrado,
  FiltrosBitacora,
  LoteRegistrado,
  NuevoDespacho,
  OpcionesRecepcion,
  PedidoCorreccion,
  UsoMateria,
} from '../types'

const CLAVE = ['almacen'] as const

/** GET /api/almacen */
export function useAlmacen() {
  return useQuery({ queryKey: CLAVE, queryFn: () => api.get<Almacen>('/almacen') })
}

/** GET /api/recepciones/opciones */
export function useOpcionesRecepcion() {
  return useQuery({
    queryKey: [...CLAVE, 'opciones-recepcion'],
    queryFn: () => api.get<OpcionesRecepcion>('/recepciones/opciones'),
  })
}

/** POST /api/lotes (F6.1): el stock sube en la misma operación; cambia el inventario, la bandeja y el inicio. */
export function useRegistrarLote() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: DatosLote) => api.post<LoteRegistrado>('/lotes', datos),
    onSuccess: () =>
      Promise.all(
        [CLAVE, ['insumos'], ['bandeja'], ['inicio'], ['navegacion', 'contadores']].map((queryKey) =>
          cliente.invalidateQueries({ queryKey }),
        ),
      ),
  })
}

/** GET /api/despachos/nuevo: sin solicitud, el retiro aprobado más antiguo. */
export function useNuevoDespacho(solicitud: string | null) {
  return useQuery({
    queryKey: [...CLAVE, 'despacho', solicitud],
    queryFn: () =>
      api.get<NuevoDespacho>('/despachos/nuevo', { parametros: { solicitud: solicitud ?? undefined } }),
    retry: false,
  })
}

/** POST /api/despachos (F6.2, F6.3): bitácora, stock, solicitud y gasto del proyecto en una operación. */
export function useRegistrarDespacho() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: {
      solicitud: string
      lotes: Record<string, string>
      retiro: string
      observacion: string
    }) => api.post<DespachoRegistrado>('/despachos', datos),
    onSuccess: () =>
      Promise.all(
        [
          CLAVE,
          ['insumos'],
          ['bandeja'],
          ['inicio'],
          ['navegacion', 'contadores'],
          ['proyectos'],
          ['bitacora'],
        ].map((queryKey) => cliente.invalidateQueries({ queryKey })),
      ),
  })
}

/** GET /api/bitacora (F6.3): las salidas de los proyectos del coordinador; el aprobador las ve todas. */
export function useBitacora(f: FiltrosBitacora) {
  return useQuery({
    queryKey: ['bitacora', f],
    queryFn: () =>
      api.get<Bitacora>('/bitacora', {
        parametros: {
          proyectoId: f.proyecto || undefined,
          desde: f.desde || undefined,
          hasta: f.hasta || undefined,
          q: f.q || undefined,
          despacho: f.despacho || undefined,
        },
      }),
    // Cambiar un filtro no vacía la tabla mientras llega la respuesta
    placeholderData: keepPreviousData,
  })
}

/** POST /api/correcciones (F6.5): queda pendiente en la bandeja del aprobador. */
export function usePedirCorreccion() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: PedidoCorreccion) => api.post<{ id: string; estado: string }>('/correcciones', datos),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['bitacora'] }),
  })
}

/** GET /api/usos-materia: balance del insumo en el proyecto, en el mes de la fecha. */
export function useUsoMateria(f: { proyectoId: string; insumo: string; fecha: string }) {
  return useQuery({
    queryKey: ['usos-materia', f],
    queryFn: () =>
      api.get<UsoMateria>('/usos-materia', {
        parametros: {
          proyectoId: f.proyectoId || undefined,
          insumo: f.insumo || undefined,
          fecha: f.fecha || undefined,
        },
      }),
    placeholderData: keepPreviousData,
  })
}

/** POST /api/usos-materia (F6.4) */
export function useRegistrarUso() {
  const cliente = useQueryClient()
  return useMutation({
    mutationFn: (datos: {
      proyectoId: string
      insumoId: string
      cantidad: number
      fecha: string
      observaciones: string
    }) => api.post<{ id: string }>('/usos-materia', datos),
    onSuccess: () => cliente.invalidateQueries({ queryKey: ['usos-materia'] }),
  })
}
