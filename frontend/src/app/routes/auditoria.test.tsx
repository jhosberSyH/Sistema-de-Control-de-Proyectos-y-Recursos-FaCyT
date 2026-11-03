import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

describe('Auditoría (vista 25, F8.5, F8.6)', () => {
  it('muestra lo más reciente primero y el detalle con el valor anterior y el nuevo', async () => {
    conSesion('admin@cpq.local')
    const total = db.auditoria.findMany().length
    const { usuario } = renderApp('/auditoria')
    expect(await screen.findByRole('heading', { level: 1, name: 'Auditoría' })).toBeInTheDocument()
    const lista = await screen.findByRole('region', { name: 'Registros de auditoría' })
    expect(
      within(lista).getByText(
        `Mostrando los registros más recientes · ${total.toLocaleString('es-VE')} en total`,
      ),
    ).toBeInTheDocument()
    const filas = within(lista).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(10)

    // El cambio de prioridad de BIO-011 del mockup: antes, después y la justificación (RN-04)
    const prioridad = filas.find((f) => f.textContent?.includes('Proyecto BIO-011'))!
    expect(prioridad).toHaveTextContent('Cambio de prioridad')
    await usuario.click(prioridad)
    expect(prioridad).toHaveAttribute('aria-current', 'true')
    const detalle = screen.getByRole('complementary', { name: 'Cambio de prioridad de BIO-011' })
    expect(within(detalle).getByText('Antes').nextSibling).toHaveTextContent('Alta')
    expect(within(detalle).getByText('Después').nextSibling).toHaveTextContent('Crítica')
    expect(detalle).toHaveTextContent('Carmen Pérez · Aprobador / Gestor de Inventario')
    expect(detalle).toHaveTextContent('«La entrega del informe al consejo de facultad se adelantó al 15/11».')
    expect(within(detalle).getByRole('link', { name: 'Proyecto BIO-011' })).toHaveAttribute(
      'href',
      '/proyectos/BIO-011',
    )
    expect(detalle).toHaveTextContent('Nadie puede editar ni borrar este registro')
  })

  it('filtra por usuario, acción y objeto, y pagina', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/auditoria')
    const lista = await screen.findByRole('region', { name: 'Registros de auditoría' })
    const filtrar = within(lista).getByRole('button', { name: 'Filtrar' })
    expect(filtrar).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(filtrar)
    expect(filtrar).toHaveAttribute('aria-expanded', 'true')

    const filtros = within(lista).getByRole('search', { name: 'Filtros' })
    await usuario.selectOptions(within(filtros).getByLabelText('Usuario'), 'Carmen Pérez')
    await waitFor(() => expect(within(lista).getByText(/^Usuario: Carmen Pérez · /)).toBeInTheDocument())
    expect(
      within(lista)
        .getAllByRole('row')
        .slice(1)
        .every((f) => f.textContent?.includes('Carmen Pérez')),
    ).toBe(true)

    await usuario.selectOptions(within(filtros).getByLabelText('Acción'), 'Inicio y cierre de sesión')
    await waitFor(() => expect(within(lista).getAllByRole('row')[1]).toHaveTextContent('Inicio de sesión'))
    // Muchas páginas: la paginación muestra las primeras, la última y "…"
    expect(within(lista).getByRole('button', { name: 'Página 1' })).toHaveAttribute('aria-current', 'page')
    await usuario.click(within(lista).getByRole('button', { name: 'Página 2' }))
    await waitFor(() => expect(within(lista).getByText(/^11 a 20$/)).toBeInTheDocument())

    await usuario.selectOptions(within(filtros).getByLabelText('Acción'), 'Todas')
    await usuario.type(within(filtros).getByLabelText('Objeto'), 'DES-0318')
    await waitFor(() => expect(within(lista).getAllByRole('row')).toHaveLength(2))
    expect(within(lista).getAllByRole('row')[1]).toHaveTextContent('Despacho DES-0318')
  })

  it('las reposiciones automáticas se registran con el usuario Sistema y sin IP (REV-025)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/auditoria')
    const lista = await screen.findByRole('region', { name: 'Registros de auditoría' })
    await usuario.click(within(lista).getByRole('button', { name: 'Filtrar' }))
    await usuario.type(within(lista).getByLabelText('Objeto'), 'REP-014')
    await waitFor(() => expect(within(lista).getAllByRole('row')).toHaveLength(2))
    const sistema = within(lista).getAllByRole('row')[1]
    expect(sistema).toHaveTextContent('Sistema')
    expect(sistema).toHaveTextContent('Reposición REP-014 a Borrador')
    expect(sistema).toHaveTextContent('—')
  })

  it('un envío a aprobación muestra el estado al que pasó (REV-025)', async () => {
    conSesion('admin@cpq.local')
    renderApp('/auditoria')
    const lista = await screen.findByRole('region', { name: 'Registros de auditoría' })
    await waitFor(() => expect(within(lista).getAllByRole('row').length).toBeGreaterThan(1))
    const fila = within(lista)
      .getAllByRole('row')
      .find((f) => f.textContent?.includes('SOL-119'))!
    expect(fila).toHaveTextContent('Solicitud SOL-119 a Pendiente de Aprobación')
  })
})
