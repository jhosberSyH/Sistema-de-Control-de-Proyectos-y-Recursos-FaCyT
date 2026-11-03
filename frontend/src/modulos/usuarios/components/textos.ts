import type { Impacto } from '../types'

/** "A", "A y B", "A, B y C" */
export function enLista(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items[items.length - 1]}`
}

const ESTATUS_MINUSCULA = {
  'En ejecución': 'en ejecución',
  Propuesta: 'en propuesta',
  Suspendido: 'suspendido',
}

/**
 * Proyectos que quedarían sin coordinador, como en el mockup: "Coordina 2 proyectos activos,
 * FIS-008 y FIS-010". Los que no están en ejecución se nombran con su estatus.
 */
export function textoProyectos(proyectos: Impacto['proyectos']) {
  const activos = proyectos.filter((p) => p.estatus === 'En ejecución').map((p) => p.codigo)
  const otros = proyectos
    .filter((p) => p.estatus !== 'En ejecución')
    .map((p) => `${p.codigo} (${ESTATUS_MINUSCULA[p.estatus]})`)
  const partes: string[] = []
  if (activos.length) {
    partes.push(
      `${activos.length} ${activos.length === 1 ? 'proyecto activo' : 'proyectos activos'}, ${enLista(activos)}`,
    )
  }
  if (otros.length) partes.push(`${activos.length ? 'también ' : ''}${enLista(otros)}`)
  return `Coordina ${partes.join(', y ')}.`
}
