import type { ItemNavegacion } from '@/components/layout/tipos'
import type { Rol } from '@/modulos/autenticacion'

/**
 * Menú de cada rol, con las mismas entradas, íconos y etiquetas del diseño aprobado
 * (docs/mockups/_fuente/compartido/comun-app.js L5-12). La clave coincide con la de los contadores
 * que devuelve GET /api/navegacion/contadores.
 */
export const NAVEGACION: Record<Rol, Omit<ItemNavegacion, 'contador'>[]> = {
  administrador: [
    { clave: 'inicio', icono: 'inicio', etiqueta: 'Inicio', ruta: '/inicio' },
    { clave: 'dashboard', icono: 'reportes', etiqueta: 'Dashboard', ruta: '/dashboard' },
    { clave: 'proyectos', icono: 'proyectos', etiqueta: 'Proyectos', ruta: '/proyectos' },
    { clave: 'usuarios', icono: 'usuarios', etiqueta: 'Usuarios', ruta: '/usuarios' },
    { clave: 'insumos', icono: 'inventario', etiqueta: 'Catálogo de insumos', ruta: '/inventario' },
    { clave: 'equipos', icono: 'equipos', etiqueta: 'Catálogo de equipos', ruta: '/equipos' },
    {
      clave: 'ubicaciones',
      icono: 'almacen',
      etiqueta: 'Ubicaciones y parámetros',
      ruta: '/ubicaciones-parametros',
    },
    { clave: 'auditoria', icono: 'auditoria', etiqueta: 'Auditoría', ruta: '/auditoria' },
  ],
  coordinador: [
    { clave: 'inicio', icono: 'inicio', etiqueta: 'Inicio', ruta: '/inicio' },
    { clave: 'proyectos', icono: 'proyectos', etiqueta: 'Mis proyectos', ruta: '/proyectos' },
    { clave: 'solicitudes', icono: 'solicitudes', etiqueta: 'Solicitudes', ruta: '/solicitudes' },
    { clave: 'reservas', icono: 'calendario', etiqueta: 'Equipos y reservas', ruta: '/reservas' },
    { clave: 'inventario', icono: 'inventario', etiqueta: 'Inventario', ruta: '/inventario' },
    { clave: 'cierre', icono: 'prorrateo', etiqueta: 'Cierre de período', ruta: '/cierre/cargos' },
    { clave: 'reportes', icono: 'descarga', etiqueta: 'Reportes', ruta: '/reportes' },
  ],
  aprobador: [
    { clave: 'inicio', icono: 'inicio', etiqueta: 'Inicio', ruta: '/inicio' },
    { clave: 'bandeja', icono: 'solicitudes', etiqueta: 'Bandeja de aprobación', ruta: '/bandeja' },
    { clave: 'inventario', icono: 'inventario', etiqueta: 'Inventario', ruta: '/inventario' },
    { clave: 'almacen', icono: 'almacen', etiqueta: 'Almacén', ruta: '/almacen' },
    { clave: 'reservas', icono: 'calendario', etiqueta: 'Equipos y reservas', ruta: '/reservas' },
    { clave: 'priorizacion', icono: 'filtro', etiqueta: 'Priorización', ruta: '/priorizacion' },
    {
      clave: 'cierre',
      icono: 'prorrateo',
      etiqueta: 'Gastos compartidos',
      ruta: '/gastos-compartidos/cierre',
    },
    { clave: 'reportes', icono: 'descarga', etiqueta: 'Reportes', ruta: '/reportes' },
  ],
}

/** Primer segmento de una ruta: "/proyectos/<id>/plan" → "proyectos". */
const seccion = (ruta: string) => ruta.split('/')[1] ?? ''

/** Ítem del menú que corresponde a la ruta actual (por su primer segmento). */
export function itemActivo(rol: Rol, ruta: string) {
  return NAVEGACION[rol].find((n) => seccion(n.ruta) === seccion(ruta))?.clave
}
