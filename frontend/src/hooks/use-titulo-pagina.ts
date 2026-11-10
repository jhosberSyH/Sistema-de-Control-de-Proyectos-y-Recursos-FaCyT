import { useEffect, useSyncExternalStore } from 'react'

/*
 * Título de la página que conoce la vista y no la ruta, como el código del proyecto en su ficha
 * ("QUI-024", mockup 07). El marco lo usa en la barra del teléfono y en el título de la pestaña.
 */
let actual: string | null = null
const oyentes = new Set<() => void>()

function fijar(titulo: string | null) {
  actual = titulo
  oyentes.forEach((o) => o())
}

/** La vista declara su título mientras está montada. */
export function useTituloPagina(titulo: string | null | undefined) {
  useEffect(() => {
    if (!titulo) return
    fijar(titulo)
    return () => fijar(null)
  }, [titulo])
}

/** El marco lee el título declarado por la vista, si hay uno. */
export function useTituloDeLaVista() {
  return useSyncExternalStore(
    (oyente) => {
      oyentes.add(oyente)
      return () => oyentes.delete(oyente)
    },
    () => actual,
  )
}
