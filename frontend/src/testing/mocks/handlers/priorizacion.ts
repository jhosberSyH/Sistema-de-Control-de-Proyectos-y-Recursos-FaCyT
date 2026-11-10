import { http, HttpResponse } from 'msw'
import { nombreUsuario, PROYECTO_NO_EXISTE, proyectoPorId, proyectosDe } from '../consultas'
import { db } from '../db'
import { avisar } from '../reglas'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Priorización de proyectos (vista 16; F5.6, F5.7; RN-04, RN-07).
 *   GET   /api/priorizacion?estatus=todos          proyectos con su prioridad y su último cambio
 *   PATCH /api/proyectos/:id/prioridad              { prioridad, justificacion }: solo el Aprobador
 * Todos consultan el orden (el Coordinador, solo sus proyectos); solo el Aprobador lo cambia. La
 * prioridad ordena la bandeja de aprobación (vista 15).
 */

const PRIORIDADES = ['Crítica', 'Alta', 'Media', 'Baja'] as const
type Prioridad = (typeof PRIORIDADES)[number]
const esPrioridad = (v: unknown): v is Prioridad => PRIORIDADES.includes(v as Prioridad)

/** El cambio de prioridad más reciente en la auditoría; si no hay, la fecha del registro del proyecto. */
function ultimoCambio(codigo: string, registradoEl: string) {
  const cambio = db.auditoria
    .findMany((q) => q.where({ entidad: `proyecto:${codigo}` }))
    .filter((a) => esPrioridad(a.valorAnterior) && esPrioridad(a.valorNuevo))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return cambio ? { fecha: cambio.fecha, desde: cambio.valorAnterior } : { fecha: registradoEl, desde: null }
}

export const handlersPriorizacion = [
  http.get('/api/priorizacion', async ({ request }) => {
    await demora()
    const quien = exigir(request)
    if (quien instanceof Response) return quien
    const todos = new URL(request.url).searchParams.get('estatus') === 'todos'
    const visibles = quien.rol === 'coordinador' ? proyectosDe(quien.id) : db.proyectos.findMany()
    return HttpResponse.json({
      proyectos: visibles
        .filter((p) => todos || p.estatus === 'En ejecución')
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map((p) => ({
          id: p.id,
          codigo: p.codigo,
          nombre: p.nombre,
          coordinador: p.coordinadorId ? nombreUsuario(p.coordinadorId) : null,
          estatus: p.estatus,
          prioridad: p.prioridad,
          ultimoCambio: ultimoCambio(p.codigo, p.registradoEl),
        })),
    })
  }),

  /** F5.7 y RN-04: sin justificación no se guarda; la auditoría guarda el nivel anterior y el nuevo. */
  http.patch('/api/proyectos/:id/prioridad', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const p = proyectoPorId(String(params.id))
    if (!p) return error(404, PROYECTO_NO_EXISTE)
    if (p.estatus === 'Finalizado') {
      return error(409, `${p.codigo} está finalizado: su prioridad ya no cambia nada.`)
    }
    const cuerpo = (await request.json().catch(() => ({}))) as {
      prioridad?: unknown
      justificacion?: unknown
    }
    const justificacion = typeof cuerpo.justificacion === 'string' ? cuerpo.justificacion.trim() : ''
    const errores: Record<string, string> = {}
    if (!esPrioridad(cuerpo.prioridad)) errores.prioridad = 'Elige la nueva prioridad.'
    else if (cuerpo.prioridad === p.prioridad) {
      errores.prioridad = `${p.codigo} ya es ${p.prioridad}: elige otra prioridad.`
    }
    if (!justificacion) {
      errores.justificacion =
        'Escribe por qué cambias la prioridad. Sin justificación el cambio no se guarda.'
    }
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const anterior = p.prioridad
    const nueva = cuerpo.prioridad as Prioridad
    await db.proyectos.update(p, {
      data(x) {
        x.prioridad = nueva
      },
    })
    await auditar(
      quien,
      'edicion',
      `${quien.nombre} cambió la prioridad de ${p.codigo} de ${anterior} a ${nueva}`,
      {
        entidad: `proyecto:${p.codigo}`,
        justificacion: justificacion.slice(0, 500),
        valorAnterior: anterior,
        valorNuevo: nueva,
      },
    )
    await avisar(p.coordinadorId, {
      clave: `prio-${p.codigo}`,
      tipo: 'info',
      titulo: `${p.codigo} ahora es prioridad ${nueva}`,
      detalle: `Antes era ${anterior}. «${justificacion.slice(0, 160)}»`,
      enlace: `/proyectos/${p.id}`,
    })
    return HttpResponse.json({ id: p.id, codigo: p.codigo, prioridad: nueva, anterior })
  }),
]
