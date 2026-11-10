import { http, HttpResponse } from 'msw'
import { fechaCorta } from '@/lib/formato'
import { horaDe, partesCaracas, seCruzan } from '@/lib/horarios'
import {
  disponible,
  gastosPorEjecutar,
  idDe,
  insumo,
  nombreEquipo,
  nombreUsuario,
  pedidosPendientes,
  periodoCerradoEn,
  prioridadDe,
  proyecto,
  SOLICITUD_NO_EXISTE,
  solicitudPorId,
} from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import { avisar, registrarCargo, siguienteDespacho } from '../reglas'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'
import { pronosticoDe } from './inventario'

/*
 * Bandeja del aprobador (vista 15; F3.5, F4.5, F5.4, F5.5, F6.6; RN-03, RN-06).
 *   GET  /api/bandeja                          pedidos por decidir y gastos aprobados por ejecutar
 *   POST /api/reservas/:id/aprobar|rechazar    F4.5 (rechazar: { motivo })
 *   POST /api/correcciones/:id/aprobar|denegar F6.6 (denegar: { nota })
 *   POST /api/solicitudes/:id/ejecutar         F5.5 { montoReal }: el gasto se carga al proyecto
 * Aprobar o rechazar solicitudes y reposiciones está en handlers/solicitudes.ts.
 */

type Grupo = 'Crítica' | 'Alta' | 'Media' | 'Baja' | 'auto'
const ORDEN: Record<Grupo, number> = { Crítica: 0, Alta: 1, Media: 2, Baja: 3, auto: 4 }

const num = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

/** "450 g" en lugar de "0,45 kg": las fracciones de kilo y de litro se leen mejor en g y mL. */
export function legible(valor: number, unidad: string) {
  const v = Math.abs(valor)
  // Con espacio de no separación: la cifra y la unidad no se parten entre dos líneas
  const nbsp = String.fromCharCode(160)
  if (unidad === 'kg' && v < 1) return `${num(v * 1000)}${nbsp}g`
  if (unidad === 'L' && v < 1) return `${num(v * 1000)}${nbsp}mL`
  return `${num(v)}${nbsp}${unidad}`
}

/** Costo del lote que sale primero (FEFO, F6.2): con él se estima el valor de un retiro. */
function costoDe(insumoId: string) {
  const hoy = dia(0)
  const lotes = db.lotes
    .findMany((q) => q.where({ insumoId, cantidad: (c) => c > 0 }))
    .filter((l) => !l.vence || l.vence >= hoy)
    .sort((a, b) => (a.vence ?? '9999').localeCompare(b.vence ?? '9999'))
  return (lotes[0] ?? db.lotes.findFirst((q) => q.where({ insumoId })))?.costoUnitario ?? 0
}

function base(id: string, grupo: Grupo, fecha: string, pedidaPor: string | null, codigo: string | null) {
  const p = codigo ? proyecto(codigo) : null
  return {
    id,
    grupo,
    fecha,
    pedidaPor: pedidaPor ? nombreUsuario(pedidaPor) : null,
    proyecto: p ? { id: p.id, codigo: p.codigo, nombre: p.nombre } : null,
  }
}

type Solicitud = NonNullable<ReturnType<typeof db.solicitudes.findFirst>>

function pedidoGasto(s: Solicitud) {
  const p = proyecto(s.proyecto!)!
  return {
    ...base(s.id, prioridadDe(s.proyecto!), s.fecha, s.creadaPor, s.proyecto),
    numero: s.numero,
    clase: 'gasto' as const,
    estado: s.estado,
    insumoServicio: s.insumoServicio ?? s.descripcion,
    cantidad: s.cantidadGasto,
    monto: s.monto ?? 0,
    descripcion: s.justificacion,
    cotizacion: s.cotizacion,
    presupuesto: p.presupuesto,
    gastoEjecutado: p.gastoEjecutado,
    decididaPor: s.decididaPor ? nombreUsuario(s.decididaPor) : null,
  }
}

function pedidoRetiro(s: Solicitud) {
  const lineas = s.lineas.map((l) => {
    const i = insumo(l.insumoId)
    const reposicion = db.solicitudes.findFirst((q) =>
      q.where({
        tipo: 'reposicion',
        insumoId: i.id,
        estado: (e) => e === 'Borrador' || e === 'Pendiente de Aprobación' || e === 'Aprobado',
      }),
    )
    return {
      insumo: i.nombre,
      unidad: i.unidad,
      cantidad: l.cantidad,
      disponible: disponible(i.id),
      // El número, para mostrarlo
      reposicion: reposicion?.numero ?? null,
    }
  })
  const valor = s.lineas.reduce((t, l) => t + l.cantidad * costoDe(l.insumoId), 0)
  return {
    ...base(s.id, prioridadDe(s.proyecto!), s.fecha, s.creadaPor, s.proyecto),
    numero: s.numero,
    clase: 'retiro' as const,
    lineas,
    proposito: s.proposito,
    valor: Math.round(valor * 100) / 100,
  }
}

function pedidoReposicion(s: Solicitud) {
  const i = insumo(s.insumoId!)
  const pronostico = pronosticoDe(i.id)
  return {
    ...base(s.id, 'auto', s.fecha, null, null),
    numero: s.numero,
    clase: 'reposicion' as const,
    insumo: { id: i.id, nombre: i.nombre, unidad: i.unidad, stock: i.stock, minimo: i.stockMinimo },
    sugerida: s.cantidad ?? 0,
    // Consumo de las próximas 8 semanas: el pronóstico mensual (F3.7) por 56 días
    consumoPrevisto: pronostico.valor === null ? null : Math.round(((pronostico.valor * 56) / 30) * 10) / 10,
  }
}

type Reserva = NonNullable<ReturnType<typeof db.reservas.findFirst>>

/** Otra reserva ya aprobada del mismo equipo que se cruza con esta (F4.4). */
function choqueDe(r: Reserva) {
  return db.reservas
    .findMany((q) => q.where({ equipoId: r.equipoId, estado: 'aprobada' }))
    .find((x) => x.id !== r.id && seCruzan(x, r))
}

function pedidoReserva(r: Reserva) {
  const e = db.equipos.findFirst((q) => q.where({ id: r.equipoId }))!
  const choque = choqueDe(r)
  return {
    ...base(r.id, prioridadDe(r.proyecto), r.pedidaEl, r.pedidaPor, r.proyecto),
    clase: 'reserva' as const,
    equipo: { id: e.id, nombre: e.nombre, estado: e.estado },
    inicio: r.inicio,
    fin: r.fin,
    choque: choque
      ? {
          id: choque.id,
          proyecto: choque.proyecto,
          proyectoId: idDe(choque.proyecto),
          inicio: choque.inicio,
          fin: choque.fin,
        }
      : null,
  }
}

type Correccion = NonNullable<ReturnType<typeof db.correcciones.findFirst>>

/** La línea de la bitácora que corrige y lo que cambia si se aprueba (RN-06: la original no se toca). */
function efectoCorreccion(c: Correccion) {
  const linea = db.despachos.findFirst((q) =>
    q.where({ codigo: c.despacho, insumoId: c.insumoId, lote: c.lote }),
  )
  const lote = db.lotes.findFirst((q) => q.where({ codigo: c.lote }))
  const i = insumo(c.insumoId)
  const costo = lote?.costoUnitario ?? costoDe(c.insumoId)
  if (!linea) return { linea: null, i, efecto: null }
  if (c.campo === 'proyecto') {
    return {
      linea,
      i,
      efecto: {
        tipo: 'traslado' as const,
        cantidad: null,
        diferencia: 0,
        monto: Math.round(linea.cantidad * costo * 100) / 100,
      },
    }
  }
  // Positiva: se registró de más y vuelve al lote; negativa: se entregó más de lo registrado
  const diferencia = Math.round((linea.cantidad - (c.cantidadNueva ?? linea.cantidad)) * 1000) / 1000
  return {
    linea,
    i,
    efecto: {
      tipo: diferencia >= 0 ? ('devolucion' as const) : ('descuento' as const),
      cantidad: legible(diferencia, i.unidad),
      diferencia,
      monto: Math.round(Math.abs(diferencia) * costo * 100) / 100,
    },
  }
}

function pedidoCorreccion(c: Correccion) {
  const { linea, i, efecto } = efectoCorreccion(c)
  return {
    ...base(c.id, prioridadDe(c.proyecto), c.fecha, c.pedidaPor, c.proyecto),
    clase: 'correccion' as const,
    despacho: { codigo: c.despacho, fecha: linea?.fecha ?? null },
    insumo: i.nombre,
    lote: c.lote,
    campo: c.campo,
    valorOriginal: c.valorOriginal,
    valorNuevo: c.valorNuevo,
    motivo: c.motivo,
    efecto: efecto && { tipo: efecto.tipo, cantidad: efecto.cantidad, monto: efecto.monto },
  }
}

/** Lo común de un movimiento de corrección en la bitácora: enlazado al despacho que corrige. */
const movimiento = (c: Correccion, registradoPor: string) => ({
  fecha: new Date().toISOString(),
  insumoId: c.insumoId,
  lote: c.lote,
  retiro: null,
  registradoPor,
  corrige: c.despacho,
  observacion: `Corrección ${c.id}`,
})

const porGrupoYAntiguedad = (a: { grupo: Grupo; fecha: string }, b: { grupo: Grupo; fecha: string }) =>
  ORDEN[a.grupo] - ORDEN[b.grupo] || a.fecha.localeCompare(b.fecha)

/** Texto corto de un horario de reserva para los avisos: "05/11/2026 de 14:00 a 16:00". */
const horario = (r: Reserva) =>
  `${fechaCorta(r.inicio)} de ${horaDe(partesCaracas(r.inicio).minutos)} a ${horaDe(partesCaracas(r.fin).minutos)}`

function leerTexto(cuerpo: unknown, campo: string) {
  const v = (cuerpo as Record<string, unknown> | null)?.[campo]
  return typeof v === 'string' ? v.trim().slice(0, 500) : ''
}

export const handlersBandeja = [
  /** Por prioridad del proyecto y, dentro de cada una, el más antiguo primero; las reposiciones al final. */
  http.get('/api/bandeja', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const p = pedidosPendientes()
    const pendientes = [
      ...p.solicitudes.map((s) => (s.tipo === 'gasto' ? pedidoGasto(s) : pedidoRetiro(s))),
      ...p.reservas.map(pedidoReserva),
      ...p.correcciones.map(pedidoCorreccion),
      ...p.reposiciones.map(pedidoReposicion),
    ].sort(porGrupoYAntiguedad)
    return HttpResponse.json({
      pendientes,
      porEjecutar: gastosPorEjecutar().map(pedidoGasto).sort(porGrupoYAntiguedad),
    })
  }),

  /** F4.5: aprobada, ocupa el horario. No se aprueba si ya choca con otra aprobada o el equipo no está. */
  http.post('/api/reservas/:id/aprobar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const r = db.reservas.findFirst((q) => q.where({ id: String(params.id) }))
    if (!r) return error(404, `No encontramos la reserva ${params.id}.`)
    if (r.estado !== 'pendiente')
      return error(409, `${r.id} ya está ${r.estado}: no se puede decidir de nuevo.`)
    const equipo = nombreEquipo(r.equipoId)
    if (db.equipos.findFirst((q) => q.where({ id: r.equipoId }))?.estado === 'En mantenimiento') {
      return error(409, `${equipo} está en mantenimiento: rechaza la reserva o espera a que vuelva.`)
    }
    if (Date.parse(r.fin) < Date.now()) return error(409, `El horario de ${r.id} ya pasó: recházala.`)
    const choque = choqueDe(r)
    if (choque) {
      return error(409, `Choca con ${choque.id} de ${choque.proyecto}, que ya está aprobada. Recházala.`)
    }
    await db.reservas.update(r, {
      data(x) {
        x.estado = 'aprobada'
        x.decididaEl = new Date().toISOString()
      },
    })
    await auditar(quien, 'cambio-estado', `${quien.nombre} aprobó la reserva ${r.id} de ${equipo}`, {
      entidad: `reserva:${r.id}`,
      valorAnterior: 'pendiente',
      valorNuevo: 'aprobada',
    })
    await avisar(r.pedidaPor, {
      clave: `res-${r.id}`,
      tipo: 'ok',
      titulo: `Reserva aprobada: ${equipo}`,
      detalle: `${r.proyecto}, ${horario(r)}.`,
      enlace: `/reservas?reserva=${r.id}`,
    })
    return HttpResponse.json({ id: r.id, estado: 'aprobada' })
  }),

  http.post('/api/reservas/:id/rechazar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const r = db.reservas.findFirst((q) => q.where({ id: String(params.id) }))
    if (!r) return error(404, `No encontramos la reserva ${params.id}.`)
    if (r.estado !== 'pendiente')
      return error(409, `${r.id} ya está ${r.estado}: no se puede decidir de nuevo.`)
    const motivo = leerTexto(await request.json().catch(() => null), 'motivo')
    if (!motivo) return errorValidacion({ motivo: 'Escribe el motivo. Sin motivo no se puede rechazar.' })
    const equipo = nombreEquipo(r.equipoId)
    await db.reservas.update(r, {
      data(x) {
        x.estado = 'rechazada'
        x.decididaEl = new Date().toISOString()
        x.motivoRechazo = motivo
      },
    })
    await auditar(quien, 'cambio-estado', `${quien.nombre} rechazó la reserva ${r.id} de ${equipo}`, {
      entidad: `reserva:${r.id}`,
      justificacion: motivo,
      valorAnterior: 'pendiente',
      valorNuevo: 'rechazada',
    })
    await avisar(r.pedidaPor, {
      clave: `res-${r.id}`,
      tipo: 'err',
      titulo: `Reserva rechazada: ${equipo}`,
      detalle: `${r.proyecto}, ${horario(r)}. «${motivo}»`,
      enlace: `/reservas?equipo=${r.equipoId}`,
    })
    return HttpResponse.json({ id: r.id, estado: 'rechazada' })
  }),

  /**
   * F6.6 y RN-06: el despacho original no cambia. Un movimiento nuevo en la bitácora devuelve (o
   * descuenta) la diferencia del lote y un cargo corrige el gasto del proyecto.
   */
  http.post('/api/correcciones/:id/aprobar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const c = db.correcciones.findFirst((q) => q.where({ id: String(params.id) }))
    if (!c) return error(404, `No encontramos la corrección ${params.id}.`)
    if (c.estado !== 'Pendiente')
      return error(409, `${c.id} ya está ${c.estado}: no se puede decidir de nuevo.`)
    const { linea, i, efecto } = efectoCorreccion(c)
    if (!linea || !efecto) return error(409, `Ya no encontramos ${c.despacho} en la bitácora.`)
    // F7.2: un período cerrado no admite correcciones con fecha en su rango
    if (periodoCerradoEn(linea.fecha))
      return error(409, `${c.despacho} es de un período cerrado: ya no se corrige.`)
    const lote = db.lotes.findFirst((q) => q.where({ codigo: c.lote }))
    const costo = lote?.costoUnitario ?? costoDe(c.insumoId)

    if (c.campo === 'cantidad') {
      const d = efecto.diferencia
      if (d < 0 && (lote?.cantidad ?? 0) < -d) {
        return error(409, `El lote ${c.lote} ya no tiene ${efecto.cantidad} para entregar de más.`)
      }
      if (lote) {
        await db.lotes.update(lote, {
          data(x) {
            x.cantidad = Math.round((x.cantidad + d) * 1000) / 1000
          },
        })
      }
      await db.insumos.update(i, {
        data(x) {
          x.stock = Math.round((x.stock + d) * 1000) / 1000
        },
      })
      const codigo = siguienteDespacho()
      await db.despachos.create({
        ...movimiento(c, quien.id),
        id: `des-${codigo.toLowerCase()}-1`,
        codigo,
        proyecto: c.proyecto,
        cantidad: -d,
      })
      await registrarCargo({
        proyecto: c.proyecto,
        tipo: 'despacho',
        concepto: `Corrección de ${c.despacho} · ${d > 0 ? '−' : '+'}${efecto.cantidad}`,
        referencia: codigo,
        monto: -d * costo,
      })
    } else if (c.proyectoNuevo) {
      // El cargo pasa de un proyecto al otro: sale de uno y entra en el otro, con el mismo movimiento
      const codigo = siguienteDespacho()
      let n = 0
      for (const [proyecto, signo] of [
        [c.proyecto, -1],
        [c.proyectoNuevo, 1],
      ] as const) {
        n += 1
        await db.despachos.create({
          ...movimiento(c, quien.id),
          id: `des-${codigo.toLowerCase()}-${n}`,
          codigo,
          proyecto,
          cantidad: signo * linea.cantidad,
        })
        await registrarCargo({
          proyecto,
          tipo: 'despacho',
          concepto: `Corrección de ${c.despacho} · ${signo < 0 ? `pasa a ${c.proyectoNuevo}` : `viene de ${c.proyecto}`}`,
          referencia: codigo,
          monto: signo * efecto.monto,
        })
      }
    }

    await db.correcciones.update(c, {
      data(x) {
        x.estado = 'Aprobado'
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} aprobó la corrección ${c.id} de ${c.despacho}: ${c.valorNuevo} en lugar de ${c.valorOriginal}`,
      { entidad: `correccion:${c.id}`, valorAnterior: 'Pendiente', valorNuevo: 'Aprobado' },
    )
    await avisar(c.pedidaPor, {
      clave: `cor-${c.id}`,
      tipo: 'ok',
      titulo: `Corrección aprobada: ${c.id}`,
      detalle: `${c.despacho} queda en ${c.valorNuevo}.`,
      enlace: `/proyectos/bitacora?despacho=${c.despacho}`,
    })
    return HttpResponse.json({ id: c.id, estado: 'Aprobado' })
  }),

  http.post('/api/correcciones/:id/denegar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const c = db.correcciones.findFirst((q) => q.where({ id: String(params.id) }))
    if (!c) return error(404, `No encontramos la corrección ${params.id}.`)
    if (c.estado !== 'Pendiente')
      return error(409, `${c.id} ya está ${c.estado}: no se puede decidir de nuevo.`)
    const nota = leerTexto(await request.json().catch(() => null), 'nota')
    if (!nota) return errorValidacion({ nota: 'Escribe la nota. Sin nota no se puede denegar.' })
    await db.correcciones.update(c, {
      data(x) {
        x.estado = 'Denegado'
      },
    })
    await auditar(quien, 'cambio-estado', `${quien.nombre} denegó la corrección ${c.id} de ${c.despacho}`, {
      entidad: `correccion:${c.id}`,
      justificacion: nota,
      valorAnterior: 'Pendiente',
      valorNuevo: 'Denegado',
    })
    await avisar(c.pedidaPor, {
      clave: `cor-${c.id}`,
      tipo: 'err',
      titulo: `Corrección denegada: ${c.id}`,
      detalle: `${c.despacho} queda como estaba. «${nota}»`,
      enlace: `/proyectos/bitacora?despacho=${c.despacho}`,
    })
    return HttpResponse.json({ id: c.id, estado: 'Denegado' })
  }),

  /** F5.5: el gasto aprobado ya se pagó. Ejecutado es final (RN-03) y el monto real se carga al proyecto. */
  http.post('/api/solicitudes/:id/ejecutar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const s = solicitudPorId(String(params.id))
    if (!s) return error(404, SOLICITUD_NO_EXISTE)
    if (s.tipo !== 'gasto')
      return error(409, `${s.numero} es un retiro: se ejecuta con su despacho en Almacén.`)
    if (s.estado !== 'Aprobado') {
      return error(409, `${s.numero} está ${s.estado}: solo un gasto aprobado se marca como ejecutado.`)
    }
    if (periodoCerradoEn(new Date().toISOString())) {
      return error(409, 'El período de hoy está cerrado: no admite gastos nuevos.')
    }
    const { montoReal } = (await request.json().catch(() => ({}))) as { montoReal?: unknown }
    if (typeof montoReal !== 'number' || !(montoReal > 0)) {
      return errorValidacion({ montoReal: 'Escribe el monto real pagado, mayor que cero.' })
    }
    const real = Math.round(montoReal * 100) / 100
    await db.solicitudes.update(s, {
      data(x) {
        x.estado = 'Ejecutado'
        x.montoReal = real
        x.fecha = new Date().toISOString()
      },
    })
    await registrarCargo({
      proyecto: s.proyecto!,
      tipo: 'gasto',
      concepto: s.insumoServicio ?? s.descripcion,
      referencia: s.numero,
      monto: real,
    })
    const texto = `US$ ${real.toFixed(2).replace('.', ',')}`
    await auditar(quien, 'cambio-estado', `${quien.nombre} marcó la solicitud ${s.numero} como ejecutada`, {
      entidad: `solicitud:${s.numero}`,
      detalle: `Monto real ${texto}; estimado US$ ${(s.monto ?? 0).toFixed(2).replace('.', ',')}`,
      valorAnterior: 'Aprobado',
      valorNuevo: 'Ejecutado',
    })
    await avisar(s.creadaPor, {
      clave: `sol-${s.numero}`,
      tipo: 'ok',
      titulo: `Gasto ejecutado: ${s.numero}`,
      detalle: `Se cargaron ${texto} a ${s.proyecto}.`,
      enlace: `/solicitudes?id=${s.id}`,
    })
    return HttpResponse.json({ id: s.id, estado: 'Ejecutado', montoReal: real })
  }),
]
