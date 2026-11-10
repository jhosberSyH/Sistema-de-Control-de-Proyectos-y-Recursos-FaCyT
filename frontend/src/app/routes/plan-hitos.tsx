import { useParams } from 'react-router'
import { VistaPlan } from '@/modulos/proyectos'

/**
 * Ruta /proyectos/:id/plan (vista 08, paso 8). El id es el UUID del proyecto.
 * Solo el coordinador del proyecto (RN-07, en el servidor).
 */
export function PlanHitos() {
  const { id = '' } = useParams()
  return <VistaPlan key={id} id={id} />
}
