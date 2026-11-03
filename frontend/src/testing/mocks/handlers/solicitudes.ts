import { http, HttpResponse } from 'msw'
import { insumo, proyectosDe } from '../consultas'
import { pdf } from '../archivos'
import { db } from '../db'
import { avisar } from '../reglas'
import { auditar, demora, error, errorValidacion, exigir } from '../utils'

/*
 * Decisiones del aprobador sobre solicitudes (RN-03): las de gasto y retiro (F5.4, vista 15) y las
 * reposiciones automáticas (F3.5), que decide desde la bandeja o desde la ficha del insumo (vista 10).
 *   POST /api/solicitudes/:id/aprobar    gasto o retiro: Pendiente → Aprobado
 *                                         reposición { cantidad }: Borrador → Pendiente → Aprobado en un paso
 *   POST /api/solicitudes/:id/rechazar   gasto o retiro { motivo }: Pendiente → Rechazado (final)
 *                                         reposición { motivo? }: se descarta, no se compra nada
 * Marcar un gasto como ejecutado (F5.5) está en handlers/bandeja.ts.
 *   GET  /api/solicitudes/:id/cotizacion  el PDF adjunto a un gasto; el aprobador y la coordinación del proyecto
 */

const PENDIENTE = 'Pendiente de Aprobación'

type Solicitud = NonNullable<ReturnType<typeof db.solicitudes.findFirst>>

/** La solicitud, si todavía espera una decisión. */
function porDecidir(id: string): Solicitud | Response {
  const s = db.solicitudes.findFirst((q) => q.where({ id }))
  if (!s) return error(404, `No encontramos la solicitud ${id}.`)
  const abierta =
    s.tipo === 'reposicion' ? s.estado === 'Borrador' || s.estado === PENDIENTE : s.estado === PENDIENTE
  if (!abierta) return error(409, `${id} ya está en estado ${s.estado}: no se puede decidir de nuevo.`)
  return s
}

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const clase = (s: Solicitud) => (s.tipo === 'gasto' ? 'de gasto' : 'de retiro')

export const handlersSolicitudes = [
  http.get('/api/solicitudes/:id/cotizacion', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador', 'coordinador'])
    if (quien instanceof Response) return quien
    const id = String(params.id)
    const s = db.solicitudes.findFirst((q) => q.where({ id }))
    // RN-07: el coordinador solo abre lo de sus proyectos
    const propia = s?.proyecto && proyectosDe(quien.id).some((p) => p.codigo === s.proyecto)
    if (!s || (quien.rol === 'coordinador' && !propia))
      return error(404, `No encontramos la solicitud ${id}.`)
    if (!s.cotizacion) return error(404, `${id} no tiene una cotización adjunta.`)
    // En los mocks no hay archivos reales: se arma un PDF de muestra con los datos de la solicitud
    const { bytes } = pdf({
      titulo: 'Cotización (archivo de muestra)',
      lineas: [`Archivo adjunto: ${s.cotizacion}`, `Solicitud ${s.id} · proyecto ${s.proyecto}`],
      tablas: [
        {
          columnas: [
            { titulo: 'Concepto', formato: 'texto', ancho: 3 },
            { titulo: 'Monto (US$)', formato: 'moneda', ancho: 1 },
          ],
          filas: [[s.insumoServicio ?? s.descripcion, s.monto ?? 0]],
        },
      ],
      nota: 'En el sistema real aquí va el documento que subió el coordinador.',
    })
    return new HttpResponse(bytes, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${s.cotizacion}"`,
      },
    })
  }),
  http.post('/api/solicitudes/:id/aprobar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const s = porDecidir(String(params.id))
    if (s instanceof Response) return s
    const entidad = `solicitud:${s.id}`

    if (s.tipo !== 'reposicion') {
      await db.solicitudes.update(s, {
        data(x) {
          x.estado = 'Aprobado'
          x.decididaPor = quien.id
          x.fecha = new Date().toISOString()
        },
      })
      await auditar(quien, 'cambio-estado', `${quien.nombre} aprobó la solicitud ${clase(s)} ${s.id}`, {
        entidad,
        valorAnterior: PENDIENTE,
        valorNuevo: 'Aprobado',
      })
      await avisar(s.creadaPor, {
        clave: `sol-${s.id}`,
        tipo: 'ok',
        titulo: `Solicitud aprobada: ${s.id}`,
        detalle:
          s.tipo === 'gasto'
            ? 'Queda por ejecutar: se carga al proyecto cuando se registre el pago.'
            : 'Almacén prepara el despacho.',
        enlace: `/solicitudes?id=${s.id}`,
      })
      return HttpResponse.json({ id: s.id, estado: 'Aprobado' })
    }

    /*
     * F3.5: el aprobador aprueba la reposición en un paso. La creó el sistema, no él, así que no es una
     * autoaprobación; el audit log guarda las dos transiciones de RN-03 (HU-09).
     */
    const { cantidad } = (await request.json().catch(() => ({}))) as { cantidad?: unknown }
    if (typeof cantidad !== 'number' || !(cantidad > 0)) {
      return errorValidacion({ cantidad: 'Escribe una cantidad mayor que cero.' })
    }
    const i = insumo(s.insumoId!)
    const valor = Math.round(cantidad * 1000) / 1000
    const texto = `${String(valor).replace('.', ',')} ${i.unidad}`
    const antes = s.estado
    const editada = await db.solicitudes.update(s, {
      data(x) {
        x.estado = 'Aprobado'
        x.cantidad = valor
        x.items = [`${i.nombre} ${texto}`]
        x.decididaPor = quien.id
        x.fecha = new Date().toISOString()
      },
    })
    if (antes === 'Borrador') {
      await auditar(quien, 'cambio-estado', `${quien.nombre} envió la reposición ${s.id} a aprobación`, {
        entidad,
        valorAnterior: 'Borrador',
        valorNuevo: PENDIENTE,
      })
    }
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} aprobó la reposición ${s.id} de ${minuscula(i.nombre)} por ${texto}`,
      { entidad, valorAnterior: PENDIENTE, valorNuevo: 'Aprobado' },
    )
    return HttpResponse.json({ id: editada!.id, estado: editada!.estado, cantidad: editada!.cantidad })
  }),

  /** RN-03: Rechazado es final. HU-09: descartar una reposición no compra nada; la alerta sigue visible. */
  http.post('/api/solicitudes/:id/rechazar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const s = porDecidir(String(params.id))
    if (s instanceof Response) return s
    const { motivo } = (await request.json().catch(() => ({}))) as { motivo?: unknown }
    const texto = typeof motivo === 'string' && motivo.trim() ? motivo.trim().slice(0, 300) : null
    const reposicion = s.tipo === 'reposicion'
    if (!reposicion && !texto) {
      return errorValidacion({ motivo: 'Escribe el motivo. Sin motivo no se puede rechazar.' })
    }
    const antes = s.estado
    await db.solicitudes.update(s, {
      data(x) {
        x.estado = 'Rechazado'
        x.decididaPor = quien.id
        x.motivoRechazo = texto ?? 'Descartada por el aprobador'
        x.fecha = new Date().toISOString()
      },
    })
    await auditar(
      quien,
      'cambio-estado',
      reposicion
        ? `${quien.nombre} descartó la reposición ${s.id}`
        : `${quien.nombre} rechazó la solicitud ${clase(s)} ${s.id}`,
      { entidad: `solicitud:${s.id}`, justificacion: texto, valorAnterior: antes, valorNuevo: 'Rechazado' },
    )
    if (!reposicion) {
      await avisar(s.creadaPor, {
        clave: `sol-${s.id}`,
        tipo: 'err',
        titulo: `Solicitud rechazada: ${s.id}`,
        detalle: `«${texto}» Puedes crear una nueva con sus datos.`,
        enlace: `/solicitudes?id=${s.id}`,
      })
    }
    return HttpResponse.json({ id: s.id, estado: 'Rechazado' })
  }),
]
