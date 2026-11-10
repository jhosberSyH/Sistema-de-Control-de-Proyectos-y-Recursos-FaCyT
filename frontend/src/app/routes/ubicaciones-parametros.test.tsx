import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

async function fila(nombre: string) {
  return (await screen.findByText(nombre, { selector: 'td b' })).closest('tr') as HTMLElement
}

describe('Ubicaciones y parámetros (vista 05, F1.4 y F1.5)', () => {
  it('no deja dos ubicaciones activas con el mismo nombre y agrega una nueva (F1.4, HU-02)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/ubicaciones-parametros')
    expect(await screen.findByText('11 activas')).toBeInTheDocument()

    const alta = screen.getByRole('form', { name: 'Agregar ubicación' })
    // Sin tildes, en minúscula y con espacios de más: igual choca con "Depósito de reactivos B"
    await usuario.type(within(alta).getByLabelText('Nombre'), 'deposito de reactivos  b')
    await usuario.click(within(alta).getByRole('button', { name: 'Agregar' }))
    expect(await within(alta).findByText(/Ya existe una ubicación activa con ese nombre/)).toBeInTheDocument()
    expect(within(alta).getByLabelText('Nombre')).toHaveFocus()

    await usuario.clear(within(alta).getByLabelText('Nombre'))
    await usuario.type(within(alta).getByLabelText('Nombre'), 'Estante de vidriería')
    await usuario.type(within(alta).getByLabelText(/Descripción/), 'Planta baja, estante metálico')
    await usuario.click(within(alta).getByRole('button', { name: 'Agregar' }))
    expect(await screen.findByText('Agregaste la ubicación Estante de vidriería.')).toBeInTheDocument()
    expect(screen.getByText('12 activas')).toBeInTheDocument()
    expect(await fila('Estante de vidriería')).toBeInTheDocument()
  })

  it('una ubicación que tuvo lotes solo se desactiva; una que nunca tuvo se puede eliminar', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/ubicaciones-parametros')

    await usuario.click(within(await fila('Depósito de reactivos A')).getByRole('button', { name: /Editar/ }))
    let dialogo = await screen.findByRole('dialog', { name: 'Editar ubicación' })
    expect(within(dialogo).queryByRole('button', { name: 'Eliminar ubicación' })).not.toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Desactivar ubicación' }))
    const alerta = await screen.findByRole('alertdialog', { name: '¿Desactivar Depósito de reactivos A?' })
    expect(within(alerta).getByText(/Sus 6 lotes siguen guardados ahí/)).toBeInTheDocument()
    await usuario.click(within(alerta).getByRole('button', { name: 'Desactivar ubicación' }))
    expect(await screen.findByText(/Desactivaste Depósito de reactivos A/)).toBeInTheDocument()
    expect(within(await fila('Depósito de reactivos A')).getByText('Desactivada')).toBeInTheDocument()
    expect(screen.getByText('10 activas')).toBeInTheDocument()

    await db.ubicaciones.create({ id: 'ub-nueva', nombre: 'Estante vacío', descripcion: '', activa: true })
    await usuario.click(screen.getByRole('button', { name: /Reactivar Depósito de reactivos A/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Reactivar ubicación' }))
    await usuario.click(within(await fila('Estante vacío')).getByRole('button', { name: /Editar/ }))
    dialogo = await screen.findByRole('dialog', { name: 'Editar ubicación' })
    expect(within(dialogo).getByText('Nunca tuvo lotes.')).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Eliminar ubicación' }))
    await usuario.click(await screen.findByRole('button', { name: 'Eliminar ubicación' }))
    expect(await screen.findByText('Eliminaste Estante vacío del catálogo.')).toBeInTheDocument()
    expect(db.ubicaciones.findFirst((q) => q.where({ id: 'ub-nueva' }))).toBeUndefined()
  })

  it('rechaza un parámetro negativo y guarda el cambio con el valor anterior y el nuevo (F1.5, HU-02)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/ubicaciones-parametros')
    const campo = await screen.findByLabelText('Anticipación de la alerta de vencimiento')
    expect(screen.getByText(/José Rodríguez lo cambió de 45 a 30 el/)).toBeInTheDocument()

    await usuario.clear(campo)
    await usuario.type(campo, '-5')
    await usuario.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    expect(
      await screen.findByText('Escribe un número entero mayor que cero, por ejemplo 30.'),
    ).toBeInTheDocument()
    expect(campo).toHaveAttribute('aria-invalid', 'true')

    await usuario.clear(campo)
    await usuario.type(campo, '15')
    await usuario.click(screen.getByRole('button', { name: 'Guardar parámetros' }))
    expect(
      await screen.findByText('Las alertas de vencimiento ya avisan con 15 días de anticipación.'),
    ).toBeInTheDocument()
    expect(screen.getByText(/José Rodríguez lo cambió de 30 a 15 el/)).toBeInTheDocument()
    expect(db.parametros.findFirst((q) => q.where({ clave: 'anticipacion_vencimiento_dias' }))?.valor).toBe(
      15,
    )
    const registro = db.auditoria.findFirst((q) =>
      q.where({ entidad: 'parametro:anticipacion_vencimiento_dias', valorNuevo: '15' }),
    )
    expect(registro?.valorAnterior).toBe('30')
  })

  it('el coordinador no entra', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/ubicaciones-parametros')
    expect(await screen.findByText('No tienes permiso para abrir esta sección')).toBeInTheDocument()
  })
})
