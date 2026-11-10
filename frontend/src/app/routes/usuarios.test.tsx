import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

/** Fila de la tabla de una persona (por su nombre). */
async function fila(nombre: string) {
  const celda = await screen.findByText(nombre)
  return celda.closest('tr') as HTMLElement
}

describe('Usuarios (vista 04, F1.1 a F1.3)', () => {
  it('lista las cuentas activas de a 8 y solo la abre el Administrador', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/usuarios')
    expect(await screen.findByText('8 de 14 cuentas activas')).toBeInTheDocument()
    expect(within(await fila('Andrés Salazar')).getByText('FIS-008')).toBeInTheDocument()
    // REV-018: primero el administrador y el aprobador, luego los coordinadores
    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(filas[0]).toHaveTextContent('Administrador del Sistema')
    const orden = filas.map((f) => f.textContent ?? '')
    expect(orden.findIndex((t) => t.includes('Carmen Pérez'))).toBeLessThan(
      orden.findIndex((t) => t.includes('Andrés Salazar')),
    )
    // Pedro Gil está desactivado: no aparece con el filtro por defecto
    expect(screen.queryByText('Pedro Gil')).not.toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Página 2' }))
    expect(await screen.findByText('9 a 14 de 14 cuentas activas')).toBeInTheDocument()
    expect(within(await fila('Valentina Ruiz')).getByText('Con contraseña temporal')).toBeInTheDocument()
  })

  it('el coordinador no entra a Usuarios', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/usuarios')
    expect(await screen.findByText('No tienes permiso para abrir esta sección')).toBeInTheDocument()
  })

  it('cambiar el rol de una coordinadora avisa qué proyectos quedan sin coordinador (F1.2)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/usuarios?q=ochoa')
    await usuario.click(
      within(await fila('María Fernanda Ochoa')).getByRole('button', {
        name: 'Editar la cuenta de María Fernanda Ochoa',
      }),
    )
    const dialogo = await screen.findByRole('dialog', { name: 'Editar cuenta' })
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Aprobador / Gestor' }))
    expect(within(dialogo).getByText(/se quedan sin coordinador/)).toHaveTextContent(
      'Si cambias el rol, BIO-011 y BIO-017 se quedan sin coordinador.',
    )

    // "Conservar el rol actual" deshace la elección sin guardar
    await usuario.click(within(dialogo).getByRole('button', { name: 'Conservar el rol actual' }))
    expect(within(dialogo).getByRole('radio', { name: 'Coordinador' })).toBeChecked()

    await usuario.click(within(dialogo).getByRole('radio', { name: 'Aprobador / Gestor' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cambiar rol y guardar' }))
    expect(await screen.findByText(/Ahora es Aprobador \/ Gestor de Inventario/)).toBeInTheDocument()
    expect(db.proyectos.findFirst((q) => q.where({ codigo: 'BIO-011' }))?.coordinadorId).toBeNull()
    expect(db.auditoria.findFirst((q) => q.where({ entidad: 'usuario:u-bio' }))?.descripcion).toBe(
      'José Rodríguez cambió el rol de María Fernanda Ochoa de Coordinador de Proyecto a Aprobador / Gestor de Inventario',
    )
  })

  it('desactivar muestra el impacto, corta el acceso y se puede reactivar (F1.3)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/usuarios?q=salazar')
    await usuario.click(within(await fila('Andrés Salazar')).getByRole('button', { name: /Editar/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Desactivar cuenta' }))

    const alerta = await screen.findByRole('alertdialog', {
      name: '¿Desactivar la cuenta de Andrés Salazar?',
    })
    expect(await within(alerta).findByText(/Coordina 2 proyectos activos/)).toHaveTextContent(
      'Coordina 2 proyectos activos, FIS-008 y FIS-010, y también FIS-012 (en propuesta) y FIS-006 (suspendido).',
    )
    expect(within(alerta).getByText(/SOL-122/)).toBeInTheDocument()
    // El foco empieza en la opción segura
    expect(within(alerta).getByRole('button', { name: 'Conservar la cuenta activa' })).toHaveFocus()

    await usuario.click(within(alerta).getByRole('button', { name: 'Desactivar cuenta' }))
    expect(await screen.findByText(/Desactivaste la cuenta de Andrés Salazar/)).toBeInTheDocument()
    expect(db.usuarios.findFirst((q) => q.where({ id: 'u-fis' }))?.activo).toBe(false)

    await usuario.click(screen.getByRole('button', { name: 'Buscar en todas las cuentas' }))
    await usuario.click(within(await fila('Andrés Salazar')).getByRole('button', { name: /Reactivar/ }))
    await usuario.click(await screen.findByRole('button', { name: 'Reactivar cuenta' }))
    expect(await screen.findByText(/Reactivaste la cuenta de Andrés Salazar/)).toBeInTheDocument()
  })

  it('no deja crear una cuenta con un correo repetido y muestra la otra cuenta (F1.1)', async () => {
    conSesion('admin@cpq.local')
    const { usuario, router } = renderApp('/usuarios')
    await usuario.click(await screen.findByRole('button', { name: 'Crear cuenta' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Crear cuenta' })
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Daniela Rivas')
    await usuario.type(within(dialogo).getByLabelText('Correo'), 'Coord.Quimica@cpq.local')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Crear cuenta' }))
    expect(await within(dialogo).findByText('Elige el rol de la cuenta.')).toBeInTheDocument()

    await usuario.click(within(dialogo).getByRole('radio', { name: 'Coordinador' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Crear cuenta' }))
    expect(await within(dialogo).findByText(/Ya existe una cuenta con ese correo/)).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Correo')).toHaveAttribute('aria-invalid', 'true')

    await usuario.click(within(dialogo).getByRole('button', { name: 'Ver esa cuenta' }))
    expect(router.state.location.search).toBe('?q=coord.quimica%40cpq.local&estado=todas')
    expect(await fila('Daniela Rivas')).toBeInTheDocument()
  })

  it('crea la cuenta, muestra la contraseña temporal una vez y al entrar pide crear la propia', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/usuarios')
    await usuario.click(await screen.findByRole('button', { name: 'Crear cuenta' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Crear cuenta' })
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Julieta Paredes')
    await usuario.type(within(dialogo).getByLabelText('Correo'), 'j.paredes@cpq.local')
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Coordinador' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Crear cuenta' }))

    const creada = await screen.findByRole('dialog', { name: 'Cuenta creada' })
    const temporal = within(creada).getByText(/^[A-Z2-9]{4}-[A-Z2-9]{4}-[A-Z2-9]{4}$/).textContent
    const nueva = db.usuarios.findFirst((q) => q.where({ correo: 'j.paredes@cpq.local' }))
    expect(nueva?.clave).toBe(temporal)
    expect(nueva?.debeCambiarClave).toBe(true)
    await usuario.click(within(creada).getByRole('button', { name: 'Listo' }))
    expect(screen.getByText(/Creaste la cuenta de Julieta Paredes/)).toBeInTheDocument()
  })

  it('con contraseña temporal solo se puede crear la propia; después entra a su inicio', async () => {
    conSesion('v.ruiz@cpq.local')
    const { usuario } = renderApp('/inicio')
    expect(await screen.findByRole('heading', { name: 'Crea tu contraseña' })).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'corta')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }))
    expect(await screen.findByText('Usa al menos 12 caracteres.')).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Contraseña nueva'))
    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'v.ruiz y su clave larga')
    await usuario.type(screen.getByLabelText('Repite la contraseña'), 'v.ruiz y su clave larga')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }))
    // El servidor rechaza una contraseña que contiene el correo
    expect(await screen.findByText(/No uses tu correo dentro de la contraseña/)).toBeInTheDocument()

    await usuario.clear(screen.getByLabelText('Contraseña nueva'))
    await usuario.clear(screen.getByLabelText('Repite la contraseña'))
    await usuario.type(screen.getByLabelText('Contraseña nueva'), 'rio cafe montaña')
    await usuario.type(screen.getByLabelText('Repite la contraseña'), 'rio cafe montaña')
    await usuario.click(screen.getByRole('button', { name: 'Guardar y entrar' }))
    expect(await screen.findByRole('heading', { level: 1, name: /Valentina$/ })).toBeInTheDocument()
  })

  it('en su propia ficha el administrador no puede cambiarse el rol ni desactivarse', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/usuarios?q=rodriguez')
    await usuario.click(within(await fila('José Rodríguez')).getByRole('button', { name: /Editar/ }))
    const dialogo = await screen.findByRole('dialog', { name: 'Editar cuenta' })
    expect(within(dialogo).getByRole('radio', { name: 'Coordinador' })).toBeDisabled()
    expect(within(dialogo).queryByRole('button', { name: 'Desactivar cuenta' })).not.toBeInTheDocument()
    expect(within(dialogo).getByText(/no puedes cambiar tu propio rol/)).toBeInTheDocument()
  })
})
