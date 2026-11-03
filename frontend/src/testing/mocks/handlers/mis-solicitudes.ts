import { http, HttpResponse } from 'msw'
import { moneda } from '@/lib/formato'
import { disponible, nombreUsuario, proyectosDe } from '../consultas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Solicitudes del coordinador (vista 14; F5.1 a F5.3; RN-03, RN-07).
 *   GET    /api/solicitudes?estado        las de sus proyectos, con conteos, sus proyectos y los insumos
 *   GET    /api/solicitudes/:id           el detalle (para editar un borrador o verla)
 *   POST   /api/solicitudes               crea un borrador con lo que tenga escrito
 *   PATCH  /api/solicitudes/:id           guarda el borrador mientras escribe; enviada, ya no se edita
 *   POST   /api/solicitudes/:id/enviar    valida los datos obligatorios y la pasa a Pendiente de Aprobación
 *   DELETE /api/solicitudes/:id           descarta un borrador
 * Las decisiones del aprobador están en handlers/solicitudes.ts.
 */

type Solicitud = NonNullable<ReturnType<typeof db.solicitudes.findFirst>>
type Quien = { id: string; nombre: string }
type Linea = { insumoId: string; cantidad: number }

const PENDIENTE = 'Pendiente de Aprobación'
const ESTADOS = ['Borrador', PENDIENTE, 'Aprobado', 'Rechazado', 'Ejecutado'] as const
const num = (n: number) => String(n).replace('.', ',')
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const insumo = (id: string) => db.insumos.findFirst((q) => q.where({ id }))

type Contenido = {
  tipo: string
  lineas: Linea[]
  insumoServicio: string | null
  cantidadGasto: string | null
}

/** Texto corto para las listas (inicio, bandeja): los insumos pedidos o el insumo o servicio. */
function resumen(s: Contenido) {
  if (s.tipo === 'gasto') return s.insumoServicio || 'Solicitud de gasto'
  const nombres = s.lineas.map((l) => insumo(l.insumoId)?.nombre).filter((n): n is string => Boolean(n))
  if (nombres.length === 0) return 'Retiro de insumos'
  const dos = [nombres[0], ...nombres.slice(1, 2).map(minuscula)].join(', ')
  return nombres.length > 2 ? `${dos} y ${nombres.length - 2} más` : dos
}

function items(s: Contenido) {
  if (s.tipo === 'gasto') {
    const texto = [s.insumoServicio, s.cantidadGasto].filter(Boolean).join(', ')
    return texto ? [texto] : []
  }
  return s.lineas.map((l) => {
    const i = insumo(l.insumoId)
    return `${i?.nombre ?? 'Insumo'} ${num(l.cantidad)} ${i?.unidad ?? ''}`.trim()
  })
}

/** RN-07: la solicitud tiene que ser de un proyecto del coordinador; si no, no existe para él. */
function suya(quien: Quien, id: string) {
  const s = db.solicitudes.findFirst((q) => q.where({ id }))
  const mios = proyectosDe(quien.id).map((p) => p.codigo)
  if (!s || !s.proyecto || !mios.includes(s.proyecto)) return error(404, `No encontramos la solicitud ${id}.`)
  return s
}

function detalle(s: Solicitud) {
  return {
    id: s.id,
    tipo: s.tipo,
    proyecto: s.proyecto,
    estado: s.estado,
    fecha: s.fecha,
    resumen: s.descripcion,
    lineas: s.lineas,
    proposito: s.proposito,
    insumoServicio: s.insumoServicio,
    cantidadGasto: s.cantidadGasto,
    monto: s.monto,
    justificacion: s.justificacion,
    cotizacion: s.cotizacion,
    motivoRechazo: s.motivoRechazo,
    decididaPor: s.decididaPor ? nombreUsuario(s.decididaPor) : null,
    despacho: s.despacho,
  }
}

type Cambios = Partial<{
  proyecto: string
  lineas: Linea[]
  proposito: string | null
  insumoServicio: string | null
  cantidadGasto: string | null
  monto: number | null
  justificacion: string | null
  cotizacion: string | null
}>

const texto = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) || null : null)

/** Lo que admite el borrador: textos recortados y líneas limpias. No exige nada (F5.1). */
function leerCambios(quien: Quien, cuerpo: Record<string, unknown>): Cambios | Response {
  const c: Cambios = {}
  if ('proyecto' in cuerpo) {
    const p = proyectosDe(quien.id).find((x) => x.codigo === cuerpo.proyecto)
    if (!p) return errorValidacion({ proyecto: 'Elige uno de tus proyectos.' })
    if (p.estatus === 'Finalizado') {
      return errorValidacion({ proyecto: `${p.codigo} está finalizado: ya no pide recursos.` })
    }
    c.proyecto = p.codigo
  }
  if (Array.isArray(cuerpo.lineas)) {
    c.lineas = (cuerpo.lineas as { insumoId?: unknown; cantidad?: unknown }[])
      .filter((l) => typeof l.insumoId === 'string' && insumo(l.insumoId))
      .map((l) => ({
        insumoId: l.insumoId as string,
        cantidad: typeof l.cantidad === 'number' && l.cantidad > 0 ? Math.round(l.cantidad * 1000) / 1000 : 0,
      }))
  }
  if ('proposito' in cuerpo) c.proposito = texto(cuerpo.proposito, 200)
  if ('insumoServicio' in cuerpo) c.insumoServicio = texto(cuerpo.insumoServicio, 160)
  if ('cantidadGasto' in cuerpo) c.cantidadGasto = texto(cuerpo.cantidadGasto, 60)
  if ('monto' in cuerpo) {
    c.monto =
      typeof cuerpo.monto === 'number' && cuerpo.monto > 0 ? Math.round(cuerpo.monto * 100) / 100 : null
  }
  if ('justificacion' in cuerpo) c.justificacion = texto(cuerpo.justificacion, 600)
  if ('cotizacion' in cuerpo) c.cotizacion = texto(cuerpo.cotizacion, 160)
  return c
}

/** F5.3: los datos obligatorios para enviar, junto a su campo. */
function faltantes(s: Solicitud) {
  const e: Record<string, string> = {}
  if (s.tipo === 'gasto') {
    if (!s.insumoServicio) e.insumoServicio = 'Escribe qué insumo o servicio necesitas.'
    if (!s.cantidadGasto) e.cantidadGasto = 'Escribe la cantidad, por ejemplo 1 frasco.'
    if (!s.monto) e.monto = 'Escribe el monto estimado. Si tienes cotización, usa ese valor.'
    if (!s.justificacion) e.justificacion = 'Escribe para qué se necesita: el aprobador decide con esto.'
  } else {
    if (s.lineas.length === 0) e.lineas = 'Agrega al menos un insumo.'
    s.lineas.forEach((l, i) => {
      if (!(l.cantidad > 0)) e[`lineas.${i}.cantidad`] = 'Escribe una cantidad mayor que cero.'
    })
  }
  return e
}

function siguienteId() {
  const n = db.solicitudes
    .findMany((q) => q.where({ tipo: (t) => t !== 'reposicion' }))
    .map((s) => Number(s.id.replace('SOL-', '')) || 0)
  return `SOL-${String(Math.max(0, ...n) + 1).padStart(3, '0')}`
}

export const handlersMisSolicitudes = [
  http.get('/api/solicitudes', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const mios = proyectosDe(quien.id)
    const codigos = mios.map((p) => p.codigo)
    const todas = db.solicitudes
      .findMany((q) =>
        q.where({ tipo: (t) => t !== 'reposicion', proyecto: (p) => p !== null && codigos.includes(p) }),
      )
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
    const estado = new URL(request.url).searchParams.get('estado')
    return HttpResponse.json({
      items: todas
        .filter((s) => !estado || s.estado === estado)
        .map((s) => ({
          id: s.id,
          tipo: s.tipo,
          proyecto: s.proyecto,
          detalle: s.tipo === 'gasto' && s.monto ? `${s.descripcion}, ${moneda(s.monto)}` : s.descripcion,
          estado: s.estado,
          fecha: s.fecha,
          motivoRechazo: s.motivoRechazo,
          despacho: s.despacho,
        })),
      conteos: Object.fromEntries([
        ['Todas', todas.length],
        ...ESTADOS.map((e) => [e, todas.filter((s) => s.estado === e).length]),
      ]),
      // Un proyecto finalizado ya no pide recursos (HU-04); la ejecución la ve también el aprobador
      misProyectos: mios
        .filter((p) => p.estatus !== 'Finalizado')
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map((p) => ({
          codigo: p.codigo,
          nombre: p.nombre,
          ejecucion: p.presupuesto > 0 ? Math.round((p.gastoEjecutado / p.presupuesto) * 100) : 0,
        })),
      insumos: db.insumos
        .findMany()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((i) => ({
          id: i.id,
          nombre: i.nombre,
          unidad: i.unidad,
          disponible: disponible(i.id),
          reposicionEnCurso: Boolean(
            db.solicitudes.findFirst((q) =>
              q.where({
                tipo: 'reposicion',
                insumoId: i.id,
                estado: (e) => e !== 'Rechazado' && e !== 'Ejecutado',
              }),
            ),
          ),
        })),
    })
  }),

  http.get('/api/solicitudes/:id', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const s = suya(quien, String(params.id))
    if (s instanceof Response) return s
    return HttpResponse.json(detalle(s))
  }),

  /** F5.1, F5.2: nace en Borrador, solo para un proyecto propio y vigente (RN-07, HU-04). */
  http.post('/api/solicitudes', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const tipo = cuerpo.tipo === 'gasto' || cuerpo.tipo === 'retiro' ? cuerpo.tipo : null
    if (!tipo) return errorValidacion({ tipo: 'Elige si es un gasto o un retiro.' })
    if (!('proyecto' in cuerpo)) return errorValidacion({ proyecto: 'Elige uno de tus proyectos.' })
    const c = leerCambios(quien, cuerpo)
    if (c instanceof Response) return c
    const contenido: Contenido = {
      tipo,
      lineas: c.lineas ?? [],
      insumoServicio: c.insumoServicio ?? null,
      cantidadGasto: c.cantidadGasto ?? null,
    }
    const nueva = await db.solicitudes.create({
      id: siguienteId(),
      tipo,
      proyecto: c.proyecto!,
      estado: 'Borrador',
      descripcion: resumen(contenido),
      items: items(contenido),
      insumoId: null,
      cantidad: null,
      monto: c.monto ?? null,
      creadaPor: quien.id,
      fecha: new Date().toISOString(),
      decididaPor: null,
      motivoRechazo: null,
      lineas: contenido.lineas,
      proposito: c.proposito ?? null,
      insumoServicio: contenido.insumoServicio,
      cantidadGasto: contenido.cantidadGasto,
      justificacion: c.justificacion ?? null,
      cotizacion: c.cotizacion ?? null,
      despacho: null,
      montoReal: null,
    })
    return HttpResponse.json(detalle(nueva), { status: 201 })
  }),

  /** El borrador se guarda mientras se escribe (F5.1). Enviada, ya no se edita (F5.3, HU-15). */
  http.patch('/api/solicitudes/:id', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const s = suya(quien, String(params.id))
    if (s instanceof Response) return s
    if (s.estado !== 'Borrador') return error(409, `${s.id} ya se envió a aprobación: no se puede editar.`)
    const c = leerCambios(quien, (await request.json().catch(() => ({}))) as Record<string, unknown>)
    if (c instanceof Response) return c
    const editada = await db.solicitudes.update(s, {
      data(x) {
        Object.assign(x, c)
        x.descripcion = resumen(x)
        x.items = items(x)
        x.fecha = new Date().toISOString()
      },
    })
    return HttpResponse.json(detalle(editada!))
  }),

  /** F5.3: pasa a Pendiente de Aprobación si tiene los datos obligatorios, y llega a la bandeja. */
  http.post('/api/solicitudes/:id/enviar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const s = suya(quien, String(params.id))
    if (s instanceof Response) return s
    if (s.estado !== 'Borrador') return error(409, `${s.id} ya se envió a aprobación.`)
    const e = faltantes(s)
    if (Object.keys(e).length > 0) return errorValidacion(e)
    const enviada = await db.solicitudes.update(s, {
      data(x) {
        x.estado = PENDIENTE
        x.fecha = new Date().toISOString()
      },
    })
    await auditar(quien, 'cambio-estado', `${quien.nombre} envió la solicitud ${s.id} a aprobación`, {
      entidad: `solicitud:${s.id}`,
      valorAnterior: 'Borrador',
      valorNuevo: PENDIENTE,
    })
    for (const apr of db.usuarios.findMany((q) => q.where({ rol: 'aprobador', activo: true }))) {
      await db.avisos.create({
        id: `av-sol-${s.id}-${apr.id}`,
        usuarioId: apr.id,
        tipo: 'info',
        titulo: `Solicitud por aprobar: ${s.id}`,
        detalle: `${s.tipo === 'gasto' ? 'Gasto' : 'Retiro de insumos'} de ${s.proyecto}: ${s.descripcion}.`,
        enlace: `/bandeja?pedido=${s.id}`,
        fecha: new Date().toISOString(),
        leido: false,
      })
    }
    return HttpResponse.json(detalle(enviada!))
  }),

  http.delete('/api/solicitudes/:id', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const s = suya(quien, String(params.id))
    if (s instanceof Response) return s
    if (s.estado !== 'Borrador') return error(409, `${s.id} ya se envió: no se puede descartar.`)
    await db.solicitudes.delete((q) => q.where({ id: s.id }))
    return new HttpResponse(null, { status: 204 })
  }),
]
