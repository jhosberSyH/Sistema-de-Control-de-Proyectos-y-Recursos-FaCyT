import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { BloqueParametros } from './bloque-parametros'
import { BloqueUbicaciones } from './bloque-ubicaciones'
import './ubicaciones-parametros.css'

/** Vista 05: ubicaciones de almacenamiento (F1.4) y parámetros generales (F1.5). Solo el Administrador. */
export function VistaUbicacionesParametros() {
  return (
    <div className="vista-ubicaciones">
      <EncabezadoPagina
        migas={[{ texto: 'Inicio', a: '/inicio' }, { texto: 'Ubicaciones y parámetros' }]}
        titulo="Ubicaciones y parámetros"
        subtitulo="Los lugares donde se guardan los lotes y los valores que usan las alertas y el pronóstico."
      />
      <div className="dos">
        <BloqueUbicaciones />
        <BloqueParametros />
      </div>
    </div>
  )
}
