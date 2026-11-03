import { useParams } from 'react-router'
import { VistaPlan } from '@/modulos/proyectos'

/** Ruta /proyectos/:codigo/plan (vista 08, paso 8). Solo el coordinador del proyecto (RN-07, en el servidor). */
export function PlanHitos() {
  const { codigo = '' } = useParams()
  return <VistaPlan key={codigo} codigo={codigo.toUpperCase()} />
}
