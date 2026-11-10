import { BotonEnlace } from '@/components/ui/boton'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { EstadoVacio } from '@/components/ui/estados-vista'

/** Página 404 dentro del marco: explica qué pasó y ofrece una salida clara (H3, H9). */
export function NoEncontrada() {
  return (
    <div className="pagina-estado" style={{ display: 'grid', gap: 24 }}>
      <EncabezadoPagina titulo="No encontramos esta página" />
      <EstadoVacio
        icono="buscar"
        titulo="La dirección no lleva a ninguna sección"
        accion={
          <BotonEnlace variante="pri" to="/inicio">
            Ir a mi inicio
          </BotonEnlace>
        }
      >
        Puede que el enlace esté mal escrito o que la página se haya movido. Usa el menú o vuelve al inicio.
      </EstadoVacio>
    </div>
  )
}
