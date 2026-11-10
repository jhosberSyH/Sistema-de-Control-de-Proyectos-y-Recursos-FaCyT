import { http, HttpResponse } from 'msw'
import { setupWorker } from 'msw/browser'
import { handlers } from './handlers'

/** Ruta de control: si responde con este encabezado, el Service Worker sigue atendiendo esta pestaña. */
export const RUTA_CONTROL = '/api/__mocks'

/** Service Worker de MSW para el navegador (modo mock). */
export const worker = setupWorker(
  ...handlers,
  http.get(RUTA_CONTROL, () => new HttpResponse(null, { status: 204, headers: { 'x-mocks': 'activos' } })),
)
