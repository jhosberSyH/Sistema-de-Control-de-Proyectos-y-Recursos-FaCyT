import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

describe('Ficha de proyecto (vista 07, F2.2 a F2.7)', () => {
  it('muestra el avance calculado con los hitos, la ejecución con su desglose y el próximo hito', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/proyectos/QUI-024')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Síntesis de catalizadores de óxido de cerio' }),
    ).toBeInTheDocument()

    // F2.6: 10·100 + 25·100 + 30·70 + 25·24 + 10·0, entre 100 = 62 %
    const avance = screen.getByRole('region', { name: 'Avance físico' })
    expect(within(avance).getByText('62 %')).toBeInTheDocument()
    expect(within(avance).getByText(/2 de 5 hitos completos/)).toBeInTheDocument()

    // F2.7: gastos + despachos + gastos compartidos = gasto ejecutado
    const ejecucion = screen.getByRole('region', { name: 'Ejecución presupuestaria' })
    expect(within(ejecucion).getByText('48 %')).toBeInTheDocument()
    expect(within(ejecucion).getByText('US$ 3.150,00')).toBeInTheDocument()
    expect(within(ejecucion).getByText('US$ 1.402,00')).toBeInTheDocument()
    expect(within(ejecucion).getByText('US$ 260,00')).toBeInTheDocument()
    expect(within(ejecucion).getByText('US$ 4.812,00')).toBeInTheDocument()

    expect(
      within(screen.getByRole('region', { name: 'Próximo hito' })).getByText(
        'Calcinación y caracterización por DRX',
      ),
    ).toBeInTheDocument()

    // REV-009: la lista mezcla cargos, cargas de avance y gastos compartidos
    const movimientos = screen.getByRole('region', { name: 'Movimientos recientes' })
    expect(within(movimientos).getAllByRole('listitem')).toHaveLength(4)
    expect(within(movimientos).getByText(/^Avance del hito \d cargado: \d+ %/)).toBeInTheDocument()
    expect(within(movimientos).getByText(/^Gastos compartidos de /)).toBeInTheDocument()

    await usuario.click(screen.getByRole('tab', { name: 'Historial' }))
    expect(
      await screen.findByText('José Rodríguez registró el proyecto QUI-024 y asignó a Daniela Rivas'),
    ).toBeInTheDocument()
    await usuario.click(screen.getByRole('tab', { name: 'Gastos y despachos' }))
    expect(await screen.findByText('SOL-112')).toBeInTheDocument()
  })

  it('el administrador cambia el estatus con un comentario y queda en el historial (F2.3, HU-04)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/proyectos/QUI-024')
    await usuario.click(await screen.findByRole('button', { name: 'Cambiar estatus' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cambiar estatus de QUI-024' })
    expect(within(dialogo).getByRole('button', { name: 'Sin cambios' })).toHaveAttribute(
      'aria-disabled',
      'true',
    )

    await usuario.click(within(dialogo).getByRole('radio', { name: 'Suspendido' }))
    expect(within(dialogo).getByText('QUI-024 deja de contar como proyecto activo.')).toBeInTheDocument()
    await usuario.type(
      within(dialogo).getByLabelText(/Comentario para el historial/),
      'Mantenimiento del DRX',
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cambiar a Suspendido' }))

    expect(await screen.findByText('QUI-024 pasó a Suspendido.')).toBeInTheDocument()
    const registro = db.auditoria.findFirst((q) =>
      q.where({ entidad: 'proyecto:QUI-024', valorNuevo: 'Suspendido' }),
    )
    expect(registro).toMatchObject({ valorAnterior: 'En ejecución', justificacion: 'Mantenimiento del DRX' })
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-qui', titulo: 'QUI-024 pasó a Suspendido' })),
    ).toBeDefined()
  })

  it('un proyecto en Propuesta sin plan confirmado no puede pasar a En ejecución', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/proyectos/BIO-017')
    await usuario.click(await screen.findByRole('button', { name: 'Cambiar estatus' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cambiar estatus de BIO-017' })
    expect(within(dialogo).getByRole('radio', { name: 'En ejecución' })).toBeDisabled()
    expect(within(dialogo).getByText(/todavía no confirma el plan de hitos/)).toBeInTheDocument()
    // La ficha también lo dice: los pesos suman 70
    expect(
      screen.getByText('El plan de hitos no está confirmado: los pesos suman 70 de 100.'),
    ).toBeInTheDocument()
  })

  it('"?asignar=coordinador" abre la asignación y el proyecto pasa al nuevo coordinador (F2.2)', async () => {
    conSesion('admin@cpq.local')
    const { usuario, router } = renderApp('/proyectos/BIO-015?asignar=coordinador')
    const dialogo = await screen.findByRole('dialog', { name: 'Asignar coordinador de BIO-015' })
    // F2.7: pasa de 100 % y lo dice con el monto
    expect(screen.getByText('Supera el presupuesto en US$ 675,00.')).toBeInTheDocument()

    await within(dialogo).findByRole('option', { name: /María Fernanda Ochoa/ })
    await usuario.selectOptions(within(dialogo).getByLabelText('Coordinador'), 'u-bio')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Asignar a María Fernanda Ochoa' }))
    expect(await screen.findByText(/María Fernanda Ochoa coordina BIO-015 desde ahora/)).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
    expect(db.proyectos.findFirst((q) => q.where({ codigo: 'BIO-015' }))?.coordinadorId).toBe('u-bio')
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-bio', titulo: 'Te asignaron el proyecto BIO-015' })),
    ).toBeDefined()
  })

  it('el coordinador ve sus botones en su proyecto y no puede abrir uno ajeno (RN-07)', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/proyectos/QUI-024')
    expect(await screen.findByRole('link', { name: 'Cargar avance' })).toHaveAttribute(
      'href',
      '/proyectos/QUI-024/plan',
    )
    expect(screen.getByRole('link', { name: 'Nueva solicitud' })).toHaveAttribute(
      'href',
      '/solicitudes?nueva=gasto&proyecto=QUI-024',
    )
    expect(screen.queryByRole('button', { name: 'Cambiar estatus' })).not.toBeInTheDocument()
  })

  it('un proyecto ajeno o inexistente explica qué pasó', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/proyectos/BIO-011')
    expect(await screen.findByText('Este proyecto no está asignado a ti')).toBeInTheDocument()
  })

  it('un código que no existe', async () => {
    conSesion('admin@cpq.local')
    renderApp('/proyectos/XYZ-999')
    expect(await screen.findByText('No encontramos el proyecto XYZ-999')).toBeInTheDocument()
  })
})
