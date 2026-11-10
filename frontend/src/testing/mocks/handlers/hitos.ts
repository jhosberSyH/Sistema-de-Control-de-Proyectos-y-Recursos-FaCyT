import { http, HttpResponse } from 'msw'
import { fechaCorta } from '@/lib/formato'
import { avanceDe, nombreUsuario } from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion } from '../utils'
import { accesoFicha } from './proyectos'

/*
 * Plan de hitos y avance (vista 08; F2.4, F2.5, F2.6; RN-07).
 *   GET  /api/proyectos/:id/plan                 hitos con su última carga
 *   PUT  /api/proyectos/:id/hitos                guarda el plan: borrador, o confirmado si los pesos suman 100
 *   GET  /api/proyectos/:id/hitos/:hitoId/avances cargas anteriores de un hito, de la más reciente a la más antigua
 *   POST /api/proyectos/:id/hitos/:hitoId/avances carga nueva de 0 a 100; no borra las anteriores
 * Solo escribe el coordinador del proyecto. Un proyecto finalizado ya no cambia.
 */

/** "66,5 %" para los textos del audit log, como los escribe el backend. */
const porcentaje = (n: number) => `${String(n).replace('.', ',')} %`

type Proyecto = NonNullable<ReturnType<typeof db.proyectos.findFirst>>
type Hito = NonNullable<ReturnType<typeof db.hitos.findFirst>>
type EntradaHito = { id?: unknown; nombre?: unknown; fechaPrevista?: unknown; peso?: unknown }

const FECHA = /^\d{4}-\d{2}-\d{2}$/
const MAX_NOMBRE = 120
const MAX_COMENTARIO = 300

function hitosDe(codigo: string) {
  return db.hitos.findMany((q) => q.where({ proyecto: codigo })).sort((a, b) => a.numero - b.numero)
}

/** Cargas de un hito, la más reciente primero (a igual fecha, la última registrada). */
function cargasDe(hitoId: string) {
  return db.avances
    .findMany((q) => q.where({ hitoId }))
    .map((a, orden) => ({ a, orden }))
    .sort((x, y) => y.a.fecha.localeCompare(x.a.fecha) || y.orden - x.orden)
    .map(({ a }) => a)
}

function plan(p: Proyecto) {
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    estatus: p.estatus,
    planConfirmado: p.planConfirmado,
    avance: avanceDe(p),
    hitos: hitosDe(p.codigo).map((h) => {
      const cargas = cargasDe(h.id)
      return {
        id: h.id,
        numero: h.numero,
        nombre: h.nombre,
        peso: h.peso,
        fechaPrevista: h.fechaPrevista,
        avance: h.avance,
        ultimaCarga: cargas[0]?.fecha ?? null,
        cargas: cargas.length,
      }
    }),
  }
}

/** "1. Revisión bibliográfica (15 %); 2. …", para el antes y el después del audit log. */
const resumen = (hitos: Pick<Hito, 'nombre' | 'peso'>[]) =>
  hitos.map((h, i) => `${i + 1}. ${h.nombre} (${porcentaje(h.peso)})`).join('; ')

function finalizado(p: Proyecto) {
  return p.estatus === 'Finalizado'
    ? error(409, `${p.codigo} está finalizado: su plan de hitos ya no cambia.`)
    : null
}

export const handlersHitos = [
  http.get('/api/proyectos/:id/plan', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.id))
    if (acceso instanceof Response) return acceso
    return HttpResponse.json(plan(acceso.proyecto))
  }),

  /**
   * F2.4: el plan se guarda entero. Con "confirmar", o si ya estaba confirmado, los pesos tienen que
   * sumar 100: así el avance físico nunca vuelve a "No disponible" por una edición.
   */
  http.put('/api/proyectos/:id/hitos', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.id), ['coordinador'])
    if (acceso instanceof Response) return acceso
    const { quien, proyecto: p } = acceso
    const cerrado = finalizado(p)
    if (cerrado) return cerrado

    const cuerpo = (await request.json().catch(() => ({}))) as { hitos?: unknown; confirmar?: unknown }
    const lista = Array.isArray(cuerpo.hitos) ? (cuerpo.hitos as EntradaHito[]) : []
    if (lista.length === 0) return errorValidacion({ hitos: 'Agrega al menos un hito.' })

    const actuales = hitosDe(p.codigo)
    const errores: Record<string, string> = {}
    const limpios = lista.map((h, i) => {
      const nombre = typeof h.nombre === 'string' ? h.nombre.trim() : ''
      const fechaPrevista = typeof h.fechaPrevista === 'string' ? h.fechaPrevista : ''
      const peso = typeof h.peso === 'number' ? h.peso : NaN
      const id = typeof h.id === 'string' ? h.id : null
      if (!nombre) errores[`hitos.${i}.nombre`] = 'Escribe el nombre del hito.'
      else if (nombre.length > MAX_NOMBRE)
        errores[`hitos.${i}.nombre`] = `Usa como máximo ${MAX_NOMBRE} caracteres.`
      else if (id && !actuales.some((a) => a.id === id)) {
        errores[`hitos.${i}.nombre`] = 'Este hito ya no existe. Recarga la página.'
      }
      if (!FECHA.test(fechaPrevista)) errores[`hitos.${i}.fechaPrevista`] = 'Elige la fecha.'
      if (!Number.isInteger(peso) || peso < 1 || peso > 100) {
        errores[`hitos.${i}.peso`] = 'Usa un entero de 1 a 100.'
      }
      return { id, nombre, fechaPrevista, peso }
    })
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const suma = limpios.reduce((t, h) => t + h.peso, 0)
    const confirmar = cuerpo.confirmar === true || p.planConfirmado
    if (confirmar && suma !== 100) {
      return errorValidacion({
        hitos:
          suma < 100
            ? `Los pesos suman ${suma} %: faltan ${100 - suma} % para llegar a 100 %.`
            : `Los pesos suman ${suma} %: sobran ${suma - 100} %.`,
      })
    }

    // F2.5: las cargas no se borran, así que un hito con avance cargado no se puede quitar.
    const quitados = actuales.filter((a) => !limpios.some((h) => h.id === a.id))
    const conCargas = quitados.find((a) => cargasDe(a.id).length > 0)
    if (conCargas) {
      return error(409, `El hito «${conCargas.nombre}» ya tiene cargas de avance: no se puede quitar.`)
    }

    const yaConfirmado = p.planConfirmado
    for (const h of quitados) await db.hitos.delete((q) => q.where({ id: h.id }))
    for (const [i, h] of limpios.entries()) {
      const existente = h.id ? actuales.find((a) => a.id === h.id) : undefined
      if (existente) {
        await db.hitos.update(existente, {
          data(x) {
            x.numero = i + 1
            x.nombre = h.nombre
            x.peso = h.peso
            x.fechaPrevista = h.fechaPrevista
          },
        })
      } else {
        await db.hitos.create({
          id: `${p.codigo}-h${Date.now()}-${i}`,
          proyecto: p.codigo,
          numero: i + 1,
          nombre: h.nombre,
          peso: h.peso,
          fechaPrevista: h.fechaPrevista,
          avance: 0,
        })
      }
    }
    const editado = confirmar
      ? await db.proyectos.update(p, {
          data(x) {
            x.planConfirmado = true
          },
        })
      : p

    const cuantos = `${limpios.length} ${limpios.length === 1 ? 'hito' : 'hitos'}`
    await auditar(
      quien,
      'edicion',
      yaConfirmado
        ? `${quien.nombre} cambió el plan de hitos de ${p.codigo} (${cuantos})`
        : confirmar
          ? `${quien.nombre} confirmó el plan de hitos de ${p.codigo} (${cuantos}, 100 %)`
          : `${quien.nombre} guardó el borrador del plan de hitos de ${p.codigo} (${cuantos}, ${porcentaje(suma)})`,
      {
        entidad: `proyecto:${p.codigo}`,
        valorAnterior: resumen(actuales) || null,
        valorNuevo: resumen(limpios),
      },
    )

    // Un plan recién confirmado en Propuesta queda listo para pasar a En ejecución (F2.3).
    if (confirmar && !yaConfirmado && p.estatus === 'Propuesta') {
      const ahora = new Date().toISOString()
      for (const adm of db.usuarios.findMany((q) => q.where({ rol: 'administrador', activo: true }))) {
        await db.avisos.create({
          id: `av-plan-${p.codigo}-${adm.id}-${Date.now()}`,
          usuarioId: adm.id,
          tipo: 'info',
          titulo: `${p.codigo} tiene su plan de hitos confirmado`,
          detalle: 'Está en Propuesta. Puedes pasarlo a En ejecución.',
          enlace: `/proyectos/${p.id}`,
          fecha: ahora,
          leido: false,
        })
      }
    }
    return HttpResponse.json(plan(editado!))
  }),

  http.get('/api/proyectos/:id/hitos/:hitoId/avances', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.id))
    if (acceso instanceof Response) return acceso
    const hito = db.hitos.findFirst((q) =>
      q.where({ id: String(params.hitoId), proyecto: acceso.proyecto.codigo }),
    )
    if (!hito) return error(404, 'No encontramos ese hito. Recarga la página.')
    return HttpResponse.json(
      cargasDe(hito.id).map((a) => ({
        id: a.id,
        fecha: a.fecha,
        porcentaje: a.porcentaje,
        comentario: a.comentario,
        usuario: nombreUsuario(a.usuarioId),
      })),
    )
  }),

  /** F2.5: cada carga es un registro nuevo; el hito queda con la última y el avance se recalcula (F2.6). */
  http.post('/api/proyectos/:id/hitos/:hitoId/avances', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.id), ['coordinador'])
    if (acceso instanceof Response) return acceso
    const { quien, proyecto: p } = acceso
    const cerrado = finalizado(p)
    if (cerrado) return cerrado
    if (!p.planConfirmado) {
      return error(409, 'Primero confirma el plan de hitos: el avance se carga cuando los pesos suman 100.')
    }
    const hito = db.hitos.findFirst((q) => q.where({ id: String(params.hitoId), proyecto: p.codigo }))
    if (!hito) return error(404, 'No encontramos ese hito. Recarga la página.')

    const cuerpo = (await request.json().catch(() => ({}))) as {
      porcentaje?: unknown
      fecha?: unknown
      comentario?: unknown
    }
    const valor = cuerpo.porcentaje
    const fecha = typeof cuerpo.fecha === 'string' ? cuerpo.fecha : ''
    const comentario = typeof cuerpo.comentario === 'string' ? cuerpo.comentario.trim() : ''
    const ultima = cargasDe(hito.id)[0]
    const errores: Record<string, string> = {}
    if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 0 || valor > 100) {
      errores.porcentaje = `Escribe un porcentaje entre 0 y 100. Escribiste ${String(valor)}.`
    }
    if (!FECHA.test(fecha)) errores.fecha = 'Elige la fecha de la carga.'
    else if (fecha > dia(0)) errores.fecha = 'La fecha no puede ser posterior a hoy.'
    else if (ultima && fecha < ultima.fecha) {
      errores.fecha = `La fecha no puede ser anterior a la última carga (${fechaCorta(ultima.fecha)}).`
    }
    if (comentario.length > MAX_COMENTARIO)
      errores.comentario = `Usa como máximo ${MAX_COMENTARIO} caracteres.`
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const nuevo = valor as number
    const antes = avanceDe(p)
    await db.avances.create({
      id: `av-${Date.now()}`,
      hitoId: hito.id,
      proyecto: p.codigo,
      porcentaje: nuevo,
      fecha,
      comentario: comentario || null,
      usuarioId: quien.id,
    })
    await db.hitos.update(hito, {
      data(x) {
        x.avance = nuevo
      },
    })
    await auditar(
      quien,
      'creacion',
      `${quien.nombre} cargó ${porcentaje(nuevo)} en el hito ${hito.numero} de ${p.codigo}`,
      {
        entidad: `proyecto:${p.codigo}`,
        justificacion: comentario || null,
        valorAnterior: porcentaje(hito.avance),
        valorNuevo: porcentaje(nuevo),
      },
    )
    return HttpResponse.json(
      { hito: hito.numero, antes, despues: avanceDe(p), completo: nuevo === 100 },
      { status: 201 },
    )
  }),
]
