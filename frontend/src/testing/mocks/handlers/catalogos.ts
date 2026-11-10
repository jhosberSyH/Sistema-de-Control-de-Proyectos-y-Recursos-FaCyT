import { http, HttpResponse } from 'msw'
import { nombreUsuario } from '../consultas'
import { db } from '../db'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Catálogos y parámetros (F1.4, F1.5; RF-02, RF-03), solo para el Administrador del Sistema.
 *   GET    /api/ubicaciones                  todas, con sus lotes guardados
 *   POST   /api/ubicaciones                  nombre único entre las activas (409 con la que choca)
 *   PATCH  /api/ubicaciones/:id              nombre y descripción
 *   PATCH  /api/ubicaciones/:id/estado       desactiva o reactiva
 *   DELETE /api/ubicaciones/:id              solo si nunca tuvo lotes ni tiene equipos; si no, se desactiva
 *   GET    /api/parametros                   valores con su último cambio (del audit log)
 *   PUT    /api/parametros                   enteros positivos dentro de su rango; audita antes y después
 */

type Ubicacion = NonNullable<ReturnType<typeof db.ubicaciones.findFirst>>

/** Sin mayúsculas, tildes ni espacios de más: "Depósito  A" choca con "deposito a". */
const clave = (t: string) => t.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim().toLowerCase()

function vista(u: Ubicacion) {
  const lotes = db.lotes.findMany((q) => q.where({ ubicacionId: u.id }))
  const equipos = db.equipos.findMany((q) => q.where({ ubicacionId: u.id }))
  return {
    id: u.id,
    nombre: u.nombre,
    descripcion: u.descripcion,
    activa: u.activa,
    /** Lotes con existencia guardados ahí (columna "Lotes"). */
    lotes: lotes.filter((l) => l.cantidad > 0).length,
    /** Equipos del catálogo ubicados ahí (F4.1). */
    equipos: equipos.length,
    /** Tuvo lotes o tiene equipos: entonces no se puede eliminar, solo desactivar (F1.4). */
    usada: lotes.length > 0 || equipos.length > 0,
  }
}

const buscar = (id: string) => db.ubicaciones.findFirst((q) => q.where({ id }))

/** Otra ubicación activa con el mismo nombre (F1.4). */
function choca(nombre: string, excepto?: string) {
  return db.ubicaciones.findFirst((q) =>
    q.where((u) => u.activa && u.id !== excepto && clave(u.nombre) === clave(nombre)),
  )
}

const conflicto = (u: Ubicacion) =>
  HttpResponse.json(
    {
      detail: {
        mensaje: 'Ya existe una ubicación activa con ese nombre. Usa otro nombre o edita la existente.',
        ubicacion: vista(u),
      },
    },
    { status: 409 },
  )

type Datos = { nombre?: string; descripcion?: string }

function validar(cuerpo: Datos) {
  const nombre = (cuerpo.nombre ?? '').replace(/\s+/g, ' ').trim()
  const descripcion = (cuerpo.descripcion ?? '').replace(/\s+/g, ' ').trim()
  const errores: Record<string, string> = {}
  if (nombre.length < 3)
    errores.nombre = 'Escribe el nombre de la ubicación, por ejemplo "Depósito de reactivos C".'
  else if (nombre.length > 80) errores.nombre = 'Usa como máximo 80 caracteres.'
  if (descripcion.length > 160) errores.descripcion = 'Usa como máximo 160 caracteres.'
  return Object.keys(errores).length ? errorValidacion(errores) : { nombre, descripcion }
}

const orden = (a: Ubicacion, b: Ubicacion) =>
  Number(b.activa) - Number(a.activa) || a.nombre.localeCompare(b.nombre, 'es')

/** Rango y texto de cada parámetro (F1.5). El frontend tiene las mismas reglas para avisar antes de enviar. */
const PARAMETROS: Record<string, { nombre: string; unidad: string; maximo: number }> = {
  anticipacion_vencimiento_dias: {
    nombre: 'la anticipación de la alerta de vencimiento',
    unidad: 'días',
    maximo: 365,
  },
  meses_minimos_pronostico: { nombre: 'el historial mínimo para el pronóstico', unidad: 'meses', maximo: 60 },
}

function parametros() {
  return db.parametros.findMany().map((p) => {
    const ultimo = db.auditoria
      .findMany((q) => q.where({ entidad: `parametro:${p.clave}` }))
      .sort((a, b) => b.fecha.localeCompare(a.fecha))[0]
    return {
      clave: p.clave,
      valor: p.valor,
      ultimoCambio: ultimo
        ? {
            usuario: nombreUsuario(ultimo.usuarioId),
            anterior: Number(ultimo.valorAnterior),
            nuevo: Number(ultimo.valorNuevo),
            fecha: ultimo.fecha,
          }
        : null,
    }
  })
}

export const handlersCatalogos = [
  http.get('/api/ubicaciones', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    return HttpResponse.json({ items: db.ubicaciones.findMany().sort(orden).map(vista) })
  }),

  http.post('/api/ubicaciones', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const datos = validar((await request.json().catch(() => ({}))) as Datos)
    if (datos instanceof Response) return datos
    const otra = choca(datos.nombre)
    if (otra) return conflicto(otra)

    const nueva = await db.ubicaciones.create({ id: `ub-${Date.now().toString(36)}`, ...datos, activa: true })
    await auditar(quien, 'creacion', `${quien.nombre} agregó la ubicación ${nueva.nombre}`, {
      detalle: nueva.descripcion || null,
      entidad: `ubicacion:${nueva.id}`,
    })
    return HttpResponse.json(vista(nueva), { status: 201 })
  }),

  http.patch('/api/ubicaciones/:id', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const u = buscar(String(params.id))
    if (!u) return error(404, 'Esa ubicación no existe.')
    const datos = validar((await request.json().catch(() => ({}))) as Datos)
    if (datos instanceof Response) return datos
    if (u.activa) {
      const otra = choca(datos.nombre, u.id)
      if (otra) return conflicto(otra)
    }
    const cambios = [
      datos.nombre !== u.nombre && `Nombre: ${u.nombre} → ${datos.nombre}`,
      datos.descripcion !== u.descripcion &&
        `Descripción: ${u.descripcion || '—'} → ${datos.descripcion || '—'}`,
    ].filter(Boolean) as string[]
    if (cambios.length === 0) return HttpResponse.json(vista(u))
    const anterior = u.nombre
    const editada = await db.ubicaciones.update(u, {
      data(x) {
        x.nombre = datos.nombre
        x.descripcion = datos.descripcion
      },
    })
    await auditar(quien, 'edicion', `${quien.nombre} editó la ubicación ${anterior}`, {
      detalle: cambios.join(' · '),
      entidad: `ubicacion:${u.id}`,
    })
    return HttpResponse.json(vista(editada!))
  }),

  http.patch('/api/ubicaciones/:id/estado', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const u = buscar(String(params.id))
    if (!u) return error(404, 'Esa ubicación no existe.')
    const { activa } = (await request.json().catch(() => ({}))) as { activa?: boolean }
    if (typeof activa !== 'boolean')
      return errorValidacion({ activa: 'Indica si la ubicación queda activa.' })
    if (u.activa === activa) return HttpResponse.json(vista(u))
    if (activa) {
      const otra = choca(u.nombre, u.id)
      if (otra) {
        return error(
          409,
          `Ya hay otra ubicación activa llamada "${otra.nombre}". Cambia el nombre de una de las dos.`,
        )
      }
    }
    // Desactivada, deja de aparecer al registrar recepciones (F6.1) y equipos (F4.1); lo que tiene sigue ahí.
    const editada = await db.ubicaciones.update(u, {
      data(x) {
        x.activa = activa
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} ${activa ? 'reactivó' : 'desactivó'} la ubicación ${u.nombre}`,
      { entidad: `ubicacion:${u.id}` },
    )
    return HttpResponse.json(vista(editada!))
  }),

  http.delete('/api/ubicaciones/:id', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const u = buscar(String(params.id))
    if (!u) return error(404, 'Esa ubicación no existe.')
    if (vista(u).usada) {
      return error(
        409,
        vista(u).equipos > 0
          ? 'Esta ubicación tiene equipos, así que no se elimina: desactívala para que deje de aparecer.'
          : 'Esta ubicación tuvo lotes, así que no se elimina: desactívala para que deje de aparecer.',
      )
    }
    await db.ubicaciones.delete((q) => q.where({ id: u.id }))
    await auditar(quien, 'cambio-estado', `${quien.nombre} eliminó la ubicación ${u.nombre}`, {
      detalle: 'Nunca tuvo lotes ni equipos',
      entidad: `ubicacion:${u.id}`,
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/parametros', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    return HttpResponse.json({ items: parametros() })
  }),

  http.put('/api/parametros', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const { valores = {} } = (await request.json().catch(() => ({}))) as { valores?: Record<string, unknown> }

    const errores: Record<string, string> = {}
    for (const [clavePar, valor] of Object.entries(valores)) {
      const def = PARAMETROS[clavePar]
      if (!def) errores[clavePar] = 'Ese parámetro no existe.'
      else if (typeof valor !== 'number' || !Number.isInteger(valor) || valor < 1) {
        errores[clavePar] = 'Escribe un número entero mayor que cero, por ejemplo 30.'
      } else if (valor > def.maximo) errores[clavePar] = `Usa como máximo ${def.maximo} ${def.unidad}.`
    }
    if (Object.keys(errores).length) return errorValidacion(errores)

    // El valor nuevo aplica desde este momento y cada cambio queda con el valor anterior y el nuevo (F1.5).
    for (const [clavePar, valor] of Object.entries(valores) as [string, number][]) {
      const actual = db.parametros.findFirst((q) => q.where({ clave: clavePar }))
      if (!actual || actual.valor === valor) continue
      const def = PARAMETROS[clavePar]
      await db.parametros.update(actual, {
        data(x) {
          x.valor = valor
        },
      })
      await auditar(
        quien,
        'edicion',
        `${quien.nombre} cambió ${def.nombre} de ${actual.valor} a ${valor} ${def.unidad}`,
        { entidad: `parametro:${clavePar}`, valorAnterior: String(actual.valor), valorNuevo: String(valor) },
      )
    }
    return HttpResponse.json({ items: parametros() })
  }),
]
