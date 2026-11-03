import { http, HttpResponse } from 'msw'
import { diasHasta, nombreUsuario, parametro } from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { pronosticar } from '../pronostico'
import { revisarReposicion } from '../reglas'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Inventario (vista 09; F3.1, F3.4, F3.6; RN-02).
 *   GET  /api/insumos?q&tipo&ubicacion&alerta&pagina   catálogo con stock, lotes, vencimiento y estado
 *   GET  /api/insumos/exportar?…                       el mismo catálogo en CSV
 *   POST /api/insumos                                  alta (solo Administrador); nace con stock cero
 *   GET  /api/insumos/:id                              ficha (vista 10): lotes, último movimiento, reposición y pronóstico
 *   PATCH /api/insumos/:id/minimo                      cambiar el stock mínimo (solo Administrador, F3.2)
 * Lo consultan el Aprobador, el Administrador y el Coordinador (este último, solo para pedir retiros).
 * El estado de vencimiento se calcula al consultar, sin tarea diaria (F3.6).
 */

const POR_PAGINA = 20
const TIPOS = ['Materia prima', 'Consumible de proyecto', 'Consumible de uso general'] as const
/** Unidades de medida del catálogo; la interfaz muestra su nombre largo ("Litro (L)"). */
const UNIDADES = ['L', 'mL', 'g', 'kg', 'unidades', 'cajas', 'bolsas', 'rollos']
/** Orden de la tabla del mockup 09: bajo el mínimo, por vencer, vencido y al día. */
const ORDEN_ESTADO = { bajo: 0, vence: 1, vencido: 2, ok: 3 } as const

type Insumo = NonNullable<ReturnType<typeof db.insumos.findFirst>>
type Filtros = { q: string; tipo: string | null; ubicacion: string | null; alerta: string | null }

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const redondear = (n: number) => Math.round(n * 1000) / 1000

/** Stock, lotes con existencia, próximo vencimiento y estado de un insumo (F3.4, F3.6). */
function vista(i: Insumo) {
  const anticipacion = parametro('anticipacion_vencimiento_dias', 30)
  const lotes = db.lotes
    .findMany((q) => q.where({ insumoId: i.id, cantidad: (c) => c > 0 }))
    .map((l) => ({ ...l, dias: l.vence ? diasHasta(l.vence) : null }))
  const conFecha = lotes.filter((l) => l.vence !== null).sort((a, b) => a.vence!.localeCompare(b.vence!))
  const vencidos = conFecha.filter((l) => l.dias! < 0).length
  const porVencer = conFecha.filter((l) => l.dias! >= 0 && l.dias! <= anticipacion).length
  const bajo = i.stock < i.stockMinimo
  // El chip muestra lo más grave: un faltante, luego un lote que ya no se puede despachar.
  const estado: keyof typeof ORDEN_ESTADO = bajo ? 'bajo' : vencidos ? 'vencido' : porVencer ? 'vence' : 'ok'
  const proximo = conFecha[0]
  return {
    id: i.id,
    nombre: i.nombre,
    unidad: i.unidad,
    tipo: i.tipo,
    stock: i.stock,
    stockMinimo: i.stockMinimo,
    lotes: lotes.length,
    proximoVencimiento: proximo ? { fecha: proximo.vence!, dias: proximo.dias! } : null,
    vencidos,
    porVencer,
    estado,
  }
}

type Vista = ReturnType<typeof vista>

function leerFiltros(url: URL): Filtros {
  return {
    q: normalizar(url.searchParams.get('q')?.trim() ?? ''),
    tipo: url.searchParams.get('tipo'),
    ubicacion: url.searchParams.get('ubicacion'),
    alerta: url.searchParams.get('alerta'),
  }
}

function filtrar(f: Filtros) {
  return db.insumos
    .findMany()
    .filter((i) => {
      if (f.tipo && i.tipo !== f.tipo) return false
      const lotes = db.lotes.findMany((q) => q.where({ insumoId: i.id }))
      if (f.ubicacion && !lotes.some((l) => l.ubicacionId === f.ubicacion && l.cantidad > 0)) return false
      if (!f.q) return true
      // Por nombre o por número de lote (mockup 09)
      return normalizar(i.nombre).includes(f.q) || lotes.some((l) => normalizar(l.codigo).includes(f.q))
    })
    .map(vista)
    .filter((v) => {
      if (f.alerta === 'minimo') return v.estado === 'bajo'
      if (f.alerta === 'vencimiento') return v.porVencer > 0
      if (f.alerta === 'vencido') return v.vencidos > 0
      return true
    })
    .sort((a, b) => ORDEN_ESTADO[a.estado] - ORDEN_ESTADO[b.estado] || a.nombre.localeCompare(b.nombre, 'es'))
}

/** Las tres tarjetas de arriba: siempre del inventario completo, no de los filtros. */
function alertas() {
  const todos = db.insumos.findMany().map(vista)
  return {
    bajoMinimo: todos.filter((v) => v.estado === 'bajo').length,
    porVencer: todos.reduce((t, v) => t + v.porVencer, 0),
    vencidos: todos.reduce((t, v) => t + v.vencidos, 0),
  }
}

const LEER = ['aprobador', 'administrador', 'coordinador'] as const

export const handlersInventario = [
  http.get('/api/insumos', async ({ request }) => {
    await demora()
    const quien = exigir(request, [...LEER])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const lista = filtrar(leerFiltros(url))
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
    const pagina = Math.min(Math.max(1, Number(url.searchParams.get('pagina')) || 1), paginas)
    return HttpResponse.json({
      items: lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA),
      total: lista.length,
      pagina,
      paginas,
      porPagina: POR_PAGINA,
      alertas: alertas(),
      anticipacion: parametro('anticipacion_vencimiento_dias', 30),
      // Para el filtro de ubicación: las activas, como en el mockup
      ubicaciones: db.ubicaciones
        .findMany((q) => q.where({ activa: true }))
        .map(({ id, nombre }) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    })
  }),

  http.get('/api/insumos/exportar', async ({ request }) => {
    await demora()
    const quien = exigir(request, [...LEER])
    if (quien instanceof Response) return quien
    const filas = filtrar(leerFiltros(new URL(request.url)))
    const ESTADO = {
      bajo: 'Bajo el mínimo',
      vence: 'Lote próximo a vencer',
      vencido: 'Lote vencido',
      ok: 'Al día',
    }
    const num = (n: number) => String(n).replace('.', ',')
    const celda = (v: string | number | null) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const csv = [
      ['Insumo', 'Tipo', 'Unidad', 'Stock', 'Stock mínimo', 'Lotes', 'Próximo vencimiento', 'Estado'],
      ...filas.map((v: Vista) => [
        v.nombre,
        v.tipo,
        v.unidad,
        num(v.stock),
        num(v.stockMinimo),
        v.lotes,
        v.proximoVencimiento?.fecha ?? '',
        ESTADO[v.estado],
      ]),
    ]
      .map((fila) => fila.map(celda).join(';'))
      .join('\r\n')
    return new HttpResponse(`${String.fromCharCode(0xfeff)}${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="inventario-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }),

  /**
   * F3.1 y F3.2: alta con tipo, unidad y stock mínimo. Nace con stock cero, así que queda bajo su mínimo
   * y entra de una vez a la regla de reposición (F3.4, F3.5).
   */
  http.post('/api/insumos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const cuerpo = (await request.json().catch(() => ({}))) as Record<string, unknown>
    const nombre = typeof cuerpo.nombre === 'string' ? cuerpo.nombre.trim() : ''
    const unidad = typeof cuerpo.unidad === 'string' ? cuerpo.unidad : ''
    const tipo = typeof cuerpo.tipo === 'string' ? cuerpo.tipo : ''
    const minimo = typeof cuerpo.stockMinimo === 'number' ? cuerpo.stockMinimo : NaN

    const errores: Record<string, string> = {}
    if (nombre.length < 3) errores.nombre = 'Escribe el nombre del insumo.'
    else if (nombre.length > 120) errores.nombre = 'Usa como máximo 120 caracteres.'
    if (!UNIDADES.includes(unidad)) errores.unidad = 'Elige la unidad de medida.'
    if (!(minimo > 0)) errores.stockMinimo = 'Escribe un número mayor que cero.'
    if (!TIPOS.includes(tipo as (typeof TIPOS)[number])) errores.tipo = 'Elige el tipo de insumo.'
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    // F3.1: no puede haber dos insumos con el mismo nombre y la misma unidad
    const repetido = db.insumos.findFirst((q) =>
      q.where((i) => i.unidad === unidad && normalizar(i.nombre) === normalizar(nombre)),
    )
    if (repetido) {
      return HttpResponse.json(
        {
          detail: {
            mensaje: `Ya existe ${repetido.nombre} en ${unidad}.`,
            insumo: { id: repetido.id, nombre: repetido.nombre, unidad: repetido.unidad },
          },
        },
        { status: 409 },
      )
    }

    const nuevo = await db.insumos.create({
      id: `ins-${Date.now()}`,
      nombre,
      unidad,
      tipo: tipo as (typeof TIPOS)[number],
      stockMinimo: redondear(minimo),
      stock: 0,
    })
    await auditar(quien, 'creacion', `${quien.nombre} registró el insumo ${nombre} (${unidad})`, {
      entidad: `insumo:${nuevo.id}`,
      valorNuevo: `${tipo}; mínimo ${String(redondear(minimo)).replace('.', ',')} ${unidad}`,
    })
    const reposicion = await revisarReposicion(nuevo.id)
    return HttpResponse.json({ insumo: vista(nuevo), reposicion }, { status: 201 })
  }),
]

// ---------- Ficha del insumo (vista 10) ----------

/** AAAA-MM del mes que está n meses antes del actual. */
function mes(atras: number) {
  const [a, m] = dia(0).split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 - atras, 1)).toISOString().slice(0, 7)
}

/**
 * F3.7: consumo de cada mes completo desde el primer despacho hasta el mes pasado, y el pronóstico del
 * mes en curso si hay al menos los meses que pide F1.5.
 */
export function pronosticoDe(insumoId: string) {
  const requeridos = parametro('meses_minimos_pronostico', 6)
  const lineas = db.despachos.findMany((q) => q.where({ insumoId }))
  const actual = mes(0)
  const porMes = new Map<string, number>()
  for (const l of lineas) {
    const m = l.fecha.slice(0, 7)
    if (m < actual) porMes.set(m, (porMes.get(m) ?? 0) + l.cantidad)
  }
  const primero = [...porMes.keys()].sort()[0]
  const historial: { mes: string; consumo: number }[] = []
  if (primero) {
    for (let atras = 1; mes(atras) >= primero; atras++) {
      historial.unshift({ mes: mes(atras), consumo: redondear(porMes.get(mes(atras)) ?? 0) })
    }
  }
  const suficiente = historial.length >= requeridos
  return {
    mes: actual,
    historial,
    meses: historial.length,
    requeridos,
    metodo: 'Holt-Winters',
    ...(suficiente
      ? pronosticar(historial.map((h) => h.consumo))
      : { valor: null, minimo: null, maximo: null }),
  }
}

/** El movimiento más reciente: un despacho de la bitácora o la recepción de un lote. */
function ultimoMovimiento(insumoId: string) {
  const despacho = db.despachos
    .findMany((q) => q.where({ insumoId }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  const recepcion = db.lotes
    .findMany((q) => q.where({ insumoId }))
    .sort((a, b) => b.ingreso.localeCompare(a.ingreso))[0]
  if (recepcion && (!despacho || recepcion.ingreso > despacho.fecha.slice(0, 10))) {
    return {
      tipo: 'recepcion' as const,
      fecha: recepcion.ingreso,
      cantidad: null,
      proyecto: null,
      lote: recepcion.codigo,
      codigo: null,
    }
  }
  if (!despacho) return null
  return {
    tipo: 'despacho' as const,
    fecha: despacho.fecha,
    cantidad: despacho.cantidad,
    proyecto: despacho.proyecto,
    lote: despacho.lote,
    codigo: despacho.codigo,
  }
}

const ABIERTA = ['Borrador', 'Pendiente de Aprobación', 'Aprobado']

function ficha(i: Insumo) {
  const anticipacion = parametro('anticipacion_vencimiento_dias', 30)
  const lotes = db.lotes
    .findMany((q) => q.where({ insumoId: i.id, cantidad: (c) => c > 0 }))
    .sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999'))
  const ubicaciones = [...new Set(lotes.map((l) => l.ubicacionId))].map(
    (id) => db.ubicaciones.findFirst((q) => q.where({ id }))?.nombre ?? id,
  )
  const reposicion = db.solicitudes
    .findMany((q) => q.where({ tipo: 'reposicion', insumoId: i.id, estado: (e) => ABIERTA.includes(e) }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
  return {
    ...vista(i),
    anticipacion,
    ubicaciones,
    lotes: lotes.map((l) => ({
      codigo: l.codigo,
      ingreso: l.ingreso,
      vence: l.vence,
      dias: l.vence ? diasHasta(l.vence) : null,
      cantidad: l.cantidad,
      costoUnitario: l.costoUnitario,
      proveedor: l.proveedor,
    })),
    ultimoMovimiento: ultimoMovimiento(i.id),
    reposicion: reposicion
      ? {
          id: reposicion.id,
          estado: reposicion.estado,
          cantidad: reposicion.cantidad,
          fecha: reposicion.fecha,
          decididaPor: reposicion.decididaPor ? nombreUsuario(reposicion.decididaPor) : null,
        }
      : null,
    pronostico: pronosticoDe(i.id),
  }
}

handlersInventario.push(
  http.get('/api/insumos/:id', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador', 'administrador'])
    if (quien instanceof Response) return quien
    const i = db.insumos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!i)
      return error(404, 'No encontramos ese insumo. Puede que el enlace esté mal: búscalo en el inventario.')
    return HttpResponse.json(ficha(i))
  }),

  /** F3.2: solo el Administrador. Si el stock ya está bajo el nuevo mínimo, la alerta y la reposición aparecen de inmediato (HU-07). */
  http.patch('/api/insumos/:id/minimo', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const i = db.insumos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!i) return error(404, 'No encontramos ese insumo.')
    const { stockMinimo } = (await request.json().catch(() => ({}))) as { stockMinimo?: unknown }
    if (typeof stockMinimo !== 'number' || !(stockMinimo > 0)) {
      return errorValidacion({ stockMinimo: 'Escribe un número mayor que cero.' })
    }
    const nuevo = redondear(stockMinimo)
    const anterior = i.stockMinimo
    await db.insumos.update(i, {
      data(x) {
        x.stockMinimo = nuevo
      },
    })
    const num = (n: number) => `${String(n).replace('.', ',')} ${i.unidad}`
    await auditar(
      quien,
      'edicion',
      `${quien.nombre} cambió el stock mínimo de ${i.nombre} de ${num(anterior)} a ${num(nuevo)}`,
      {
        entidad: `insumo:${i.id}`,
        valorAnterior: num(anterior),
        valorNuevo: num(nuevo),
      },
    )
    const reposicion = await revisarReposicion(i.id)
    return HttpResponse.json({ stockMinimo: nuevo, reposicion })
  }),
)
