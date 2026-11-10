import { fechaIso } from '@/lib/formato'
import { dia } from './datos/fechas'
import { db } from './db'

/*
 * Consultas de dominio que usan varios handlers (inicio, contadores del menú, bandeja...).
 * Aplican las mismas reglas que el backend: RN-05 (activo = En ejecución) y RN-07 (alcance del coordinador).
 */

const ORDEN_PRIORIDAD = { Crítica: 0, Alta: 1, Media: 2, Baja: 3 } as const
type Prioridad = keyof typeof ORDEN_PRIORIDAD

export const porPrioridad = (a: { prioridad: Prioridad }, b: { prioridad: Prioridad }) =>
  ORDEN_PRIORIDAD[a.prioridad] - ORDEN_PRIORIDAD[b.prioridad]

export function proyecto(codigo: string) {
  return db.proyectos.findFirst((q) => q.where({ codigo }))
}

/** Respuesta 404 del backend cuando el UUID no es de ningún proyecto. */
export const PROYECTO_NO_EXISTE = 'Ese proyecto no existe.'

/**
 * Proyecto por su UUID: así lo identifica la API en rutas, filtros y cuerpos (decisión 8). El código
 * (QUI-024) solo se muestra.
 */
export function proyectoPorId(id: string | null | undefined) {
  if (!id) return undefined
  return db.proyectos.findFirst((q) => q.where({ id }))
}

/**
 * UUID de un proyecto a partir de su código. Las tablas de los mocks guardan la referencia por código;
 * las respuestas llevan además el UUID (proyectoId) para que el cliente lo use al pedir algo.
 */
export function idDe(codigo: string): string
export function idDe(codigo: string | null): string | null
export function idDe(codigo: string | null) {
  if (!codigo) return null
  return proyecto(codigo)?.id ?? ''
}

/** Respuesta 404 del backend cuando el UUID no es de ninguna solicitud. */
export const SOLICITUD_NO_EXISTE = 'Esa solicitud no existe.'

/**
 * Solicitud por su UUID: así la identifica la API en rutas, cuerpos y enlaces. El número (SOL-2026-0001)
 * solo se muestra.
 */
export function solicitudPorId(id: string | null | undefined) {
  if (!id) return undefined
  return db.solicitudes.findFirst((q) => q.where({ id }))
}

/** Siguiente número de solicitud del año: SOL-2026-0001, SOL-2026-0002… (REP- en las reposiciones). */
export function siguienteNumeroSolicitud(prefijo: 'SOL' | 'REP') {
  const base = `${prefijo}-${dia(0).slice(0, 4)}-`
  const usados = db.solicitudes
    .findMany((q) => q.where({ numero: (n) => n.startsWith(base) }))
    .map((s) => Number(s.numero.slice(base.length)) || 0)
  return `${base}${String(Math.max(0, ...usados) + 1).padStart(4, '0')}`
}

export function prioridadDe(codigo: string): Prioridad {
  return proyecto(codigo)?.prioridad ?? 'Baja'
}

export function nombreUsuario(id: string | null) {
  return id ? (db.usuarios.findFirst((q) => q.where({ id }))?.nombre ?? '—') : 'El sistema'
}

/** RN-05: un proyecto es activo solo si está En ejecución. */
export function proyectosActivos() {
  return db.proyectos.findMany((q) => q.where({ estatus: 'En ejecución' }))
}

/** RN-07: proyectos asignados a un coordinador. */
export function proyectosDe(usuarioId: string) {
  return db.proyectos.findMany((q) => q.where({ coordinadorId: usuarioId }))
}

/**
 * Avance físico (F2.6): suma de avance × peso de cada hito, entre 100. null mientras el plan no esté
 * confirmado (los pesos no suman 100, F2.4).
 */
export function avanceDe(p: { codigo: string; planConfirmado: boolean }) {
  if (!p.planConfirmado) return null
  const hitos = db.hitos.findMany((q) => q.where({ proyecto: p.codigo }))
  // Con un decimal: 62 % + 30 × (85 − 70) / 100 = 66,5 % (mockup 08)
  return Math.round(hitos.reduce((suma, h) => suma + h.peso * h.avance, 0) / 10) / 10
}

/** Estatus en los que un proyecto todavía necesita coordinador (todos menos Finalizado). */
const VIGENTE = (e: string) => e !== 'Finalizado'

/** Proyectos vigentes de un coordinador: los que quedarían sin coordinador si cambia de rol o se desactiva. */
export function proyectosVigentesDe(usuarioId: string) {
  const orden = { 'En ejecución': 0, Propuesta: 1, Suspendido: 2, Finalizado: 3 } as const
  return db.proyectos
    .findMany((q) => q.where({ coordinadorId: usuarioId, estatus: VIGENTE }))
    .sort((a, b) => orden[a.estatus] - orden[b.estatus] || a.codigo.localeCompare(b.codigo))
}

/** Proyectos vigentes sin coordinador: van a la bandeja del administrador para reasignarlos (F1.2, F2.2). */
export function proyectosSinCoordinador() {
  return db.proyectos.findMany((q) => q.where({ coordinadorId: null, estatus: VIGENTE }))
}

export function periodoEnCurso() {
  return (
    db.periodos.findFirst((q) => q.where({ estado: 'en_revision' })) ??
    db.periodos.findFirst((q) => q.where({ estado: 'abierto' })) ??
    null
  )
}

type Rango = { inicio: string; fin: string }

/** Cargos directos de un proyecto en un período (F7.1): gastos y despachos. Los compartidos se reparten después. */
export function cargosDelPeriodo(periodo: Rango, codigo: string) {
  return db.cargos
    .findMany((q) => q.where({ proyecto: codigo, tipo: (t) => t !== 'compartido' }))
    .filter((c) => c.fecha >= periodo.inicio && c.fecha <= periodo.fin)
    .sort((a, b) => a.fecha.localeCompare(b.fecha) || a.id.localeCompare(b.id))
}

/** Número de cargos y monto de un proyecto en el período (lo que confirma su coordinador). */
export function resumenCargos(periodo: Rango, codigo: string) {
  const cargos = cargosDelPeriodo(periodo, codigo)
  return {
    cargos: cargos.length,
    monto: Math.round(cargos.reduce((t, c) => t + c.monto, 0) * 100) / 100,
  }
}

/** Período cerrado (o ya repartido) que contiene la fecha: ahí no entran movimientos (F7.2). */
export function periodoCerradoEn(fecha: string) {
  const d = fecha.length > 10 ? fechaIso(fecha) : fecha
  return (
    db.periodos.findFirst((q) =>
      q.where({
        estado: (e) => e === 'cerrado' || e === 'prorrateado',
        inicio: (i) => i <= d,
        fin: (f) => f >= d,
      }),
    ) ?? null
  )
}

export function parametro(clave: string, porDefecto: number) {
  return db.parametros.findFirst((q) => q.where({ clave }))?.valor ?? porDefecto
}

const PENDIENTE = 'Pendiente de Aprobación'

/** Pedidos que esperan una decisión del aprobador (bandeja, F5.4, F4.5, F6.6, F3.5). */
export function pedidosPendientes() {
  return {
    solicitudes: db.solicitudes.findMany((q) =>
      q.where({ estado: PENDIENTE, tipo: (t) => t === 'gasto' || t === 'retiro' }),
    ),
    reposiciones: db.solicitudes.findMany((q) =>
      q.where({ tipo: 'reposicion', estado: (e) => e === 'Borrador' || e === PENDIENTE }),
    ),
    reservas: db.reservas.findMany((q) => q.where({ estado: 'pendiente' })),
    correcciones: db.correcciones.findMany((q) => q.where({ estado: 'Pendiente' })),
  }
}

/** Gastos aprobados que esperan la compra: el aprobador los marca como ejecutados (F5.5). */
export function gastosPorEjecutar() {
  return db.solicitudes.findMany((q) => q.where({ tipo: 'gasto', estado: 'Aprobado' }), {
    orderBy: { fecha: 'asc' },
  })
}

/** Stock que se puede despachar: sin los lotes vencidos (F3.6, F6.2). */
export function disponible(insumoId: string) {
  const hoy = dia(0)
  const total = db.lotes
    .findMany((q) => q.where({ insumoId, cantidad: (c) => c > 0 }))
    .filter((l) => !l.vence || l.vence >= hoy)
    .reduce((t, l) => t + l.cantidad, 0)
  return Math.round(total * 1000) / 1000
}

/** Retiros aprobados que el almacén todavía no despachó (F6.2). */
export function despachosPorEntregar() {
  return db.solicitudes.findMany((q) => q.where({ tipo: 'retiro', estado: 'Aprobado' }), {
    orderBy: { fecha: 'asc' },
  })
}

/** Días entre hoy y una fecha AAAA-MM-DD (negativo si ya pasó). */
export function diasHasta(fecha: string) {
  return Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${dia(0)}T12:00:00Z`)) / 86400_000)
}

/** Alertas de inventario: stock bajo el mínimo (F3.4), lotes próximos a vencer y vencidos (F3.6). */
export function alertasInventario() {
  const anticipacion = parametro('anticipacion_vencimiento_dias', 30)
  const bajoMinimo = db.insumos.findMany((q) => q.where((i) => i.stock < i.stockMinimo))
  const conVencimiento = db.lotes
    .findMany((q) => q.where({ vence: (v) => v !== null, cantidad: (c) => c > 0 }))
    .map((l) => ({ ...l, dias: diasHasta(l.vence as string) }))
  return {
    bajoMinimo,
    porVencer: conVencimiento
      .filter((l) => l.dias >= 0 && l.dias <= anticipacion)
      .sort((a, b) => a.dias - b.dias),
    vencidos: conVencimiento.filter((l) => l.dias < 0),
  }
}

export function insumo(id: string) {
  return db.insumos.findFirst((q) => q.where({ id }), { strict: true })
}

/** Nombre de un equipo para los textos (reservas del inicio, la ficha del proyecto…). */
export function nombreEquipo(id: string) {
  return db.equipos.findFirst((q) => q.where({ id }))?.nombre ?? 'Equipo'
}
