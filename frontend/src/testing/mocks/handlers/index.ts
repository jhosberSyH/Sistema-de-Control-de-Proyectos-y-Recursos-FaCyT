import { handlersAlmacen } from './almacen'
import { handlersAuditoria } from './auditoria'
import { handlersAutenticacion } from './autenticacion'
import { handlersAvisos } from './avisos'
import { handlersBandeja } from './bandeja'
import { handlersBusqueda } from './busqueda'
import { handlersCatalogos } from './catalogos'
import { handlersDashboard } from './dashboard'
import { handlersDespachos } from './despachos'
import { handlersEquipos } from './equipos'
import { handlersHitos } from './hitos'
import { handlersInicio } from './inicio'
import { handlersInventario } from './inventario'
import { handlersMisSolicitudes } from './mis-solicitudes'
import { handlersPriorizacion } from './priorizacion'
import { handlersProrrateo } from './prorrateo'
import { handlersProyectos } from './proyectos'
import { handlersReportes } from './reportes'
import { handlersReservas } from './reservas'
import { handlersSolicitudes } from './solicitudes'
import { handlersUsos } from './usos'
import { handlersUsosMateria } from './usos-materia'
import { handlersUsuarios } from './usuarios'

/** Todos los handlers, agrupados por módulo como recomienda MSW. Cada vista nueva agrega los suyos. */
export const handlers = [
  ...handlersAutenticacion,
  ...handlersAvisos,
  ...handlersInicio,
  ...handlersProrrateo,
  ...handlersUsuarios,
  ...handlersCatalogos,
  ...handlersPriorizacion,
  ...handlersProyectos,
  ...handlersHitos,
  ...handlersInventario,
  ...handlersSolicitudes,
  ...handlersBandeja,
  ...handlersMisSolicitudes,
  ...handlersEquipos,
  ...handlersReservas,
  ...handlersUsos,
  ...handlersAlmacen,
  ...handlersDespachos,
  ...handlersUsosMateria,
  ...handlersReportes,
  ...handlersAuditoria,
  ...handlersDashboard,
  ...handlersBusqueda,
]
