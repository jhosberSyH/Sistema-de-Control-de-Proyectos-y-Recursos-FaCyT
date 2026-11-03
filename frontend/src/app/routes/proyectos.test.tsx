import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const codigos = () => filas().map((f) => within(f).getByText(/^[A-Z]{3}-\d{3}$/).textContent)

describe('Proyectos (vista 06, F2.1, F2.2, F2.6, F2.7)', () => {
  it('el administrador ve todos, ordenados por prioridad, con avance y ejecución', async () => {
    conSesion('admin@cpq.local')
    renderApp('/proyectos')
    expect(await screen.findByText('12 proyectos, ordenados por prioridad')).toBeInTheDocument()
    expect(codigos()).toEqual([
      'BIO-011',
      'BIO-015',
      'QUI-024',
      'FIS-008',
      'QUI-031',
      'FIS-012',
      'QUI-035',
      'FIS-010',
      'QUI-027',
      'BIO-017',
      'FIS-006',
      'QUI-019',
    ])
    const bio015 = filas()[1]
    expect(within(bio015).getByRole('link', { name: 'Asignar coordinador a BIO-015' })).toHaveAttribute(
      'href',
      '/proyectos/BIO-015?asignar=coordinador',
    )
    // F2.7: pasa de 100 % sin recortarse, y no depende solo del color
    expect(within(bio015).getByText(/109 %/)).toHaveTextContent('109 % (pasa del 100 %)')
    expect(within(filas()[5]).getByText('Plan de hitos confirmado')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'En ejecución 7' })).toHaveAttribute('aria-pressed', 'false')
  })

  it('filtra por estatus y búsqueda, y los conteos respetan los demás filtros', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/proyectos')
    await usuario.click(await screen.findByRole('button', { name: 'Propuesta 3' }))
    expect(await screen.findByText('3 proyectos, ordenados por prioridad')).toBeInTheDocument()
    expect(codigos()).toEqual(['FIS-012', 'QUI-035', 'BIO-017'])

    await usuario.type(screen.getByLabelText('Buscar'), 'salazar')
    expect(await screen.findByRole('button', { name: 'Todos 4' })).toBeInTheDocument()
    expect(await screen.findByText('1 proyecto, ordenados por prioridad')).toBeInTheDocument()
  })

  it('no deja registrar un código repetido y muestra ese proyecto; luego registra uno nuevo (F2.1)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/proyectos')
    await usuario.click(await screen.findByRole('button', { name: 'Registrar proyecto' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar proyecto' })

    // Vacío: los errores van junto a cada campo y el foco al primero
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar proyecto' }))
    expect(await within(dialogo).findByText(/Usa el formato del código institucional/)).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Código institucional')).toHaveFocus()

    await usuario.type(within(dialogo).getByLabelText('Código institucional'), 'qui-024')
    // El área se sugiere por el prefijo del código
    expect(within(dialogo).getByLabelText('Área')).toHaveValue('Química')
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Síntesis verde de nanopartículas de plata')
    await usuario.type(within(dialogo).getByLabelText('Presupuesto asignado'), '9500,5')
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Media' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar proyecto' }))

    const enlace = await within(dialogo).findByRole('link', {
      name: 'QUI-024, Síntesis de catalizadores de óxido de cerio',
    })
    expect(enlace).toHaveAttribute('href', '/proyectos/QUI-024')
    expect(within(dialogo).getByLabelText('Código institucional')).toHaveFocus()

    await usuario.clear(within(dialogo).getByLabelText('Código institucional'))
    await usuario.type(within(dialogo).getByLabelText('Código institucional'), 'QUI-032')
    await usuario.selectOptions(within(dialogo).getByLabelText(/Coordinador/), 'u-qui')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar proyecto' }))

    expect(await screen.findByText(/Daniela Rivas ya lo ve en sus proyectos/)).toBeInTheDocument()
    const nuevo = db.proyectos.findFirst((q) => q.where({ codigo: 'QUI-032' }))
    expect(nuevo).toMatchObject({ estatus: 'Propuesta', presupuesto: 9500.5, coordinadorId: 'u-qui' })
    // F2.2: le llega el aviso al coordinador
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-qui', enlace: '/proyectos/QUI-032' })),
    ).toBeDefined()
  })

  it('el área tiene que coincidir con el prefijo del código', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/proyectos')
    await usuario.click(await screen.findByRole('button', { name: 'Registrar proyecto' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar proyecto' })
    await usuario.selectOptions(within(dialogo).getByLabelText('Área'), 'Química')
    await usuario.type(within(dialogo).getByLabelText('Código institucional'), 'FIS-100')
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Otro proyecto de prueba')
    await usuario.type(within(dialogo).getByLabelText('Presupuesto asignado'), '100')
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Baja' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar proyecto' }))
    expect(
      await within(dialogo).findByText('El código FIS-100 es de Física. Cambia el área o el código.'),
    ).toBeInTheDocument()
  })

  it('el coordinador solo ve sus proyectos y no registra ni asigna (RN-07)', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/proyectos')
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis proyectos' })).toBeInTheDocument()
    expect(await screen.findByText('3 proyectos, ordenados por prioridad')).toBeInTheDocument()
    expect(codigos()).toEqual(['QUI-024', 'QUI-031', 'QUI-035'])
    expect(screen.queryByRole('button', { name: 'Registrar proyecto' })).not.toBeInTheDocument()
    // La columna de coordinador sobra: siempre sería quien mira
    expect(screen.queryByRole('columnheader', { name: 'Coordinador' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Exportar/ })).toBeInTheDocument()
  })
})
