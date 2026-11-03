import { http, HttpResponse } from 'msw'
import { fechaIso } from '@/lib/formato'
import { insumo, periodoEnCurso, proyectosDe } from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Uso de materia prima (vista 20; F6.4; RN-07).
 *   GET  /api/usos-materia?proyecto&insumo&fecha    lo despachado y lo usado del insumo (mes de la fecha y período en revisión)
 *   POST /api/usos-materia                          { proyecto, insumoId, cantidad, fecha, observaciones }
 * El registro solo documenta el consumo; el stock ya bajó con el despacho (F6.2).
 */

const redondear = (n: number) => Math.round(n * 1000) / 1000

/** Primer y último día del mes de una fecha AAAA-MM-DD. */
function mesDe(fecha: string) {
  const [a, m] = fecha.split('-').map(Number)
  const fin = new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
  return { inicio: `${fecha.slice(0, 7)}-01`, fin }
}

/** Materia prima despachada alguna vez al proyecto (descontadas las correcciones). */
function insumosDespachados(proyecto: string) {
  const neto = new Map<string, number>()
  for (const d of db.despachos.findMany((q) => q.where({ proyecto }))) {
    neto.set(d.insumoId, (neto.get(d.insumoId) ?? 0) + d.cantidad)
  }
  return [...neto.entries()]
    .filter(([, n]) => n > 0)
    .map(([id]) => insumo(id))
    .filter((i) => i.tipo === 'Materia prima')
    .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

/**
 * Rango del balance: el mes de la fecha, empezando antes si el período contable en revisión empezó
 * antes (a comienzo de mes, el mes pasado todavía se está revisando: su consumo cuenta).
 */
function ventana(fecha: string) {
  const mes = mesDe(fecha)
  const p = periodoEnCurso()
  return { inicio: p && p.inicio < mes.inicio && fecha >= p.inicio ? p.inicio : mes.inicio, fin: mes.fin }
}

function balance(proyecto: string, insumoId: string, fecha: string) {
  const mes = ventana(fecha)
  const enMes = (f: string) => f >= mes.inicio && f <= mes.fin
  const despachado = db.despachos
    .findMany((q) => q.where({ proyecto, insumoId }))
    .filter((d) => enMes(fechaIso(d.fecha)))
    .reduce((t, d) => t + d.cantidad, 0)
  const usos = db.usosMateria
    .findMany((q) => q.where({ proyecto, insumoId }))
    .filter((u) => enMes(u.fecha))
    .sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id.localeCompare(a.id))
  return {
    mes,
    despachado: redondear(despachado),
    usado: redondear(usos.reduce((t, u) => t + u.cantidad, 0)),
    usos: usos.map(({ id, fecha: f, cantidad, observaciones }) => ({
      id,
      fecha: f,
      cantidad,
      observaciones,
    })),
  }
}

export const handlersUsosMateria = [
  http.get('/api/usos-materia', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const mios = proyectosDe(quien.id)
      .filter((p) => p.estatus !== 'Finalizado')
      .sort((a, b) => a.codigo.localeCompare(b.codigo))
    const pedido = url.searchParams.get('proyecto')
    const p = mios.find((x) => x.codigo === pedido) ?? mios[0]
    if (pedido && p?.codigo !== pedido) return error(404, `${pedido} no es uno de tus proyectos.`)
    const insumos = p ? insumosDespachados(p.codigo) : []
    const i = insumos.find((x) => x.id === url.searchParams.get('insumo')) ?? insumos[0]
    const fecha = url.searchParams.get('fecha') || dia(0)
    return HttpResponse.json({
      proyectos: mios.map(({ codigo, nombre }) => ({ codigo, nombre })),
      proyecto: p?.codigo ?? null,
      insumos: insumos.map(({ id, nombre, unidad }) => ({ id, nombre, unidad })),
      insumo: i?.id ?? null,
      ...(p && i
        ? balance(p.codigo, i.id, fecha)
        : { mes: ventana(fecha), despachado: 0, usado: 0, usos: [] }),
    })
  }),

  /** F6.4: si el uso supera lo despachado, se guarda igual; el aprobador verá la diferencia. */
  http.post('/api/usos-materia', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const c = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const codigo = typeof c.proyecto === 'string' ? c.proyecto : ''
    const p = proyectosDe(quien.id).find((x) => x.codigo === codigo && x.estatus !== 'Finalizado')
    if (!p) return errorValidacion({ proyecto: 'Elige uno de tus proyectos.' })
    const errores: Record<string, string> = {}
    const i = insumosDespachados(p.codigo).find((x) => x.id === c.insumoId)
    if (!i) errores.insumoId = 'Elige un insumo despachado a este proyecto.'
    const cantidad = typeof c.cantidad === 'number' ? c.cantidad : NaN
    if (!(cantidad > 0)) errores.cantidad = 'Escribe la cantidad usada, mayor que cero.'
    const fecha = typeof c.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.fecha) ? c.fecha : null
    if (!fecha) errores.fecha = 'Elige la fecha.'
    else if (fecha > dia(0)) errores.fecha = 'La fecha no puede ser posterior a hoy.'
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const observaciones =
      typeof c.observaciones === 'string' ? c.observaciones.trim().slice(0, 300) || null : null
    const id = `um-${Date.now()}`
    await db.usosMateria.create({
      id,
      proyecto: p.codigo,
      insumoId: i!.id,
      cantidad: redondear(cantidad),
      fecha: fecha!,
      observaciones,
      usuarioId: quien.id,
    })
    const b = balance(p.codigo, i!.id, fecha!)
    await auditar(quien, 'creacion', `${quien.nombre} registró el uso de ${i!.nombre} en ${p.codigo}`, {
      entidad: `proyecto:${p.codigo}`,
      detalle: `${String(redondear(cantidad)).replace('.', ',')} ${i!.unidad}${
        b.usado > b.despachado
          ? ` · supera lo despachado del mes en ${String(redondear(b.usado - b.despachado)).replace('.', ',')} ${i!.unidad}`
          : ''
      }`,
    })
    return HttpResponse.json({ id, ...b }, { status: 201 })
  }),
]
