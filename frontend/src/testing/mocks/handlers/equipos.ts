import { http, HttpResponse } from 'msw'
import { fechaIso } from '@/lib/formato'
import { idDe, nombreUsuario, proyecto } from '../consultas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Catálogo de equipos (vista 11; F4.1, F4.2), solo para el Administrador.
 *   GET  /api/equipos?q&estado&ubicacion            equipos con su estado y su próxima reserva
 *   POST /api/equipos                               alta; nace Disponible; código de activo único (409)
 *   GET  /api/equipos/:id/reservas-afectadas        reservas pendientes o aprobadas que todavía no terminan
 *   POST /api/equipos/:id/mantenimiento   {motivo}  pasa a En mantenimiento, cancela esas reservas y avisa
 *   POST /api/equipos/:id/fin-mantenimiento         vuelve a Disponible
 */

const ESTADOS = ['Disponible', 'En uso', 'En mantenimiento'] as const
/** Código de activo como el de la placa: letras, números y guiones (UC-FACYT-0457). */
const CODIGO = /^[A-Z0-9][A-Z0-9-]{2,23}$/

type Equipo = NonNullable<ReturnType<typeof db.equipos.findFirst>>

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const ubicacion = (id: string) => db.ubicaciones.findFirst((q) => q.where({ id }))
const ahora = () => new Date().toISOString()

/** Pendientes y aprobadas: las rechazadas y las canceladas ya no ocupan el horario. */
const vigente = (e: string) => e === 'pendiente' || e === 'aprobada'

/** Reservas vigentes que todavía no terminan, de la más próxima a la más lejana. */
function reservasFuturas(equipoId: string) {
  // Las de hoy cuentan todo el día, aunque su horario ya haya pasado
  const hoy = fechaIso()
  return db.reservas
    .findMany((q) => q.where({ equipoId, estado: vigente }))
    .filter((r) => fechaIso(r.fin) >= hoy)
    .sort((a, b) => a.inicio.localeCompare(b.inicio))
}

function vista(e: Equipo) {
  const u = ubicacion(e.ubicacionId)
  // En mantenimiento no se usa: el mockup muestra "—" en la próxima reserva
  const proxima = e.estado === 'En mantenimiento' ? undefined : reservasFuturas(e.id)[0]
  return {
    id: e.id,
    nombre: e.nombre,
    codigo: e.codigo,
    ubicacion: { id: e.ubicacionId, nombre: u?.nombre ?? 'Sin ubicación' },
    estado: e.estado,
    mantenimiento: e.mantenimiento,
    proximaReserva: proxima
      ? {
          inicio: proxima.inicio,
          proyecto: proxima.proyecto,
          proyectoId: idDe(proxima.proyecto),
          aprobada: proxima.estado === 'aprobada',
        }
      : null,
  }
}

/** F4.2: las pendientes y aprobadas que todavía no terminan; el mantenimiento las cancela. */
function afectadas(equipoId: string) {
  return reservasFuturas(equipoId)
    .filter((r) => Date.parse(r.fin) > Date.now())
    .map((r) => {
      const coordinadorId = proyecto(r.proyecto)?.coordinadorId ?? r.pedidaPor
      return {
        reserva: r,
        id: r.id,
        inicio: r.inicio,
        fin: r.fin,
        proyecto: r.proyecto,
        coordinador: nombreUsuario(coordinadorId),
        coordinadorId,
      }
    })
}

export const handlersEquipos = [
  http.get('/api/equipos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const q = normalizar(url.searchParams.get('q')?.trim() ?? '')
    const estado = url.searchParams.get('estado')
    const ubicacionId = url.searchParams.get('ubicacion')
    const todos = db.equipos.findMany()
    const items = todos
      .filter((e) => !estado || !(ESTADOS as readonly string[]).includes(estado) || e.estado === estado)
      .filter((e) => !ubicacionId || e.ubicacionId === ubicacionId)
      .filter((e) => !q || normalizar(e.nombre).includes(q) || normalizar(e.codigo).includes(q))
      .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
      .map(vista)
    const conEquipos = [...new Set(todos.map((e) => e.ubicacionId))]
    return HttpResponse.json({
      items,
      total: todos.length,
      // Filtro: los lugares donde hay equipos. Alta: todas las ubicaciones activas del catálogo (F1.4)
      ubicacionesConEquipos: conEquipos
        .map((id) => ({ id, nombre: ubicacion(id)?.nombre ?? id }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
      ubicaciones: db.ubicaciones
        .findMany((x) => x.where({ activa: true }))
        .map(({ id, nombre }) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    })
  }),

  /** F4.1: nace Disponible; el código de activo es único (HU-12). */
  http.post('/api/equipos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.replace(/\s+/g, ' ').trim() : ''
    const codigo = typeof cuerpo.codigo === 'string' ? cuerpo.codigo.trim().toUpperCase() : ''
    const ubicacionId = typeof cuerpo.ubicacionId === 'string' ? cuerpo.ubicacionId : ''

    const errores: Record<string, string> = {}
    if (nombre.length < 3) errores.nombre = 'Escribe el nombre del equipo.'
    else if (nombre.length > 120) errores.nombre = 'Usa como máximo 120 caracteres.'
    if (!CODIGO.test(codigo)) errores.codigo = 'Escribe el código de la placa del equipo, como UC-FACYT-0457.'
    if (!ubicacion(ubicacionId)?.activa) errores.ubicacionId = 'Elige una ubicación activa del catálogo.'
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const repetido = db.equipos.findFirst((q) => q.where({ codigo }))
    if (repetido) {
      return HttpResponse.json(
        {
          detail: {
            mensaje: `El código ${codigo} ya es de otro equipo.`,
            equipo: { id: repetido.id, nombre: repetido.nombre },
          },
        },
        { status: 409 },
      )
    }
    const nuevo = await db.equipos.create({
      id: `eq-${Date.now()}`,
      nombre,
      codigo,
      ubicacionId,
      estado: 'Disponible',
      mantenimiento: null,
    })
    await auditar(quien, 'creacion', `${quien.nombre} registró el equipo ${nombre} (${codigo})`, {
      entidad: `equipo:${nuevo.id}`,
      valorNuevo: 'Disponible',
    })
    return HttpResponse.json(vista(nuevo), { status: 201 })
  }),

  http.get('/api/equipos/:id/reservas-afectadas', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const e = db.equipos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!e) return error(404, 'No encontramos ese equipo.')
    return HttpResponse.json(
      afectadas(e.id).map(({ id, inicio, fin, proyecto, coordinador }) => ({
        id,
        inicio,
        fin,
        proyecto,
        proyectoId: idDe(proyecto),
        coordinador,
      })),
    )
  }),

  /**
   * F4.2: en mantenimiento no admite reservas nuevas. Sus reservas pendientes o aprobadas que todavía no
   * terminan pasan a "cancelada" y a cada coordinador le llega un aviso por reserva, con el motivo (HU-12).
   */
  http.post('/api/equipos/:id/mantenimiento', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const e = db.equipos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!e) return error(404, 'No encontramos ese equipo.')
    if (e.estado === 'En mantenimiento') return error(409, `${e.nombre} ya está en mantenimiento.`)
    const { motivo } = (await request.json().catch(() => ({}))) as { motivo?: unknown }
    const texto = typeof motivo === 'string' ? motivo.replace(/\s+/g, ' ').trim() : ''
    if (texto.length < 5) {
      return errorValidacion({ motivo: 'Escribe el motivo: se incluye en el aviso a los coordinadores.' })
    }
    if (texto.length > 300) return errorValidacion({ motivo: 'Usa como máximo 300 caracteres.' })

    const lista = afectadas(e.id)
    const anterior = e.estado
    const editado = await db.equipos.update(e, {
      data(x) {
        x.estado = 'En mantenimiento'
        x.mantenimiento = { motivo: texto, desde: ahora().slice(0, 10) }
      },
    })
    await auditar(quien, 'cambio-estado', `${quien.nombre} pasó ${e.nombre} a mantenimiento`, {
      entidad: `equipo:${e.id}`,
      justificacion: texto,
      valorAnterior: anterior,
      valorNuevo: 'En mantenimiento',
    })
    // Cada reserva afectada se cancela y su coordinador recibe un aviso que lleva a ella
    for (const a of lista) {
      const antes = a.reserva.estado
      await db.reservas.update(a.reserva, {
        data(x) {
          x.estado = 'cancelada'
          x.decididaEl = ahora()
          x.motivoRechazo = `El equipo pasó a mantenimiento: ${texto}`
        },
      })
      await auditar(
        quien,
        'cambio-estado',
        `Se canceló la reserva ${a.id} de ${e.nombre} por mantenimiento`,
        {
          entidad: `reserva:${a.id}`,
          justificacion: texto,
          valorAnterior: antes,
          valorNuevo: 'cancelada',
        },
      )
      await db.avisos.create({
        id: `av-mant-${a.id}-${a.coordinadorId}-${Date.now()}`,
        usuarioId: a.coordinadorId,
        tipo: 'warn',
        titulo: `Se canceló tu reserva de ${e.nombre}`,
        detalle: `${a.proyecto}: el equipo pasó a mantenimiento. Motivo: ${texto}. Elige otro horario u otro equipo.`,
        enlace: `/reservas?reserva=${a.id}`,
        fecha: ahora(),
        leido: false,
      })
    }
    return HttpResponse.json({
      equipo: vista(editado!),
      avisados: new Set(lista.map((a) => a.coordinadorId)).size,
      reservas: lista.length,
    })
  }),

  /** F4.2: el administrador registra el fin del mantenimiento y el equipo vuelve a Disponible. */
  http.post('/api/equipos/:id/fin-mantenimiento', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const e = db.equipos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!e) return error(404, 'No encontramos ese equipo.')
    if (e.estado !== 'En mantenimiento') return error(409, `${e.nombre} no está en mantenimiento.`)
    const editado = await db.equipos.update(e, {
      data(x) {
        x.estado = 'Disponible'
        x.mantenimiento = null
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} registró el fin del mantenimiento de ${e.nombre}`,
      {
        entidad: `equipo:${e.id}`,
        valorAnterior: 'En mantenimiento',
        valorNuevo: 'Disponible',
      },
    )
    return HttpResponse.json(vista(editado!))
  }),
]
