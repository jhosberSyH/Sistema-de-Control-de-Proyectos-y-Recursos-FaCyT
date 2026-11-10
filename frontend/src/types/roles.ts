/** Roles del sistema (README §3). Los beneficiarios y el personal general no tienen usuario (RN-01). */
export type Rol = 'administrador' | 'coordinador' | 'aprobador'

export const ROLES = ['administrador', 'coordinador', 'aprobador'] as const satisfies readonly Rol[]

/** Nombre oficial del rol, sin flexión de género. */
export const NOMBRE_ROL: Record<Rol, string> = {
  administrador: 'Administrador del Sistema',
  coordinador: 'Coordinador de Proyecto',
  aprobador: 'Aprobador / Gestor de Inventario',
}

/** Nombre corto para las opciones de un formulario (mockup 04). */
export const NOMBRE_ROL_CORTO: Record<Rol, string> = {
  administrador: 'Administrador',
  coordinador: 'Coordinador',
  aprobador: 'Aprobador / Gestor',
}
