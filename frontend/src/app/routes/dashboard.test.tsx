import { screen, waitFor, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { proyectosActivos } from '@/testing/mocks/consultas'
import { conSesion, renderApp } from '@/testing/render'

describe('Dashboard ejecutivo (vista 03, F8.1)', () => {
  // La vista carga Recharts: se precarga para que la primera prueba no pase del tiempo límite
  beforeAll(() => import('./dashboard'), 60_000)

  it('muestra los indicadores al día y el detalle de cada uno', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/dashboard')
    expect(await screen.findByRole('heading', { level: 1, name: 'Dashboard ejecutivo' })).toBeInTheDocument()
    const indicadores = screen.getByRole('region', { name: 'Indicadores' })
    const activos = within(indicadores).getByRole('button', { name: /Proyectos activos/ })
    expect(activos).toHaveTextContent(
      `Proyectos activos${proyectosActivos().length}En ejecución, según RN-05`,
    )
    // Cuatro insumos bajo su mínimo y L-0311 vencido (mockups 03 y 09)
    expect(within(indicadores).getByRole('button', { name: /Alertas críticas de stock/ })).toHaveTextContent(
      'Alertas críticas de stock4',
    )
    expect(within(indicadores).getByRole('button', { name: /Lotes próximos a vencer/ })).toHaveTextContent(
      'Y 1 lote vencido',
    )

    await usuario.click(within(indicadores).getByRole('button', { name: /Alertas críticas de stock/ }))
    expect(within(indicadores).getByRole('button', { name: /Alertas críticas de stock/ })).toHaveAttribute(
      'aria-expanded',
      'true',
    )
    const detalle = screen.getByRole('heading', { name: 'Insumos bajo su mínimo' }).closest('section')!
    expect(within(detalle).getByRole('columnheader', { name: 'Reposición' })).toBeInTheDocument()
    expect(detalle).toHaveTextContent('Acetona grado analítico')
    await usuario.click(within(detalle).getByRole('button', { name: 'Cerrar detalle' }))
    expect(screen.queryByRole('heading', { name: 'Insumos bajo su mínimo' })).not.toBeInTheDocument()

    // Cada gráfico tiene su tabla (WCAG 1.1.1)
    const ejecucion = screen.getByRole('region', { name: 'Ejecución presupuestaria por proyecto' })
    const ver = within(ejecucion).getByRole('button', { name: 'Ver como tabla' })
    await usuario.click(ver)
    expect(ver).toHaveAttribute('aria-expanded', 'true')
    expect(
      within(ejecucion).getByRole('table', { name: 'Ejecución presupuestaria por proyecto' }),
    ).toBeInTheDocument()
    // BIO-015 supera su presupuesto (109 %): lleva el ícono de alerta, no solo el color
    expect(within(ejecucion).getByLabelText('BIO-015: 109 % del presupuesto')).toHaveTextContent('109 %')
  })

  it('filtra por prioridad', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/dashboard')
    const filtros = await screen.findByRole('form', { name: 'Filtros' })
    await usuario.selectOptions(within(filtros).getByLabelText('Prioridad'), 'Crítica')
    const indicadores = screen.getByRole('region', { name: 'Indicadores' })
    await waitFor(() =>
      expect(within(indicadores).getByRole('button', { name: /Proyectos activos/ })).toHaveTextContent(
        'Proyectos activos1Con prioridad Crítica',
      ),
    )
    const ejecucion = screen.getByRole('region', { name: 'Ejecución presupuestaria por proyecto' })
    expect(within(ejecucion).getByLabelText(/^BIO-011:/)).toBeInTheDocument()
    expect(within(ejecucion).queryByLabelText(/^QUI-024:/)).not.toBeInTheDocument()
  })
})
