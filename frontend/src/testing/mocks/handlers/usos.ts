import { http, HttpResponse } from 'msw'
import { hora } from '@/lib/formato'
import { partesCaracas, seCruzan } from '@/lib/horarios'
import { idDe, nombreUsuario, PROYECTO_NO_EXISTE, proyectoPorId, proyectosDe } from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Uso de equipos (vista 13; F4.6; RN-07), del Coordinador.
 *   GET  /api/usos?equipo                  el equipo, su uso abierto, tu reserva de hoy y los usos de tus proyectos
 *   POST /api/usos         { equipoId, proyectoId } inicia el uso: el equipo pasa a En uso
 *   POST /api/usos/:id/cerrar { observaciones }     cierra el uso: vuelve a Disponible (salvo en mantenimiento)
 */

type Usuario = { id: string; nombre: string }

const ubicacion = (id: string) => db.ubicaciones.findFirst((q) => q.where({ id }))?.nombre ?? 'Sin ubicación'
const abiertoDe = (equipoId: string) => db.usos.findFirst((q) => q.where({ equipoId, fin: null }))
const horas = (inicio: string, fin: string) =>
  Math.round(((Date.parse(fin) - Date.parse(inicio)) / 3600_000) * 10) / 10

/** Tu reserva aprobada de hoy para ese equipo (la que propone el proyecto, mockup 13). */
function reservaDeHoy(equipoId: string, codigos: string[]) {
  return db.reservas
    .findMany((q) => q.where({ equipoId, estado: 'aprobada' }))
    .filter((r) => codigos.includes(r.proyecto) && partesCaracas(r.inicio).fecha === dia(0))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
    .find((r) => Date.parse(r.fin) >= Date.now())
}

/** Sin equipo en la URL: el que estás usando, el de tu reserva de hoy o el de tu próxima reserva. */
function equipoInicial(quien: Usuario, codigos: string[]) {
  const mio = db.usos.findFirst((q) => q.where({ usuarioId: quien.id, fin: null }))
  if (mio) return mio.equipoId
  const proxima = db.reservas
    .findMany((q) => q.where({ estado: 'aprobada' }))
    .filter((r) => codigos.includes(r.proyecto) && Date.parse(r.fin) >= Date.now())
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0]
  return (
    proxima?.equipoId ?? db.equipos.findMany().sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))[0]?.id
  )
}

export const handlersUsos = [
  http.get('/api/usos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const mios = proyectosDe(quien.id)
    const codigos = mios.map((p) => p.codigo)
    const id = new URL(request.url).searchParams.get('equipo') || equipoInicial(quien, codigos)
    const e = id ? db.equipos.findFirst((q) => q.where({ id })) : undefined
    if (!e) return error(404, 'No encontramos ese equipo. Elige otro de la lista.')

    const abierto = abiertoDe(e.id)
    const reserva = reservaDeHoy(e.id, codigos)
    // RN-07: solo los usos de los proyectos del coordinador
    const historial = db.usos
      .findMany((q) => q.where({ equipoId: e.id, fin: (f) => f !== null }))
      .filter((u) => codigos.includes(u.proyecto))
      .sort((a, b) => b.inicio.localeCompare(a.inicio))
      .map((u) => ({
        id: u.id,
        inicio: u.inicio,
        proyecto: u.proyecto,
        proyectoId: idDe(u.proyecto),
        horas: horas(u.inicio, u.fin!),
        observaciones: u.observaciones,
      }))
    // Horas del mes del último uso (mockup: "Octubre: 14,5 h")
    const mes = historial[0]?.inicio.slice(0, 7)
    return HttpResponse.json({
      equipo: {
        id: e.id,
        nombre: e.nombre,
        codigo: e.codigo,
        ubicacion: ubicacion(e.ubicacionId),
        estado: e.estado,
        mantenimiento: e.mantenimiento,
      },
      equipos: db.equipos
        .findMany()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map(({ id: x, nombre, estado }) => ({ id: x, nombre, estado })),
      abierto: abierto
        ? {
            id: abierto.id,
            proyecto: abierto.proyecto,
            proyectoId: idDe(abierto.proyecto),
            inicio: abierto.inicio,
            mio: abierto.usuarioId === quien.id,
            usuario: nombreUsuario(abierto.usuarioId),
          }
        : null,
      reservaHoy: reserva
        ? {
            id: reserva.id,
            proyecto: reserva.proyecto,
            proyectoId: idDe(reserva.proyecto),
            inicio: reserva.inicio,
            fin: reserva.fin,
          }
        : null,
      misProyectos: mios
        .filter((p) => p.estatus !== 'Finalizado')
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map(({ id: x, codigo, nombre }) => ({ id: x, codigo, nombre })),
      historial,
      mes: mes
        ? {
            mes,
            horas:
              Math.round(
                historial.filter((h) => h.inicio.startsWith(mes)).reduce((t, h) => t + h.horas, 0) * 10,
              ) / 10,
          }
        : null,
    })
  }),

  /** F4.6: inicia el uso. Puede no tener reserva; si la tiene, queda asociada. */
  http.post('/api/usos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const { equipoId, proyectoId } = (await request.json().catch(() => ({}))) as {
      equipoId?: string
      proyectoId?: string
    }
    const e = db.equipos.findFirst((q) => q.where({ id: equipoId ?? '' }))
    if (!e) return error(404, 'No encontramos ese equipo.')
    if (e.estado === 'En mantenimiento')
      return error(409, `${e.nombre} está en mantenimiento: no se puede usar.`)
    const abierto = abiertoDe(e.id)
    if (abierto) {
      return error(
        409,
        `${e.nombre} ya está en uso por ${nombreUsuario(abierto.usuarioId)} para ${abierto.proyecto} desde las ${hora(abierto.inicio)}.`,
      )
    }
    if (proyectoId && !proyectoPorId(proyectoId)) return error(404, PROYECTO_NO_EXISTE)
    const p = proyectosDe(quien.id).find((x) => x.id === proyectoId)
    if (!p || p.estatus === 'Finalizado')
      return errorValidacion({ proyectoId: 'Elige uno de tus proyectos vigentes.' })

    const ahora = new Date().toISOString()
    // La reserva aprobada de ese proyecto que cubre este momento, si la hay
    const reserva = db.reservas
      .findMany((q) => q.where({ equipoId: e.id, proyecto: p.codigo, estado: 'aprobada' }))
      .find((r) => seCruzan(r, { inicio: ahora, fin: new Date(Date.now() + 60_000).toISOString() }))
    const numeros = db.usos.findMany().map((u) => Number(u.id.replace('USO-', '')) || 0)
    const id = `USO-${String(Math.max(0, ...numeros) + 1).padStart(3, '0')}`
    await db.usos.create({
      id,
      equipoId: e.id,
      proyecto: p.codigo,
      usuarioId: quien.id,
      inicio: ahora,
      fin: null,
      observaciones: null,
      reservaId: reserva?.id ?? null,
    })
    await db.equipos.update(e, {
      data(x) {
        x.estado = 'En uso'
      },
    })
    await auditar(quien, 'cambio-estado', `${quien.nombre} inició el uso de ${e.nombre} para ${p.codigo}`, {
      entidad: `equipo:${e.id}`,
      valorAnterior: e.estado,
      valorNuevo: 'En uso',
    })
    return HttpResponse.json({ id, proyecto: p.codigo, proyectoId: p.id, inicio: ahora }, { status: 201 })
  }),

  /** F4.6: cierra el uso con observaciones opcionales; el equipo vuelve a Disponible (HU-14). */
  http.post('/api/usos/:id/cerrar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const uso = db.usos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!uso) return error(404, 'No encontramos ese registro de uso.')
    if (uso.fin) return error(409, 'Ese registro de uso ya está cerrado.')
    if (uso.usuarioId !== quien.id) return error(403, 'Solo quien inició el uso puede cerrarlo.')
    const { observaciones } = (await request.json().catch(() => ({}))) as { observaciones?: unknown }
    const texto = typeof observaciones === 'string' ? observaciones.trim().slice(0, 500) : ''
    const fin = new Date().toISOString()
    await db.usos.update(uso, {
      data(x) {
        x.fin = fin
        x.observaciones = texto || null
      },
    })
    const e = db.equipos.findFirst((q) => q.where({ id: uso.equipoId }))!
    if (e.estado === 'En uso') {
      await db.equipos.update(e, {
        data(x) {
          x.estado = 'Disponible'
        },
      })
    }
    const h = horas(uso.inicio, fin)
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} cerró el uso de ${e.nombre} para ${uso.proyecto}`,
      {
        entidad: `equipo:${e.id}`,
        detalle: `${String(h).replace('.', ',')} h`,
        valorAnterior: 'En uso',
        valorNuevo: e.estado === 'En mantenimiento' ? 'En mantenimiento' : 'Disponible',
      },
    )
    return HttpResponse.json({
      id: uso.id,
      proyecto: uso.proyecto,
      proyectoId: idDe(uso.proyecto),
      horas: h,
      equipo: e.nombre,
    })
  }),
]
