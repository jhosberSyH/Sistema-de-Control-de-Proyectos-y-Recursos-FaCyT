import { http, HttpResponse } from 'msw'
import { db } from '../db'
import {
  auditar,
  demora,
  error,
  errorValidacion,
  guardarSesion,
  iniciales,
  leerSesion,
  nuevoTokenCsrf,
  usuarioActual,
} from '../utils'

/*
 * Autenticación (README §6): POST /api/auth/iniciar-sesion, POST /api/auth/cerrar-sesion,
 * GET /api/auth/sesion y POST /api/auth/cambiar-clave. Las respuestas usan los mismos nombres de
 * campo que tendrá FastAPI.
 */

const INACTIVIDAD_MINUTOS = 30
/** Largo mínimo de la contraseña propia (NIST SP 800-63B: largo antes que reglas de composición). */
export const CLAVE_MINIMO = 12
const CLAVE_MAXIMO = 128

function respuestaSesion(usuarioId: string, csrf: string) {
  const u = db.usuarios.findFirst((q) => q.where({ id: usuarioId }), { strict: true })
  return {
    usuario: { id: u.id, nombre: u.nombre, correo: u.correo, rol: u.rol, iniciales: iniciales(u.nombre) },
    csrf,
    inactividadMinutos: INACTIVIDAD_MINUTOS,
    debeCambiarClave: u.debeCambiarClave,
  }
}

export const handlersAutenticacion = [
  http.post('/api/auth/iniciar-sesion', async ({ request }) => {
    await demora()
    const cuerpo = (await request.json().catch(() => ({}))) as { correo?: string; clave?: string }
    const correo = cuerpo.correo?.trim().toLowerCase() ?? ''
    const clave = cuerpo.clave ?? ''

    const faltan: Record<string, string> = {}
    if (!correo) faltan.correo = 'Escribe tu correo.'
    if (!clave) faltan.clave = 'Escribe tu contraseña.'
    if (Object.keys(faltan).length) return errorValidacion(faltan)

    const usuario = db.usuarios.findFirst((q) => q.where({ correo }))
    // El mismo mensaje para correo inexistente y contraseña errada: no revela qué cuentas existen (OWASP).
    if (!usuario || usuario.clave !== clave) {
      return error(
        401,
        'El correo o la contraseña no coinciden. Revisa que el correo esté bien escrito e inténtalo de nuevo.',
      )
    }
    // F1.3: una cuenta desactivada no entra. Se informa solo después de validar la contraseña.
    if (!usuario.activo) {
      return error(
        403,
        'Tu cuenta está desactivada. Si necesitas entrar de nuevo, pídele al administrador del sistema que la reactive.',
      )
    }

    // Al iniciar sesión se crea un identificador nuevo (README §6, Invalidación).
    const csrf = nuevoTokenCsrf()
    guardarSesion({ usuarioId: usuario.id, csrf })
    await db.usuarios.update(usuario, {
      data(u) {
        u.ultimoAcceso = new Date().toISOString()
      },
    })
    // RF-04: el inicio y el cierre de sesión quedan en la auditoría (vista 25)
    await auditar(usuario, 'sesion', `${usuario.nombre} inició sesión`, { entidad: `sesion:${usuario.id}` })
    return HttpResponse.json(respuestaSesion(usuario.id, csrf))
  }),

  http.get('/api/auth/sesion', async () => {
    await demora()
    const usuario = usuarioActual()
    const sesion = leerSesion()
    if (!usuario || !sesion) {
      guardarSesion(null)
      return error(401, 'No hay una sesión abierta.')
    }
    return HttpResponse.json(respuestaSesion(usuario.id, sesion.csrf))
  }),

  /**
   * Primera entrada con contraseña temporal (F1.1): la persona crea la suya. Solo sirve en ese caso;
   * cambiar la contraseña por gusto no es parte de los requisitos.
   */
  http.post('/api/auth/cambiar-clave', async ({ request }) => {
    await demora()
    const usuario = usuarioActual()
    const sesion = leerSesion()
    if (!usuario || !sesion) return error(401, 'Tu sesión se cerró. Vuelve a iniciar sesión para continuar.')
    if (request.headers.get('X-CSRF-Token') !== sesion.csrf) {
      return error(403, 'La página quedó desactualizada. Recárgala e inténtalo de nuevo.')
    }
    if (!usuario.debeCambiarClave) return error(409, 'Tu contraseña ya está creada.')

    const { clave = '' } = (await request.json().catch(() => ({}))) as { clave?: string }
    const nombreCorreo = usuario.correo.split('@')[0].toLowerCase()
    if (clave.length < CLAVE_MINIMO) {
      return errorValidacion({ clave: `Usa al menos ${CLAVE_MINIMO} caracteres.` })
    }
    if (clave.length > CLAVE_MAXIMO) {
      return errorValidacion({ clave: `Usa como máximo ${CLAVE_MAXIMO} caracteres.` })
    }
    if (clave === usuario.clave) {
      return errorValidacion({ clave: 'Elige una distinta de la contraseña temporal.' })
    }
    if (nombreCorreo.length >= 4 && clave.toLowerCase().includes(nombreCorreo)) {
      return errorValidacion({
        clave: 'No uses tu correo dentro de la contraseña: es lo primero que se prueba.',
      })
    }

    await db.usuarios.update(usuario, {
      data(u) {
        u.clave = clave
        u.debeCambiarClave = false
      },
    })
    // Contraseña nueva, sesión nueva (README §6, Invalidación).
    const csrf = nuevoTokenCsrf()
    guardarSesion({ usuarioId: usuario.id, csrf })
    return HttpResponse.json(respuestaSesion(usuario.id, csrf))
  }),

  http.post('/api/auth/cerrar-sesion', async () => {
    await demora()
    const usuario = usuarioActual()
    if (usuario) {
      await auditar(usuario, 'sesion', `${usuario.nombre} cerró sesión`, { entidad: `sesion:${usuario.id}` })
    }
    guardarSesion(null)
    return new HttpResponse(null, { status: 204 })
  }),
]
