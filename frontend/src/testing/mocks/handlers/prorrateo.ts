import { http, HttpResponse } from 'msw'
import { diaYFecha, fechaCorta, moneda, nombreMes } from '@/lib/formato'
import {
  cargosDelPeriodo,
  nombreUsuario,
  periodoEnCurso,
  proyectosActivos,
  proyecto,
  proyectosDe,
  resumenCargos,
} from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { avisar, registrarCargo } from '../reglas'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Cierre de período y reparto de gastos compartidos (M7; vistas 21 y 22; F7.1, F7.2).
 *   GET  /api/periodos/actual                       el período en revisión (encabezado y avisos)
 *   GET  /api/cierre/cargos?proyecto                 Coordinador: los cargos de sus proyectos en el período
 *   POST /api/cierre/confirmaciones                  { proyecto }: confirma la lista completa (F7.1)
 *   GET  /api/cierre                                 Aprobador: el tablero de confirmaciones
 *   POST /api/periodos                               { tipo, inicio, fin }: abre la revisión (F7.1)
 *   POST /api/periodos/:id/recordatorios             recordatorio a quienes no confirmaron
 *   POST /api/periodos/:id/cerrar                    cierra el período (F7.2)
 *   GET  /api/reparto                                el período cerrado por repartir, con los dos criterios (F7.3, F7.4)
 *   POST /api/periodos/:id/reparto                   { criterio }: aplica el reparto elegido
 */

type Periodo = NonNullable<ReturnType<typeof periodoEnCurso>>

const nombrePeriodo = (p: { tipo: string; inicio: string }) =>
  p.tipo === 'mensual'
    ? `${nombreMes(p.inicio)} de ${p.inicio.slice(0, 4)}`
    : `el trimestre que empieza el ${fechaCorta(p.inicio)}`

/** Correcciones de despachos del proyecto que esperan al aprobador (no se confirma mientras haya una). */
function correccionesPendientes(codigo: string) {
  return db.correcciones.findMany((q) => q.where({ proyecto: codigo, estado: 'Pendiente' }))
}

function resumenPeriodo(p: Periodo) {
  return {
    id: p.id,
    tipo: p.tipo,
    inicio: p.inicio,
    fin: p.fin,
    estado: p.estado,
    abiertoEl: p.abiertoEl,
    abiertoPor: p.abiertoPor ? nombreUsuario(p.abiertoPor) : null,
  }
}

/** Estado de un proyecto en el tablero (mockup 22). */
function estadoConfirmacion(c: { proyecto: string; confirmado: boolean }) {
  if (c.confirmado) return 'confirmado' as const
  if (!proyecto(c.proyecto)?.coordinadorId) return 'sin-coordinador' as const
  if (correccionesPendientes(c.proyecto).length > 0) return 'correccion' as const
  return 'por-confirmar' as const
}

/** Coordinadores con proyectos sin confirmar (a quienes llega el recordatorio). */
function coordinadoresPendientes(periodoId: string) {
  const coordinadores = new Map<string, string[]>()
  for (const c of db.confirmaciones.findMany((q) => q.where({ periodoId, confirmado: false }))) {
    const id = proyecto(c.proyecto)?.coordinadorId
    if (id) coordinadores.set(id, [...(coordinadores.get(id) ?? []), c.proyecto])
  }
  return coordinadores
}

export const handlersProrrateo = [
  http.get('/api/periodos/actual', async ({ request }) => {
    await demora()
    const usuario = exigir(request)
    if (usuario instanceof Response) return usuario
    return HttpResponse.json(periodoEnCurso())
  }),

  /** F7.1 (Coordinador): los gastos y despachos de cada proyecto suyo en el período; RN-07. */
  http.get('/api/cierre/cargos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const p = periodoEnCurso()
    if (!p)
      return HttpResponse.json({ periodo: null, cierra: null, proyectos: [], proyecto: null, cargos: [] })
    const mios = proyectosDe(quien.id).map((x) => x.codigo)
    const confirmaciones = db.confirmaciones
      .findMany((q) => q.where({ periodoId: p.id, proyecto: (x) => mios.includes(x) }))
      .sort((a, b) => a.proyecto.localeCompare(b.proyecto))
    const proyectos = confirmaciones.map((c) => ({
      codigo: c.proyecto,
      estado: estadoConfirmacion(c),
      confirmadoEl: c.confirmadoEl,
      correcciones: correccionesPendientes(c.proyecto).map((x) => x.id),
      ...resumenCargos(p, c.proyecto),
    }))
    const pedido = new URL(request.url).searchParams.get('proyecto')
    const elegido =
      proyectos.find((x) => x.codigo === pedido) ??
      proyectos.find((x) => x.estado !== 'confirmado') ??
      proyectos[0] ??
      null
    return HttpResponse.json({
      periodo: resumenPeriodo(p),
      // Quien cierra: el aprobador que abrió la revisión
      cierra: p.abiertoPor ? nombreUsuario(p.abiertoPor) : null,
      proyectos,
      proyecto: elegido?.codigo ?? null,
      cargos: elegido
        ? cargosDelPeriodo(p, elegido.codigo).map((c) => ({
            id: c.id,
            fecha: c.fecha,
            concepto: c.concepto,
            referencia: c.referencia,
            tipo: c.tipo,
            monto: c.monto,
          }))
        : [],
    })
  }),

  /** F7.1: el coordinador confirma la lista completa de un proyecto suyo. */
  http.post('/api/cierre/confirmaciones', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const { proyecto: codigo } = (await request.json().catch(() => ({}))) as { proyecto?: string }
    const p = periodoEnCurso()
    if (!p) return error(409, 'No hay un período en revisión.')
    if (!proyectosDe(quien.id).some((x) => x.codigo === codigo)) return error(404, 'Ese proyecto no es tuyo.')
    const c = db.confirmaciones.findFirst((q) => q.where({ periodoId: p.id, proyecto: codigo }))
    if (!c) return error(404, `${codigo} no tiene cargos que revisar en este período.`)
    if (c.confirmado) return error(409, `Ya confirmaste los cargos de ${codigo}.`)
    const pendientes = correccionesPendientes(codigo!)
    if (pendientes.length > 0) {
      return error(409, `${pendientes[0].id} espera la decisión del aprobador: confirma cuando la decida.`)
    }
    const r = resumenCargos(p, codigo!)
    const ahora = new Date().toISOString()
    await db.confirmaciones.update(c, {
      data(x) {
        x.confirmado = true
        x.confirmadoEl = ahora
        x.confirmadoPor = quien.id
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} confirmó los cargos de ${codigo} de ${nombrePeriodo(p)}`,
      {
        entidad: `proyecto:${codigo}`,
        detalle: `${r.cargos} cargos · US$ ${r.monto.toFixed(2).replace('.', ',')}`,
        valorAnterior: 'Por confirmar',
        valorNuevo: 'Confirmado',
      },
    )
    return HttpResponse.json({ proyecto: codigo, confirmadoEl: ahora, ...r })
  }),

  /** Tablero del aprobador (mockup 22). Sin período en revisión, el paso 1: abrir la siguiente. */
  http.get('/api/cierre', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const p = periodoEnCurso()
    const cerrados = db.periodos
      .findMany((q) => q.where({ estado: (e) => e === 'cerrado' || e === 'prorrateado' }))
      .sort((a, b) => b.fin.localeCompare(a.fin))
    const porRepartir = cerrados.find((x) => x.estado === 'cerrado') ?? null
    const ultimo = cerrados[0] ?? null
    return HttpResponse.json({
      periodo: p ? resumenPeriodo(p) : null,
      filas: p
        ? db.confirmaciones
            .findMany((q) => q.where({ periodoId: p.id }))
            .map((c) => {
              const pr = proyecto(c.proyecto)
              return {
                proyecto: c.proyecto,
                coordinador: pr?.coordinadorId ? nombreUsuario(pr.coordinadorId) : null,
                estado: estadoConfirmacion(c),
                confirmadoEl: c.confirmadoEl,
                ...resumenCargos(p, c.proyecto),
              }
            })
            // Primero los confirmados (del más antiguo), después los que faltan
            .sort(
              (a, b) =>
                Number(b.estado === 'confirmado') - Number(a.estado === 'confirmado') ||
                (a.confirmadoEl ?? '').localeCompare(b.confirmadoEl ?? '') ||
                a.proyecto.localeCompare(b.proyecto),
            )
        : [],
      coordinadoresPendientes: p ? coordinadoresPendientes(p.id).size : 0,
      porRepartir: porRepartir
        ? { id: porRepartir.id, tipo: porRepartir.tipo, inicio: porRepartir.inicio, fin: porRepartir.fin }
        : null,
      // Para abrir la siguiente revisión: empieza el día después del último período cerrado
      sugerido: ultimo ? siguienteMes(ultimo.fin) : null,
    })
  }),

  /** F7.1: abre la revisión. El rango no puede cruzarse con otro período; si se cruza, no se envía nada. */
  http.post('/api/periodos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    if (periodoEnCurso()) return error(409, 'Ya hay un período en revisión: ciérralo antes de abrir otro.')
    const c = (await request.json().catch(() => ({}))) as { tipo?: string; inicio?: string; fin?: string }
    const fecha = (v?: string) => (v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
    const tipo = c.tipo === 'trimestral' ? 'trimestral' : c.tipo === 'mensual' ? 'mensual' : null
    const inicio = fecha(c.inicio)
    const fin = fecha(c.fin)
    const errores: Record<string, string> = {}
    if (!tipo) errores.tipo = 'Elige si el período es mensual o trimestral.'
    if (!inicio) errores.inicio = 'Elige la fecha de inicio.'
    if (!fin) errores.fin = 'Elige la fecha de fin.'
    else if (inicio && fin < inicio) errores.fin = 'El fin tiene que ser después del inicio.'
    if (Object.keys(errores).length > 0) return errorValidacion(errores)

    const cruce = db.periodos.findMany().find((x) => x.inicio <= fin! && x.fin >= inicio!)
    if (cruce) {
      const siguiente = siguienteMes(cruce.fin).inicio
      return HttpResponse.json(
        {
          detail: {
            mensaje: `Se cruza con el período cerrado de ${nombrePeriodo(cruce)} (${fechaCorta(cruce.inicio)} al ${fechaCorta(cruce.fin)}). Empieza el período el ${fechaCorta(siguiente)} o después.`,
            periodo: { inicio: cruce.inicio, fin: cruce.fin },
          },
        },
        { status: 409 },
      )
    }

    const id = `per-${inicio}`
    const ahora = new Date().toISOString()
    await db.periodos.create({
      id,
      tipo: tipo!,
      inicio: inicio!,
      fin: fin!,
      estado: 'en_revision',
      abiertoEl: ahora,
      abiertoPor: quien.id,
      cerradoEl: null,
      cerradoPor: null,
    })
    const nuevo = db.periodos.findFirst((q) => q.where({ id }))!
    for (const pr of proyectosActivos()) {
      await db.confirmaciones.create({
        periodoId: id,
        proyecto: pr.codigo,
        confirmado: false,
        confirmadoEl: null,
        confirmadoPor: null,
      })
      await avisar(pr.coordinadorId, {
        clave: `per-${id}-${pr.codigo}`,
        tipo: 'warn',
        titulo: `Revisa los cargos de ${pr.codigo}`,
        detalle: `Se abrió la revisión de ${nombrePeriodo(nuevo)}. Confírmalos antes del cierre.`,
        enlace: `/cierre/cargos?proyecto=${pr.codigo}`,
      })
    }
    await auditar(quien, 'creacion', `${quien.nombre} abrió la revisión de ${nombrePeriodo(nuevo)}`, {
      entidad: `periodo:${id}`,
      detalle: `${fechaCorta(inicio!)} al ${fechaCorta(fin!)}`,
      valorNuevo: 'en_revision',
    })
    return HttpResponse.json(resumenPeriodo(nuevo), { status: 201 })
  }),

  /** Recordatorio a los coordinadores que no confirmaron sus cargos (F7.1, L7). Llega a su bandeja de avisos. */
  http.post('/api/periodos/:id/recordatorios', async ({ request, params }) => {
    await demora()
    const usuario = exigir(request, ['aprobador'])
    if (usuario instanceof Response) return usuario
    const periodo = db.periodos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!periodo) return error(404, 'Ese período no existe.')
    if (periodo.estado !== 'en_revision' && periodo.estado !== 'abierto') {
      return error(409, 'El período ya se cerró: no quedan cargos por confirmar.')
    }

    const pendientes = db.confirmaciones.findMany((q) =>
      q.where({ periodoId: periodo.id, confirmado: false }),
    )
    const coordinadores = coordinadoresPendientes(periodo.id)
    const ahora = new Date().toISOString()
    let n = 0
    for (const [coordinadorId, proyectos] of coordinadores) {
      n += 1
      await db.avisos.create({
        id: `av-rec-${Date.now()}-${n}`,
        usuarioId: coordinadorId,
        tipo: 'warn',
        titulo: `Recordatorio: confirma los cargos de ${proyectos.join(', ')}`,
        detalle:
          periodo.fin < dia(0)
            ? `El aprobador cierra ${nombrePeriodo(periodo)} en cuanto confirmen todos.`
            : `El período cierra el ${diaYFecha(periodo.fin)}.`,
        enlace: `/cierre/cargos?proyecto=${proyectos[0]}`,
        fecha: ahora,
        leido: false,
      })
    }
    return HttpResponse.json({
      enviados: coordinadores.size,
      sinCoordinador: pendientes.length - [...coordinadores.values()].flat().length,
    })
  }),

  /**
   * F7.2: el período cerrado ya no admite despachos, gastos ni correcciones con fecha en su rango, y
   * queda listo para el reparto. Se puede cerrar sin todas las confirmaciones (SP-08, resuelto); el
   * registro guarda cuántas faltaban.
   */
  http.post('/api/periodos/:id/cerrar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const p = db.periodos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!p) return error(404, 'Ese período no existe.')
    if (p.estado !== 'en_revision' && p.estado !== 'abierto')
      return error(409, 'Ese período ya está cerrado.')
    const faltan = db.confirmaciones.findMany((q) => q.where({ periodoId: p.id, confirmado: false }))
    const ahora = new Date().toISOString()
    await db.periodos.update(p, {
      data(x) {
        x.estado = 'cerrado'
        x.cerradoEl = ahora
        x.cerradoPor = quien.id
      },
    })
    await auditar(quien, 'cambio-estado', `${quien.nombre} cerró el período de ${nombrePeriodo(p)}`, {
      entidad: `periodo:${p.id}`,
      detalle:
        faltan.length > 0
          ? `Sin confirmar: ${faltan.map((c) => c.proyecto).join(', ')}`
          : 'Todos los proyectos confirmaron sus cargos',
      valorAnterior: p.estado,
      valorNuevo: 'cerrado',
    })
    return HttpResponse.json({ ...resumenPeriodo({ ...p, estado: 'cerrado' }), faltan: faltan.length })
  }),

  /** F7.3, F7.4: el período cerrado más antiguo sin repartir, con los dos criterios calculados. */
  http.get('/api/reparto', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const p =
      db.periodos
        .findMany((q) => q.where({ estado: 'cerrado' }))
        .sort((a, b) => a.fin.localeCompare(b.fin))[0] ?? null
    const hecho = db.repartos.findMany().sort((a, b) => b.aplicadoEl.localeCompare(a.aplicadoEl))[0]
    const delHecho = hecho ? db.periodos.findFirst((q) => q.where({ id: hecho.periodoId })) : null
    return HttpResponse.json({
      periodo: p ? { id: p.id, tipo: p.tipo, inicio: p.inicio, fin: p.fin, cerradoEl: p.cerradoEl } : null,
      ultimo:
        hecho && delHecho
          ? {
              periodo: { id: delHecho.id, tipo: delHecho.tipo, inicio: delHecho.inicio, fin: delHecho.fin },
              criterio: hecho.criterio,
              total: hecho.total,
              aplicadoEl: hecho.aplicadoEl,
              aplicadoPor: nombreUsuario(hecho.aplicadoPor),
            }
          : null,
      // Los suspendidos no participan (RN-05)
      excluidos: db.proyectos
        .findMany((q) => q.where({ estatus: 'Suspendido' }))
        .map((x) => x.codigo)
        .sort(),
      ...(p ? calcularReparto(p) : { gastos: null, consumoTotal: 0, filas: [], residuo: null }),
    })
  }),

  /** Aplica el criterio elegido: cada monto entra al gasto ejecutado de su proyecto (F2.7) y no se repite. */
  http.post('/api/periodos/:id/reparto', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const p = db.periodos.findFirst((q) => q.where({ id: String(params.id) }))
    if (!p) return error(404, 'Ese período no existe.')
    if (p.estado === 'prorrateado') {
      return error(409, `Los gastos compartidos de ${nombrePeriodo(p)} ya se repartieron.`)
    }
    if (p.estado !== 'cerrado') return error(409, `Cierra ${nombrePeriodo(p)} antes de repartir sus gastos.`)
    const { criterio } = (await request.json().catch(() => ({}))) as { criterio?: string }
    if (criterio !== 'consumo' && criterio !== 'iguales') {
      return errorValidacion({ criterio: 'Elige cómo repartir los gastos compartidos.' })
    }
    const r = calcularReparto(p)
    if (criterio === 'consumo' && r.consumoTotal <= 0) {
      return error(409, 'Ningún proyecto activo consumió en el período: repártelo en partes iguales.')
    }
    const filas = r.filas.map((f) => ({
      proyecto: f.proyecto,
      consumo: f.consumo,
      porcentaje: Math.round(f.porcentaje * 10) / 10,
      monto: (criterio === 'consumo' ? f.segunConsumo : f.enPartesIguales) ?? 0,
    }))
    const mes =
      p.tipo === 'mensual' ? nombreMes(p.inicio) : `el trimestre que terminó el ${fechaCorta(p.fin)}`
    for (const f of filas.filter((x) => x.monto > 0)) {
      await registrarCargo({
        proyecto: f.proyecto,
        tipo: 'compartido',
        concepto: `Gastos compartidos de ${mes}`,
        referencia: null,
        monto: f.monto,
      })
      await avisar(proyecto(f.proyecto)?.coordinadorId ?? null, {
        clave: `rep-${p.id}-${f.proyecto}`,
        tipo: 'info',
        titulo: `Se cargaron ${moneda(f.monto)} de gastos compartidos a ${f.proyecto}`,
        detalle: `Reparto de ${nombrePeriodo(p)}, ${CRITERIO[criterio]}.`,
        enlace: `/proyectos/${f.proyecto}`,
      })
    }
    await db.repartos.create({
      periodoId: p.id,
      criterio,
      total: r.gastos.total,
      aplicadoEl: new Date().toISOString(),
      aplicadoPor: quien.id,
      filas,
    })
    await db.periodos.update(p, {
      data(x) {
        x.estado = 'prorrateado'
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} repartió los gastos compartidos de ${nombrePeriodo(p)} ${CRITERIO[criterio]}`,
      {
        entidad: `periodo:${p.id}`,
        detalle: `${moneda(r.gastos.total)} entre ${filas.length} proyectos activos`,
        valorAnterior: 'cerrado',
        valorNuevo: 'prorrateado',
      },
    )
    return HttpResponse.json({ periodoId: p.id, criterio, total: r.gastos.total, filas })
  }),
]

type Rango = { inicio: string; fin: string }
const redondear = (n: number) => Math.round(n * 100) / 100
const CRITERIO = { consumo: 'según el consumo', iguales: 'en partes iguales' } as const

/**
 * Gastos compartidos del período: el costo de los lotes de consumibles de uso general (RN-02).
 * Entran los lotes recibidos en el rango (SP-09, resuelto).
 */
function gastosCompartidos(p: Rango) {
  const generales = new Map(
    db.insumos
      .findMany((q) => q.where({ tipo: 'Consumible de uso general' }))
      .map((i) => [i.id, i.nombre] as const),
  )
  const lotes = db.lotes
    .findMany((q) =>
      q.where({ insumoId: (id) => generales.has(id), ingreso: (f) => f >= p.inicio && f <= p.fin }),
    )
    .sort((a, b) => a.ingreso.localeCompare(b.ingreso))
  return {
    total: redondear(lotes.reduce((t, l) => t + l.recibido * l.costoUnitario, 0)),
    lotes: lotes.length,
    insumos: [...new Set(lotes.map((l) => generales.get(l.insumoId)!))],
  }
}

/**
 * Reparte el total según los pesos, en centavos hacia abajo. El residuo del redondeo va al primero, el
 * proyecto de código menor (F7.4).
 */
function repartir(total: number, pesos: number[]) {
  const montos = pesos.map((w) => Math.floor(total * w * 100 + 1e-6) / 100)
  const resto = redondear(total - montos.reduce((t, m) => t + m, 0))
  if (montos.length > 0) montos[0] = redondear(montos[0] + resto)
  return { montos, resto }
}

/** Los dos repartos lado a lado (F7.3, F7.4). Solo participan los proyectos activos (RN-05). */
function calcularReparto(p: Rango) {
  const activos = proyectosActivos().sort((a, b) => a.codigo.localeCompare(b.codigo))
  const consumos = activos.map((pr) => ({
    proyecto: pr.codigo,
    nombre: pr.nombre,
    // La materia prima y los insumos despachados al proyecto en el período, valorizados
    consumo: redondear(
      cargosDelPeriodo(p, pr.codigo)
        .filter((c) => c.tipo === 'despacho')
        .reduce((t, c) => t + c.monto, 0),
    ),
  }))
  const consumoTotal = redondear(consumos.reduce((t, c) => t + c.consumo, 0))
  const gastos = gastosCompartidos(p)
  const segunConsumo =
    consumoTotal > 0
      ? repartir(
          gastos.total,
          consumos.map((c) => c.consumo / consumoTotal),
        )
      : null
  const enPartesIguales = repartir(
    gastos.total,
    activos.map(() => 1 / activos.length),
  )
  return {
    gastos,
    consumoTotal,
    filas: consumos.map((c, i) => ({
      ...c,
      porcentaje: consumoTotal > 0 ? (c.consumo / consumoTotal) * 100 : 0,
      segunConsumo: segunConsumo?.montos[i] ?? null,
      enPartesIguales: enPartesIguales.montos[i],
    })),
    residuo: { consumo: segunConsumo?.resto ?? 0, iguales: enPartesIguales.resto },
  }
}

/** El mes que sigue a una fecha de fin: lo que se sugiere al abrir la siguiente revisión. */
function siguienteMes(fin: string) {
  const f = new Date(`${fin}T12:00:00Z`)
  f.setUTCDate(f.getUTCDate() + 1)
  const inicio = f.toISOString().slice(0, 10)
  const ultimo = new Date(Date.UTC(f.getUTCFullYear(), f.getUTCMonth() + 1, 0)).toISOString().slice(0, 10)
  return { inicio, fin: ultimo }
}
