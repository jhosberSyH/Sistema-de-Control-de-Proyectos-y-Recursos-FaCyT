import { useMatches } from 'react-router'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { EstadoVacio } from '@/components/ui/estados-vista'
import type { DatosRuta } from '../rutas'

/** Marcador de las vistas que todavía no se construyen (se reemplaza vista por vista). */
export function EnConstruccion() {
  const coincidencias = useMatches()
  const datos = coincidencias[coincidencias.length - 1]?.handle as DatosRuta | undefined
  return (
    <>
      <EncabezadoPagina titulo={datos?.titulo ?? 'Vista en construcción'} />
      <EstadoVacio icono="reloj" titulo="Vista en construcción">
        {datos?.paso
          ? `Esta vista se construye en el paso ${datos.paso} del plan del frontend${datos.mockup ? `, a partir del mockup ${datos.mockup}` : ''}.`
          : 'Esta vista todavía no tiene diseño aprobado.'}
      </EstadoVacio>
    </>
  )
}
