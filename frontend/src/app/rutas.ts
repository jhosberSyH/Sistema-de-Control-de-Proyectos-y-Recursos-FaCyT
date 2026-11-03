import type { Rol } from '@/modulos/autenticacion'

/** Datos de cada ruta que usan el marco (título del encabezado) y la guarda de roles. */
export type DatosRuta = {
  titulo: string
  /** Roles que pueden abrir la ruta; sin la lista, cualquiera con sesión. */
  roles?: Rol[]
  /** Paso del plan (frontend/plan_frontend.md §6) en que se construye la vista, mientras no existe. */
  paso?: number
  /** Mockup de referencia, para la pantalla "Vista en construcción". */
  mockup?: string
}

/**
 * Módulo de cada mockup, el que va en el encabezado editorial ("Universidad de Carabobo · FaCyT ·
 * Usuarios, catálogos y parámetros"), igual que window.APP.ins en los mockups. Inicio y Dashboard
 * no tienen: muestran el título de la página.
 */
const MODULO_POR_MOCKUP: Record<string, string> = {
  '04': 'Usuarios, catálogos y parámetros',
  '05': 'Usuarios, catálogos y parámetros',
  '06': 'Proyectos y avance',
  '07': 'Proyectos y avance',
  '08': 'Proyectos y avance',
  '09': 'Inventario de materia prima y consumibles',
  '10': 'Inventario de materia prima y consumibles',
  '11': 'Equipos y reservas',
  '12': 'Equipos y reservas',
  '13': 'Equipos y reservas',
  '14': 'Solicitudes y priorización',
  '15': 'Solicitudes y priorización',
  '16': 'Solicitudes y priorización',
  '17': 'Almacén',
  '18': 'Almacén',
  '19': 'Almacén',
  '20': 'Almacén',
  '21': 'Cierre de período y gastos compartidos',
  '22': 'Cierre de período y gastos compartidos',
  '23': 'Cierre de período y gastos compartidos',
  '24': 'Reportes y auditoría',
  '25': 'Reportes y auditoría',
}

/** Texto del encabezado editorial: el módulo de la vista o, si no tiene, su título. */
export function seccionDe(datos: DatosRuta) {
  return (datos.mockup && MODULO_POR_MOCKUP[datos.mockup.slice(0, 2)]) || datos.titulo
}

const ADM: Rol = 'administrador'
const COO: Rol = 'coordinador'
const APR: Rol = 'aprobador'

/**
 * Mapa de rutas del plan (§6). Las vistas que todavía no se construyen muestran "Vista en
 * construcción" con el paso en que llegan; al construir cada una se reemplaza su componente en router.tsx.
 */
export const RUTAS = {
  inicio: { ruta: '/inicio', datos: { titulo: 'Inicio', paso: 3, mockup: '02-inicio-por-rol' } },
  dashboard: {
    ruta: '/dashboard',
    datos: { titulo: 'Dashboard', roles: [ADM], paso: 26, mockup: '03-dashboard' },
  },
  usuarios: {
    ruta: '/usuarios',
    datos: { titulo: 'Usuarios', roles: [ADM], paso: 4, mockup: '04-usuarios' },
  },
  ubicaciones: {
    ruta: '/ubicaciones-parametros',
    datos: { titulo: 'Ubicaciones y parámetros', roles: [ADM], paso: 5, mockup: '05-ubicaciones-parametros' },
  },
  proyectos: {
    ruta: '/proyectos',
    datos: { titulo: 'Proyectos', roles: [ADM, COO], paso: 6, mockup: '06-proyectos' },
  },
  bitacora: {
    ruta: '/proyectos/bitacora',
    // El Aprobador la consulta completa ("Ver en la bitácora" del despacho); solo el Coordinador pide correcciones
    datos: { titulo: 'Bitácora de despachos', roles: [COO, APR], paso: 19, mockup: '19-bitacora' },
  },
  usoMateriaPrima: {
    ruta: '/proyectos/uso-materia-prima',
    datos: { titulo: 'Uso de materia prima', roles: [COO], paso: 20, mockup: '20-uso-materia-prima' },
  },
  fichaProyecto: {
    ruta: '/proyectos/:codigo',
    datos: { titulo: 'Ficha de proyecto', roles: [ADM, COO], paso: 7, mockup: '07-ficha-proyecto' },
  },
  planHitos: {
    ruta: '/proyectos/:codigo/plan',
    datos: { titulo: 'Plan de hitos y avance', roles: [COO], paso: 8, mockup: '08-plan-hitos' },
  },
  inventario: {
    ruta: '/inventario',
    datos: { titulo: 'Inventario', roles: [APR, ADM, COO], paso: 9, mockup: '09-inventario' },
  },
  fichaInsumo: {
    ruta: '/inventario/:id',
    datos: { titulo: 'Ficha de insumo', roles: [APR, ADM], paso: 10, mockup: '10-ficha-insumo' },
  },
  equipos: {
    ruta: '/equipos',
    datos: { titulo: 'Catálogo de equipos', roles: [ADM], paso: 11, mockup: '11-equipos' },
  },
  reservas: {
    ruta: '/reservas',
    datos: { titulo: 'Equipos y reservas', roles: [COO, APR], paso: 12, mockup: '12-reservas' },
  },
  usoEquipo: {
    ruta: '/reservas/uso',
    datos: { titulo: 'Uso de equipo', roles: [COO], paso: 13, mockup: '13-uso-equipo' },
  },
  solicitudes: {
    ruta: '/solicitudes',
    datos: { titulo: 'Mis solicitudes', roles: [COO], paso: 14, mockup: '14-solicitudes' },
  },
  bandeja: {
    ruta: '/bandeja',
    datos: { titulo: 'Bandeja de aprobación', roles: [APR], paso: 15, mockup: '15-bandeja-aprobacion' },
  },
  priorizacion: {
    ruta: '/priorizacion',
    // F5.6: el orden por prioridad lo consultan todos; solo el Aprobador lo cambia (F5.7)
    datos: { titulo: 'Priorización', roles: [APR, ADM, COO], paso: 16, mockup: '16-priorizacion' },
  },
  almacen: { ruta: '/almacen', datos: { titulo: 'Almacén', roles: [APR], paso: 17 } },
  recepcion: {
    ruta: '/almacen/recepcion',
    datos: { titulo: 'Recepción de lote', roles: [APR], paso: 17, mockup: '17-recepcion-lote' },
  },
  despacho: {
    ruta: '/almacen/despacho',
    datos: { titulo: 'Despacho', roles: [APR], paso: 18, mockup: '18-despacho' },
  },
  revisionCargos: {
    ruta: '/cierre/cargos',
    datos: { titulo: 'Revisión de cargos', roles: [COO], paso: 21, mockup: '21-revision-cargos' },
  },
  cierrePeriodo: {
    ruta: '/gastos-compartidos/cierre',
    datos: { titulo: 'Cierre de período', roles: [APR], paso: 22, mockup: '22-cierre-periodo' },
  },
  reparto: {
    ruta: '/gastos-compartidos/reparto',
    datos: { titulo: 'Reparto de gastos compartidos', roles: [APR], paso: 23, mockup: '23-prorrateo' },
  },
  reportes: {
    ruta: '/reportes',
    datos: { titulo: 'Reportes', roles: [COO, APR, ADM], paso: 24, mockup: '24-reportes' },
  },
  auditoria: {
    ruta: '/auditoria',
    datos: { titulo: 'Auditoría', roles: [ADM], paso: 25, mockup: '25-auditoria' },
  },
  buscar: { ruta: '/buscar', datos: { titulo: 'Búsqueda' } },
} satisfies Record<string, { ruta: string; datos: DatosRuta }>
