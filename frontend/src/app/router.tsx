import { createBrowserRouter, Navigate, type RouteObject } from 'react-router'
import { Cargando } from '@/components/ui/estados-vista'
import { RUTAS } from './rutas'
import { AppLayout } from './routes/app-layout'
import { EnConstruccion } from './routes/en-construccion'
import { ErrorRuta } from './routes/error-ruta'
import { NoEncontrada } from './routes/no-encontrada'

/** Vistas ya construidas, cargadas bajo demanda (cada una en su propio fragmento del build). */
const VISTAS: Partial<Record<keyof typeof RUTAS, RouteObject['lazy']>> = {
  inicio: async () => ({ Component: (await import('./routes/inicio/inicio')).Inicio }),
  usuarios: async () => ({ Component: (await import('./routes/usuarios')).Usuarios }),
  proyectos: async () => ({ Component: (await import('./routes/proyectos')).Proyectos }),
  fichaProyecto: async () => ({ Component: (await import('./routes/ficha-proyecto')).FichaProyecto }),
  planHitos: async () => ({ Component: (await import('./routes/plan-hitos')).PlanHitos }),
  inventario: async () => ({ Component: (await import('./routes/inventario')).Inventario }),
  fichaInsumo: async () => ({ Component: (await import('./routes/ficha-insumo')).FichaInsumo }),
  equipos: async () => ({ Component: (await import('./routes/equipos')).Equipos }),
  reservas: async () => ({ Component: (await import('./routes/reservas')).Reservas }),
  usoEquipo: async () => ({ Component: (await import('./routes/uso-equipo')).UsoEquipo }),
  solicitudes: async () => ({ Component: (await import('./routes/solicitudes')).Solicitudes }),
  bandeja: async () => ({ Component: (await import('./routes/bandeja')).Bandeja }),
  priorizacion: async () => ({ Component: (await import('./routes/priorizacion')).Priorizacion }),
  almacen: async () => ({ Component: (await import('./routes/almacen')).Almacen }),
  recepcion: async () => ({ Component: (await import('./routes/recepcion')).Recepcion }),
  despacho: async () => ({ Component: (await import('./routes/despacho')).Despacho }),
  bitacora: async () => ({ Component: (await import('./routes/bitacora')).Bitacora }),
  revisionCargos: async () => ({ Component: (await import('./routes/revision-cargos')).RevisionCargos }),
  cierrePeriodo: async () => ({ Component: (await import('./routes/cierre-periodo')).CierrePeriodo }),
  reparto: async () => ({ Component: (await import('./routes/reparto')).RepartoGastos }),
  reportes: async () => ({ Component: (await import('./routes/reportes')).Reportes }),
  auditoria: async () => ({ Component: (await import('./routes/auditoria')).Auditoria }),
  buscar: async () => ({ Component: (await import('./routes/buscar')).Buscar }),
  dashboard: async () => ({ Component: (await import('./routes/dashboard')).DashboardEjecutivo }),
  usoMateriaPrima: async () => ({
    Component: (await import('./routes/uso-materia-prima')).UsoMateriaPrima,
  }),
  ubicaciones: async () => ({
    Component: (await import('./routes/ubicaciones-parametros')).UbicacionesParametros,
  }),
}

/** Rutas del plan: las construidas cargan su vista; las demás muestran "Vista en construcción". */
const rutasPlan: RouteObject[] = (Object.keys(RUTAS) as (keyof typeof RUTAS)[]).map((clave) => {
  const { ruta, datos } = RUTAS[clave]
  const vista = VISTAS[clave]
  return vista
    ? { path: ruta, handle: datos, lazy: vista }
    : { path: ruta, handle: datos, element: <EnConstruccion /> }
})

/** Galería de componentes: solo en desarrollo; en el build de producción esta ruta no existe. */
const desarrollo: RouteObject[] = import.meta.env.DEV
  ? [
      {
        path: '/componentes',
        handle: { titulo: 'Componentes' },
        lazy: async () => ({ Component: (await import('./routes/galeria')).Galeria }),
      },
    ]
  : []

/** Árbol de rutas; las pruebas lo montan con createMemoryRouter. */
export const rutasApp: RouteObject[] = [
  {
    path: '/iniciar-sesion',
    errorElement: <ErrorRuta />,
    hydrateFallbackElement: <Cargando />,
    // Aparte del resto: Zod y React Hook Form solo los necesita esta pantalla.
    lazy: async () => ({ Component: (await import('./routes/iniciar-sesion')).RutaIniciarSesion }),
  },
  {
    path: '/crear-clave',
    errorElement: <ErrorRuta />,
    hydrateFallbackElement: <Cargando />,
    lazy: async () => ({ Component: (await import('./routes/crear-clave')).RutaCrearClave }),
  },
  {
    element: <AppLayout />,
    errorElement: <ErrorRuta />,
    // Mientras llega el fragmento de la vista en la primera carga (rutas perezosas)
    hydrateFallbackElement: <Cargando />,
    children: [
      { index: true, element: <Navigate to="/inicio" replace /> },
      {
        path: '/perfil',
        handle: { titulo: 'Mi perfil' },
        lazy: async () => ({ Component: (await import('./routes/perfil')).Perfil }),
      },
      ...rutasPlan,
      ...desarrollo,
      { path: '*', handle: { titulo: 'Página no encontrada' }, element: <NoEncontrada /> },
    ],
  },
]

export const router = createBrowserRouter(rutasApp)
