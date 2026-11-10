import { DialogoAlerta } from '@/components/ui/dialogo'

type Props = {
  /** Segundos que faltan para el cierre; null oculta el aviso. */
  restante: number | null
  alSeguir: () => void
  alSalir: () => void
}

function reloj(segundos: number) {
  const m = Math.floor(segundos / 60)
  const s = String(segundos % 60).padStart(2, '0')
  return `${m}:${s}`
}

/**
 * Aviso de sesión por expirar, 2 minutos antes del cierre por inactividad (mockup 01; WCAG 2.2.1).
 * El foco empieza en "Seguir trabajando", que es la opción segura; Escape también sigue trabajando.
 */
export function AvisoSesion({ restante, alSeguir, alSalir }: Props) {
  return (
    <DialogoAlerta
      abierto={restante !== null}
      alCambiar={(abierto) => {
        if (!abierto) alSeguir()
      }}
      titulo="Tu sesión está por cerrarse"
      descripcion={
        restante !== null
          ? `No detectamos actividad. La sesión se cierra en ${reloj(restante)}. Elige "Seguir trabajando" para no perder lo que todavía no guardaste.`
          : undefined
      }
      confirmar="Seguir trabajando"
      alConfirmar={alSeguir}
      focoEnConfirmar
      cancelar="Cerrar sesión"
      alCancelar={alSalir}
    />
  )
}
