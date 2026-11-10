import { isRouteErrorResponse, useRouteError } from 'react-router'
import { EstadoVacio } from '@/components/ui/estados-vista'

/**
 * Error inesperado al pintar una página. Se muestra en lenguaje claro, sin detalles técnicos, con
 * dos salidas (H9). El detalle queda en la consola para el equipo.
 */
export function ErrorRuta() {
  const error = useRouteError()
  console.error(error)
  const titulo =
    isRouteErrorResponse(error) && error.status === 404 ? 'No encontramos esta página' : 'Algo salió mal'
  return (
    <main className="contenido" style={{ maxWidth: 680, margin: '0 auto' }}>
      <EstadoVacio
        icono="alerta"
        titulo={titulo}
        accion={
          <div className="acc-form" style={{ justifyContent: 'flex-start' }}>
            <button className="btn btn-pri" type="button" onClick={() => window.location.reload()}>
              Recargar la página
            </button>
            <a className="btn btn-sec" href="/inicio">
              Ir a mi inicio
            </a>
          </div>
        }
      >
        La página no se pudo mostrar. Recarga para intentarlo de nuevo; si sigue pasando, avísale al
        administrador del sistema.
      </EstadoVacio>
    </main>
  )
}
