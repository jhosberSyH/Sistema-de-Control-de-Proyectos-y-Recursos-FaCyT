import { setupServer } from 'msw/node'
import { handlers } from './handlers'

/** Los mismos handlers, interceptando en Node para las pruebas de Vitest. */
export const server = setupServer(...handlers)
