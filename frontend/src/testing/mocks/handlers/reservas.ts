import { http, HttpResponse } from 'msw'
import { fechaCorta, fechaIso } from '@/lib/formato'
import {
  APERTURA,
  CIERRE,
  diaSemana,
  horaDe,
  lunesDe,
  partesCaracas,
  rangosLibres,
  seCruzan,
  sumarDias,
} from '@/lib/horarios'
import { idDe, nombreEquipo, PROYECTO_NO_EXISTE, proyectoPorId, proyectosDe } from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Reservas de equipos (vista 12; F4.3, F4.4; RN-03, RN-07).
 *   GET  /api/reservas?equipo&semana&reserva   el equipo, sus reservas de la semana y los proyectos del coordinador
 *   POST /api/reservas                         { equipoId, proyectoId, inicio, fin }: queda pendiente para el aprobador
 * El Coordinador ve todas las reservas del equipo (para no chocar) y pide para sus proyectos. El Aprobador
 * ve el mismo calendario; decide en la bandeja (vista 15).
 */

const VIGENTE = ['pendiente', 'aprobada'] as const
const vigente = (e: string) => (VIGENTE as readonly string[]).includes(e)

type Usuario = { id: string; rol: string }

/** Próxima: termina hoy o después. Las de hoy cuentan todo el día, aunque su horario ya haya pasado. */
const proximaHoy = (fin: string) => fechaIso(fin) >= fechaIso()

const ubicacion = (id: string) => db.ubicaciones.findFirst((q) => q.where({ id }))?.nombre ?? 'Sin ubicación'

/** Equipo por defecto: el de la próxima reserva del coordinador, o la próxima pendiente del aprobador. */
function equipoInicial(quien: Usuario) {
  const mios = quien.rol === 'coordinador' ? proyectosDe(quien.id).map((p) => p.codigo) : null
  const proxima = db.reservas
    .findMany((q) => q.where({ estado: (e) => (mios ? vigente(e) : e === 'pendiente') }))
    .filter((r) => (!mios || mios.includes(r.proyecto)) && proximaHoy(r.fin))
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0]
  if (proxima) return proxima.equipoId
  return db.equipos
    .findMany((q) => q.where({ estado: (e) => e !== 'En mantenimiento' }))
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))[0]?.id
}

/** Hoy, o el lunes que viene si hoy es domingo (los laboratorios cierran). */
const semanaActual = () => lunesDe(dia(0))

function siguienteId() {
  const numeros = db.reservas.findMany().map((r) => Number(r.id.replace('RES-', '')) || 0)
  return `RES-${String(Math.max(0, ...numeros) + 1).padStart(3, '0')}`
}

/** Libres del día de `inicio`, cerca del horario pedido (F4.4), como instantes ISO. */
function libresDelDia(equipoId: string, inicio: string) {
  const { fecha, minutos } = partesCaracas(inicio)
  const ocupados = db.reservas
    .findMany((q) => q.where({ equipoId, estado: vigente }))
    .map((r) => ({ a: partesCaracas(r.inicio), b: partesCaracas(r.fin) }))
    .filter(({ a }) => a.fecha === fecha)
    .map(({ a, b }) => ({ desde: a.minutos, hasta: b.minutos }))
  return rangosLibres(ocupados, minutos)
    .slice(0, 3)
    .map((r) => ({
      inicio: `${fecha}T${horaDe(r.desde)}:00-04:00`,
      fin: `${fecha}T${horaDe(r.hasta)}:00-04:00`,
    }))
}

export const handlersReservas = [
  http.get('/api/reservas', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador', 'aprobador'])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const pedida = url.searchParams.get('reserva')
    const resaltada = pedida ? db.reservas.findFirst((q) => q.where({ id: pedida })) : undefined
    const equipoId = resaltada?.equipoId ?? url.searchParams.get('equipo') ?? equipoInicial(quien)
    const equipo = equipoId ? db.equipos.findFirst((q) => q.where({ id: equipoId })) : undefined
    if (!equipo) return error(404, 'No encontramos ese equipo. Elige otro de la lista.')

    const pedidaSemana = url.searchParams.get('semana')
    const semana = resaltada
      ? lunesDe(partesCaracas(resaltada.inicio).fecha)
      : pedidaSemana && /^\d{4}-\d{2}-\d{2}$/.test(pedidaSemana)
        ? lunesDe(pedidaSemana)
        : semanaActual()
    const hasta = sumarDias(semana, 6)
    const mios = quien.rol === 'coordinador' ? proyectosDe(quien.id) : []
    const codigos = mios.map((p) => p.codigo)

    return HttpResponse.json({
      equipo: {
        id: equipo.id,
        nombre: equipo.nombre,
        codigo: equipo.codigo,
        ubicacion: ubicacion(equipo.ubicacionId),
        estado: equipo.estado,
        mantenimiento: equipo.mantenimiento,
      },
      equipos: db.equipos
        .findMany()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map(({ id, nombre, estado }) => ({ id, nombre, estado })),
      semana,
      reservas: db.reservas
        .findMany((q) => q.where({ equipoId: equipo.id, estado: vigente }))
        .filter((r) => {
          const f = partesCaracas(r.inicio).fecha
          return f >= semana && f < hasta
        })
        .sort((a, b) => a.inicio.localeCompare(b.inicio))
        .map((r) => ({
          id: r.id,
          proyecto: r.proyecto,
          proyectoId: idDe(r.proyecto),
          inicio: r.inicio,
          fin: r.fin,
          estado: r.estado,
          // RN-07: el coordinador distingue las suyas; las demás son "Ocupado"
          mia: codigos.includes(r.proyecto),
        })),
      // Un proyecto finalizado ya no pide recursos (HU-04)
      misProyectos: mios
        .filter((p) => p.estatus !== 'Finalizado')
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map(({ id, codigo, nombre }) => ({ id, codigo, nombre })),
      resaltada: resaltada?.id ?? null,
      // Coordinador (HU-13): sus reservas rechazadas de los últimos 30 días, con el motivo; no ocupan horario
      rechazadas:
        quien.rol === 'coordinador'
          ? db.reservas
              .findMany((q) => q.where({ estado: 'rechazada', proyecto: (x) => codigos.includes(x) }))
              .filter((r) => r.decididaEl !== null && fechaIso(r.decididaEl) >= dia(-30))
              .sort((a, b) => (b.decididaEl ?? '').localeCompare(a.decididaEl ?? ''))
              .slice(0, 5)
              .map((r) => ({
                id: r.id,
                equipoId: r.equipoId,
                equipo: nombreEquipo(r.equipoId),
                proyecto: r.proyecto,
                proyectoId: idDe(r.proyecto),
                inicio: r.inicio,
                fin: r.fin,
                decididaEl: r.decididaEl,
                motivo: r.motivoRechazo ?? 'Sin motivo registrado.',
              }))
          : [],
      // Aprobador: las pendientes de este equipo, que decide en la bandeja (plan §7.1)
      pendientes:
        quien.rol === 'aprobador'
          ? db.reservas
              .findMany((q) => q.where({ equipoId: equipo.id, estado: 'pendiente' }))
              .filter((r) => proximaHoy(r.fin))
              .sort((x, y) => x.inicio.localeCompare(y.inicio))
              .map(({ id, proyecto, inicio, fin }) => ({
                id,
                proyecto,
                proyectoId: idDe(proyecto),
                inicio,
                fin,
              }))
          : [],
    })
  }),

  /**
   * F4.3: queda pendiente y llega a la bandeja del aprobador. F4.4: no se guarda si choca con otra
   * reserva pendiente o aprobada del equipo, ni si el equipo está en mantenimiento.
   */
  http.post('/api/reservas', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const texto = (v: unknown) => (typeof v === 'string' ? v : '')
    const equipo = db.equipos.findFirst((q) => q.where({ id: texto(cuerpo.equipoId) }))
    if (!equipo) return error(404, 'No encontramos ese equipo.')
    if (equipo.estado === 'En mantenimiento') {
      return error(
        409,
        `${equipo.nombre} está en mantenimiento: no admite reservas nuevas hasta que vuelva a Disponible.`,
      )
    }
    const proyectoId = texto(cuerpo.proyectoId)
    if (proyectoId && !proyectoPorId(proyectoId)) return error(404, PROYECTO_NO_EXISTE)
    const proyecto = proyectosDe(quien.id).find((p) => p.id === proyectoId)
    if (!proyecto) return errorValidacion({ proyectoId: 'Elige uno de tus proyectos.' })
    const codigo = proyecto.codigo
    if (proyecto.estatus === 'Finalizado') {
      return errorValidacion({ proyectoId: `${codigo} está finalizado: ya no pide recursos.` })
    }

    const inicio = texto(cuerpo.inicio)
    const fin = texto(cuerpo.fin)
    if (Number.isNaN(Date.parse(inicio)) || Number.isNaN(Date.parse(fin))) {
      return errorValidacion({ inicio: 'Elige la fecha y el horario.' })
    }
    const a = partesCaracas(inicio)
    const b = partesCaracas(fin)
    const errores: Record<string, string> = {}
    if (diaSemana(a.fecha) === 0) errores.fecha = 'Los domingos los laboratorios están cerrados.'
    else if (Date.parse(inicio) <= Date.now())
      errores.inicio = 'La reserva tiene que empezar más tarde que ahora.'
    else if (a.fecha !== b.fecha || b.minutos <= a.minutos)
      errores.fin = 'La hora de fin tiene que ser después del inicio.'
    else if (a.minutos < APERTURA || b.minutos > CIERRE) {
      errores.inicio = `Los laboratorios atienden de ${horaDe(APERTURA)} a ${horaDe(CIERRE)}.`
    }
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const choque = db.reservas
      .findMany((q) => q.where({ equipoId: equipo.id, estado: vigente }))
      .find((r) => seCruzan(r, { inicio, fin }))
    if (choque) {
      return HttpResponse.json(
        {
          detail: {
            mensaje: `Choca con la reserva de ${choque.proyecto} el ${fechaCorta(choque.inicio)}.`,
            choque: {
              proyecto: choque.proyecto,
              proyectoId: idDe(choque.proyecto),
              inicio: choque.inicio,
              fin: choque.fin,
            },
            libres: libresDelDia(equipo.id, inicio),
          },
        },
        { status: 409 },
      )
    }

    const id = siguienteId()
    await db.reservas.create({
      id,
      equipoId: equipo.id,
      proyecto: codigo,
      inicio,
      fin,
      estado: 'pendiente',
      pedidaPor: quien.id,
      pedidaEl: new Date().toISOString(),
      decididaEl: null,
      motivoRechazo: null,
    })
    await auditar(
      quien,
      'creacion',
      `${quien.nombre} solicitó la reserva ${id} de ${equipo.nombre} para ${codigo}`,
      {
        entidad: `reserva:${id}`,
        valorNuevo: 'pendiente',
      },
    )
    for (const apr of db.usuarios.findMany((q) => q.where({ rol: 'aprobador', activo: true }))) {
      await db.avisos.create({
        id: `av-res-${id}-${apr.id}`,
        usuarioId: apr.id,
        tipo: 'info',
        titulo: `Reserva por aprobar: ${nombreEquipo(equipo.id)}`,
        detalle: `${codigo}, ${fechaCorta(inicio)} de ${horaDe(a.minutos)} a ${horaDe(b.minutos)}.`,
        enlace: `/bandeja?pedido=${id}`,
        fecha: new Date().toISOString(),
        leido: false,
      })
    }
    return HttpResponse.json(
      {
        id,
        equipo: equipo.nombre,
        proyecto: codigo,
        proyectoId: proyecto.id,
        inicio,
        fin,
        estado: 'pendiente',
      },
      { status: 201 },
    )
  }),
]
