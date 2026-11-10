import { http, HttpResponse } from 'msw'
import { fechaIso } from '@/lib/formato'
import {
  despachosPorEntregar,
  idDe,
  insumo,
  nombreUsuario,
  periodoCerradoEn,
  periodoEnCurso,
  proyecto,
  PROYECTO_NO_EXISTE,
  proyectoPorId,
  proyectosDe,
  SOLICITUD_NO_EXISTE,
  solicitudPorId,
} from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { avisar, registrarCargo, revisarReposicion, siguienteDespacho } from '../reglas'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'
import { legible } from './bandeja'

/*
 * Despachos y bitácora (vistas 18 y 19; F6.2, F6.3, F6.5; RN-06, RN-07).
 *   GET  /api/despachos/nuevo?solicitud      el retiro aprobado con los lotes de cada insumo (FEFO)
 *   POST /api/despachos                      { solicitud, lotes: { insumoId: lote }, retiro, observacion }
 *   GET  /api/bitacora?proyectoId&desde&hasta&q&despacho
 *   POST /api/correcciones                   { lineaId, campo, cantidadNueva | proyectoNuevoId, motivo }
 * Los proyectos se identifican por su UUID (proyectoId); "proyecto" es el código, para mostrarlo.
 * La bitácora no tiene PUT ni DELETE (RN-06): un error se corrige con un movimiento nuevo (F6.6).
 */

const redondear = (n: number) => Math.round(n * 1000) / 1000
const ubicacion = (id: string) => db.ubicaciones.findFirst((q) => q.where({ id }))?.nombre ?? '—'

/** Lotes con stock de un insumo: los que vencen, del que vence primero (FEFO); los que no, del más antiguo. */
function lotesDe(insumoId: string, pedida: number) {
  const hoy = dia(0)
  const lotes = db.lotes
    .findMany((q) => q.where({ insumoId, cantidad: (c) => c > 0 }))
    .map((l) => ({ ...l, vencido: l.vence !== null && l.vence < hoy }))
    .sort(
      (a, b) =>
        Number(a.vencido) - Number(b.vencido) ||
        (a.vence ?? '9999').localeCompare(b.vence ?? '9999') ||
        a.ingreso.localeCompare(b.ingreso),
    )
  const sugerido =
    lotes.find((l) => !l.vencido && l.cantidad >= pedida) ?? lotes.find((l) => !l.vencido) ?? null
  return lotes.map((l) => ({
    codigo: l.codigo,
    vence: l.vence,
    ingreso: l.ingreso,
    cantidad: l.cantidad,
    ubicacion: ubicacion(l.ubicacionId),
    vencido: l.vencido,
    sugerido: l.codigo === sugerido?.codigo,
  }))
}

type Linea = NonNullable<ReturnType<typeof db.despachos.findFirst>>

/** La corrección que espera decisión para esta línea, si la hay (una a la vez). */
const correccionPendiente = (l: Linea) =>
  db.correcciones.findFirst((q) =>
    q.where({ despacho: l.codigo, insumoId: l.insumoId, lote: l.lote, estado: 'Pendiente' }),
  )

/** Nombre de quien coordina el proyecto, para el subtítulo del despacho. */
function coordinadorDe(codigo: string | null) {
  const id = codigo ? proyecto(codigo)?.coordinadorId : null
  return id ? nombreUsuario(id) : null
}

export const handlersDespachos = [
  http.get('/api/despachos/nuevo', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const pedida = new URL(request.url).searchParams.get('solicitud')
    const pendientes = despachosPorEntregar()
    if (pedida) {
      // ?solicitud= trae el UUID del retiro
      const s = solicitudPorId(pedida)
      if (!s || s.tipo !== 'retiro') return error(404, SOLICITUD_NO_EXISTE)
      if (s.estado === 'Ejecutado') {
        return error(409, `${s.numero} ya se despachó${s.despacho ? ` con ${s.despacho}` : ''}.`)
      }
      if (s.estado !== 'Aprobado')
        return error(409, `${s.numero} está ${s.estado}: solo se despacha un retiro aprobado.`)
    }
    const s = pedida ? pendientes.find((x) => x.id === pedida)! : pendientes[0]
    if (!s) {
      return HttpResponse.json({
        solicitud: null,
        lineas: [],
        personas: [],
        siguiente: null,
        siguienteId: null,
      })
    }
    const p = proyecto(s.proyecto!)!
    const otro = pendientes.find((x) => x.id !== s.id)
    const coordinador = p.coordinadorId ? nombreUsuario(p.coordinadorId) : null
    // Quienes ya retiraron para este proyecto: el personal de laboratorio sin cuenta (F6.3)
    const anteriores = db.despachos
      .findMany((q) => q.where({ proyecto: p.codigo, retiro: (r) => r !== null }))
      .map((d) => d.retiro!)
    return HttpResponse.json({
      solicitud: {
        id: s.id,
        numero: s.numero,
        proyecto: p.codigo,
        proyectoId: p.id,
        coordinador,
        aprobadaEl: s.fecha,
        proposito: s.proposito,
      },
      lineas: s.lineas.map((l) => {
        const i = insumo(l.insumoId)
        const lotes = lotesDe(i.id, l.cantidad)
        return {
          insumoId: i.id,
          insumo: i.nombre,
          unidad: i.unidad,
          cantidad: l.cantidad,
          stock: i.stock,
          vence: db.lotes.findMany((q) => q.where({ insumoId: i.id })).some((x) => x.vence !== null),
          lotes,
        }
      }),
      personas: [...new Set([coordinador, ...anteriores].filter((x): x is string => Boolean(x)))],
      siguiente: otro?.numero ?? null,
      siguienteId: otro?.id ?? null,
    })
  }),

  /**
   * F6.2 y F6.3: en una sola operación se registra el despacho en la bitácora, se descuenta el stock de
   * cada lote (F3.3), el retiro pasa a Ejecutado y el costo se carga al proyecto (F2.7).
   */
  http.post('/api/despachos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const c = (await request.json().catch(() => ({}))) as {
      solicitud?: string
      lotes?: Record<string, string>
      retiro?: string
      observacion?: string
    }
    // "solicitud" trae el UUID del retiro
    const s = solicitudPorId(String(c.solicitud ?? ''))
    if (!s || s.tipo !== 'retiro') return error(404, SOLICITUD_NO_EXISTE)
    if (s.estado !== 'Aprobado') return error(409, `${s.numero} está ${s.estado}: ya no se puede despachar.`)
    const cerrado = periodoCerradoEn(fechaIso())
    if (cerrado) return error(409, 'El período de hoy está cerrado: no admite despachos.')

    const errores: Record<string, string> = {}
    const retiro = (c.retiro ?? '').trim().slice(0, 120)
    if (!retiro) errores.retiro = 'Escribe quién retira los insumos.'
    const hoy = dia(0)
    const elegidos = s.lineas.map((l) => {
      const i = insumo(l.insumoId)
      const lote = db.lotes.findFirst((q) => q.where({ codigo: c.lotes?.[i.id] ?? '', insumoId: i.id }))
      const campo = `lotes.${i.id}`
      if (!lote) errores[campo] = `Elige el lote de ${i.nombre.charAt(0).toLowerCase()}${i.nombre.slice(1)}.`
      else if (lote.vence && lote.vence < hoy) errores[campo] = `${lote.codigo} está vencido: no se despacha.`
      else if (lote.cantidad < l.cantidad) {
        errores[campo] =
          `${lote.codigo} tiene ${legible(lote.cantidad, i.unidad)}; se piden ${legible(l.cantidad, i.unidad)}.`
      }
      return { l, i, lote: lote! }
    })
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const codigo = siguienteDespacho()
    const fecha = new Date().toISOString()
    // La solicitud pasa a Ejecutado y su fecha cambia: se guarda la de la aprobación para el subtítulo del éxito
    const aprobadaEl = s.fecha
    let monto = 0
    let n = 0
    for (const { l, i, lote } of elegidos) {
      n += 1
      await db.despachos.create({
        id: `des-${codigo.toLowerCase()}-${n}`,
        codigo,
        fecha,
        proyecto: s.proyecto,
        insumoId: i.id,
        lote: lote.codigo,
        cantidad: l.cantidad,
        retiro,
        registradoPor: quien.id,
        corrige: null,
        observacion: (c.observacion ?? '').trim().slice(0, 300) || null,
      })
      await db.lotes.update(lote, {
        data(x) {
          x.cantidad = redondear(x.cantidad - l.cantidad)
        },
      })
      await db.insumos.update(i, {
        data(x) {
          x.stock = redondear(x.stock - l.cantidad)
        },
      })
      monto += l.cantidad * lote.costoUnitario
    }
    monto = Math.round(monto * 100) / 100
    const detalle = elegidos.map(({ l, i }) => `${i.nombre} ${legible(l.cantidad, i.unidad)}`).join(', ')
    await registrarCargo({
      proyecto: s.proyecto!,
      tipo: 'despacho',
      concepto: detalle,
      referencia: codigo,
      monto,
    })
    await db.solicitudes.update(s, {
      data(x) {
        x.estado = 'Ejecutado'
        x.despacho = codigo
        x.fecha = fecha
      },
    })
    await auditar(quien, 'creacion', `${quien.nombre} registró el despacho ${codigo} de ${s.numero}`, {
      entidad: `despacho:${codigo}`,
      detalle: `${detalle} · retiró ${retiro}`,
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} ejecutó la solicitud ${s.numero} con el despacho ${codigo}`,
      {
        entidad: `solicitud:${s.numero}`,
        valorAnterior: 'Aprobado',
        valorNuevo: 'Ejecutado',
      },
    )
    await avisar(s.creadaPor, {
      clave: `des-${codigo}`,
      tipo: 'ok',
      titulo: `Despachado: ${s.numero}`,
      detalle: `${detalle}. Lo retiró ${retiro}.`,
      enlace: `/proyectos/bitacora?despacho=${codigo}`,
    })
    // Lo que bajó del mínimo puede crear su reposición (F3.4, F3.5)
    for (const { i } of elegidos) await revisarReposicion(i.id)
    const siguiente = despachosPorEntregar()[0]

    return HttpResponse.json(
      {
        codigo,
        fecha,
        solicitud: s.numero,
        solicitudId: s.id,
        proyecto: s.proyecto,
        proyectoId: idDe(s.proyecto),
        coordinador: coordinadorDe(s.proyecto),
        aprobadaEl,
        retiro,
        monto,
        lineas: elegidos.map(({ l, i, lote }) => ({
          insumo: i.nombre,
          unidad: i.unidad,
          cantidad: l.cantidad,
          lote: lote.codigo,
        })),
        siguiente: siguiente?.numero ?? null,
        siguienteId: siguiente?.id ?? null,
      },
      { status: 201 },
    )
  }),

  /** F6.3: la bitácora de los proyectos del coordinador (RN-07); el aprobador la ve completa. */
  http.get('/api/bitacora', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador', 'aprobador'])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const esCoordinador = quien.rol === 'coordinador'
    const mios = esCoordinador ? proyectosDe(quien.id).map((p) => p.codigo) : null
    const periodo = periodoEnCurso()
    const resaltado = url.searchParams.get('despacho')
    const linea = resaltado ? db.despachos.findFirst((q) => q.where({ codigo: resaltado })) : null
    let desde = url.searchParams.get('desde') || periodo?.inicio || dia(-30)
    const hasta = url.searchParams.get('hasta') || dia(0)
    // Un enlace a un despacho anterior al rango lo incluye
    if (linea && fechaIso(linea.fecha) < desde) desde = fechaIso(linea.fecha)
    const pedido = url.searchParams.get('proyectoId')
    const filtro = pedido ? proyectoPorId(pedido) : null
    if (pedido && !filtro) return error(404, PROYECTO_NO_EXISTE)
    const filtroProyecto = filtro?.codigo ?? null
    const q = (url.searchParams.get('q') ?? '').trim().toLowerCase()

    const filas = db.despachos
      .findMany((x) =>
        x.where({
          proyecto: (p) =>
            (mios ? p !== null && mios.includes(p) : true) && (!filtroProyecto || p === filtroProyecto),
        }),
      )
      .filter((d) => {
        const f = fechaIso(d.fecha)
        if (f < desde || f > hasta) return false
        return !q || insumo(d.insumoId).nombre.toLowerCase().includes(q)
      })
      .sort(
        (a, b) =>
          b.fecha.localeCompare(a.fecha) || b.codigo.localeCompare(a.codigo) || a.id.localeCompare(b.id),
      )
      .map((d) => {
        const i = insumo(d.insumoId)
        const corregidoPor = db.despachos.findFirst((x) =>
          x.where({ corrige: d.codigo, insumoId: d.insumoId, lote: d.lote }),
        )
        const pendiente = d.corrige ? null : correccionPendiente(d)
        return {
          id: d.id,
          codigo: d.codigo,
          fecha: d.fecha,
          proyecto: d.proyecto,
          proyectoId: idDe(d.proyecto),
          insumoId: i.id,
          insumo: i.nombre,
          unidad: i.unidad,
          lote: d.lote,
          cantidad: d.cantidad,
          retiro: d.retiro,
          corrige: d.corrige,
          aprobadaPor: d.corrige && d.registradoPor ? nombreUsuario(d.registradoPor) : null,
          corregidoPor: corregidoPor?.codigo ?? null,
          correccionPendiente: pendiente?.id ?? null,
          puedeCorregir:
            esCoordinador &&
            !d.corrige &&
            !corregidoPor &&
            !pendiente &&
            d.cantidad > 0 &&
            !periodoCerradoEn(d.fecha),
        }
      })

    return HttpResponse.json({
      desde,
      hasta,
      resaltado: linea ? resaltado : null,
      proyectos: (esCoordinador ? proyectosDe(quien.id) : db.proyectos.findMany())
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map(({ id, codigo, nombre }) => ({ id, codigo, nombre })),
      filas,
    })
  }),

  /** F6.5: el pedido queda pendiente en la bandeja del aprobador; el despacho original no cambia (RN-06). */
  http.post('/api/correcciones', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const c = (await request.json().catch(() => ({}))) as {
      lineaId?: string
      campo?: string
      cantidadNueva?: unknown
      proyectoNuevoId?: string
      motivo?: string
    }
    const mios = proyectosDe(quien.id).map((p) => p.codigo)
    const l = db.despachos.findFirst((q) => q.where({ id: String(c.lineaId ?? '') }))
    if (!l || !l.proyecto || !mios.includes(l.proyecto))
      return error(404, 'No encontramos ese despacho en tus proyectos.')
    if (l.corrige) return error(409, `${l.codigo} es un movimiento de corrección: no se corrige otra vez.`)
    const pendiente = correccionPendiente(l)
    if (pendiente)
      return error(409, `${l.codigo} ya tiene la corrección ${pendiente.id} esperando al aprobador.`)
    const cerrado = periodoCerradoEn(l.fecha)
    if (cerrado) return error(409, `${l.codigo} es de un período cerrado: ya no se corrige.`)

    const i = insumo(l.insumoId)
    const errores: Record<string, string> = {}
    const campo = c.campo === 'proyecto' ? 'proyecto' : c.campo === 'cantidad' ? 'cantidad' : null
    if (!campo) errores.campo = 'Elige qué está mal: la cantidad o el proyecto.'
    const cantidad = typeof c.cantidadNueva === 'number' ? c.cantidadNueva : NaN
    if (campo === 'cantidad') {
      if (!(cantidad >= 0)) errores.cantidadNueva = 'Escribe la cantidad correcta, 0 o más.'
      else if (redondear(cantidad) === l.cantidad) errores.cantidadNueva = 'Es la misma cantidad registrada.'
    }
    // El proyecto nuevo llega por su UUID; la corrección guarda el código, que es lo que se lee
    const destino = proyectoPorId(c.proyectoNuevoId)?.codigo ?? ''
    if (campo === 'proyecto') {
      if (!destino || !mios.includes(destino)) errores.proyectoNuevoId = 'Elige otro de tus proyectos.'
      else if (destino === l.proyecto) errores.proyectoNuevoId = 'Es el mismo proyecto registrado.'
    }
    const motivo = (c.motivo ?? '').trim().slice(0, 500)
    if (!motivo) errores.motivo = 'Escribe el motivo de la corrección. Sin motivo no se puede enviar.'
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const numeros = db.correcciones.findMany().map((x) => Number(x.id.replace('COR-', '')) || 0)
    const id = `COR-${String(Math.max(0, ...numeros) + 1).padStart(3, '0')}`
    const porCantidad = campo === 'cantidad'
    await db.correcciones.create({
      id,
      despacho: l.codigo,
      proyecto: l.proyecto,
      campo: campo!,
      insumoId: l.insumoId,
      lote: l.lote,
      valorOriginal: porCantidad ? legible(l.cantidad, i.unidad) : l.proyecto,
      valorNuevo: porCantidad ? legible(cantidad, i.unidad) : destino,
      cantidadNueva: porCantidad ? redondear(cantidad) : null,
      proyectoNuevo: porCantidad ? null : destino,
      motivo,
      estado: 'Pendiente',
      pedidaPor: quien.id,
      fecha: new Date().toISOString(),
    })
    await auditar(quien, 'creacion', `${quien.nombre} pidió la corrección ${id} de ${l.codigo}`, {
      entidad: `correccion:${id}`,
      justificacion: motivo,
      valorAnterior: porCantidad ? legible(l.cantidad, i.unidad) : l.proyecto,
      valorNuevo: porCantidad ? legible(cantidad, i.unidad) : destino,
    })
    for (const apr of db.usuarios.findMany((q) => q.where({ rol: 'aprobador', activo: true }))) {
      await avisar(apr.id, {
        clave: `cor-${id}`,
        tipo: 'info',
        titulo: `Corrección por decidir: ${id}`,
        detalle: `${l.codigo} de ${l.proyecto}: ${i.nombre}.`,
        enlace: `/bandeja?pedido=${id}`,
      })
    }
    return HttpResponse.json({ id, estado: 'Pendiente' }, { status: 201 })
  }),
]
