import { diaMes, fechaCorta, fechaIso, hora, nombreMes } from '@/lib/formato'

/** "octubre de 2026" o "el trimestre del 01/07/2026 al 30/09/2026". */
export function nombrePeriodo(p: { tipo: string; inicio: string; fin: string }) {
  return p.tipo === 'mensual'
    ? `${nombreMes(p.inicio)} de ${p.inicio.slice(0, 4)}`
    : `el trimestre del ${fechaCorta(p.inicio)} al ${fechaCorta(p.fin)}`
}

/** "Octubre de 2026" para un título. */
export const tituloPeriodo = (p: { tipo: string; inicio: string; fin: string }) => {
  const n = nombrePeriodo(p)
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** "Hoy a las 10:31", "Ayer a las 16:05" o "El 25/10 a las 09:40" */
export function cuandoFrase(fecha: string) {
  const dia = fechaIso(fecha)
  if (dia === fechaIso()) return `Hoy a las ${hora(fecha)}`
  if (dia === fechaIso(new Date(Date.now() - 86_400_000))) return `Ayer a las ${hora(fecha)}`
  return `El ${diaMes(fecha)} a las ${hora(fecha)}`
}

/** El último día de un período que empieza en `inicio`: fin de mes o fin del trimestre. */
export function finSugerido(inicio: string, tipo: 'mensual' | 'trimestral') {
  const [a, m] = inicio.split('-').map(Number)
  return new Date(Date.UTC(a, m - 1 + (tipo === 'mensual' ? 1 : 3), 0)).toISOString().slice(0, 10)
}
