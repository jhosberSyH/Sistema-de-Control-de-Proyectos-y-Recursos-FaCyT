import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'
import { idProyecto } from '@/testing/mocks/datos/proyectos'

const proyecto = (codigo: string) => db.proyectos.findFirst((q) => q.where({ codigo }))

describe('Plan de hitos y avance (vista 08, F2.4 a F2.6, HU-05)', () => {
  it('con 90 de peso no confirma y dice cuánto falta; con 100 confirma el plan', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp(`/proyectos/${idProyecto('QUI-035')}/plan`)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan de hitos de QUI-035' }),
    ).toBeInTheDocument()
    expect(screen.getByText('4 hitos')).toBeInTheDocument()
    expect(screen.getByText('Faltan 10 % para llegar a 100 %.')).toBeInTheDocument()

    const confirmar = screen.getByRole('button', { name: 'Confirmar plan' })
    expect(confirmar).toHaveAttribute('aria-disabled', 'true')
    await usuario.click(confirmar)
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Los pesos suman 90 %: faltan 10 % para llegar a 100 %.',
    )
    expect(proyecto('QUI-035')?.planConfirmado).toBe(false)

    const peso = screen.getByLabelText('Peso del hito 1')
    await usuario.clear(peso)
    await usuario.type(peso, '25')
    expect(screen.getByText('Los pesos suman 100 %. Ya puedes confirmar el plan.')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Confirmar plan' }))

    expect(await screen.findByText('Confirmaste el plan de hitos de QUI-035.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1, name: 'Hitos de QUI-035' })).toBeInTheDocument()
    expect(proyecto('QUI-035')?.planConfirmado).toBe(true)
    expect(
      db.auditoria.findFirst((q) =>
        q.where({ descripcion: 'Daniela Rivas confirmó el plan de hitos de QUI-035 (4 hitos, 100 %)' }),
      ),
    ).toBeDefined()
    // En Propuesta, el administrador ya puede pasarlo a En ejecución (F2.3)
    expect(
      db.avisos.findFirst((q) =>
        q.where({ usuarioId: 'u-adm', titulo: 'QUI-035 tiene su plan de hitos confirmado' }),
      ),
    ).toBeDefined()
  })

  it('agrega y quita hitos, valida cada fila y guarda el borrador', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp(`/proyectos/${idProyecto('QUI-035')}/plan`)
    await usuario.click(await screen.findByRole('button', { name: 'Agregar hito' }))
    expect(screen.getByText('5 hitos')).toBeInTheDocument()
    expect(screen.getByLabelText('Hito 5')).toHaveFocus()

    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(await screen.findByText('Escribe el nombre del hito.')).toBeInTheDocument()
    expect(screen.getByLabelText('Hito 5')).toHaveFocus()

    await usuario.click(screen.getByRole('button', { name: 'Quitar hito 5' }))
    expect(screen.getByText('4 hitos')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar borrador' }))
    expect(
      await screen.findByText(/Guardaste el borrador del plan\. Los pesos suman 90 %/),
    ).toBeInTheDocument()
    expect(
      db.auditoria.findFirst((q) =>
        q.where({
          descripcion: 'Daniela Rivas guardó el borrador del plan de hitos de QUI-035 (4 hitos, 90 %)',
          usuarioId: 'u-qui',
        }),
      ),
    ).toBeDefined()
  })

  it('carga el avance de un hito: rechaza 120 y recalcula el avance físico', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp(`/proyectos/${idProyecto('QUI-024')}/plan`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Hitos de QUI-024' })).toBeInTheDocument()
    expect(
      screen.getByText('Síntesis de catalizadores de óxido de cerio · avance físico 62 %.'),
    ).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Cargar avance del hito 3' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cargar avance' })
    // F2.5: las cargas anteriores siguen ahí
    expect(await within(dialogo).findByText('DRX de 4 de 6 muestras')).toBeInTheDocument()
    expect(within(dialogo).getByText('Horno calibrado')).toBeInTheDocument()

    const avance = within(dialogo).getByLabelText('Avance alcanzado')
    await usuario.type(avance, '120')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar avance' }))
    expect(
      await within(dialogo).findByText('Escribe un porcentaje entre 0 y 100. Escribiste 120.'),
    ).toBeInTheDocument()
    expect(avance).toHaveFocus()

    // REV-014: un avance menor que el actual avisa antes de guardar
    await usuario.clear(avance)
    await usuario.type(avance, '60')
    expect(await within(dialogo).findByText(/Es menos que la última carga \(70 %\)/)).toBeInTheDocument()

    await usuario.clear(avance)
    await usuario.type(avance, '85')
    expect(
      await within(dialogo).findByText(
        'Con 85 % en este hito, el avance físico del proyecto pasa de 62 % a 66,5 %.',
      ),
    ).toBeInTheDocument()
    await usuario.type(within(dialogo).getByLabelText(/Comentario/), 'DRX de las 6 muestras listo')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar avance' }))

    expect(
      await screen.findByText(
        'Guardaste 85 % en el hito 3. El avance físico de QUI-024 pasó de 62 % a 66,5 %.',
      ),
    ).toBeInTheDocument()
    expect(db.hitos.findFirst((q) => q.where({ id: 'QUI-024-h3' }))?.avance).toBe(85)
    expect(db.avances.findMany((q) => q.where({ hitoId: 'QUI-024-h3' }))).toHaveLength(4)
  })

  it('edita un plan confirmado sin quitar hitos con avance y avisa antes de salir sin guardar', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario, router } = renderApp(`/proyectos/${idProyecto('QUI-024')}/plan?modo=editar`)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Plan de hitos de QUI-024' }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: 'Quitar hito 1 (no se puede: ya tiene cargas de avance)' }),
    ).toHaveAttribute('aria-disabled', 'true')
    expect(screen.getByRole('button', { name: 'Quitar hito 5' })).not.toHaveAttribute('aria-disabled')

    const peso5 = screen.getByLabelText('Peso del hito 5')
    await usuario.clear(peso5)
    await usuario.type(peso5, '5')
    expect(screen.getByText('Faltan 5 % para llegar a 100 %.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Guardar cambios' })).toHaveAttribute('aria-disabled', 'true')
    const peso4 = screen.getByLabelText('Peso del hito 4')
    await usuario.clear(peso4)
    await usuario.type(peso4, '30')
    // 62 + 5 × 24 / 100 = 63,2
    expect(screen.getByText('Al guardar, el avance físico pasa de 62 % a 63,2 %.')).toBeInTheDocument()

    const migas = screen.getByRole('navigation', { name: 'Ruta de navegación' })
    await usuario.click(within(migas).getByRole('link', { name: 'Mis proyectos' }))
    const salir = await screen.findByRole('alertdialog', { name: '¿Salir sin guardar el plan?' })
    await usuario.click(within(salir).getByRole('button', { name: 'Seguir editando' }))
    expect(router.state.location.pathname).toBe(`/proyectos/${idProyecto('QUI-024')}/plan`)

    await usuario.click(screen.getByRole('button', { name: 'Guardar cambios' }))
    expect(
      await screen.findByText('Guardaste los cambios del plan. El avance físico de QUI-024 es 63,2 %.'),
    ).toBeInTheDocument()
    expect(router.state.location.search).toBe('')
    expect(db.hitos.findFirst((q) => q.where({ id: 'QUI-024-h4' }))?.peso).toBe(30)
  })

  it('el coordinador no abre el plan de un proyecto ajeno (RN-07)', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp(`/proyectos/${idProyecto('BIO-011')}/plan`)
    expect(await screen.findByText('Este proyecto no está asignado a ti')).toBeInTheDocument()
  })

  it('el administrador no arma planes: solo el coordinador del proyecto', async () => {
    conSesion('admin@cpq.local')
    renderApp(`/proyectos/${idProyecto('QUI-024')}/plan`)
    expect(await screen.findByText('No tienes permiso para abrir esta sección')).toBeInTheDocument()
  })
})
