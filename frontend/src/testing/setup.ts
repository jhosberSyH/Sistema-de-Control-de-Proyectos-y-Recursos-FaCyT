import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll, beforeEach } from 'vitest'
import { sembrar } from './mocks/db'
import { server } from './mocks/server'
import { guardarSesion } from './mocks/utils'

// La primera prueba de cada archivo carga la vista perezosa (import dinámico) y algunas esperan una pausa a
// propósito (búsqueda, guardado automático): con todos los archivos en paralelo, el segundo que espera
// findBy por defecto no alcanza.
configure({ asyncUtilTimeout: 8000 })

// Las pruebas usan los mismos handlers que el navegador en modo mock (plan_frontend.md §8).
beforeAll(() => server.listen({ onUnhandledFrame: 'error' }))
beforeEach(async () => {
  await sembrar()
  guardarSesion(null)
  window.localStorage.clear()
})
afterEach(() => {
  cleanup()
  server.resetHandlers()
})
afterAll(() => server.close())
