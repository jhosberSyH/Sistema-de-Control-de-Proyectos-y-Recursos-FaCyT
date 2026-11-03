import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { rutasApp } from '@/app/router'
import { db } from './mocks/db'
import { guardarSesion, nuevoTokenCsrf } from './mocks/utils'

/** Monta la app completa en una ruta, con una caché de TanStack Query nueva para cada prueba. */
export function renderApp(ruta = '/') {
  const cliente = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  })
  const router = createMemoryRouter(rutasApp, { initialEntries: [ruta] })
  const usuario = userEvent.setup()
  const resultado = render(
    <QueryClientProvider client={cliente}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  )
  return { ...resultado, router, usuario }
}

/** Abre una sesión simulada sin pasar por el formulario (para probar vistas internas). */
export function conSesion(correo: string) {
  const u = db.usuarios.findFirst((q) => q.where({ correo }), { strict: true })
  guardarSesion({ usuarioId: u.id, csrf: nuevoTokenCsrf() })
}
