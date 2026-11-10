import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { conSesion, renderApp } from '@/testing/render'

describe('Inicio de sesión (vista 01) y marco de la app', () => {
  it('sin sesión, una ruta interna lleva al inicio de sesión', async () => {
    renderApp('/inicio')
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })

  it('valida los campos vacíos junto a cada campo', async () => {
    const { usuario } = renderApp('/iniciar-sesion')
    await usuario.click(await screen.findByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByText('Escribe tu correo.')).toBeInTheDocument()
    expect(screen.getByText('Escribe tu contraseña.')).toBeInTheDocument()
    expect(screen.getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true')
  })

  it('con la contraseña errada muestra el aviso y marca la contraseña, como en el mockup', async () => {
    const { usuario } = renderApp('/iniciar-sesion')
    await usuario.type(await screen.findByLabelText('Correo'), 'coord.quimica@cpq.local')
    await usuario.type(screen.getByLabelText('Contraseña'), 'otra-clave')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    expect(await screen.findByRole('alert')).toHaveTextContent('El correo o la contraseña no coinciden')
    expect(screen.getByLabelText('Contraseña')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByLabelText('Contraseña')).toHaveFocus()
  })

  it('una cuenta desactivada no entra (F1.3)', async () => {
    const { usuario } = renderApp('/iniciar-sesion')
    await usuario.type(await screen.findByLabelText('Correo'), 'p.gil@cpq.local')
    await usuario.type(screen.getByLabelText('Contraseña'), 'Demo2026*')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Tu cuenta está desactivada')
  })

  it('al entrar muestra el menú del rol con sus contadores', async () => {
    const { usuario, router } = renderApp('/iniciar-sesion')
    await usuario.type(await screen.findByLabelText('Correo'), 'coord.quimica@cpq.local')
    await usuario.type(screen.getByLabelText('Contraseña'), 'Demo2026*')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar sesión' }))

    const menu = await screen.findByRole('complementary', { name: 'Navegación principal' })
    expect(router.state.location.pathname).toBe('/inicio')
    expect(within(menu).getByRole('link', { name: /Mis proyectos/ })).toBeInTheDocument()
    expect(within(menu).getByRole('link', { name: /Inicio/ })).toHaveAttribute('aria-current', 'page')
    expect(
      await within(menu).findByRole('link', { name: /^Solicitudes\s*\(1 pendiente\)$/ }),
    ).toBeInTheDocument()
    expect(within(menu).queryByRole('link', { name: /Usuarios/ })).not.toBeInTheDocument()
  })

  it('una sección de otro rol muestra "Sin permiso" con quién la usa', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/usuarios')
    expect(
      await screen.findByRole('heading', { name: 'No tienes permiso para abrir esta sección' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/La usa el rol Administrador del Sistema/)).toBeInTheDocument()
  })

  it('el avatar de la barra abre Mi perfil, y desde ahí se cierra la sesión', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario, router } = renderApp('/inicio')
    await usuario.click(await screen.findByRole('link', { name: /Mi perfil: Carmen Pérez/ }))
    // Mi perfil se carga bajo demanda: la URL cambia cuando llega su fragmento
    expect(await screen.findByRole('heading', { name: 'Mi perfil', level: 1 })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/perfil')
    expect(screen.getByText('Aprobador / Gestor de Inventario')).toBeInTheDocument()

    // El riel ya no tiene botones de tema ni de salida
    const menu = screen.getByRole('complementary', { name: 'Navegación principal' })
    expect(within(menu).queryByRole('button')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cerrar sesión' }))
    expect(await screen.findByRole('heading', { name: 'Inicia sesión' })).toBeInTheDocument()
  })
})
