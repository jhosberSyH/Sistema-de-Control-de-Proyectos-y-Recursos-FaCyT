import { http, HttpResponse } from 'msw'
import { proyectosDe } from '../consultas'
import { db } from '../db'
import { demora, exigir } from '../utils'

/*
 * Búsqueda global (barra superior). GET /api/buscar?q=texto
 * Cada rol encuentra solo lo que puede abrir: el Coordinador, los proyectos y pedidos propios (RN-07);
 * el Aprobador, los pedidos que le llegan; el Administrador, los proyectos y los equipos.
 */

const POR_GRUPO = 6
const MINIMO = 2

type Resultado = { id: string; titulo: string; detalle: string; enlace: string }
type Grupo = {
  clave: 'proyectos' | 'insumos' | 'equipos' | 'solicitudes'
  titulo: string
  total: number
  resultados: Resultado[]
}

const normal = (t: string) =>
  t
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
const coincide = (q: string, ...campos: (string | null)[]) =>
  normal(campos.filter(Boolean).join(' ')).includes(q)

function grupo(clave: Grupo['clave'], titulo: string, todos: Resultado[]): Grupo {
  return { clave, titulo, total: todos.length, resultados: todos.slice(0, POR_GRUPO) }
}

export const handlersBusqueda = [
  http.get('/api/buscar', async ({ request }) => {
    await demora()
    const u = exigir(request)
    if (u instanceof Response) return u
    const texto = (new URL(request.url).searchParams.get('q') ?? '').trim()
    if (texto.length < MINIMO) return HttpResponse.json({ q: texto, grupos: [] })
    const q = normal(texto)
    const grupos: Grupo[] = []
    const mios = u.rol === 'coordinador' ? new Set(proyectosDe(u.id).map((p) => p.codigo)) : null

    if (u.rol === 'administrador' || u.rol === 'coordinador') {
      const proyectos = db.proyectos
        .findMany()
        .filter((p) => (!mios || mios.has(p.codigo)) && coincide(q, p.codigo, p.nombre, p.area))
        .sort((a, b) => a.codigo.localeCompare(b.codigo))
        .map((p) => ({
          id: p.codigo,
          titulo: `${p.codigo} · ${p.nombre}`,
          detalle: `${p.area} · ${p.estatus}`,
          enlace: `/proyectos/${p.codigo}`,
        }))
      grupos.push(grupo('proyectos', 'Proyectos', proyectos))
    }

    const insumos = db.insumos
      .findMany()
      .filter((i) => coincide(q, i.nombre, i.tipo))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((i) => ({
        id: i.id,
        titulo: i.nombre,
        detalle: `${i.tipo} · ${i.stock} ${i.unidad} en stock`,
        enlace:
          u.rol === 'coordinador' ? `/inventario?q=${encodeURIComponent(i.nombre)}` : `/inventario/${i.id}`,
      }))
    grupos.push(grupo('insumos', 'Insumos', insumos))

    const equipos = db.equipos
      .findMany()
      .filter((e) => coincide(q, e.nombre, e.codigo))
      .sort((a, b) => a.nombre.localeCompare(b.nombre))
      .map((e) => ({
        id: e.id,
        titulo: e.nombre,
        detalle: `${e.codigo} · ${e.estado}`,
        enlace: u.rol === 'administrador' ? `/equipos?q=${encodeURIComponent(e.codigo)}` : '/reservas',
      }))
    grupos.push(grupo('equipos', 'Equipos', equipos))

    if (u.rol === 'coordinador' || u.rol === 'aprobador') {
      const solicitudes = db.solicitudes
        .findMany()
        .filter((s) => {
          if (mios ? !(s.proyecto && mios.has(s.proyecto)) : s.estado === 'Borrador') return false
          return coincide(q, s.id, s.descripcion, s.proyecto, s.insumoServicio)
        })
        .sort((a, b) => b.id.localeCompare(a.id))
        .map((s) => ({
          id: s.id,
          titulo: `${s.id} · ${s.descripcion}`,
          detalle: `${s.proyecto ?? 'Sin proyecto'} · ${s.estado}`,
          enlace:
            u.rol === 'coordinador'
              ? '/solicitudes'
              : `/bandeja?${s.tipo === 'reposicion' ? 'tipo=reposicion&' : ''}pedido=${s.id}`,
        }))
      grupos.push(grupo('solicitudes', 'Solicitudes', solicitudes))
    }

    return HttpResponse.json({ q: texto, grupos })
  }),
]
