/**
 * Avance físico por hitos ponderados (F2.6): suma de avance × peso de cada hito, entre 100, con un
 * decimal. Ejemplo de HU-05: un hito de peso 60 al 50 % y uno de peso 40 al 100 % dan 70 %.
 * El servidor lo calcula igual; aquí sirve para mostrar el resultado antes de guardar.
 */
export function avanceFisico(hitos: { peso: number; avance: number }[]) {
  return Math.round(hitos.reduce((suma, h) => suma + h.peso * h.avance, 0) / 10) / 10
}

/** Lee un entero escrito en un campo ("85", " 15 "); null si está vacío o no es un entero. */
export function leerEntero(texto: string) {
  const t = texto.trim()
  return /^\d+$/.test(t) ? Number(t) : null
}
