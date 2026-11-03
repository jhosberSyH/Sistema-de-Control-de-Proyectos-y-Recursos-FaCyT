/**
 * Cliente HTTP único de la app. Habla con /api, que en producción atiende FastAPI detrás de
 * Nginx y en el modo mock atiende Mock Service Worker. Ningún componente sabe cuál de los dos responde.
 *
 * - La sesión viaja en la cookie HttpOnly que pone el servidor (README §6, Autenticación).
 * - Cada POST, PUT, PATCH y DELETE lleva el token CSRF en el encabezado X-CSRF-Token.
 * - Los errores de FastAPI ({ detail }) se convierten en ApiError, con los errores por campo aparte.
 */

const BASE = '/api'
const METODOS_CON_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE'])

let tokenCsrf: string | null = null

/** Lo llama la sesión al iniciar o renovar, con el token que entrega el servidor. */
export function establecerTokenCsrf(token: string | null) {
  tokenCsrf = token
}

/**
 * Error de la API con el mensaje del servidor y, si es una validación (422), el error de cada campo.
 * Un conflicto (409) puede traer el registro con el que choca, para mostrarlo (plan §7.1).
 */
export class ApiError extends Error {
  readonly status: number
  readonly errores: Record<string, string>
  readonly conflicto: unknown

  constructor(status: number, mensaje: string, errores: Record<string, string> = {}, conflicto?: unknown) {
    super(mensaje)
    this.name = 'ApiError'
    this.status = status
    this.errores = errores
    this.conflicto = conflicto
  }
}

/** Mensaje en lenguaje claro para errores sin texto del servidor (H9: decir qué pasó y qué hacer). */
function mensajePorEstado(status: number): string {
  if (status === 0) return 'No pudimos conectarnos con el servidor. Revisa tu conexión e inténtalo de nuevo.'
  if (status === 401) return 'Tu sesión se cerró. Vuelve a iniciar sesión para continuar.'
  if (status === 403) return 'Tu cuenta no tiene permiso para hacer esto.'
  if (status === 404)
    return 'No encontramos lo que buscas. Puede que se haya eliminado o que el enlace esté mal.'
  if (status >= 500) return 'El servidor tuvo un problema. Inténtalo de nuevo en unos minutos.'
  return 'No se pudo completar la operación. Inténtalo de nuevo.'
}

type DetalleValidacion = { loc?: (string | number)[]; msg?: string }

async function leerError(respuesta: Response): Promise<ApiError> {
  let detalle: unknown
  try {
    detalle = ((await respuesta.json()) as { detail?: unknown }).detail
  } catch {
    detalle = undefined
  }
  if (typeof detalle === 'string') return new ApiError(respuesta.status, detalle)
  if (detalle && typeof detalle === 'object' && 'mensaje' in detalle && typeof detalle.mensaje === 'string') {
    // Conflicto con el registro que choca: { detail: { mensaje, cuenta: {...} } }
    const { mensaje, ...conflicto } = detalle as { mensaje: string }
    return new ApiError(respuesta.status, mensaje, {}, conflicto)
  }
  if (Array.isArray(detalle)) {
    // Forma de FastAPI para 422: [{ loc: ['body', 'campo'], msg: '...' }]. En una lista, la ruta
    // completa sin "body" ("hitos.2.peso"), que es como React Hook Form nombra los campos.
    const errores: Record<string, string> = {}
    for (const d of detalle as DetalleValidacion[]) {
      const ruta = d.loc && d.loc.length > 1 ? d.loc.slice(1) : d.loc
      if (ruta?.length && d.msg) errores[ruta.join('.')] = d.msg
    }
    return new ApiError(respuesta.status, 'Revisa los datos marcados.', errores)
  }
  return new ApiError(respuesta.status, mensajePorEstado(respuesta.status))
}

type Opciones = {
  parametros?: Record<string, string | number | boolean | undefined | null>
  senal?: AbortSignal
}

function armarUrl(ruta: string, parametros?: Opciones['parametros']) {
  const url = new URL(BASE + ruta, window.location.origin)
  for (const [clave, valor] of Object.entries(parametros ?? {})) {
    if (valor !== undefined && valor !== null && valor !== '') url.searchParams.set(clave, String(valor))
  }
  return url.pathname + url.search
}

async function solicitar(metodo: string, ruta: string, cuerpo?: unknown, opciones: Opciones = {}) {
  const encabezados: Record<string, string> = { Accept: 'application/json' }
  if (cuerpo !== undefined) encabezados['Content-Type'] = 'application/json'
  if (METODOS_CON_CSRF.has(metodo) && tokenCsrf) encabezados['X-CSRF-Token'] = tokenCsrf

  let respuesta: Response
  try {
    respuesta = await fetch(armarUrl(ruta, opciones.parametros), {
      method: metodo,
      headers: encabezados,
      body: cuerpo === undefined ? undefined : JSON.stringify(cuerpo),
      credentials: 'same-origin',
      signal: opciones.senal,
    })
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e
    throw new ApiError(0, mensajePorEstado(0))
  }
  if (!respuesta.ok) throw await leerError(respuesta)
  return respuesta
}

async function json<T>(respuesta: Response): Promise<T> {
  if (respuesta.status === 204) return undefined as T
  return (await respuesta.json()) as T
}

export const api = {
  get: async <T>(ruta: string, opciones?: Opciones) =>
    json<T>(await solicitar('GET', ruta, undefined, opciones)),
  post: async <T>(ruta: string, cuerpo?: unknown, opciones?: Opciones) =>
    json<T>(await solicitar('POST', ruta, cuerpo ?? {}, opciones)),
  put: async <T>(ruta: string, cuerpo: unknown, opciones?: Opciones) =>
    json<T>(await solicitar('PUT', ruta, cuerpo, opciones)),
  patch: async <T>(ruta: string, cuerpo: unknown, opciones?: Opciones) =>
    json<T>(await solicitar('PATCH', ruta, cuerpo, opciones)),
  delete: async <T>(ruta: string, opciones?: Opciones) =>
    json<T>(await solicitar('DELETE', ruta, undefined, opciones)),
  /** Descarga un archivo (PDF o Excel) y devuelve el contenido con el nombre que propone el servidor. */
  descargar: async (ruta: string, opciones?: Opciones) => {
    const respuesta = await solicitar('GET', ruta, undefined, opciones)
    const disposicion = respuesta.headers.get('Content-Disposition') ?? ''
    const nombre = /filename="?([^"]+)"?/.exec(disposicion)?.[1] ?? 'archivo'
    return { archivo: await respuesta.blob(), nombre }
  },
}

export function esApiError(e: unknown): e is ApiError {
  return e instanceof ApiError
}
