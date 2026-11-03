/**
 * Tema de la interfaz: el del sistema por defecto, o claro u oscuro a elección del usuario.
 * Igual que en los mockups, se fuerza con data-theme en <html>; la elección se recuerda en este
 * navegador. index.html la aplica antes de pintar para que no parpadee.
 */

export type Tema = 'sistema' | 'light' | 'dark'

const CLAVE = 'cpq-tema'
const oyentes = new Set<() => void>()

export function leerTema(): Tema {
  try {
    const guardado = localStorage.getItem(CLAVE)
    return guardado === 'light' || guardado === 'dark' ? guardado : 'sistema'
  } catch {
    return 'sistema'
  }
}

export function cambiarTema(tema: Tema) {
  const raiz = document.documentElement
  if (tema === 'sistema') raiz.removeAttribute('data-theme')
  else raiz.setAttribute('data-theme', tema)
  try {
    if (tema === 'sistema') localStorage.removeItem(CLAVE)
    else localStorage.setItem(CLAVE, tema)
  } catch {
    // Sin almacenamiento (ventana privada): el tema dura hasta recargar.
  }
  oyentes.forEach((avisar) => avisar())
}

export function suscribirTema(avisar: () => void) {
  oyentes.add(avisar)
  return () => oyentes.delete(avisar)
}

export const ETIQUETAS_TEMA: Record<Tema, string> = { sistema: 'Sistema', light: 'Claro', dark: 'Oscuro' }
