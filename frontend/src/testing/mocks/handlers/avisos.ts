import { http, HttpResponse } from 'msw'
import { db } from '../db'
import { demora, error, exigir } from '../utils'
import { contadoresMenu } from './inicio'

/* Avisos de la bandeja interna y contadores del menú. */

export const handlersAvisos = [
  http.get('/api/avisos', async ({ request }) => {
    await demora()
    const usuario = exigir(request)
    if (usuario instanceof Response) return usuario
    const avisos = db.avisos
      .findMany((q) => q.where({ usuarioId: usuario.id }), { orderBy: { fecha: 'desc' } })
      .map((a) => ({
        id: a.id,
        tipo: a.tipo,
        titulo: a.titulo,
        detalle: a.detalle,
        enlace: a.enlace,
        fecha: a.fecha,
        leido: a.leido,
      }))
    return HttpResponse.json(avisos)
  }),

  http.post('/api/avisos/:id/leido', async ({ request, params }) => {
    await demora()
    const usuario = exigir(request)
    if (usuario instanceof Response) return usuario
    const aviso = db.avisos.findFirst((q) => q.where({ id: String(params.id), usuarioId: usuario.id }))
    if (!aviso) return error(404, 'Ese aviso ya no existe.')
    await db.avisos.update(aviso, {
      data(a) {
        a.leido = true
      },
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.post('/api/avisos/leidos', async ({ request }) => {
    await demora()
    const usuario = exigir(request)
    if (usuario instanceof Response) return usuario
    await db.avisos.updateMany((q) => q.where({ usuarioId: usuario.id }), {
      data(a) {
        a.leido = true
      },
    })
    return new HttpResponse(null, { status: 204 })
  }),

  http.get('/api/navegacion/contadores', async ({ request }) => {
    await demora()
    const usuario = exigir(request)
    if (usuario instanceof Response) return usuario
    return HttpResponse.json(contadoresMenu(usuario.id, usuario.rol))
  }),
]
