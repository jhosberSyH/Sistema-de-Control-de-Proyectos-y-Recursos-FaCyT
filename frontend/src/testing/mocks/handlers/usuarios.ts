import { http, HttpResponse } from 'msw'
import { proyectosVigentesDe } from '../consultas'
import { dia } from '../datos/fechas'
import { db } from '../db'
import {
  auditar,
  claveTemporal,
  demora,
  error,
  errorValidacion,
  exigir,
  iniciales,
  type RolMock,
} from '../utils'

/*
 * Cuentas de usuario (F1.1 a F1.3, RF-01), solo para el Administrador del Sistema.
 *   GET   /api/usuarios?q&rol&estado&pagina    lista paginada (8 por página, como el mockup 04)
 *   GET   /api/usuarios/:id/impacto            qué pasa si cambia de rol o se desactiva
 *   POST  /api/usuarios                        crea la cuenta con contraseña temporal
 *   PATCH /api/usuarios/:id                    nombre, correo y rol
 *   PATCH /api/usuarios/:id/estado             desactiva o reactiva
 *   POST  /api/usuarios/:id/clave-temporal     restablece la contraseña
 * Una cuenta nunca se borra: se desactiva y conserva su historial (F1.3).
 */

const POR_PAGINA = 8
const ROLES: RolMock[] = ['administrador', 'coordinador', 'aprobador']
const NOMBRE_ROL: Record<RolMock, string> = {
  administrador: 'Administrador del Sistema',
  coordinador: 'Coordinador de Proyecto',
  aprobador: 'Aprobador / Gestor de Inventario',
}
const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type Usuario = NonNullable<ReturnType<typeof db.usuarios.findFirst>>

/** Sin mayúsculas ni tildes, para buscar "maria" y encontrar "María". */
const normalizar = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** La cuenta como la ve la lista: nunca incluye la contraseña. */
function cuenta(u: Usuario, quien: Usuario) {
  return {
    id: u.id,
    nombre: u.nombre,
    correo: u.correo,
    iniciales: iniciales(u.nombre),
    rol: u.rol,
    activo: u.activo,
    ultimoAcceso: u.ultimoAcceso,
    debeCambiarClave: u.debeCambiarClave,
    // Columna "Proyectos que coordina": los activos (RN-05), como en el mockup.
    proyectos: db.proyectos
      .findMany((q) => q.where({ coordinadorId: u.id, estatus: 'En ejecución' }))
      .map((p) => p.codigo)
      .sort(),
    esPropia: u.id === quien.id,
  }
}

function buscar(id: string) {
  return db.usuarios.findFirst((q) => q.where({ id }))
}

type Datos = { nombre?: string; correo?: string; rol?: string }

/** Valida los datos de la cuenta; devuelve los datos limpios o la respuesta 422 / 409. */
function validar(cuerpo: Datos, quien: Usuario, propio?: Usuario) {
  const nombre = (cuerpo.nombre ?? '').trim().replace(/\s+/g, ' ')
  const correo = (cuerpo.correo ?? '').trim().toLowerCase()
  const rol = cuerpo.rol as RolMock
  const errores: Record<string, string> = {}
  if (nombre.length < 3) errores.nombre = 'Escribe el nombre y el apellido de la persona.'
  if (!CORREO.test(correo)) errores.correo = 'Escribe un correo válido, como nombre@uc.edu.ve.'
  if (!ROLES.includes(rol)) errores.rol = 'Elige el rol de la cuenta.'
  if (Object.keys(errores).length) return errorValidacion(errores)

  const otra = db.usuarios.findFirst((q) => q.where({ correo }))
  if (otra && otra.id !== propio?.id) {
    // F1.1 y F1.2: se muestra la cuenta que ya usa el correo, no solo el error.
    return HttpResponse.json(
      { detail: { mensaje: 'Ya existe una cuenta con ese correo.', cuenta: cuenta(otra, quien) } },
      { status: 409 },
    )
  }
  return { nombre, correo, rol }
}

/** Deja sin coordinador los proyectos vigentes de la cuenta; quedan en la bandeja del administrador (F1.2, F2.2). */
async function liberarProyectos(u: Usuario, motivo: string) {
  const proyectos = proyectosVigentesDe(u.id)
  for (const p of proyectos) {
    await db.proyectos.update(p, {
      data(x) {
        x.coordinadorId = null
        x.sinCoordinador = { motivo, fecha: dia(0) }
      },
    })
  }
  return proyectos.map((p) => p.codigo)
}

const sinCoordinadorTexto = (codigos: string[]) =>
  codigos.length === 0
    ? null
    : `${codigos.join(', ')} ${codigos.length === 1 ? 'quedó' : 'quedaron'} sin coordinador`

const ORDEN_ROL = { administrador: 0, aprobador: 1, coordinador: 2 } as const

export const handlersUsuarios = [
  http.get('/api/usuarios', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const q = normalizar(url.searchParams.get('q')?.trim() ?? '')
    const rol = url.searchParams.get('rol') as RolMock | null
    const estado = url.searchParams.get('estado') ?? 'activas'

    const filtradas = db.usuarios
      .findMany((x) =>
        x.where((u) => {
          if (q && !normalizar(u.nombre).includes(q) && !u.correo.includes(q)) return false
          if (rol && ROLES.includes(rol) && u.rol !== rol) return false
          if (estado === 'activas') return u.activo
          if (estado === 'desactivadas') return !u.activo
          return true
        }),
      )
      // Activas primero y, dentro de cada grupo, por rol (administrador, aprobador, coordinadores) y nombre: como el mockup 04
      .sort(
        (a, b) =>
          Number(b.activo) - Number(a.activo) ||
          ORDEN_ROL[a.rol] - ORDEN_ROL[b.rol] ||
          a.nombre.localeCompare(b.nombre, 'es'),
      )

    const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
    const pagina = Math.min(Math.max(1, Number(url.searchParams.get('pagina')) || 1), paginas)
    return HttpResponse.json({
      items: filtradas.slice((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA).map((u) => cuenta(u, quien)),
      total: filtradas.length,
      pagina,
      paginas,
      porPagina: POR_PAGINA,
    })
  }),

  http.get('/api/usuarios/:id/impacto', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const u = buscar(String(params.id))
    if (!u) return error(404, 'Esa cuenta no existe.')
    const activosDelRol = db.usuarios.findMany((q) => q.where({ rol: u.rol, activo: true })).length
    return HttpResponse.json({
      proyectos: proyectosVigentesDe(u.id).map((p) => ({ id: p.id, codigo: p.codigo, estatus: p.estatus })),
      solicitudesPendientes: db.solicitudes
        .findMany((q) => q.where({ creadaPor: u.id, estado: 'Pendiente de Aprobación' }))
        .map((s) => s.numero),
      unicoDeSuRol: u.activo && activosDelRol === 1,
    })
  }),

  http.post('/api/usuarios', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const datos = validar((await request.json().catch(() => ({}))) as Datos, quien)
    if (datos instanceof Response) return datos

    const clave = claveTemporal()
    const nueva = await db.usuarios.create({
      id: `u-${Date.now().toString(36)}`,
      ...datos,
      clave,
      activo: true,
      debeCambiarClave: true,
      ultimoAcceso: null,
    })
    await auditar(quien, 'creacion', `${quien.nombre} creó la cuenta de ${nueva.nombre}`, {
      detalle: `${NOMBRE_ROL[nueva.rol]} · ${nueva.correo}`,
      entidad: `usuario:${nueva.id}`,
    })
    return HttpResponse.json({ cuenta: cuenta(nueva, quien), claveTemporal: clave }, { status: 201 })
  }),

  http.patch('/api/usuarios/:id', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const u = buscar(String(params.id))
    if (!u) return error(404, 'Esa cuenta no existe.')
    const datos = validar((await request.json().catch(() => ({}))) as Datos, quien, u)
    if (datos instanceof Response) return datos

    const cambiaRol = datos.rol !== u.rol
    if (cambiaRol && u.id === quien.id) {
      return error(409, 'No puedes cambiar tu propio rol. Pídeselo a otro administrador.')
    }
    const cambios = [
      datos.nombre !== u.nombre && `Nombre: ${u.nombre} → ${datos.nombre}`,
      datos.correo !== u.correo && `Correo: ${u.correo} → ${datos.correo}`,
    ].filter(Boolean) as string[]
    if (!cambiaRol && cambios.length === 0) return HttpResponse.json(cuenta(u, quien))

    // El cambio de rol aplica desde la siguiente acción de la persona: cada petición lee su rol actual.
    const liberados =
      cambiaRol && u.rol === 'coordinador'
        ? await liberarProyectos(u, `al cambiar el rol de ${u.nombre}`)
        : []
    const rolAnterior = u.rol
    const nombreAnterior = u.nombre
    const editada = await db.usuarios.update(u, {
      data(x) {
        x.nombre = datos.nombre
        x.correo = datos.correo
        x.rol = datos.rol
      },
    })
    await auditar(
      quien,
      'edicion',
      cambiaRol
        ? `${quien.nombre} cambió el rol de ${nombreAnterior} de ${NOMBRE_ROL[rolAnterior]} a ${NOMBRE_ROL[datos.rol]}`
        : `${quien.nombre} editó los datos de la cuenta de ${nombreAnterior}`,
      {
        detalle: [...cambios, sinCoordinadorTexto(liberados)].filter(Boolean).join(' · ') || null,
        entidad: `usuario:${u.id}`,
      },
    )
    return HttpResponse.json(cuenta(editada!, quien))
  }),

  http.patch('/api/usuarios/:id/estado', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const u = buscar(String(params.id))
    if (!u) return error(404, 'Esa cuenta no existe.')
    const { activo } = (await request.json().catch(() => ({}))) as { activo?: boolean }
    if (typeof activo !== 'boolean') return errorValidacion({ activo: 'Indica si la cuenta queda activa.' })
    if (!activo && u.id === quien.id) {
      return error(409, 'No puedes desactivar tu propia cuenta. Pídeselo a otro administrador.')
    }
    if (u.activo === activo) return HttpResponse.json(cuenta(u, quien))

    // F1.3: pierde el acceso de inmediato (cada petición comprueba que la cuenta siga activa).
    const liberados =
      !activo && u.rol === 'coordinador'
        ? await liberarProyectos(u, `al desactivar la cuenta de ${u.nombre}`)
        : []
    const editada = await db.usuarios.update(u, {
      data(x) {
        x.activo = activo
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} ${activo ? 'reactivó' : 'desactivó'} la cuenta de ${u.nombre}`,
      { detalle: sinCoordinadorTexto(liberados), entidad: `usuario:${u.id}` },
    )
    return HttpResponse.json(cuenta(editada!, quien))
  }),

  http.post('/api/usuarios/:id/clave-temporal', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const u = buscar(String(params.id))
    if (!u) return error(404, 'Esa cuenta no existe.')
    if (u.id === quien.id) {
      return error(409, 'Tu propia contraseña no se restablece aquí. Pídeselo a otro administrador.')
    }
    if (!u.activo) return error(409, 'Reactiva la cuenta antes de restablecer su contraseña.')

    const clave = claveTemporal()
    const editada = await db.usuarios.update(u, {
      data(x) {
        x.clave = clave
        x.debeCambiarClave = true
      },
    })
    // El backend además cierra las sesiones abiertas de la cuenta. La contraseña nunca va al audit log.
    await auditar(quien, 'edicion', `${quien.nombre} restableció la contraseña de ${u.nombre}`, {
      entidad: `usuario:${u.id}`,
    })
    return HttpResponse.json({ cuenta: cuenta(editada!, quien), claveTemporal: clave })
  }),
]
