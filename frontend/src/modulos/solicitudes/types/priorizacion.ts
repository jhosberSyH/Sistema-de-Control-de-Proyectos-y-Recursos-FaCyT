import type { Prioridad } from '@/components/ui/estado'

/** Un proyecto en la priorización (GET /api/priorizacion). */
export type ProyectoPriorizado = {
  /** UUID del proyecto: con él se cambia la prioridad y se abre la ficha. */
  id: string
  codigo: string
  nombre: string
  coordinador: string | null
  estatus: 'Propuesta' | 'En ejecución' | 'Suspendido' | 'Finalizado'
  prioridad: Prioridad
  /** Último cambio de prioridad; sin cambios, la fecha de registro (desde: null). */
  ultimoCambio: { fecha: string; desde: Prioridad | null }
}
