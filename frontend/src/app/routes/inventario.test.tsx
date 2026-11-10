import { screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { dia } from '@/testing/mocks/datos/fechas'
import { conSesion, renderApp } from '@/testing/render'

const filas = () => within(screen.getByRole('table')).getAllByRole('row').slice(1)
const nombres = () =>
  filas().map(
    (f) =>
      within(f).getByText(
        (_, el) => el?.tagName === 'B' && el.parentElement?.classList.contains('ins') === true,
      ).textContent,
  )

// Con toda la suite en paralelo, transformar la vista la primera vez puede pasar del tiempo de la prueba.
beforeAll(() => import('./inventario'), 60_000)

describe('Inventario (vista 09, F3.1, F3.4, F3.6)', () => {
  it('el aprobador ve las alertas, el stock con su mínimo y los vencimientos (HU-10)', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/inventario')
    expect(await screen.findByText('1 a 20 de 24 insumos')).toBeInTheDocument()

    const alertas = screen.getByRole('group', { name: 'Filtrar por alerta' })
    expect(within(alertas).getByRole('button', { name: /4\s*insumos bajo su mínimo/ })).toBeInTheDocument()
    expect(
      within(alertas).getByRole('button', { name: /2\s*lotes próximos a vencer \(30 días\)/ }),
    ).toBeInTheDocument()
    expect(
      within(alertas).getByRole('button', { name: /1\s*lote vencido, bloqueado para despacho/ }),
    ).toBeInTheDocument()

    // Primero lo que falta, luego lo que vence, lo vencido y lo que está al día (mockup 09)
    expect(nombres().slice(0, 7)).toEqual([
      'Acetona grado analítico',
      'Guantes de nitrilo talla M',
      'Metanol grado HPLC',
      'Puntas de micropipeta 200 µL',
      'Etanol 96 %',
      'Medio LB agar',
      'Tripsina 0,25 %',
    ])
    const acetona = filas()[0]
    expect(within(acetona).getByText('2,5 L')).toBeInTheDocument()
    expect(within(acetona).getByText('mín. 5 L')).toBeInTheDocument()
    expect(within(acetona).getByText('Bajo el mínimo')).toBeInTheDocument()
    expect(within(acetona).getByRole('link', { name: 'Acetona grado analítico' })).toHaveAttribute(
      'href',
      '/inventario/ins-acetona',
    )
    expect(within(filas()[5]).getByText('en 9 días')).toBeInTheDocument()
    expect(within(filas()[6]).getByText('1 lote vencido')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar insumo' })).not.toBeInTheDocument()

    await usuario.click(within(alertas).getByRole('button', { name: /insumos bajo su mínimo/ }))
    expect(await screen.findByText('4 insumos')).toBeInTheDocument()
    expect(within(alertas).getByRole('button', { name: /insumos bajo su mínimo/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('busca por número de lote y filtra por ubicación', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/inventario')
    await usuario.type(await screen.findByLabelText('Buscar'), 'L-0311')
    expect(await screen.findByText('1 insumo')).toBeInTheDocument()
    expect(nombres()).toEqual(['Tripsina 0,25 %'])

    await usuario.clear(screen.getByLabelText('Buscar'))
    await screen.findByText('1 a 20 de 24 insumos')
    await usuario.selectOptions(screen.getByLabelText('Ubicación'), 'Cuarto frío de Biología')
    expect(await screen.findByText('2 insumos')).toBeInTheDocument()
    expect(nombres()).toEqual(['Tripsina 0,25 %', 'Glicerol'])
  })

  it('el administrador registra un insumo; un nombre repetido enlaza al existente (F3.1, HU-07)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/inventario')
    await usuario.click(await screen.findByRole('button', { name: 'Registrar insumo' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Registrar insumo' })

    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar insumo' }))
    expect(await within(dialogo).findByText('Escribe el nombre del insumo.')).toBeInTheDocument()
    expect(within(dialogo).getByText('Elige el tipo de insumo.')).toBeInTheDocument()

    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Acetona grado analítico')
    await usuario.selectOptions(within(dialogo).getByLabelText('Unidad de medida'), 'L')
    await usuario.type(within(dialogo).getByLabelText('Stock mínimo'), '5')
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Materia prima' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar insumo' }))
    expect(
      await within(dialogo).findByRole('link', { name: 'Acetona grado analítico en litros' }),
    ).toHaveAttribute('href', '/inventario/ins-acetona')
    expect(within(dialogo).getByLabelText('Nombre')).toHaveFocus()

    await usuario.clear(within(dialogo).getByLabelText('Nombre'))
    await usuario.type(within(dialogo).getByLabelText('Nombre'), 'Toallas de laboratorio')
    await usuario.selectOptions(within(dialogo).getByLabelText('Unidad de medida'), 'rollos')
    await usuario.clear(within(dialogo).getByLabelText('Stock mínimo'))
    await usuario.type(within(dialogo).getByLabelText('Stock mínimo'), '4')
    await usuario.click(within(dialogo).getByRole('radio', { name: 'Consumible de uso general' }))
    await usuario.click(within(dialogo).getByRole('button', { name: 'Registrar insumo' }))

    expect(await screen.findByText(/su costo se reparte entre los proyectos/)).toBeInTheDocument()
    // Las nuevas se numeran por año: REP-2026-0001
    const numero = `REP-${dia(0).slice(0, 4)}-0001`
    expect(screen.getByText(/se creó la reposición/)).toHaveTextContent(numero)
    const nuevo = db.insumos.findFirst((q) => q.where({ nombre: 'Toallas de laboratorio' }))
    expect(nuevo).toMatchObject({ stock: 0, stockMinimo: 4, tipo: 'Consumible de uso general' })
    // F3.5: la reposición queda en Borrador para el aprobador
    const reposicion = db.solicitudes.findFirst((q) => q.where({ numero }))
    expect(reposicion).toMatchObject({
      tipo: 'reposicion',
      estado: 'Borrador',
      insumoId: nuevo?.id,
    })
    // El aviso enlaza con el UUID de la reposición
    expect(reposicion?.id).toMatch(/^[0-9a-f-]{36}$/)
    expect(
      db.avisos.findFirst((q) =>
        q.where({
          usuarioId: 'u-apr',
          enlace: `/bandeja?pedido=${reposicion?.id}`,
          id: (i) => i.startsWith('av-rep-'),
        }),
      ),
    ).toBeDefined()
  })

  it('el coordinador solo consulta y pide retiros desde la tabla', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/inventario')
    expect(await screen.findByText('1 a 20 de 24 insumos')).toBeInTheDocument()
    expect(screen.queryByRole('group', { name: 'Filtrar por alerta' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Registrar insumo' })).not.toBeInTheDocument()
    const acetona = filas()[0]
    expect(within(acetona).queryByRole('link', { name: 'Acetona grado analítico' })).not.toBeInTheDocument()
    expect(
      within(acetona).getByRole('link', { name: 'Pedir retiro de Acetona grado analítico' }),
    ).toHaveAttribute('href', '/solicitudes?nueva=retiro&insumo=ins-acetona')
  })
})
