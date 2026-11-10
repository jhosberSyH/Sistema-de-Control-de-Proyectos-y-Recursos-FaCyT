import { http, HttpResponse } from 'msw'
import {
  avanceDe,
  nombreEquipo,
  alertasInventario,
  despachosPorEntregar,
  gastosPorEjecutar,
  idDe,
  insumo,
  nombreUsuario,
  parametro,
  pedidosPendientes,
  periodoEnCurso,
  porPrioridad,
  prioridadDe,
  proyecto,
  proyectosActivos,
  proyectosDe,
  proyectosSinCoordinador,
  resumenCargos,
} from '../consultas'
import { fechaIso } from '@/lib/formato'
import { db } from '../db'
import { demora, exigir } from '../utils'

/*
 * GET /api/inicio (vista 02). Junta, para el rol de quien pide, los datos de varios módulos.
 * El coordinador solo ve sus proyectos (RN-07). Cada proyecto que se menciona lleva su código (proyecto,
 * para mostrarlo) y su UUID (proyectoId, para enlazar a su ficha).
 */

const RECIENTE_MS = 3 * 86400_000
const reciente = (fecha: string | null) => fecha !== null && Date.now() - Date.parse(fecha) <= RECIENTE_MS
const nombrePila = (nombre: string) => nombre.split(' ')[0]
const VIGENTE = ['pendiente', 'aprobada']

function resumenProyecto(codigo: string) {
  const p = proyecto(codigo)!
  return {
    id: p.id,
    codigo: p.codigo,
    nombre: p.nombre,
    estatus: p.estatus,
    prioridad: p.prioridad,
    avance: avanceDe(p),
    ejecucion: Math.round((p.gastoEjecutado / p.presupuesto) * 100),
    gastoEjecutado: p.gastoEjecutado,
    presupuesto: p.presupuesto,
  }
}

function inicioCoordinador(usuarioId: string, nombre: string) {
  const mios = proyectosDe(usuarioId).map((p) => p.codigo)
  const periodo = periodoEnCurso()
  const pendientes = []

  if (periodo) {
    for (const c of db.confirmaciones.findMany((q) =>
      q.where({ periodoId: periodo.id, confirmado: false, proyecto: (x) => mios.includes(x) }),
    )) {
      pendientes.push({
        clase: 'confirmar-cargos',
        proyecto: c.proyecto,
        proyectoId: idDe(c.proyecto),
        ...resumenCargos(periodo, c.proyecto),
        cierre: periodo.fin,
      })
    }
  }
  for (const s of db.solicitudes.findMany((q) =>
    q.where({ estado: 'Rechazado', proyecto: (x) => x !== null && mios.includes(x) }),
  )) {
    if (reciente(s.fecha)) {
      pendientes.push({
        clase: 'solicitud-rechazada',
        solicitud: s.numero,
        solicitudId: s.id,
        decididaPor: nombreUsuario(s.decididaPor),
        motivo: s.motivoRechazo ?? '',
      })
    }
  }
  const reservas = db.reservas
    // Las rechazadas y las canceladas (el equipo pasó a mantenimiento) ya no ocupan el horario
    .findMany((q) => q.where({ proyecto: (x) => mios.includes(x), estado: (e) => VIGENTE.includes(e) }), {
      orderBy: { inicio: 'asc' },
    })
    // Las de hoy siguen siendo próximas aunque su horario ya haya pasado
    .filter((r) => fechaIso(r.fin) >= fechaIso())
  for (const r of reservas) {
    if (r.estado === 'aprobada' && reciente(r.decididaEl)) {
      pendientes.push({
        clase: 'reserva-aprobada',
        reserva: r.id,
        equipo: nombreEquipo(r.equipoId),
        proyecto: r.proyecto,
        proyectoId: idDe(r.proyecto),
        inicio: r.inicio,
        fin: r.fin,
      })
    }
  }

  const solicitudes = db.solicitudes
    .findMany((q) => q.where({ proyecto: (x) => x !== null && mios.includes(x) }))
    // Las más recientes primero: por fecha de creación, que sigue el orden del número
    .sort((a, b) => b.numero.localeCompare(a.numero, 'es', { numeric: true }))
    .slice(0, 4)
    .map(({ id, numero, tipo, descripcion, monto, estado }) => ({
      id,
      numero,
      tipo,
      descripcion,
      monto,
      estado,
    }))

  return {
    rol: 'coordinador',
    nombre: nombrePila(nombre),
    cierrePeriodo: periodo?.fin ?? null,
    pendientes,
    proyectos: proyectosDe(usuarioId)
      .filter((p) => p.estatus === 'En ejecución')
      .sort(porPrioridad)
      .map((p) => resumenProyecto(p.codigo)),
    reservas: reservas.slice(0, 4).map(({ id, equipoId, proyecto, inicio, fin, estado }) => ({
      id,
      equipo: nombreEquipo(equipoId),
      proyecto,
      proyectoId: idDe(proyecto),
      inicio,
      fin,
      estado,
    })),
    solicitudes,
  }
}

function inicioAprobador(nombre: string) {
  const p = pedidosPendientes()
  const conPrioridad = [
    ...p.solicitudes.map((s) =>
      s.tipo === 'retiro'
        ? {
            clase: 'retiro',
            id: s.id,
            numero: s.numero,
            proyecto: s.proyecto!,
            proyectoId: idDe(s.proyecto!),
            prioridad: prioridadDe(s.proyecto!),
            items: s.items.length,
            fecha: s.fecha,
          }
        : {
            clase: 'gasto',
            id: s.id,
            numero: s.numero,
            proyecto: s.proyecto!,
            proyectoId: idDe(s.proyecto!),
            prioridad: prioridadDe(s.proyecto!),
            monto: s.monto ?? 0,
            fecha: s.fecha,
          },
    ),
    ...p.reservas.map((r) => ({
      clase: 'reserva',
      id: r.id,
      proyecto: r.proyecto,
      proyectoId: idDe(r.proyecto),
      prioridad: prioridadDe(r.proyecto),
      equipo: nombreEquipo(r.equipoId),
      inicio: r.inicio,
      fin: r.fin,
      fecha: r.pedidaEl,
    })),
    ...p.correcciones.map((c) => ({
      clase: 'correccion',
      id: c.id,
      proyecto: c.proyecto,
      proyectoId: idDe(c.proyecto),
      prioridad: prioridadDe(c.proyecto),
      despacho: c.despacho,
      valorOriginal: c.valorOriginal,
      valorNuevo: c.valorNuevo,
      fecha: c.fecha,
    })),
  ].sort((a, b) => porPrioridad(a, b) || a.fecha.localeCompare(b.fecha))

  const reposiciones = p.reposiciones.map((r) => {
    const i = insumo(r.insumoId!)
    return {
      clase: 'reposicion',
      id: r.id,
      numero: r.numero,
      insumo: i.nombre,
      stock: i.stock,
      minimo: i.stockMinimo,
      unidad: i.unidad,
    }
  })
  // 5 filas por prioridad; si hay reposiciones automáticas, la última fila es la primera de ellas, para que
  // no queden siempre fuera del inicio (el resto se ve en la bandeja)
  const bandeja =
    reposiciones.length > 0 ? [...conPrioridad.slice(0, 4), reposiciones[0]] : conPrioridad.slice(0, 5)

  const periodo = periodoEnCurso()
  const confirmaciones = periodo ? db.confirmaciones.findMany((q) => q.where({ periodoId: periodo.id })) : []

  const a = alertasInventario()
  const alertas = [
    ...a.bajoMinimo.slice(0, 2).map((i) => ({
      clase: 'bajo-minimo',
      insumoId: i.id,
      insumo: i.nombre,
      stock: i.stock,
      minimo: i.stockMinimo,
      unidad: i.unidad,
    })),
    ...a.porVencer.slice(0, 1).map((l) => ({
      clase: 'por-vencer',
      insumoId: l.insumoId,
      insumo: insumo(l.insumoId).nombre,
      lote: l.codigo,
      vence: l.vence!,
      dias: l.dias,
    })),
    ...a.vencidos.slice(0, 1).map((l) => ({
      clase: 'vencido',
      insumoId: l.insumoId,
      insumo: insumo(l.insumoId).nombre,
      lote: l.codigo,
      vence: l.vence!,
    })),
  ]
  const despachos = despachosPorEntregar()

  return {
    rol: 'aprobador',
    nombre: nombrePila(nombre),
    decisiones: p.solicitudes.length + p.reposiciones.length + p.reservas.length + p.correcciones.length,
    contadores: {
      solicitudes: p.solicitudes.length,
      reservas: p.reservas.length,
      correcciones: p.correcciones.length,
      despachos: despachos.length,
    },
    bandeja,
    cierre: periodo
      ? {
          periodoId: periodo.id,
          inicio: periodo.inicio,
          confirmados: confirmaciones.filter((c) => c.confirmado).length,
          total: confirmaciones.length,
        }
      : null,
    alertas,
    despachos: despachos.map((s) => ({
      solicitud: s.numero,
      solicitudId: s.id,
      proyecto: s.proyecto!,
      proyectoId: idDe(s.proyecto!),
      items: s.items,
    })),
  }
}

function inicioAdministrador(nombre: string) {
  const pendientes = []
  for (const p of proyectosSinCoordinador()) {
    pendientes.push({
      clase: 'sin-coordinador',
      proyecto: p.codigo,
      proyectoId: p.id,
      motivo: p.sinCoordinador?.motivo ?? '',
      fecha: p.sinCoordinador?.fecha ?? '',
    })
  }
  for (const p of db.proyectos.findMany((q) => q.where({ estatus: 'Propuesta', planConfirmado: true }))) {
    pendientes.push({ clase: 'plan-confirmado', proyecto: p.codigo, proyectoId: p.id })
  }

  const activos = proyectosActivos()
  const presupuesto = activos.reduce((t, p) => t + p.presupuesto, 0)
  const gasto = activos.reduce((t, p) => t + p.gastoEjecutado, 0)
  const a = alertasInventario()

  return {
    rol: 'administrador',
    nombre: nombrePila(nombre),
    pendientes,
    contadores: {
      proyectosActivos: activos.length,
      ejecucionGlobal: presupuesto ? Math.round((gasto / presupuesto) * 100) : 0,
      alertasStock: a.bajoMinimo.length,
      lotesPorVencer: a.porVencer.length,
    },
    // Sin los inicios y cierres de sesión: esos se consultan en la auditoría
    // Se ordena a mano: combinar filtro, orderBy y take de @msw/data corta antes de ordenar
    actividad: db.auditoria
      .findMany((q) => q.where({ accion: (a) => a !== 'sesion' }))
      .sort((a, b) => Date.parse(b.fecha) - Date.parse(a.fecha))
      .slice(0, 3)
      .map(({ id, descripcion, detalle, justificacion, fecha, ip }) => ({
        id,
        descripcion,
        detalle,
        justificacion,
        fecha,
        ip,
      })),
    prioridades: [...activos]
      .sort((x, y) => porPrioridad(x, y) || x.codigo.localeCompare(y.codigo))
      .slice(0, 4)
      .map(({ id, codigo, nombre, prioridad }) => ({ id, codigo, nombre, prioridad })),
    accesos: {
      cuentasActivas: db.usuarios.findMany((q) => q.where({ activo: true })).length,
      anticipacionVencimiento: parametro('anticipacion_vencimiento_dias', 30),
    },
  }
}

export const handlersInicio = [
  http.get('/api/inicio', async ({ request }) => {
    await demora()
    const u = exigir(request)
    if (u instanceof Response) return u
    if (u.rol === 'coordinador') return HttpResponse.json(inicioCoordinador(u.id, u.nombre))
    if (u.rol === 'aprobador') return HttpResponse.json(inicioAprobador(u.nombre))
    return HttpResponse.json(inicioAdministrador(u.nombre))
  }),
]

/** Contadores del menú, calculados desde la base (los mismos que muestra el inicio). */
export function contadoresMenu(usuarioId: string, rol: string): Record<string, number> {
  if (rol === 'aprobador') {
    const p = pedidosPendientes()
    // Por decidir más los gastos aprobados por ejecutar (plan §7.2)
    const porEjecutar = gastosPorEjecutar().length
    return {
      bandeja:
        p.solicitudes.length +
        p.reposiciones.length +
        p.reservas.length +
        p.correcciones.length +
        porEjecutar,
      // No es una sección: separa lo que ya se aprobó del resto para el nombre accesible del contador
      bandejaPorEjecutar: porEjecutar,
      almacen: despachosPorEntregar().length,
    }
  }
  if (rol === 'coordinador') {
    const mios = proyectosDe(usuarioId).map((p) => p.codigo)
    const periodo = periodoEnCurso()
    return {
      solicitudes: db.solicitudes
        .findMany((q) => q.where({ estado: 'Rechazado', proyecto: (x) => x !== null && mios.includes(x) }))
        .filter((s) => reciente(s.fecha)).length,
      cierre: periodo
        ? db.confirmaciones.findMany((q) =>
            q.where({ periodoId: periodo.id, confirmado: false, proyecto: (x) => mios.includes(x) }),
          ).length
        : 0,
    }
  }
  return {
    proyectos: proyectosSinCoordinador().length,
  }
}
