import type { Rol } from '@/types/roles'

export type EstadoCuentas = 'activas' | 'desactivadas' | 'todas'

/** Una cuenta de la lista (GET /api/usuarios). Nunca trae la contraseña. */
export type Cuenta = {
  id: string
  nombre: string
  correo: string
  iniciales: string
  rol: Rol
  activo: boolean
  ultimoAcceso: string | null
  /** Tiene una contraseña temporal que la persona todavía no cambió. */
  debeCambiarClave: boolean
  /** Proyectos En ejecución que coordina (RN-05). */
  proyectos: string[]
  /** Es la cuenta de quien mira la lista: no puede cambiar su rol ni desactivarse. */
  esPropia: boolean
}

export type PaginaCuentas = {
  items: Cuenta[]
  total: number
  pagina: number
  paginas: number
  porPagina: number
}

export type FiltrosCuentas = {
  q: string
  rol: Rol | ''
  estado: EstadoCuentas
  pagina: number
}

/** GET /api/usuarios/:id/impacto: qué pasa si la cuenta cambia de rol o se desactiva (F1.2, F1.3). */
export type Impacto = {
  /** Proyectos vigentes que coordina: quedarían sin coordinador. */
  proyectos: { id: string; codigo: string; estatus: 'Propuesta' | 'En ejecución' | 'Suspendido' }[]
  /** Sus solicitudes en Pendiente de Aprobación: siguen su curso. */
  solicitudesPendientes: string[]
  /** Es la única cuenta activa con su rol. */
  unicoDeSuRol: boolean
}

/** Proyecto que quedó sin coordinador tras cambiar el rol o desactivar la cuenta. */
export type ProyectoLiberado = { id: string; codigo: string }

/** Respuesta al crear una cuenta o restablecer su contraseña: la temporal se muestra una sola vez. */
export type CuentaConClave = { cuenta: Cuenta; claveTemporal: string }

/** Lo que trae el 409 cuando el correo ya es de otra cuenta. */
export type ConflictoCorreo = { cuenta: Cuenta }

/** Ubicación de almacenamiento (F1.4), GET /api/ubicaciones. */
export type Ubicacion = {
  id: string
  nombre: string
  descripcion: string
  activa: boolean
  /** Lotes con existencia guardados ahí. */
  lotes: number
  /** Equipos del catálogo ubicados ahí (F4.1). */
  equipos: number
  /** Tuvo lotes o tiene equipos: no se puede eliminar, solo desactivar. */
  usada: boolean
}

/** Parámetro general (F1.5), GET /api/parametros. */
export type Parametro = {
  clave: ClaveParametro
  valor: number
  /** Último cambio, del audit log; null si conserva el valor inicial del sistema. */
  ultimoCambio: { usuario: string; anterior: number; nuevo: number; fecha: string } | null
}

export type ClaveParametro = 'anticipacion_vencimiento_dias' | 'meses_minimos_pronostico'
