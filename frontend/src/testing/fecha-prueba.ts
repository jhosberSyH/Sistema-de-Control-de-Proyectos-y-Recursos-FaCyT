import { vi } from 'vitest'

/*
 * VITE_FECHA_PRUEBA=2026-11-07T10:00:00-04:00 npm run test corre la suite como si fuera ese día. La semilla es
 * relativa a hoy, así se comprueba que las pruebas no dependan del día de la semana. Solo se finge Date.
 */
// import.meta.env no sirve aquí: Vite solo expone las variables con prefijo VITE_
const fecha = import.meta.env.VITE_FECHA_PRUEBA as string | undefined
if (fecha) {
  vi.useFakeTimers({ toFake: ['Date'], now: new Date(fecha) })
}
