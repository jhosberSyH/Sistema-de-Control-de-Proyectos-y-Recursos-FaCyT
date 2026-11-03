import { useSyncExternalStore } from 'react'
import { cambiarTema, leerTema, suscribirTema } from '@/lib/tema'

/** Tema elegido y la función para cambiarlo. */
export function useTema() {
  const tema = useSyncExternalStore(suscribirTema, leerTema, () => 'sistema' as const)
  return [tema, cambiarTema] as const
}
