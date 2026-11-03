import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

const filas = () =>
  within(screen.getByRole('table', { name: 'Equipos' }))
    .getAllByRole('row')
    .slice(1)
const fila = (nombre: string) => filas().find((f) => within(f).queryByText(nombre, { selector: 'b' }))!

describe('Catálogo de equipos (vista 11, F4.1, F4.2)', () => {
  it('muestra cada equipo con su ubicación, estado y próxima reserva', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/equipos')
    expect(await screen.findByRole('heading', { level: 1, name: 'Catálogo de equipos' })).toBeInTheDocument()
    await screen.findByRole('table', { name: 'Equipos' })
    expect(filas()).toHaveLength(7)

    const uv = fila('Espectrofotómetro UV-Vis')
    expect(within(uv).getByText('UC-FACYT-0457')).toBeInTheDocument()
    expect(within(uv).getByText('Laboratorio de Química Analítica')).toBeInTheDocument()
    expect(within(uv).getByText('Disponible')).toBeInTheDocument()
    expect(within(uv).getByText('QUI-024')).toBeInTheDocument()
    expect(within(fila('Rotavapor R-300')).getByText('por aprobar')).toBeInTheDocument()
    expect(within(fila('Potenciostato')).getByText('Sin reservas')).toBeInTheDocument()
    const cabina = fila('Cabina de flujo laminar')
    expect(within(cabina).getByText('En mantenimiento')).toBeInTheDocument()
    expect(within(cabina).getByText('No se puede reservar')).toBeInTheDocument()

    await usuario.selectOptions(screen.getByLabelText('Estado'), 'En mantenimiento')
    expect(await screen.findByRole('button', { name: /Registrar fin del mantenimiento/ })).toBeInTheDocument()
    expect(filas()).toHaveLength(1)
  })

  it('registra un equipo en una ubicación nueva del catálogo; el código repetido nombra al que ya lo tiene (HU-12)', async () => {
    // Una ubicación registrada después en el paso 5 ya se puede elegir (F1.4)
    await db.ubicaciones.create({
      id: 'ub-lab-bq',
      nombre: 'Laboratorio de Bioquímica',
      descripcion: 'Edificio de Biología',
      activa: true,
    })
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/equipos')
    await usuario.click(await screen.findByRole('button', { name: 'Registrar equipo' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar equipo' })

    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Centrífuga refrigerada de mesa')
    await usuario.type(within(dialogo).getByLabelText('Código de activo'), 'uc-facyt-0457')
    await usuario.selectOptions(within(dialogo).getByLabelText('Ubicación'), 'Laboratorio de Bioquímica')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar equipo' }))
    expect(await within(dialogo).findByRole('link', { name: 'espectrofotómetro UV-Vis' })).toHaveAttribute(
      'href',
      '/equipos?q=UC-FACYT-0457',
    )
    expect(within(dialogo).getByLabelText('Código de activo')).toHaveFocus()

    await usuario.clear(within(dialogo).getByLabelText('Código de activo'))
    await usuario.type(within(dialogo).getByLabelText('Código de activo'), 'UC-FACYT-0600')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar equipo' }))
    expect(await screen.findByText(/Registraste Centrífuga refrigerada de mesa/)).toHaveTextContent(
      'en Laboratorio de Bioquímica. Nace Disponible',
    )
    expect(db.equipos.findFirst((q) => q.where({ codigo: 'UC-FACYT-0600' }))).toMatchObject({
      estado: 'Disponible',
      ubicacionId: 'ub-lab-bq',
    })
    expect(filas()).toHaveLength(8)
  })

  it('al pasar a mantenimiento lista las reservas aprobadas y avisa a sus coordinadores (F4.2, HU-12)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/equipos')
    await usuario.click(
      within(await screen.findByRole('row', { name: /Difractómetro de rayos X/ })).getByRole('button', {
        name: 'Pasar a mantenimiento Difractómetro de rayos X',
      }),
    )
    const dialogo = await screen.findByRole('alertdialog', { name: 'Pasar a mantenimiento' })
    const lista = await within(dialogo).findByRole('list')
    expect(within(lista).getAllByRole('listitem')).toHaveLength(2)
    expect(within(lista).getByText('Daniela Rivas')).toBeInTheDocument()
    expect(within(lista).getByText('Andrés Salazar')).toBeInTheDocument()

    await usuario.click(within(dialogo).getByRole('button', { name: 'Pasar a mantenimiento y avisar' }))
    expect(await within(dialogo).findByText(/Escribe el motivo/)).toBeInTheDocument()
    await usuario.type(
      within(dialogo).getByLabelText(/Motivo/),
      'Cambio del tubo de rayos X. El técnico estima dos semanas.',
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Pasar a mantenimiento y avisar' }))

    expect(await screen.findByText(/pasó a mantenimiento/)).toHaveTextContent(
      'Avisamos a 2 coordinadores de sus 2 reservas afectadas.',
    )
    expect(db.equipos.findFirst((q) => q.where({ id: 'eq-drx' }))?.estado).toBe('En mantenimiento')
    for (const usuarioId of ['u-qui', 'u-fis']) {
      expect(
        db.avisos.findFirst((q) =>
          q.where({ usuarioId, titulo: 'Difractómetro de rayos X pasó a mantenimiento' }),
        ),
      ).toBeDefined()
    }
    expect(
      db.auditoria.findFirst((q) => q.where({ entidad: 'equipo:eq-drx', valorNuevo: 'En mantenimiento' })),
    ).toMatchObject({ justificacion: 'Cambio del tubo de rayos X. El técnico estima dos semanas.' })
  })

  it('registra el fin del mantenimiento y el equipo vuelve a Disponible', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/equipos')
    await usuario.click(
      await screen.findByRole('button', {
        name: 'Registrar fin del mantenimiento de Cabina de flujo laminar',
      }),
    )
    expect(await screen.findByText(/volvió a Disponible/)).toBeInTheDocument()
    expect(within(fila('Cabina de flujo laminar')).getByText('Disponible')).toBeInTheDocument()
    expect(db.equipos.findFirst((q) => q.where({ id: 'eq-cabina' }))?.mantenimiento).toBeNull()
  })

  it('un laboratorio con equipos no se elimina del catálogo de ubicaciones (F1.4)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/ubicaciones-parametros')
    const fila = await screen.findByRole('row', { name: /Laboratorio de Electroquímica/ })
    await usuario.click(within(fila).getByRole('button', { name: /Editar/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar ubicación' })
    expect(within(dialogo).getByText('Tiene 1 equipo.')).toBeInTheDocument()
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar ubicación' })).not.toBeInTheDocument()
  })

  it('solo el Administrador abre el catálogo', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/equipos')
    expect(await screen.findByText('No tienes permiso para abrir esta sección')).toBeInTheDocument()
  })
})
