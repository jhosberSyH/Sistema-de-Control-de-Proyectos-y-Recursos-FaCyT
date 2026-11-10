import { delay, HttpResponse } from 'msw'
import { db } from './db'

/*
 * Utilidades de los handlers: sesión simulada, errores con la forma de FastAPI y demora realista.
 */

export type RolMock = 'administrador' | 'coordinador' | 'aprobador'

/** Demora de 300 a 600 ms en el navegador, para que se vean los estados de carga. En pruebas, ninguna. */
export async function demora() {
  if (import.meta.env.MODE === 'test') return
  await delay(300 + Math.round(Math.random() * 300))
}

/** Error con la forma de FastAPI: { detail: "mensaje" }. */
export function error(status: number, detalle: string) {
  return HttpResponse.json({ detail: detalle }, { status })
}

/**
 * Error de validación 422 de FastAPI: { detail: [{ loc: ['body', campo], msg }] }. Los campos de una
 * lista van con su posición, como "hitos.2.peso" → loc ['body', 'hitos', 2, 'peso'].
 */
export function errorValidacion(errores: Record<string, string>) {
  return HttpResponse.json(
    {
      detail: Object.entries(errores).map(([campo, msg]) => ({
        loc: ['body', ...campo.split('.').map((parte) => (/^\d+$/.test(parte) ? Number(parte) : parte))],
        msg,
        type: 'value_error',
      })),
    },
    { status: 422 },
  )
}

// ---------- Sesión simulada ----------
// El backend real guarda la sesión en la tabla "sesion" y la identifica con la cookie HttpOnly.
// Aquí basta con recordar quién inició sesión: sessionStorage en el navegador (sobrevive a recargar
// la página) y una variable en las pruebas.

type SesionMock = { usuarioId: string; csrf: string }
const CLAVE = 'cpq-mock-sesion'
let enMemoria: SesionMock | null = null

function hayNavegador() {
  return typeof window !== 'undefined' && typeof window.sessionStorage !== 'undefined'
}

export function leerSesion(): SesionMock | null {
  if (!hayNavegador()) return enMemoria
  try {
    const guardada = window.sessionStorage.getItem(CLAVE)
    return guardada ? (JSON.parse(guardada) as SesionMock) : null
  } catch {
    return enMemoria
  }
}

export function guardarSesion(sesion: SesionMock | null) {
  enMemoria = sesion
  if (!hayNavegador()) return
  try {
    if (sesion) window.sessionStorage.setItem(CLAVE, JSON.stringify(sesion))
    else window.sessionStorage.removeItem(CLAVE)
  } catch {
    // Sin almacenamiento: la sesión dura hasta recargar.
  }
}

export function nuevoTokenCsrf() {
  return Array.from(crypto.getRandomValues(new Uint8Array(24)), (b) => b.toString(16).padStart(2, '0')).join(
    '',
  )
}

/** Usuario de la sesión, o null si no hay sesión o la cuenta ya no está activa. */
export function usuarioActual() {
  const sesion = leerSesion()
  if (!sesion) return null
  const usuario = db.usuarios.findFirst((q) => q.where({ id: sesion.usuarioId }))
  return usuario?.activo ? usuario : null
}

type Usuario = NonNullable<ReturnType<typeof usuarioActual>>

/**
 * Exige sesión (401), el rol (403) y, en las escrituras, el token CSRF (403), como el backend.
 * Devuelve el usuario o la respuesta de error.
 */
export function exigir(request: Request, roles?: RolMock[]): Usuario | Response {
  const usuario = usuarioActual()
  if (!usuario) return error(401, 'Tu sesión se cerró. Vuelve a iniciar sesión para continuar.')
  if (request.method !== 'GET' && request.headers.get('X-CSRF-Token') !== leerSesion()?.csrf) {
    return error(403, 'La página quedó desactualizada. Recárgala e inténtalo de nuevo.')
  }
  // Con contraseña temporal, el servidor solo acepta crear la contraseña propia (F1.1).
  if (usuario.debeCambiarClave) {
    return error(403, 'Primero crea tu contraseña: entraste con una temporal.')
  }
  if (roles && !roles.includes(usuario.rol)) return error(403, 'Tu cuenta no tiene permiso para hacer esto.')
  return usuario
}

/** IP simulada de quien hace la acción: el backend la toma de la petición (RF-04). */
export const IP_MOCK: Record<string, string> = {
  'u-adm': '10.20.2.15',
  'u-apr': '10.20.4.17',
  'u-qui': '10.20.6.33',
  'u-bio': '10.20.7.41',
  'u-fis': '10.20.5.22',
}

/** Agrega un registro al audit log, como el backend en cada creación, edición y cambio de estado (RF-04, RN-06). */
export async function auditar(
  quien: Usuario,
  accion: 'creacion' | 'edicion' | 'cambio-estado' | 'sesion',
  descripcion: string,
  extra: {
    detalle?: string | null
    entidad?: string | null
    justificacion?: string | null
    valorAnterior?: string | null
    valorNuevo?: string | null
  } = {},
) {
  await db.auditoria.create({
    id: `aud-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    fecha: new Date().toISOString(),
    usuarioId: quien.id,
    ip: IP_MOCK[quien.id] ?? '10.20.9.40',
    accion,
    descripcion,
    detalle: extra.detalle ?? null,
    justificacion: extra.justificacion ?? null,
    entidad: extra.entidad ?? null,
    valorAnterior: extra.valorAnterior ?? null,
    valorNuevo: extra.valorNuevo ?? null,
  })
}

/** Registro de auditoría de lo que hace el sistema solo (la reposición automática): sin usuario ni IP. */
export async function auditarSistema(
  descripcion: string,
  extra: { entidad: string; valorAnterior?: string | null; valorNuevo?: string | null },
) {
  await db.auditoria.create({
    id: `aud-${Date.now()}-${Math.round(Math.random() * 1000)}`,
    fecha: new Date().toISOString(),
    usuarioId: 'sistema',
    ip: '—',
    accion: 'cambio-estado',
    descripcion,
    detalle: null,
    justificacion: null,
    entidad: extra.entidad,
    valorAnterior: extra.valorAnterior ?? null,
    valorNuevo: extra.valorNuevo ?? null,
  })
}

/**
 * Contraseña temporal de 12 caracteres en tres grupos ("KM7Q-P2XR-9TWB"), sin letras ni números
 * que se confundan al dictarla (0/O, 1/I/L). El backend la genera con secrets y guarda solo su hash.
 */
export function claveTemporal() {
  const alfabeto = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  const azar = crypto.getRandomValues(new Uint8Array(12))
  const c = Array.from(azar, (b) => alfabeto[b % alfabeto.length]).join('')
  return `${c.slice(0, 4)}-${c.slice(4, 8)}-${c.slice(8)}`
}

/** Iniciales para el avatar: "José Rodríguez" → "JR". */
export function iniciales(nombre: string) {
  const partes = nombre.split(/\s+/).filter(Boolean)
  return ((partes[0]?.[0] ?? '') + (partes.length > 1 ? partes[partes.length - 1][0] : '')).toUpperCase()
}
