import { http, HttpResponse } from 'msw'
import { alertasInventario, despachosPorEntregar, insumo, prioridadDe } from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { revisarReposicion } from '../reglas'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Almacén (paso 17; F6.1, F3.3; RN-02).
 *   GET  /api/almacen                  tareas del día: despachos por entregar, reposiciones por recibir,
 *                                      lotes por vencer o vencidos y las últimas recepciones
 *   GET  /api/recepciones/opciones     insumos, ubicaciones activas y reposiciones aprobadas
 *   POST /api/lotes                    registra la recepción: el stock sube en la misma operación (RNF-10)
 */

const num = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')
const redondear = (n: number) => Math.round(n * 1000) / 1000

function reposicionesAprobadas() {
  return db.solicitudes.findMany((q) => q.where({ tipo: 'reposicion', estado: 'Aprobado' }), {
    orderBy: { fecha: 'asc' },
  })
}

/** Si el insumo vence: true si sus lotes traen vencimiento, false si no, null si todavía no tiene lotes. */
function vence(insumoId: string) {
  const lotes = db.lotes.findMany((q) => q.where({ insumoId }))
  if (lotes.length === 0) return null
  return lotes.some((l) => l.vence !== null)
}

function siguienteCodigo() {
  const numeros = db.lotes.findMany().map((l) => Number(l.codigo.replace('L-', '')) || 0)
  return `L-${String(Math.max(0, ...numeros) + 1).padStart(4, '0')}`
}

const texto = (v: unknown) => (typeof v === 'string' ? v.trim() : '')
const fecha = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)

export const handlersAlmacen = [
  http.get('/api/almacen', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const alertas = alertasInventario()
    return HttpResponse.json({
      lotesPorVencer: alertas.porVencer.length,
      lotesVencidos: alertas.vencidos.length,
      despachos: despachosPorEntregar().map((s) => ({
        solicitud: s.id,
        proyecto: s.proyecto!,
        prioridad: prioridadDe(s.proyecto!),
        items: s.items,
        aprobadaEl: s.fecha,
      })),
      porRecibir: reposicionesAprobadas().map((r) => {
        const i = insumo(r.insumoId!)
        return {
          id: r.id,
          insumoId: i.id,
          insumo: i.nombre,
          cantidad: r.cantidad ?? 0,
          unidad: i.unidad,
          aprobadaEl: r.fecha,
        }
      }),
      recientes: db.lotes
        .findMany()
        .sort((a, b) => b.ingreso.localeCompare(a.ingreso) || b.codigo.localeCompare(a.codigo))
        .slice(0, 3)
        .map((l) => {
          const i = insumo(l.insumoId)
          return {
            codigo: l.codigo,
            insumoId: i.id,
            insumo: i.nombre,
            cantidad: l.cantidad,
            unidad: i.unidad,
            ingreso: l.ingreso,
            proveedor: l.proveedor,
          }
        }),
    })
  }),

  http.get('/api/recepciones/opciones', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    return HttpResponse.json({
      insumos: db.insumos
        .findMany()
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((i) => {
          const ultimo = db.lotes
            .findMany((q) => q.where({ insumoId: i.id }))
            .sort((a, b) => b.ingreso.localeCompare(a.ingreso))[0]
          return {
            id: i.id,
            nombre: i.nombre,
            unidad: i.unidad,
            stock: i.stock,
            stockMinimo: i.stockMinimo,
            vence: vence(i.id),
            ubicacionId: ultimo?.ubicacionId ?? null,
          }
        }),
      ubicaciones: db.ubicaciones
        .findMany((q) => q.where({ activa: true }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map(({ id, nombre }) => ({ id, nombre })),
      reposiciones: reposicionesAprobadas().map((r) => ({
        id: r.id,
        insumoId: r.insumoId!,
        cantidad: r.cantidad ?? 0,
      })),
    })
  }),

  /** F6.1 y HU-18: un lote vencido (o que vence antes de ingresar) no se registra. */
  http.post('/api/lotes', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const c = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const hoy = dia(0)
    const errores: Record<string, string> = {}

    const i = db.insumos.findFirst((q) => q.where({ id: texto(c.insumoId) }))
    if (!i) errores.insumoId = 'Elige el insumo.'
    const loteProveedor = texto(c.loteProveedor).slice(0, 40)
    if (!loteProveedor) errores.loteProveedor = 'Escribe el número de lote que trae el proveedor.'
    const cantidad = typeof c.cantidad === 'number' ? c.cantidad : NaN
    if (!(cantidad > 0)) errores.cantidad = 'Escribe la cantidad recibida, mayor que cero.'
    const costo = typeof c.costoUnitario === 'number' ? c.costoUnitario : NaN
    if (!(costo > 0)) errores.costoUnitario = 'Escribe el costo unitario, mayor que cero.'
    const proveedor = texto(c.proveedor).slice(0, 120)
    if (!proveedor) errores.proveedor = 'Escribe el proveedor.'
    const ingreso = fecha(c.ingreso)
    if (!ingreso) errores.ingreso = 'Elige la fecha de ingreso.'
    else if (ingreso > hoy) errores.ingreso = 'La fecha de ingreso no puede ser posterior a hoy.'
    const venceEl = c.vence === null || c.vence === '' ? null : fecha(c.vence)
    if (c.vence && !venceEl) errores.vence = 'Escribe una fecha de vencimiento válida.'
    else if (venceEl && venceEl < hoy) {
      errores.vence =
        'La fecha de vencimiento ya pasó. Un lote vencido no se registra: devuélvelo al proveedor.'
    } else if (venceEl && ingreso && venceEl < ingreso) {
      errores.vence = 'El vencimiento no puede ser anterior a la fecha de ingreso.'
    } else if (!venceEl && i && vence(i.id) === true) {
      errores.vence = `${i.nombre} vence: escribe la fecha de vencimiento del lote.`
    }
    const ubicacion = db.ubicaciones.findFirst((q) => q.where({ id: texto(c.ubicacionId), activa: true }))
    if (!ubicacion) errores.ubicacionId = 'Elige dónde se guarda el lote.'
    const solicitudId = texto(c.solicitud) || null
    const reposicion = solicitudId
      ? db.solicitudes.findFirst((q) => q.where({ id: solicitudId, tipo: 'reposicion', estado: 'Aprobado' }))
      : null
    if (solicitudId && !reposicion) errores.solicitud = `${solicitudId} ya no está aprobada por recibir.`
    else if (reposicion && i && reposicion.insumoId !== i.id) {
      errores.insumoId = `${reposicion.id} es de ${insumo(reposicion.insumoId!).nombre}: elige ese insumo.`
    }
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const repetido = db.lotes.findFirst((q) =>
      q.where({
        insumoId: i!.id,
        loteProveedor,
        proveedor: (p) => p.toLowerCase() === proveedor.toLowerCase(),
      }),
    )
    if (repetido) {
      return error(409, `El lote ${loteProveedor} de ${proveedor} ya se registró como ${repetido.codigo}.`)
    }

    const codigo = siguienteCodigo()
    const stockAntes = i!.stock
    await db.lotes.create({
      codigo,
      insumoId: i!.id,
      cantidad: redondear(cantidad),
      vence: venceEl,
      ubicacionId: ubicacion!.id,
      ingreso: ingreso!,
      costoUnitario: Math.round(costo * 100) / 100,
      proveedor,
      recibido: redondear(cantidad),
      loteProveedor,
      solicitud: reposicion?.id ?? null,
    })
    const editado = await db.insumos.update(i!, {
      data(x) {
        x.stock = redondear(x.stock + cantidad)
      },
    })
    await auditar(quien, 'creacion', `${quien.nombre} registró la recepción del lote ${codigo}`, {
      entidad: `lote:${codigo}`,
      detalle: `${i!.nombre}, ${num(cantidad)} ${i!.unidad} · ${proveedor} · lote ${loteProveedor}`,
    })
    if (reposicion) {
      await db.solicitudes.update(reposicion, {
        data(x) {
          x.estado = 'Ejecutado'
          x.fecha = new Date().toISOString()
        },
      })
      await auditar(
        quien,
        'cambio-estado',
        `${quien.nombre} recibió la reposición ${reposicion.id} con el lote ${codigo}`,
        {
          entidad: `solicitud:${reposicion.id}`,
          valorAnterior: 'Aprobado',
          valorNuevo: 'Ejecutado',
        },
      )
    }
    // Si sigue bajo el mínimo y ya no hay una reposición abierta, el sistema crea otra (F3.5)
    const nueva = await revisarReposicion(i!.id)
    return HttpResponse.json(
      {
        codigo,
        insumoId: i!.id,
        insumo: i!.nombre,
        unidad: i!.unidad,
        stockAntes,
        stockDespues: editado!.stock,
        stockMinimo: i!.stockMinimo,
        reposicion: reposicion?.id ?? null,
        nuevaReposicion: nueva,
      },
      { status: 201 },
    )
  }),
]
