import { BotonEnlace } from '@/components/ui/boton'
import { ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { esApiError } from '@/lib/api-client'

type Props = {
  codigo: string
  error: Error
  esAdministrador: boolean
  alReintentar: () => void
}

/**
 * Lo que se ve cuando un proyecto no se puede abrir: no existe (404), no es del coordinador (403, RN-07)
 * o falló la carga. Lo comparten la ficha (vista 07) y el plan de hitos (vista 08).
 */
export function ErrorProyecto({ codigo, error, esAdministrador, alReintentar }: Props) {
  const status = esApiError(error) ? error.status : 0
  if (status === 404 || status === 403) {
    return (
      <EstadoVacio
        icono={status === 403 ? 'candado' : 'buscar'}
        titulo={
          status === 403 ? 'Este proyecto no está asignado a ti' : `No encontramos el proyecto ${codigo}`
        }
        accion={
          <BotonEnlace to="/proyectos" chico>
            {esAdministrador ? 'Ver los proyectos' : 'Ver mis proyectos'}
          </BotonEnlace>
        }
      >
        {error.message}
      </EstadoVacio>
    )
  }
  return <ErrorCarga mensaje={error.message} alReintentar={alReintentar} />
}
