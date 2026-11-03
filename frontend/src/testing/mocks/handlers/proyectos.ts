import { http, HttpResponse } from 'msw'
import { avanceDe, nombreEquipo, nombreUsuario, porPrioridad } from '../consultas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion, exigir, type RolMock } from '../utils'

/*
 * Proyectos (F2.1, F2.2, F2.6, F2.7; RN-05, RN-07).
 *   GET  /api/proyectos?q&area&prioridad&estatus&pagina   Administrador: todos. Coordinador: solo los suyos (RN-07).
 *   GET  /api/proyectos/exportar?…                        la misma lista en CSV
 *   GET  /api/proyectos/coordinadores                     cuentas activas con rol Coordinador, para asignar (F2.2)
 *   POST /api/proyectos                                   nace en Propuesta; código único (409 con el que choca)
 */

const POR_PAGINA = 20
const AREAS = ['Física', 'Química', 'Biología'] as const
const PREFIJO_AREA: Record<string, (typeof AREAS)[number]> = {
  FIS: 'Física',
  QUI: 'Química',
  BIO: 'Biología',
}
const PRIORIDADES = ['Crítica', 'Alta', 'Media', 'Baja'] as const
const ESTATUS = ['En ejecución', 'Propuesta', 'Suspendido', 'Finalizado'] as const
/** Código institucional: área en tres letras y número, como QUI-024. */
const CODIGO = /^[A-Z]{3}-\d{3}$/

type Proyecto = NonNullable<ReturnType<typeof db.proyectos.findFirst>>

const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

function vista(p: Proyecto) {
  return {
    codigo: p.codigo,
    nombre: p.nombre,
    area: p.area,
    estatus: p.estatus,
    prioridad: p.prioridad,
    presupuesto: p.presupuesto,
    gastoEjecutado: p.gastoEjecutado,
    /** F2.6: null mientras el plan de hitos no esté confirmado (pesos que sumen 100). */
    avance: avanceDe(p),
    /** F2.7: gasto ejecutado / presupuesto, sin recortar si pasa de 100. */
    ejecucion: p.presupuesto > 0 ? Math.round((p.gastoEjecutado / p.presupuesto) * 100) : 0,
    planConfirmado: p.planConfirmado,
    coordinador: p.coordinadorId ? { id: p.coordinadorId, nombre: nombreUsuario(p.coordinadorId) } : null,
  }
}

type Filtros = { q: string; area: string | null; prioridad: string | null; estatus: string | null }

function leerFiltros(url: URL): Filtros {
  return {
    q: normalizar(url.searchParams.get('q')?.trim() ?? ''),
    area: url.searchParams.get('area'),
    prioridad: url.searchParams.get('prioridad'),
    estatus: url.searchParams.get('estatus'),
  }
}

/** Proyectos visibles para quien pregunta (RN-07) con los filtros de búsqueda, área y prioridad. */
function filtrar(quien: { id: string; rol: string }, f: Filtros) {
  return db.proyectos.findMany((x) =>
    x.where((p) => {
      if (quien.rol === 'coordinador' && p.coordinadorId !== quien.id) return false
      if (f.area && p.area !== f.area) return false
      if (f.prioridad && p.prioridad !== f.prioridad) return false
      if (!f.q) return true
      const coordinador = p.coordinadorId ? nombreUsuario(p.coordinadorId) : ''
      return [p.codigo, p.nombre, coordinador].some((t) => normalizar(t).includes(f.q))
    }),
  )
}

/** Como el mockup 06: por prioridad; dentro de cada una, primero los que están en ejecución; luego por código. */
const orden = (a: Proyecto, b: Proyecto) =>
  porPrioridad(a, b) ||
  ESTATUS.indexOf(a.estatus) - ESTATUS.indexOf(b.estatus) ||
  a.codigo.localeCompare(b.codigo)

export const handlersProyectos = [
  http.get('/api/proyectos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador', 'coordinador'])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const f = leerFiltros(url)
    const base = filtrar(quien, f)
    // Los conteos por estatus respetan los demás filtros, así cada botón dice cuántos va a mostrar.
    const conteos = Object.fromEntries([
      ['Todos', base.length],
      ...ESTATUS.map((e) => [e, base.filter((p) => p.estatus === e).length]),
    ])
    const lista = base.filter((p) => !f.estatus || p.estatus === f.estatus).sort(orden)
    const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
    const pagina = Math.min(Math.max(1, Number(url.searchParams.get('pagina')) || 1), paginas)
    return HttpResponse.json({
      items: lista.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(vista),
      total: lista.length,
      pagina,
      paginas,
      porPagina: POR_PAGINA,
      conteos,
    })
  }),

  http.get('/api/proyectos/exportar', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador', 'coordinador'])
    if (quien instanceof Response) return quien
    const f = leerFiltros(new URL(request.url))
    const filas = filtrar(quien, f)
      .filter((p) => !f.estatus || p.estatus === f.estatus)
      .sort(orden)
      .map(vista)
    const celda = (v: string | number | null) => `"${String(v ?? '').replaceAll('"', '""')}"`
    const csv = [
      [
        'Código',
        'Nombre',
        'Área',
        'Coordinador',
        'Estatus',
        'Prioridad',
        'Presupuesto (US$)',
        'Gasto ejecutado (US$)',
        'Avance físico (%)',
        'Ejecución (%)',
      ],
      ...filas.map((p) => [
        p.codigo,
        p.nombre,
        p.area,
        p.coordinador?.nombre ?? 'Sin coordinador',
        p.estatus,
        p.prioridad,
        p.presupuesto.toFixed(2).replace('.', ','),
        p.gastoEjecutado.toFixed(2).replace('.', ','),
        p.avance,
        p.ejecucion,
      ]),
    ]
      .map((fila) => fila.map(celda).join(';'))
      .join('\r\n')
    // BOM para que Excel abra bien las tildes; punto y coma, como espera Excel en español.
    return new HttpResponse(`${String.fromCharCode(0xfeff)}${csv}`, {
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="proyectos-${new Date().toISOString().slice(0, 10)}.csv"`,
      },
    })
  }),

  http.get('/api/proyectos/coordinadores', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const cuentas = db.usuarios.findMany((q) => q.where({ rol: 'coordinador', activo: true }))
    return HttpResponse.json(
      cuentas
        .map((u) => ({
          id: u.id,
          nombre: u.nombre,
          proyectos: db.proyectos.findMany((q) =>
            q.where({ coordinadorId: u.id, estatus: (e) => e !== 'Finalizado' }),
          ).length,
        }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    )
  }),

  http.post('/api/proyectos', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const c = (await request.json().catch(() => ({}))) as {
      codigo?: string
      nombre?: string
      area?: string
      presupuesto?: number
      prioridad?: string
      coordinadorId?: string | null
    }
    const codigo = (c.codigo ?? '').trim().toUpperCase()
    const nombre = (c.nombre ?? '').replace(/\s+/g, ' ').trim()
    const errores: Record<string, string> = {}
    if (!CODIGO.test(codigo))
      errores.codigo = 'Usa el formato del código institucional: área y número, como QUI-032.'
    if (!AREAS.includes(c.area as (typeof AREAS)[number])) errores.area = 'Elige el área del proyecto.'
    else if (PREFIJO_AREA[codigo.slice(0, 3)] && PREFIJO_AREA[codigo.slice(0, 3)] !== c.area) {
      errores.area = `El código ${codigo} es de ${PREFIJO_AREA[codigo.slice(0, 3)]}. Cambia el área o el código.`
    }
    if (nombre.length < 5) errores.nombre = 'Escribe el nombre del proyecto.'
    if (typeof c.presupuesto !== 'number' || !(c.presupuesto > 0)) {
      errores.presupuesto = 'Escribe un monto mayor que cero, por ejemplo 9.500,00.'
    }
    if (!PRIORIDADES.includes(c.prioridad as (typeof PRIORIDADES)[number])) {
      errores.prioridad = 'Elige la prioridad del proyecto.'
    }
    const coordinador = c.coordinadorId
      ? db.usuarios.findFirst((q) => q.where({ id: c.coordinadorId!, rol: 'coordinador', activo: true }))
      : null
    if (c.coordinadorId && !coordinador) errores.coordinadorId = 'Esa cuenta ya no es un coordinador activo.'
    if (Object.keys(errores).length) return errorValidacion(errores)

    const existente = db.proyectos.findFirst((q) => q.where({ codigo }))
    if (existente) {
      // F2.1: se muestra el proyecto que ya tiene el código.
      return HttpResponse.json(
        {
          detail: {
            mensaje: 'Ya existe un proyecto con ese código.',
            proyecto: { codigo: existente.codigo, nombre: existente.nombre },
          },
        },
        { status: 409 },
      )
    }

    const nuevo = await db.proyectos.create({
      codigo,
      nombre,
      area: c.area as (typeof AREAS)[number],
      estatus: 'Propuesta',
      prioridad: c.prioridad as (typeof PRIORIDADES)[number],
      presupuesto: Math.round(c.presupuesto! * 100) / 100,
      gastoEjecutado: 0,
      registradoEl: new Date().toISOString().slice(0, 10),
      coordinadorId: coordinador?.id ?? null,
      sinCoordinador: coordinador
        ? null
        : { motivo: 'al registrarse', fecha: new Date().toISOString().slice(0, 10) },
      planConfirmado: false,
    })
    await auditar(quien, 'creacion', `${quien.nombre} registró el proyecto ${codigo}`, {
      detalle: `${nombre} · ${nuevo.prioridad} · US$ ${nuevo.presupuesto.toFixed(2)}${coordinador ? ` · coordina ${coordinador.nombre}` : ''}`,
      entidad: `proyecto:${codigo}`,
    })
    if (coordinador) {
      // F2.2: el proyecto aparece en la bandeja del coordinador.
      await db.avisos.create({
        id: `av-proy-${Date.now()}`,
        usuarioId: coordinador.id,
        tipo: 'info',
        titulo: `Te asignaron el proyecto ${codigo}`,
        detalle: `${nombre}. Está en Propuesta: carga su plan de hitos para que pueda pasar a En ejecución.`,
        enlace: `/proyectos/${codigo}`,
        fecha: new Date().toISOString(),
        leido: false,
      })
    }
    return HttpResponse.json(vista(nuevo), { status: 201 })
  }),
  // ---------- Ficha del proyecto (vista 07) ----------

  http.get('/api/proyectos/:codigo', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.codigo))
    if (acceso instanceof Response) return acceso
    const { proyecto: p } = acceso
    const hitos = db.hitos
      .findMany((q) => q.where({ proyecto: p.codigo }))
      .sort((a, b) => a.numero - b.numero)
    const cargos = db.cargos.findMany((q) => q.where({ proyecto: p.codigo }))
    const suma = (tipo: string) =>
      Math.round(cargos.filter((c) => c.tipo === tipo).reduce((t, c) => t + c.monto, 0) * 100) / 100
    const proximo = hitos.find((h) => h.avance < 100) ?? null
    return HttpResponse.json({
      ...vista(p),
      registradoEl: p.registradoEl,
      hitos: hitos.map(({ id, numero, nombre, peso, fechaPrevista, avance }) => ({
        id,
        numero,
        nombre,
        peso,
        fechaPrevista,
        avance,
      })),
      sumaPesos: hitos.reduce((t, h) => t + h.peso, 0),
      proximoHito: proximo
        ? {
            numero: proximo.numero,
            nombre: proximo.nombre,
            peso: proximo.peso,
            avance: proximo.avance,
            fechaPrevista: proximo.fechaPrevista,
          }
        : null,
      // F2.7: de dónde sale el gasto ejecutado
      desglose: { gastos: suma('gasto'), despachos: suma('despacho'), compartidos: suma('compartido') },
      movimientos: movimientosRecientes(p.codigo),
      transiciones: TRANSICIONES[p.estatus].map((estatus) => ({
        estatus,
        bloqueo: bloqueoTransicion(p, estatus),
      })),
    })
  }),

  http.get('/api/proyectos/:codigo/gastos', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.codigo))
    if (acceso instanceof Response) return acceso
    return HttpResponse.json(
      db.cargos
        .findMany((q) => q.where({ proyecto: acceso.proyecto.codigo }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(({ id, fecha, tipo, concepto, referencia, monto }) => ({
          id,
          fecha,
          tipo,
          concepto,
          referencia,
          monto,
        })),
    )
  }),

  http.get('/api/proyectos/:codigo/reservas', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.codigo))
    if (acceso instanceof Response) return acceso
    return HttpResponse.json(
      db.reservas
        .findMany((q) => q.where({ proyecto: acceso.proyecto.codigo }))
        .sort((a, b) => b.inicio.localeCompare(a.inicio))
        .map(({ id, equipoId, inicio, fin, estado }) => ({
          id,
          equipo: nombreEquipo(equipoId),
          inicio,
          fin,
          estado,
        })),
    )
  }),

  http.get('/api/proyectos/:codigo/historial', async ({ request, params }) => {
    await demora()
    const acceso = accesoFicha(request, String(params.codigo))
    if (acceso instanceof Response) return acceso
    return HttpResponse.json(
      db.auditoria
        .findMany((q) => q.where({ entidad: `proyecto:${acceso.proyecto.codigo}` }))
        .sort((a, b) => b.fecha.localeCompare(a.fecha))
        .map(({ id, fecha, descripcion, justificacion, ip }) => ({
          id,
          fecha,
          descripcion,
          justificacion,
          ip,
        })),
    )
  }),

  /** F2.3: cambio de estatus por el Administrador, con el anterior y el nuevo en el audit log. */
  http.patch('/api/proyectos/:codigo/estatus', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const p = db.proyectos.findFirst((q) => q.where({ codigo: String(params.codigo) }))
    if (!p) return error(404, `No encontramos el proyecto ${String(params.codigo)}.`)
    const { estatus, comentario } = (await request.json().catch(() => ({}))) as {
      estatus?: string
      comentario?: string
    }
    if (!ESTATUS.includes(estatus as (typeof ESTATUS)[number])) {
      return errorValidacion({ estatus: 'Elige el nuevo estatus.' })
    }
    const nuevo = estatus as (typeof ESTATUS)[number]
    if (nuevo === p.estatus) return HttpResponse.json(vista(p))
    if (!TRANSICIONES[p.estatus].includes(nuevo)) {
      return error(409, `Un proyecto en estatus ${p.estatus} no puede pasar a ${nuevo}.`)
    }
    const bloqueo = bloqueoTransicion(p, nuevo)
    if (bloqueo) return error(409, bloqueo)
    const texto = (comentario ?? '').trim().slice(0, 300)
    const anterior = p.estatus
    const editado = await db.proyectos.update(p, {
      data(x) {
        x.estatus = nuevo
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} cambió el estatus de ${p.codigo} de ${anterior} a ${nuevo}`,
      {
        entidad: `proyecto:${p.codigo}`,
        justificacion: texto || null,
        valorAnterior: anterior,
        valorNuevo: nuevo,
      },
    )
    if (p.coordinadorId) {
      await db.avisos.create({
        id: `av-est-${Date.now()}`,
        usuarioId: p.coordinadorId,
        tipo: nuevo === 'Suspendido' ? 'warn' : 'info',
        titulo: `${p.codigo} pasó a ${nuevo}`,
        detalle: texto || undefined,
        enlace: `/proyectos/${p.codigo}`,
        fecha: new Date().toISOString(),
        leido: false,
      })
    }
    return HttpResponse.json(vista(editado!))
  }),

  /** F2.2: asignar o cambiar el coordinador. Pasa a la bandeja del nuevo y sale de la del anterior. */
  http.patch('/api/proyectos/:codigo/coordinador', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const p = db.proyectos.findFirst((q) => q.where({ codigo: String(params.codigo) }))
    if (!p) return error(404, `No encontramos el proyecto ${String(params.codigo)}.`)
    if (p.estatus === 'Finalizado')
      return error(409, 'El proyecto está finalizado: ya no cambia de coordinador.')
    const { coordinadorId } = (await request.json().catch(() => ({}))) as { coordinadorId?: string }
    const nuevo = coordinadorId
      ? db.usuarios.findFirst((q) => q.where({ id: coordinadorId, rol: 'coordinador', activo: true }))
      : null
    if (!nuevo) {
      return errorValidacion({ coordinadorId: 'Elige una cuenta activa con rol Coordinador de Proyecto.' })
    }
    if (nuevo.id === p.coordinadorId) return HttpResponse.json(vista(p))
    const anteriorId = p.coordinadorId
    const editado = await db.proyectos.update(p, {
      data(x) {
        x.coordinadorId = nuevo.id
        x.sinCoordinador = null
      },
    })
    await auditar(
      quien,
      'edicion',
      anteriorId
        ? `${quien.nombre} cambió el coordinador de ${p.codigo} de ${nombreUsuario(anteriorId)} a ${nuevo.nombre}`
        : `${quien.nombre} asignó a ${nuevo.nombre} como coordinador de ${p.codigo}`,
      {
        entidad: `proyecto:${p.codigo}`,
        valorAnterior: anteriorId ? nombreUsuario(anteriorId) : null,
        valorNuevo: nuevo.nombre,
      },
    )
    const ahora = new Date().toISOString()
    await db.avisos.create({
      id: `av-coord-${Date.now()}`,
      usuarioId: nuevo.id,
      tipo: 'info',
      titulo: `Te asignaron el proyecto ${p.codigo}`,
      detalle: p.nombre,
      enlace: `/proyectos/${p.codigo}`,
      fecha: ahora,
      leido: false,
    })
    if (anteriorId) {
      await db.avisos.create({
        id: `av-coord-ant-${Date.now()}`,
        usuarioId: anteriorId,
        tipo: 'info',
        titulo: `Ya no coordinas ${p.codigo}`,
        detalle: `Ahora lo coordina ${nuevo.nombre}.`,
        enlace: '/proyectos',
        fecha: ahora,
        leido: false,
      })
    }
    return HttpResponse.json(vista(editado!))
  }),
]

/**
 * Transiciones de estatus (F2.3). Finalizado es el final. Suspendido puede volver a En ejecución, como
 * muestra el mockup 07 (SP-13, resuelto).
 */
const TRANSICIONES: Record<(typeof ESTATUS)[number], (typeof ESTATUS)[number][]> = {
  Propuesta: ['En ejecución'],
  'En ejecución': ['Suspendido', 'Finalizado'],
  Suspendido: ['En ejecución', 'Finalizado'],
  Finalizado: [],
}

/** Por qué no se puede pasar a ese estatus todavía, o null si se puede. */
function bloqueoTransicion(p: Proyecto, estatus: (typeof ESTATUS)[number]) {
  if (p.estatus === 'Propuesta' && estatus === 'En ejecución') {
    if (!p.coordinadorId) return 'Primero asígnale un coordinador.'
    if (!p.planConfirmado) {
      return 'Su coordinador todavía no confirma el plan de hitos (los pesos tienen que sumar 100).'
    }
  }
  return null
}

/** Administrador: cualquier proyecto. Coordinador: solo los suyos (RN-07). También lo usa handlers/hitos.ts. */
export function accesoFicha(
  request: Request,
  codigo: string,
  roles: RolMock[] = ['administrador', 'coordinador'],
) {
  const quien = exigir(request, roles)
  if (quien instanceof Response) return quien
  const proyecto = db.proyectos.findFirst((q) => q.where({ codigo }))
  if (!proyecto) {
    return error(404, `No encontramos el proyecto ${codigo}. Revisa el código o búscalo en la lista.`)
  }
  if (quien.rol === 'coordinador' && proyecto.coordinadorId !== quien.id) {
    return error(403, `${codigo} no está asignado a ti: solo ves los proyectos que coordinas.`)
  }
  return { quien, proyecto }
}

const TIPO_CARGO = { gasto: 'Gasto', despacho: 'Despacho', compartido: 'Gastos compartidos' } as const
const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** Lo último que pasó en el proyecto: cargos y cargas de avance, como la lista del mockup 07. */
function movimientosRecientes(codigo: string) {
  const cargos = db.cargos
    .findMany((q) => q.where({ proyecto: codigo }))
    .map((c) => ({
      id: c.id,
      fecha: c.fecha,
      texto:
        c.tipo === 'despacho'
          ? `Despacho de ${minuscula(c.concepto)}`
          : c.tipo === 'gasto'
            ? `Solicitud de gasto ejecutada, ${minuscula(c.concepto)}`
            : c.concepto,
      referencia: c.referencia,
      monto: c.monto as number | null,
      nota: null as string | null,
      tipo: TIPO_CARGO[c.tipo] as string,
    }))
  const avances = db.avances
    .findMany((q) => q.where({ proyecto: codigo }))
    .map((a) => {
      const hito = db.hitos.findFirst((q) => q.where({ id: a.hitoId }))
      return {
        id: a.id,
        fecha: a.fecha,
        texto: `Avance del hito ${hito?.numero ?? '?'} cargado: ${a.porcentaje} %`,
        referencia: null,
        monto: null,
        nota: a.comentario,
        tipo: 'Avance',
      }
    })
  const todos = [...cargos, ...avances].sort((a, b) => b.fecha.localeCompare(a.fecha))
  const primeros = todos.slice(0, 4)
  // La lista mezcla todo lo que mueve al proyecto (mockup 07): si entre los 4 más recientes no hay una carga
  // de avance o gastos compartidos, entra la más reciente de cada una en lugar de los cargos más viejos.
  const ESPECIALES = ['Avance', 'Gastos compartidos']
  const faltan = ESPECIALES.filter((t) => !primeros.some((m) => m.tipo === t)).flatMap((t) =>
    todos.filter((m) => m.tipo === t).slice(0, 1),
  )
  // Salen los cargos más viejos, nunca un avance o unos gastos compartidos que ya estaban entre los 4
  const cargosEnLista = primeros.filter((m) => !ESPECIALES.includes(m.tipo))
  const salen = new Set(cargosEnLista.slice(cargosEnLista.length - faltan.length))
  return [...primeros.filter((m) => !salen.has(m)), ...faltan].sort((a, b) => b.fecha.localeCompare(a.fecha))
}
