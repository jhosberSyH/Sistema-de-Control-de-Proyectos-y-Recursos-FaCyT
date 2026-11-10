/*
 * Pronóstico de consumo (F3.7, IA-01). El backend usa statsmodels (README §6: suavizado exponencial
 * Holt-Winters); con pocos meses no hay estacionalidad que estimar, así que queda en Holt con tendencia
 * amortiguada. Aquí se calcula igual para que la ficha muestre números coherentes con la bitácora.
 */

const ALFA = 0.5
const BETA = 0.2
const PHI = 0.9
/** Intervalo del 95 %: ± 1,96 veces el error cuadrático medio de los pronósticos a un paso. */
const Z = 1.96

const redondear = (n: number) => Math.round(n * 10) / 10

/** Consumo esperado del mes siguiente a la serie, con su intervalo. La serie necesita 2 meses o más. */
export function pronosticar(serie: number[]) {
  let nivel = serie[0]
  let tendencia = serie[1] - serie[0]
  const errores: number[] = []
  for (const x of serie.slice(1)) {
    errores.push(x - (nivel + PHI * tendencia))
    const nuevo = ALFA * x + (1 - ALFA) * (nivel + PHI * tendencia)
    tendencia = BETA * (nuevo - nivel) + (1 - BETA) * PHI * tendencia
    nivel = nuevo
  }
  const valor = Math.max(0, nivel + PHI * tendencia)
  const rmse = Math.sqrt(errores.reduce((t, e) => t + e * e, 0) / errores.length)
  return {
    valor: redondear(valor),
    minimo: redondear(Math.max(0, valor - Z * rmse)),
    maximo: redondear(valor + Z * rmse),
  }
}
