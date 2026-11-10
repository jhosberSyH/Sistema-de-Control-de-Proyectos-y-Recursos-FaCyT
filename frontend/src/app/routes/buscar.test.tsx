import { screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { conSesion, renderApp } from '@/testing/render'
import { idProyecto } from '@/testing/mocks/datos/proyectos'
import { idSolicitudSemilla } from '@/testing/mocks/datos/solicitudes'

beforeAll(() => import('./buscar'), 60_000)

describe('Búsqueda (barra superior, REV-004)', () => {
  it('desde la barra superior lleva a los resultados con el alcance del coordinador (RN-07)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/inicio')
    await usuario.type(
      await screen.findByRole('searchbox', { name: 'Buscar en todo el sistema' }),
      'QUI-0{Enter}',
    )

    expect(
      await screen.findByRole('heading', { level: 1, name: 'Resultados para «QUI-0»' }),
    ).toBeInTheDocument()
    const proyectos = await screen.findByRole('region', { name: 'Proyectos' })
    expect(within(proyectos).getByRole('link', { name: /^QUI-024 · / })).toHaveAttribute(
      'href',
      `/proyectos/${idProyecto('QUI-024')}`,
    )
    // Ningún proyecto de otra coordinación
    expect(screen.queryByRole('link', { name: /^BIO-/ })).not.toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Equipos' })).not.toBeInTheDocument()
  })

  it('el administrador encuentra proyectos, insumos y equipos, pero no solicitudes', async () => {
    conSesion('admin@cpq.local')
    renderApp('/buscar?q=etanol')
    const insumos = await screen.findByRole('region', { name: 'Insumos' })
    expect(within(insumos).getByRole('link', { name: 'Etanol 96 %' })).toHaveAttribute(
      'href',
      '/inventario/ins-etanol',
    )
    expect(screen.queryByRole('region', { name: 'Solicitudes' })).not.toBeInTheDocument()
  })

  it('el aprobador abre el pedido en su bandeja', async () => {
    conSesion('aprobador@cpq.local')
    renderApp('/buscar?q=SOL-121')
    const solicitudes = await screen.findByRole('region', { name: 'Solicitudes' })
    expect(within(solicitudes).getByRole('link', { name: /^SOL-121 · / })).toHaveAttribute(
      'href',
      `/bandeja?pedido=${idSolicitudSemilla('SOL-121')}`,
    )
  })

  it('pide al menos 2 letras y avisa cuando no hay resultados', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/buscar?q=a')
    expect(await screen.findByRole('heading', { name: 'Escribe al menos 2 letras' })).toBeInTheDocument()
    await usuario.clear(screen.getByRole('searchbox', { name: 'Buscar en todo el sistema' }))
    await usuario.type(screen.getByRole('searchbox', { name: 'Buscar en todo el sistema' }), 'zzzzzz{Enter}')
    expect(
      await screen.findByRole('heading', { name: 'No encontramos nada para «zzzzzz»' }),
    ).toBeInTheDocument()
  })
})
