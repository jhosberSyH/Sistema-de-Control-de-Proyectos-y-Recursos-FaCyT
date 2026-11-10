import { BotonEnlace } from '@/components/ui/boton'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { EstadoVacio } from '@/components/ui/estados-vista'
import { NOMBRE_ROL, type Rol } from '@/modulos/autenticacion'

/** Página "Sin permiso": dice qué rol puede usar la sección y ofrece volver al inicio (H3, H9). */
export function SinPermiso({ roles }: { roles: Rol[] }) {
  const quienes = roles.map((r) => NOMBRE_ROL[r]).join(' o ')
  return (
    <div className="pagina-estado" style={{ display: 'grid', gap: 24 }}>
      <EncabezadoPagina titulo="Esta sección no está disponible para tu cuenta" />
      <EstadoVacio
        icono="candado"
        titulo="No tienes permiso para abrir esta sección"
        accion={
          <BotonEnlace variante="pri" to="/inicio">
            Ir a mi inicio
          </BotonEnlace>
        }
      >
        {quienes
          ? `La usa el rol ${quienes}. Si crees que la necesitas, pídele al administrador del sistema que revise tu cuenta.`
          : 'Si crees que la necesitas, pídele al administrador del sistema que revise tu cuenta.'}
      </EstadoVacio>
    </div>
  )
}
