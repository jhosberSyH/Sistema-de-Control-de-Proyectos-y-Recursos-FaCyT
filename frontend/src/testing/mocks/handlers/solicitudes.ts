import { http, HttpResponse } from 'msw'
import { insumo, proyecto, proyectosDe, SOLICITUD_NO_EXISTE, solicitudPorId } from '../consultas'
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
 *   POST /api/solicitudes/:id/cotizacion  multipart/form-data, campo "archivo": sube el PDF de un gasto en
 *                                         Borrador (solo su coordinador). 200 { nombre, tamano }; 422 si no es
 *                                         un PDF, pesa más de 10 MB o falta; 409 si ya no es un borrador.
 */

/** Tamaño máximo de la cotización: 10 MB. */
export const MAX_COTIZACION = 10 * 1024 * 1024

/** Uint8Array ↔ base64, para guardar el PDF subido en la base en memoria. */
function aBase64(bytes: Uint8Array) {
  let texto = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    texto += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(texto)
}
const deBase64 = (b64: string) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0))

/** Un PDF de verdad empieza con "%PDF-": no basta con el nombre o el tipo que declara el navegador. */
const firmaPdf = (b: Uint8Array) =>
  b.length >= 5 && b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46 && b[4] === 0x2d

type ArchivoSubido = { nombre: string; tipo: string; bytes: Uint8Array }

/** Posición de `aguja` en `bytes` desde `desde`, o -1. */
function buscar(bytes: Uint8Array, aguja: Uint8Array, desde: number) {
  fuera: for (let i = desde; i <= bytes.length - aguja.length; i++) {
    for (let j = 0; j < aguja.length; j++) if (bytes[i + j] !== aguja[j]) continue fuera
    return i
  }
  return -1
}

/**
 * Lee un campo de archivo de un cuerpo multipart/form-data. Se arma a mano y no con request.formData():
 * en las pruebas (jsdom), el lector de formularios de Node no reconoce el File de jsdom. El backend
 * real lo lee con UploadFile de FastAPI.
 */
async function leerArchivo(request: Request, campo: string): Promise<ArchivoSubido | null> {
  const separador = /boundary="?([^";]+)"?/i.exec(request.headers.get('Content-Type') ?? '')?.[1]
  if (!separador) return null
  const bytes = new Uint8Array(await request.arrayBuffer())
  const marca = new TextEncoder().encode(`--${separador}`)
  const finEncabezado = new TextEncoder().encode('\r\n\r\n')
  let i = buscar(bytes, marca, 0)
  while (i >= 0) {
    const inicio = i + marca.length + 2 // salta el \r\n después del separador
    const siguiente = buscar(bytes, marca, inicio)
    if (siguiente < 0) break
    const corte = buscar(bytes, finEncabezado, inicio)
    if (corte > 0 && corte < siguiente) {
      const encabezado = new TextDecoder().decode(bytes.subarray(inicio, corte))
      const nombreCampo = /name="([^"]*)"/i.exec(encabezado)?.[1]
      const nombre = /filename="([^"]*)"/i.exec(encabezado)?.[1]
      if (nombreCampo === campo && nombre !== undefined) {
        return {
          nombre,
          tipo: /content-type:\s*([^\r\n]+)/i.exec(encabezado)?.[1].trim() ?? '',
          // Sin el \r\n que va antes del siguiente separador
          bytes: bytes.slice(corte + finEncabezado.length, siguiente - 2),
        }
      }
    }
    i = siguiente
  }
  return null
}

const PENDIENTE = 'Pendiente de Aprobación'

type Solicitud = NonNullable<ReturnType<typeof db.solicitudes.findFirst>>

/** La solicitud (por su UUID), si todavía espera una decisión. */
function porDecidir(id: string): Solicitud | Response {
  const s = solicitudPorId(id)
  if (!s) return error(404, SOLICITUD_NO_EXISTE)
  const abierta =
    s.tipo === 'reposicion' ? s.estado === 'Borrador' || s.estado === PENDIENTE : s.estado === PENDIENTE
  if (!abierta) return error(409, `${s.numero} ya está en estado ${s.estado}: no se puede decidir de nuevo.`)
  return s
}

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)
const clase = (s: Solicitud) => (s.tipo === 'gasto' ? 'de gasto' : 'de retiro')

export const handlersSolicitudes = [
  http.get('/api/solicitudes/:id/cotizacion', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador', 'coordinador'])
    if (quien instanceof Response) return quien
    const s = solicitudPorId(String(params.id))
    // RN-07: el coordinador solo abre lo de sus proyectos
    const propia = s?.proyecto && proyectosDe(quien.id).some((p) => p.codigo === s.proyecto)
    if (!s || (quien.rol === 'coordinador' && !propia)) return error(404, SOLICITUD_NO_EXISTE)
    if (!s.cotizacion) return error(404, `${s.numero} no tiene una cotización adjunta.`)
    const disposicion = `attachment; filename="${s.cotizacion}"`
    if (s.cotizacionContenido) {
      // El archivo que subió el coordinador, tal cual
      return new HttpResponse(deBase64(s.cotizacionContenido), {
        headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': disposicion },
      })
    }
    // En los mocks no hay archivos reales: se arma un PDF de muestra con los datos de la solicitud
    const { bytes } = pdf({
      titulo: 'Cotización (archivo de muestra)',
      lineas: [`Archivo adjunto: ${s.cotizacion}`, `Solicitud ${s.numero} · proyecto ${s.proyecto}`],
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
      headers: { 'Content-Type': 'application/pdf', 'Content-Disposition': disposicion },
    })
  }),

  /**
   * F5.1: el coordinador adjunta la cotización de un gasto mientras es borrador. Un archivo nuevo reemplaza
   * al anterior. El nombre queda en "cotizacion" de la solicitud.
   */
  http.post('/api/solicitudes/:id/cotizacion', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['coordinador'])
    if (quien instanceof Response) return quien
    const s = solicitudPorId(String(params.id))
    // RN-07: solo el coordinador del proyecto de la solicitud; para los demás no existe
    if (!s || s.tipo === 'reposicion' || !s.proyecto || proyecto(s.proyecto)?.coordinadorId !== quien.id) {
      return error(404, SOLICITUD_NO_EXISTE)
    }
    if (s.tipo !== 'gasto')
      return error(409, `${s.numero} es un retiro: solo las solicitudes de gasto llevan cotización.`)
    if (s.estado !== 'Borrador') {
      return error(409, `${s.numero} ya se envió a aprobación: su cotización ya no se puede cambiar.`)
    }
    const archivo = await leerArchivo(request, 'archivo').catch(() => null)
    if (!archivo || archivo.bytes.length === 0) {
      return errorValidacion({ archivo: 'Elige el PDF de la cotización.' })
    }
    const { bytes } = archivo
    if (bytes.length > MAX_COTIZACION) {
      return errorValidacion({ archivo: 'El archivo pesa más de 10 MB. Prueba con uno más liviano.' })
    }
    const declaraPdf = archivo.tipo === 'application/pdf' || /\.pdf$/i.test(archivo.nombre)
    if (!declaraPdf || !firmaPdf(bytes)) {
      return errorValidacion({ archivo: 'La cotización tiene que ser un PDF.' })
    }
    // Solo el nombre, sin carpetas ni comillas (va en el Content-Disposition de la descarga)
    const nombre =
      (archivo.nombre.split(/[\\/]/).pop() ?? '')
        .replace(/["\r\n]/g, '')
        .trim()
        .slice(0, 160) || 'cotizacion.pdf'
    await db.solicitudes.update(s, {
      data(x) {
        x.cotizacion = nombre
        x.cotizacionTamano = bytes.length
        x.cotizacionContenido = aBase64(bytes)
      },
    })
    await auditar(quien, 'edicion', `${quien.nombre} adjuntó la cotización de la solicitud ${s.numero}`, {
      entidad: `solicitud:${s.numero}`,
      valorAnterior: s.cotizacion,
      valorNuevo: nombre,
    })
    return HttpResponse.json({ nombre, tamano: bytes.length })
  }),
  http.post('/api/solicitudes/:id/aprobar', async ({ request, params }) => {
    await demora()
    const quien = exigir(request, ['aprobador'])
    if (quien instanceof Response) return quien
    const s = porDecidir(String(params.id))
    if (s instanceof Response) return s
    const entidad = `solicitud:${s.numero}`

    if (s.tipo !== 'reposicion') {
      await db.solicitudes.update(s, {
        data(x) {
          x.estado = 'Aprobado'
          x.decididaPor = quien.id
          x.fecha = new Date().toISOString()
        },
      })
      await auditar(quien, 'cambio-estado', `${quien.nombre} aprobó la solicitud ${clase(s)} ${s.numero}`, {
        entidad,
        valorAnterior: PENDIENTE,
        valorNuevo: 'Aprobado',
      })
      await avisar(s.creadaPor, {
        clave: `sol-${s.numero}`,
        tipo: 'ok',
        titulo: `Solicitud aprobada: ${s.numero}`,
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
      await auditar(quien, 'cambio-estado', `${quien.nombre} envió la reposición ${s.numero} a aprobación`, {
        entidad,
        valorAnterior: 'Borrador',
        valorNuevo: PENDIENTE,
      })
    }
    await auditar(
      quien,
      'cambio-estado',
      `${quien.nombre} aprobó la reposición ${s.numero} de ${minuscula(i.nombre)} por ${texto}`,
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
        ? `${quien.nombre} descartó la reposición ${s.numero}`
        : `${quien.nombre} rechazó la solicitud ${clase(s)} ${s.numero}`,
      {
        entidad: `solicitud:${s.numero}`,
        justificacion: texto,
        valorAnterior: antes,
        valorNuevo: 'Rechazado',
      },
    )
    if (!reposicion) {
      await avisar(s.creadaPor, {
        clave: `sol-${s.numero}`,
        tipo: 'err',
        titulo: `Solicitud rechazada: ${s.numero}`,
        detalle: `«${texto}» Puedes crear una nueva con sus datos.`,
        enlace: `/solicitudes?id=${s.id}`,
      })
    }
    return HttpResponse.json({ id: s.id, estado: 'Rechazado' })
  }),
]
