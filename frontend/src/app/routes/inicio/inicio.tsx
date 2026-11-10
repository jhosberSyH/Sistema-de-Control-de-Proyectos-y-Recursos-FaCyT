import { Cargando, ErrorCarga, Esqueleto } from '@/components/ui/estados-vista'
import { esApiError } from '@/lib/api-client'
import { useInicio } from './api'
import { VistaAdministrador } from './vista-administrador'
import { VistaAprobador } from './vista-aprobador'
import { VistaCoordinador } from './vista-coordinador'

/** Esqueleto con la forma del inicio: saludo, fila de contadores y las dos columnas. */
function EsqueletoInicio() {
  return (
    <Cargando etiqueta="Cargando tu inicio…">
      <Esqueleto className="esqueleto-titulo" />
      <Esqueleto ancho="45%" />
      <div className="contadores">
        {[0, 1, 2, 3].map((i) => (
          <Esqueleto key={i} alto={78} />
        ))}
      </div>
      <div className="rejilla">
        <Esqueleto alto={260} />
        <Esqueleto alto={260} />
      </div>
    </Cargando>
  )
}

/** Vista 02, Inicio por rol (/inicio): F-sin código; agrega datos de M2 a M8 para cada rol (RF-01 a RF-10, RN-07). */
export function Inicio() {
  const inicio = useInicio()
  if (inicio.isPending) return <EsqueletoInicio />
  if (inicio.isError) {
    return (
      <ErrorCarga
        mensaje={esApiError(inicio.error) ? inicio.error.message : 'No pudimos cargar tu inicio.'}
        alReintentar={() => inicio.refetch()}
      />
    )
  }
  const datos = inicio.data
  if (datos.rol === 'coordinador') return <VistaCoordinador datos={datos} />
  if (datos.rol === 'aprobador') return <VistaAprobador datos={datos} />
  return <VistaAdministrador datos={datos} />
}
