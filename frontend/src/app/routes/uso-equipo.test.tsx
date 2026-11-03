import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

describe('Uso de equipo (vista 13, F4.6, HU-14)', () => {
  it('muestra el uso en curso con su reloj y cierra el registro: el equipo vuelve a Disponible', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reservas/uso')
    expect(await screen.findByRole('heading', { level: 1, name: 'Horno mufla 1200 °C' })).toBeInTheDocument()
    expect(screen.getByText('En uso por ti')).toBeInTheDocument()
    expect(screen.getByRole('timer', { name: 'Tiempo transcurrido' })).toHaveTextContent(/^02:4\d$/)

    // RN-07: solo los usos de sus proyectos (no el de QUI-027)
    const tabla = screen.getByRole('table', { name: /Usos de Horno mufla/ })
    expect(within(tabla).getAllByRole('row').slice(1)).toHaveLength(4)
    expect(within(tabla).queryByText('QUI-027')).not.toBeInTheDocument()
    expect(within(tabla).getByText('Calcinación a 450 °C, lote de prueba')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText(/Observaciones/), 'Calcinación de 6 muestras a 500 °C')
    await usuario.click(screen.getByRole('button', { name: 'Cerrar registro de uso' }))
    expect(await screen.findByText(/Cerraste el registro: 2,7 h para/)).toHaveTextContent(
      'Horno mufla 1200 °C quedó Disponible.',
    )
    expect(await screen.findByText('Disponible')).toBeInTheDocument()
    expect(db.equipos.findFirst((q) => q.where({ id: 'eq-mufla' }))?.estado).toBe('Disponible')
    expect(db.usos.findFirst((q) => q.where({ id: 'USO-120' }))).toMatchObject({
      observaciones: 'Calcinación de 6 muestras a 500 °C',
    })
    expect(
      within(screen.getByRole('table', { name: /Usos de Horno mufla/ }))
        .getAllByRole('row')
        .slice(1),
    ).toHaveLength(5)
  })

  it('inicia el uso de un equipo disponible: queda En uso para los demás (HU-14)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reservas/uso?equipo=eq-potenciostato')
    expect(await screen.findByText('No tienes una reserva hoy para este equipo')).toBeInTheDocument()
    await usuario.selectOptions(screen.getByLabelText('Proyecto'), 'QUI-031')
    await usuario.click(screen.getByRole('button', { name: 'Iniciar uso' }))

    expect(await screen.findByText('En uso por ti')).toBeInTheDocument()
    expect(screen.getByText('En uso por ti').closest('.estado-g')).toHaveFocus()
    expect(db.equipos.findFirst((q) => q.where({ id: 'eq-potenciostato' }))?.estado).toBe('En uso')
    expect(db.usos.findFirst((q) => q.where({ equipoId: 'eq-potenciostato', fin: null }))).toMatchObject({
      proyecto: 'QUI-031',
      usuarioId: 'u-qui',
    })
  })

  it('un equipo que usa otra persona o que está en mantenimiento no se puede iniciar', async () => {
    conSesion('coord.quimica@cpq.local')
    const { unmount } = renderApp('/reservas/uso?equipo=eq-rotavapor')
    expect(await screen.findByText('En uso por Rosa Linares')).toBeInTheDocument()
    expect(screen.getByText('QUI-027')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar uso' })).not.toBeInTheDocument()
    unmount()

    renderApp('/reservas/uso?equipo=eq-cabina')
    expect(await screen.findByText('En mantenimiento')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Iniciar uso' })).not.toBeInTheDocument()
  })

  it('lleva a reservar el equipo y a su hoja de vida en Reportes', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/reservas/uso?equipo=eq-mufla')
    expect(await screen.findByRole('link', { name: 'Reservar' })).toHaveAttribute(
      'href',
      '/reservas?equipo=eq-mufla',
    )
    expect(screen.getByRole('link', { name: 'Hoja de vida' })).toHaveAttribute(
      'href',
      '/reportes?tipo=hoja-de-vida&equipo=eq-mufla',
    )
  })
})
