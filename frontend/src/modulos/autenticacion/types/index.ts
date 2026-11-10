import type { Rol } from '@/types/roles'

// Los roles son de toda la app (src/types); se reexportan por compatibilidad con las rutas.
export { NOMBRE_ROL, type Rol } from '@/types/roles'

export type UsuarioSesion = {
  id: string
  nombre: string
  correo: string
  rol: Rol
  iniciales: string
}

/** Respuesta de GET /api/auth/sesion y de POST /api/auth/iniciar-sesion. */
export type Sesion = {
  usuario: UsuarioSesion
  /** Token CSRF de la sesión; viaja en X-CSRF-Token en cada escritura. */
  csrf: string
  /** Minutos sin actividad antes de que el servidor cierre la sesión (SESSION_IDLE_MINUTES). */
  inactividadMinutos: number
  /**
   * La cuenta entró con una contraseña temporal (cuenta nueva o restablecida, F1.1): hasta que cree
   * la suya, el servidor solo acepta POST /auth/cambiar-clave y la app muestra "Crea tu contraseña".
   */
  debeCambiarClave: boolean
}
