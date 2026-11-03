import { http, HttpResponse } from 'msw'
import { fechaIso, nombreMes } from '@/lib/formato'
import { NOMBRE_ROL } from '@/types/roles'
import { db } from '../db'
import { demora, exigir } from '../utils'

/*
 * Auditoría global (M8; vista 25; F8.5, F8.6). Solo lectura (RN-06): no hay PUT ni DELETE.
 *   GET /api/auditoria?usuario&accion&objeto&desde&pagina   lo más reciente primero, 10 por página
 */

const POR_PAGINA = 10

type Registro = ReturnType<typeof db.auditoria.findMany>[number]

const ESTADO_PERIODO: Record<string, string> = {
  abierto: 'Abierto',
  en_revision: 'En revisión',
  cerrado: 'Cerrado',
  prorrateado: 'Repartido',
}

/** Nombre del registro afectado y, si el Administrador puede abrirlo, a dónde lleva (L8). */
function objeto(entidad: string | null): { texto: string; codigo: string | null; enlace: string | null } {
  if (!entidad) return { texto: '—', codigo: null, enlace: null }
  const [tipo, id] = entidad.split(':')
  switch (tipo) {
    case 'proyecto':
      return { texto: `Proyecto ${id}`, codigo: id, enlace: `/proyectos/${id}` }
    // Las sesiones van aparte de los cambios de la cuenta (que filtran usuarios y ficha)
    case 'sesion':
    case 'usuario': {
      const u = db.usuarios.findFirst((q) => q.where({ id }))
      return { texto: `Cuenta ${u?.correo ?? id}`, codigo: null, enlace: '/usuarios' }
    }
    case 'insumo': {
      const i = db.insumos.findFirst((q) => q.where({ id }))
      return { texto: `Insumo ${i?.nombre ?? id}`, codigo: null, enlace: `/inventario/${id}` }
    }
    case 'lote': {
      const l = db.lotes.findFirst((q) => q.where({ codigo: id }))
      return { texto: `Lote ${id}`, codigo: id, enlace: l ? `/inventario/${l.insumoId}` : null }
    }
    case 'equipo': {
      const e = db.equipos.findFirst((q) => q.where({ id }))
      return { texto: `Equipo ${e?.nombre ?? id}`, codigo: e?.codigo ?? null, enlace: '/equipos' }
    }
    case 'ubicacion': {
      const u = db.ubicaciones.findFirst((q) => q.where({ id }))
      return { texto: `Ubicación ${u?.nombre ?? id}`, codigo: null, enlace: '/ubicaciones-parametros' }
    }
    case 'parametro':
      return {
        texto: `Parámetro ${id.replaceAll('_', ' ')}`,
        codigo: null,
        enlace: '/ubicaciones-parametros',
      }
    case 'solicitud':
      return { texto: `${id.startsWith('REP') ? 'Reposición' : 'Solicitud'} ${id}`, codigo: id, enlace: null }
    case 'reserva':
      return { texto: `Reserva ${id}`, codigo: id, enlace: null }
    case 'correccion':
      return { texto: `Corrección ${id}`, codigo: id, enlace: null }
    case 'despacho':
      return { texto: `Despacho ${id}`, codigo: id, enlace: null }
    case 'periodo': {
      const p = db.periodos.findFirst((q) => q.where({ id }))
      return {
        texto: p ? `Período ${nombreMes(p.inicio)} de ${p.inicio.slice(0, 4)}` : `Período ${id}`,
        codigo: null,
        enlace: null,
      }
    }
    default:
      return { texto: entidad, codigo: null, enlace: null }
  }
}

/** Cómo se lee la acción en la tabla (mockup 25): "Cambio de prioridad", "Inicio de sesión"… */
function etiqueta(r: Registro) {
  if (r.accion === 'creacion') return 'Creación'
  if (r.accion === 'cambio-estado') return 'Cambio de estado'
  if (r.accion === 'sesion')
    return r.descripcion.includes('cerró sesión') ? 'Cierre de sesión' : 'Inicio de sesión'
  if (r.descripcion.includes('la prioridad')) return 'Cambio de prioridad'
  if (r.descripcion.includes('el rol')) return 'Cambio de rol'
  return 'Edición'
}

const legible = (v: string | null, entidad: string | null) =>
  v && entidad?.startsWith('periodo:') ? (ESTADO_PERIODO[v] ?? v) : v

function aRespuesta(r: Registro) {
  const u = db.usuarios.findFirst((q) => q.where({ id: r.usuarioId }))
  const o = objeto(r.entidad)
  const nuevo = legible(r.valorNuevo, r.entidad)
  return {
    id: r.id,
    fecha: r.fecha,
    usuario: u ? { nombre: u.nombre, rol: NOMBRE_ROL[u.rol] } : null,
    ip: u ? r.ip : null,
    accion: r.accion,
    etiqueta: etiqueta(r),
    // "Solicitud SOL-121 a Aprobado": el estado al que pasó, como en el mockup
    objeto: r.accion === 'cambio-estado' && nuevo ? `${o.texto} a ${nuevo}` : o.texto,
    codigo: o.codigo,
    enlace: o.enlace,
    descripcion: r.descripcion,
    detalle: r.detalle,
    justificacion: r.justificacion,
    valorAnterior: legible(r.valorAnterior, r.entidad),
    valorNuevo: nuevo,
  }
}

export const handlersAuditoria = [
  http.get('/api/auditoria', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const q = new URL(request.url).searchParams
    const usuario = q.get('usuario') ?? ''
    const accion = q.get('accion') ?? ''
    const texto = (q.get('objeto') ?? '').trim().toLowerCase()
    const desde = q.get('desde') ?? ''
    const todos = db.auditoria.findMany(undefined, { orderBy: { fecha: 'desc' } })
    const filtrados = todos.filter((r) => {
      if (usuario && r.usuarioId !== usuario) return false
      if (accion && r.accion !== accion) return false
      if (desde && fechaIso(r.fecha) < desde) return false
      if (texto) {
        const o = objeto(r.entidad)
        const donde = `${o.texto} ${o.codigo ?? ''} ${r.entidad ?? ''} ${r.descripcion}`.toLowerCase()
        if (!donde.includes(texto)) return false
      }
      return true
    })
    const paginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA))
    const pagina = Math.min(Math.max(1, Number(q.get('pagina')) || 1), paginas)
    const ids = new Set(todos.map((r) => r.usuarioId))
    return HttpResponse.json({
      total: todos.length,
      filtrados: filtrados.length,
      pagina,
      paginas,
      porPagina: POR_PAGINA,
      registros: filtrados.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map(aRespuesta),
      // Para el filtro: quienes tienen registros, en orden alfabético
      usuarios: db.usuarios
        .findMany((x) => x.where({ id: (id) => ids.has(id) }))
        .map(({ id, nombre }) => ({ id, nombre }))
        .sort((a, b) => a.nombre.localeCompare(b.nombre)),
    })
  }),
]
