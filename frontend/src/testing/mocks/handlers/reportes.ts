import { http, HttpResponse } from 'msw'
import { fechaCorta, fechaIso, hora, moneda, nombreMes } from '@/lib/formato'
import { pdf, texto, xlsx, type Hoja } from '../archivos'
import { PROYECTO_NO_EXISTE, proyectoPorId, proyectosDe } from '../consultas'
import { dia, mesAtras } from '../datos/fechas'
import { db } from '../db'
import { demora, error, errorValidacion, exigir } from '../utils'

/*
 * Reportes (M8; vista 24; F8.2 a F8.4). El Coordinador ve y exporta solo sus proyectos (RN-07); el
 * Aprobador y el Administrador, todos.
 *   GET /api/reportes/opciones                       proyectos, períodos repartidos y equipos del alcance
 *   GET /api/reportes/vista-previa?tipo&...          primera página del reporte, o por qué no hay datos
 *   GET /api/reportes/:tipo?formato=pdf|xlsx&...     el archivo (409 si no hay datos: no se genera vacío)
 * tipo: gastos (F8.2), reparto (F8.3) u hoja-de-vida (F8.4). Filtros: desde, hasta, proyectoIds
 * ("todos", "activos" o UUIDs de proyectos separados por comas), periodo y equipo.
 */

type Usuario = Exclude<ReturnType<typeof exigir>, Response>
type Tipo = 'gastos' | 'reparto' | 'hoja-de-vida'
const TIPOS: Tipo[] = ['gastos', 'reparto', 'hoja-de-vida']

const nombrePeriodo = (p: { tipo: string; inicio: string; fin: string }) =>
  p.tipo === 'mensual'
    ? `${nombreMes(p.inicio)} de ${p.inicio.slice(0, 4)}`
    : `el trimestre del ${fechaCorta(p.inicio)} al ${fechaCorta(p.fin)}`

/** Proyectos que el usuario puede incluir en un reporte (RN-07). */
function alcance(u: Usuario) {
  return (u.rol === 'coordinador' ? proyectosDe(u.id) : db.proyectos.findMany()).sort((a, b) =>
    a.codigo.localeCompare(b.codigo),
  )
}

type Filtros = {
  tipo: Tipo
  desde: string
  hasta: string
  proyectos: string[]
  /** Cómo se nombran los proyectos elegidos en el encabezado: "QUI-024, QUI-031" o "todos (11)". */
  etiqueta: string
  /** Para "No hay gastos de …": el código si es uno solo. */
  sujeto: string
  periodoId: string | null
  equipoId: string | null
}

function leerFiltros(u: Usuario, tipo: string, url: URL): Filtros | Response {
  const q = (k: string) => url.searchParams.get(k) ?? ''
  if (!TIPOS.includes(tipo as Tipo)) return error(404, 'Ese reporte no existe.')
  const errores: Record<string, string> = {}
  const fecha = (v: string) => (/^\d{4}-\d{2}-\d{2}$/.test(v) ? v : null)
  const desde = fecha(q('desde'))
  const hasta = fecha(q('hasta'))
  if (tipo !== 'reparto') {
    if (!desde) errores.desde = 'Elige la fecha de inicio.'
    if (!hasta) errores.hasta = 'Elige la fecha de fin.'
    else if (desde && hasta < desde) errores.hasta = 'El fin tiene que ser después del inicio.'
  }
  if (tipo === 'reparto' && !q('periodo')) errores.periodo = 'Elige el período repartido.'
  if (tipo === 'hoja-de-vida' && !q('equipo')) errores.equipo = 'Elige el equipo.'
  if (Object.keys(errores).length > 0) return errorValidacion(errores)

  const propios = alcance(u)
  const pedido = q('proyectoIds') || 'todos'
  let proyectos = propios
  let etiqueta =
    u.rol === 'coordinador' ? propios.map((p) => p.codigo).join(', ') : `todos (${propios.length})`
  let sujeto = u.rol === 'coordinador' ? 'tus proyectos' : 'ningún proyecto'
  if (pedido === 'activos') {
    proyectos = propios.filter((p) => p.estatus === 'En ejecución')
    etiqueta =
      u.rol === 'coordinador' ? proyectos.map((p) => p.codigo).join(', ') : `activos (${proyectos.length})`
    sujeto = 'los proyectos activos'
  } else if (pedido !== 'todos') {
    const ids = [...new Set(pedido.split(',').map((x) => x.trim()))].filter(Boolean)
    if (ids.some((id) => !proyectoPorId(id))) return error(404, PROYECTO_NO_EXISTE)
    const elegidos = propios.filter((p) => ids.includes(p.id))
    if (elegidos.length !== ids.length) return error(404, 'Ese proyecto no es tuyo.')
    proyectos = elegidos
    etiqueta = elegidos.map((p) => p.codigo).join(', ')
    sujeto = etiqueta
  }
  return {
    tipo: tipo as Tipo,
    desde: desde ?? '',
    hasta: hasta ?? '',
    proyectos: proyectos.map((p) => p.codigo),
    etiqueta,
    sujeto,
    periodoId: q('periodo') || null,
    equipoId: q('equipo') || null,
  }
}

type Reporte = { hoja: Hoja; archivo: string; vacio: { titulo: string; detalle: string } | null }

const generado = (u: Usuario) => {
  const ahora = new Date()
  return `Generado el ${fechaCorta(ahora)} a las ${hora(ahora)} por ${u.nombre}`
}
const sinArchivoVacio = 'no generamos un archivo vacío.'

/** F8.2: gastos ejecutados, despachos valorizados y gastos compartidos de cada proyecto en el rango. */
function analisisDeGastos(u: Usuario, f: Filtros): Reporte {
  const cargos = db.cargos.findMany((q) =>
    q.where({ proyecto: (p) => f.proyectos.includes(p), fecha: (x) => x >= f.desde && x <= f.hasta }),
  )
  const suma = (codigo: string, tipo: string) =>
    Math.round(
      cargos.filter((c) => c.proyecto === codigo && c.tipo === tipo).reduce((t, c) => t + c.monto, 0) * 100,
    ) / 100
  const filas = f.proyectos
    .map((codigo) => {
      const [g, d, c] = [suma(codigo, 'gasto'), suma(codigo, 'despacho'), suma(codigo, 'compartido')]
      return [codigo, g, d, c, Math.round((g + d + c) * 100) / 100] as (string | number)[]
    })
    .filter((x) => x.slice(1).some((v) => v !== 0))
  if (filas.length > 1) {
    filas.push([
      'Total',
      ...[1, 2, 3, 4].map((i) => Math.round(filas.reduce((t, x) => t + Number(x[i]), 0) * 100) / 100),
    ])
  }
  const uno =
    f.proyectos.length === 1 ? db.proyectos.findFirst((q) => q.where({ codigo: f.proyectos[0] })) : null
  return {
    archivo: `analisis-de-gastos-${fechaIso()}`,
    hoja: {
      titulo: 'Análisis de gastos',
      lineas: [
        `Período: ${fechaCorta(f.desde)} al ${fechaCorta(f.hasta)} · Proyectos: ${f.etiqueta}`,
        generado(u),
      ],
      tablas: [
        {
          columnas: [
            { titulo: 'Proyecto', formato: 'texto', ancho: 18 },
            { titulo: 'Gastos', formato: 'moneda', ancho: 16 },
            { titulo: 'Despachos', formato: 'moneda', ancho: 16 },
            { titulo: 'Gastos compartidos', formato: 'moneda', ancho: 22 },
            { titulo: 'Total', formato: 'moneda', ancho: 16 },
          ],
          filas,
        },
      ],
      nota: 'Montos en US$. Solo incluye solicitudes de gasto en estado Ejecutado. Los despachos se valorizan al costo unitario de cada lote.',
    },
    vacio:
      filas.length > 0
        ? null
        : {
            titulo: `No hay gastos de ${f.sujeto} entre el ${fechaCorta(f.desde)} y el ${fechaCorta(f.hasta)}.`,
            detalle:
              uno && f.desde < uno.registradoEl
                ? `El proyecto se registró el ${fechaCorta(uno.registradoEl)}. Cambia el período; ${sinArchivoVacio}`
                : `Cambia el período o los proyectos; ${sinArchivoVacio}`,
          },
  }
}

/** F8.3: el reparto aplicado de un período, con el criterio, el total y la parte de cada proyecto. */
function resumenDelReparto(u: Usuario, f: Filtros): Reporte | Response {
  const p = db.periodos.findFirst((q) => q.where({ id: f.periodoId! }))
  if (!p) return error(404, 'Ese período no existe.')
  const r = db.repartos.findFirst((q) => q.where({ periodoId: p.id }))
  if (!r) return error(409, `Los gastos compartidos de ${nombrePeriodo(p)} todavía no se repartieron.`)
  const filas: (string | number)[][] = r.filas
    .filter((x) => f.proyectos.includes(x.proyecto))
    .map((x) => [x.proyecto, x.consumo, x.porcentaje, x.monto])
  if (filas.length > 1) {
    const s = (i: number) => Math.round(filas.reduce((t, x) => t + Number(x[i]), 0) * 100) / 100
    filas.push(['Total', s(1), Math.round(s(2) * 10) / 10, s(3)])
  }
  return {
    archivo: `resumen-reparto-${p.inicio.slice(0, 7)}`,
    hoja: {
      titulo: 'Resumen del reparto de gastos compartidos',
      lineas: [
        `Período: ${nombrePeriodo(p)} (${fechaCorta(p.inicio)} al ${fechaCorta(p.fin)}) · Criterio: ${r.criterio === 'consumo' ? 'según el consumo de cada proyecto' : 'en partes iguales'}`,
        `Total repartido: ${moneda(r.total)} entre ${r.filas.length} proyectos activos · Proyectos: ${f.etiqueta}`,
        generado(u),
      ],
      tablas: [
        {
          columnas: [
            { titulo: 'Proyecto', formato: 'texto', ancho: 22 },
            { titulo: 'Consumo', formato: 'moneda', ancho: 20 },
            { titulo: 'Porcentaje', formato: 'porcentaje', ancho: 16 },
            { titulo: 'Monto', formato: 'moneda', ancho: 20 },
          ],
          filas,
        },
      ],
      nota: 'Montos en US$. El consumo suma la materia prima y los insumos despachados al proyecto en el período.',
    },
    vacio:
      filas.length > 0
        ? null
        : {
            titulo: `${f.sujeto === 'tus proyectos' ? 'Tus proyectos no participaron' : `${f.sujeto} no participó`} en el reparto de ${nombrePeriodo(p)}.`,
            detalle: `Solo participan los proyectos En ejecución durante el período. Elige otro período; ${sinArchivoVacio}`,
          },
  }
}

const horasEntre = (inicio: string, fin: string | null) =>
  Math.max(0, ((fin ? Date.parse(fin) : Date.now()) - Date.parse(inicio)) / 3_600_000)

/** F8.4: datos del equipo, cambios de estado, reservas y horas de uso por proyecto en el rango. */
function hojaDeVida(u: Usuario, f: Filtros): Reporte | Response {
  const e = db.equipos.findFirst((q) => q.where({ id: f.equipoId! }))
  if (!e) return error(404, 'Ese equipo no existe.')
  const enRango = (fecha: string) => {
    const d = fechaIso(fecha)
    return d >= f.desde && d <= f.hasta
  }
  // RN-07: el Coordinador ve solo los usos y las reservas de sus proyectos
  const usos = db.usos
    .findMany((q) => q.where({ equipoId: e.id, proyecto: (p) => f.proyectos.includes(p) }))
    .filter((x) => enRango(x.inicio))
  const reservas = db.reservas
    .findMany((q) => q.where({ equipoId: e.id, proyecto: (p) => f.proyectos.includes(p) }))
    .filter((x) => enRango(x.inicio))
  const cambios = db.auditoria
    .findMany((q) => q.where({ entidad: `equipo:${e.id}`, accion: 'cambio-estado' }))
    .filter((x) => enRango(x.fecha))
  const ubicacion = db.ubicaciones.findFirst((q) => q.where({ id: e.ubicacionId }))?.nombre ?? '—'

  const porProyecto = [...new Set([...usos, ...reservas].map((x) => x.proyecto))].sort().map((codigo) => {
    const suyos = usos.filter((x) => x.proyecto === codigo)
    return [
      codigo,
      suyos.length,
      Math.round(suyos.reduce((t, x) => t + horasEntre(x.inicio, x.fin), 0) * 10) / 10,
      reservas.filter((x) => x.proyecto === codigo && x.estado === 'aprobada').length,
    ] as (string | number)[]
  })
  const historial: (string | number)[][] = [
    ...cambios.map((c) => ({ fecha: c.fecha, evento: c.descripcion, proyecto: '—' })),
    ...reservas.map((r) => ({
      fecha: r.inicio,
      evento: `Reserva ${r.id} (${r.estado})`,
      proyecto: r.proyecto,
    })),
    ...usos.map((x) => ({
      fecha: x.inicio,
      evento: x.fin ? `Uso de ${Math.round(horasEntre(x.inicio, x.fin) * 10) / 10} h` : 'Uso en curso',
      proyecto: x.proyecto,
    })),
  ]
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
    .map((x) => [`${fechaCorta(x.fecha)} ${hora(x.fecha)}`, x.evento, x.proyecto])

  return {
    archivo: `hoja-de-vida-${e.codigo}`,
    hoja: {
      titulo: `Hoja de vida: ${e.nombre}`,
      lineas: [
        `Equipo: ${e.codigo} · ${ubicacion} · Estado: ${e.estado}`,
        `Período: ${fechaCorta(f.desde)} al ${fechaCorta(f.hasta)} · Proyectos: ${f.etiqueta}`,
        generado(u),
      ],
      tablas: [
        {
          columnas: [
            { titulo: 'Proyecto', formato: 'texto', ancho: 22 },
            { titulo: 'Usos', formato: 'numero', ancho: 12 },
            { titulo: 'Horas de uso', formato: 'numero', ancho: 16 },
            { titulo: 'Reservas aprobadas', formato: 'numero', ancho: 20 },
          ],
          filas: porProyecto,
        },
        {
          titulo: 'Historial',
          columnas: [
            { titulo: 'Fecha', formato: 'texto', ancho: 18 },
            { titulo: 'Evento', formato: 'texto', ancho: 56 },
            { titulo: 'Proyecto', formato: 'texto', ancho: 14 },
          ],
          filas: historial,
        },
      ],
      nota:
        e.estado === 'En mantenimiento' && e.mantenimiento
          ? `En mantenimiento desde el ${fechaCorta(e.mantenimiento.desde)}: ${e.mantenimiento.motivo}`
          : null,
    },
    vacio:
      historial.length > 0
        ? null
        : {
            titulo: `No hay usos, reservas ni cambios de estado de ${e.nombre} entre el ${fechaCorta(f.desde)} y el ${fechaCorta(f.hasta)}.`,
            detalle: `Cambia el período; ${sinArchivoVacio}`,
          },
  }
}

function armar(u: Usuario, tipo: string, url: URL): Reporte | Response {
  const f = leerFiltros(u, tipo, url)
  if (f instanceof Response) return f
  if (f.tipo === 'gastos') return analisisDeGastos(u, f)
  if (f.tipo === 'reparto') return resumenDelReparto(u, f)
  return hojaDeVida(u, f)
}

export const handlersReportes = [
  http.get('/api/reportes/opciones', async ({ request }) => {
    await demora()
    const u = exigir(request)
    if (u instanceof Response) return u
    return HttpResponse.json({
      alcance: u.rol === 'coordinador' ? 'propios' : 'todos',
      proyectos: alcance(u).map(({ id, codigo, nombre, estatus }) => ({ id, codigo, nombre, estatus })),
      // Los cerrados sin repartir también salen, marcados: el resumen existe solo después del reparto (HU-25)
      periodos: db.periodos
        .findMany((q) => q.where({ estado: (e) => e === 'prorrateado' || e === 'cerrado' }))
        .sort((a, b) => b.inicio.localeCompare(a.inicio))
        .map((p) => ({ id: p.id, nombre: nombrePeriodo(p), repartido: p.estado === 'prorrateado' })),
      equipos: db.equipos
        .findMany()
        .sort((a, b) => a.nombre.localeCompare(b.nombre))
        .map(({ id, nombre, codigo }) => ({ id, nombre, codigo })),
      // Los últimos cinco meses hasta hoy (mockup 24: de junio a octubre)
      sugerido: { desde: mesAtras(4).inicio, hasta: dia(0) },
    })
  }),

  /** La primera página del reporte, para la vista previa, o el aviso de que no hay datos. */
  http.get('/api/reportes/vista-previa', async ({ request }) => {
    await demora()
    const u = exigir(request)
    if (u instanceof Response) return u
    const url = new URL(request.url)
    const r = armar(u, url.searchParams.get('tipo') ?? '', url)
    if (r instanceof Response) return r
    const [tabla] = r.hoja.tablas
    const visibles = tabla.filas.slice(0, 8)
    return HttpResponse.json({
      titulo: r.hoja.titulo,
      lineas: r.hoja.lineas,
      columnas: tabla.columnas.map((c) => ({ titulo: c.titulo, numerica: c.formato !== 'texto' })),
      filas: visibles.map((x) => x.map((v, i) => texto(v, tabla.columnas[i].formato))),
      nota: r.hoja.nota,
      paginas: r.vacio ? 0 : pdf(r.hoja).paginas,
      vacio: r.vacio,
    })
  }),

  /** El archivo, con los filtros en el encabezado. Sin datos no se genera (F8.2). */
  http.get('/api/reportes/:tipo', async ({ request, params }) => {
    await demora()
    const u = exigir(request)
    if (u instanceof Response) return u
    const url = new URL(request.url)
    const formato = url.searchParams.get('formato')
    if (formato !== 'pdf' && formato !== 'xlsx') return errorValidacion({ formato: 'Elige PDF o Excel.' })
    const r = armar(u, String(params.tipo), url)
    if (r instanceof Response) return r
    if (r.vacio) return error(409, `${r.vacio.titulo} ${r.vacio.detalle}`)
    const bytes = formato === 'pdf' ? pdf(r.hoja).bytes : xlsx(r.hoja)
    return new HttpResponse(bytes, {
      headers: {
        'Content-Type':
          formato === 'pdf'
            ? 'application/pdf'
            : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="${r.archivo}.${formato}"`,
      },
    })
  }),
]
