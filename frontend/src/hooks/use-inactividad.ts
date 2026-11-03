import { useCallback, useEffect, useRef, useState } from 'react'

const EVENTOS = ['pointerdown', 'keydown', 'wheel', 'touchstart'] as const
const AVISO_ANTES_MS = 2 * 60_000
const RENOVAR_CADA_MS = 5 * 60_000

type Opciones = {
  /** Minutos sin actividad tras los que el servidor cierra la sesión. */
  minutos: number
  /** Mantiene viva la sesión del servidor mientras el usuario trabaja sin enviar datos. */
  alRenovar: () => void
  /** Se llama al llegar a cero: la sesión se cierra. */
  alExpirar: () => void
  activo?: boolean
}

/**
 * Lleva la cuenta de la inactividad para el aviso de sesión por expirar (mockup 01, WCAG 2.2.1).
 * Mientras hay actividad renueva la sesión cada 5 minutos; 2 minutos antes del cierre devuelve
 * los segundos restantes para mostrar el aviso con "Seguir trabajando".
 */
export function useInactividad({ minutos, alRenovar, alExpirar, activo = true }: Opciones) {
  const ultimaActividad = useRef(0)
  const ultimaRenovacion = useRef(0)
  const [restante, setRestante] = useState<number | null>(null)
  const callbacks = useRef({ alRenovar, alExpirar })

  useEffect(() => {
    callbacks.current = { alRenovar, alExpirar }
  }, [alRenovar, alExpirar])

  const seguir = useCallback(() => {
    ultimaActividad.current = Date.now()
    ultimaRenovacion.current = Date.now()
    setRestante(null)
    callbacks.current.alRenovar()
  }, [])

  useEffect(() => {
    if (!activo) return
    ultimaActividad.current = Date.now()
    ultimaRenovacion.current = Date.now()
    const limite = minutos * 60_000
    const marcar = () => {
      // Con el aviso a la vista, solo el botón cuenta como "seguir": un clic cualquiera no lo descarta.
      if (Date.now() - ultimaActividad.current < limite - AVISO_ANTES_MS) ultimaActividad.current = Date.now()
    }
    EVENTOS.forEach((e) => window.addEventListener(e, marcar, { passive: true }))
    const reloj = window.setInterval(() => {
      const ahora = Date.now()
      const inactivo = ahora - ultimaActividad.current
      if (inactivo >= limite) {
        window.clearInterval(reloj)
        callbacks.current.alExpirar()
        return
      }
      if (inactivo >= limite - AVISO_ANTES_MS) {
        setRestante(Math.ceil((limite - inactivo) / 1000))
        return
      }
      setRestante(null)
      if (
        ahora - ultimaRenovacion.current >= RENOVAR_CADA_MS &&
        ultimaActividad.current > ultimaRenovacion.current
      ) {
        ultimaRenovacion.current = ahora
        callbacks.current.alRenovar()
      }
    }, 1000)
    return () => {
      EVENTOS.forEach((e) => window.removeEventListener(e, marcar))
      window.clearInterval(reloj)
    }
  }, [activo, minutos])

  return { restante, seguir }
}
