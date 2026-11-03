import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

const filas = () => within(screen.getByRole('tabpanel')).getAllByRole('row').slice(1)

describe('Mis solicitudes (vista 14, F5.1 a F5.3, HU-15)', () => {
  it('lista las solicitudes de sus proyectos por estado, con la acción de cada una (RN-07)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/solicitudes')
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis solicitudes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Todas (6)' })).toHaveAttribute('aria-selected', 'true')
    expect(filas()).toHaveLength(6)
    // De otros coordinadores no aparece nada (SOL-124 es de BIO-011)
    expect(screen.queryByText('SOL-124')).not.toBeInTheDocument()

    const rechazada = filas().find((f) => within(f).queryByText('SOL-118'))!
    expect(within(rechazada).getByText('«Falta la cotización del proveedor»')).toBeInTheDocument()
    expect(within(rechazada).getByRole('link', { name: /Crear una nueva/ })).toHaveAttribute(
      'href',
      '/solicitudes?nueva=gasto&desde=SOL-118',
    )
    const ejecutada = filas().find((f) => within(f).queryByText('SOL-120'))!
    expect(within(ejecutada).getByRole('link', { name: /Ver despacho/ })).toHaveAttribute(
      'href',
      '/proyectos/bitacora?despacho=DES-0318',
    )

    await usuario.click(screen.getByRole('tab', { name: 'Ejecutadas (2)' }))
    expect(filas()).toHaveLength(2)
  })

  it('el borrador se guarda solo mientras escribe y sigue ahí al volver (HU-15)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario, router } = renderApp('/solicitudes?nueva=gasto&proyecto=QUI-031')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nueva solicitud de gasto' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Proyecto')).toHaveValue('QUI-031')
    await usuario.type(screen.getByLabelText('Insumo o servicio'), 'Dióxido de titanio P25, 500 g')

    expect(await screen.findByText(/guardado a las/)).toHaveTextContent('Borrador SOL-126')
    await waitFor(() => expect(router.state.location.search).toBe('?id=SOL-126'))
    expect(db.solicitudes.findFirst((q) => q.where({ id: 'SOL-126' }))).toMatchObject({
      estado: 'Borrador',
      tipo: 'gasto',
      proyecto: 'QUI-031',
      insumoServicio: 'Dióxido de titanio P25, 500 g',
    })

    await usuario.click(screen.getByRole('button', { name: 'Volver a mis solicitudes' }))
    await usuario.click(await screen.findByRole('link', { name: 'Seguir editando SOL-126' }))
    expect(await screen.findByLabelText('Insumo o servicio')).toHaveValue('Dióxido de titanio P25, 500 g')
  })

  it('con datos vacíos no envía y los marca; completa y envía con confirmación (F5.3)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario, router } = renderApp('/solicitudes?nueva=gasto&proyecto=QUI-031')
    await usuario.type(await screen.findByLabelText('Insumo o servicio'), 'Dióxido de titanio P25, 500 g')
    await usuario.type(
      screen.getByLabelText('Descripción'),
      'Catalizador de referencia para comparar la degradación.',
    )
    await usuario.click(screen.getByRole('button', { name: 'Enviar a aprobación' }))

    expect(await screen.findByText('Faltan 2 datos para enviar.')).toBeInTheDocument()
    expect(screen.getByText('Escribe la cantidad, por ejemplo 1 frasco.')).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad')).toHaveFocus()
    expect(db.solicitudes.findFirst((q) => q.where({ id: 'SOL-126' }))?.estado).toBe('Borrador')

    await usuario.type(screen.getByLabelText('Cantidad'), '1 frasco')
    await usuario.type(screen.getByLabelText('Monto estimado (US$)'), '185,5')
    await usuario.click(screen.getByRole('button', { name: 'Enviar a aprobación' }))
    const confirmar = await screen.findByRole('alertdialog', { name: '¿Enviar SOL-126 a aprobación?' })
    await usuario.click(within(confirmar).getByRole('button', { name: 'Enviar a aprobación' }))

    expect(await screen.findByText(/Enviaste/)).toHaveTextContent('Enviaste SOL-126 a aprobación.')
    expect(router.state.location.pathname).toBe('/solicitudes')
    expect(db.solicitudes.findFirst((q) => q.where({ id: 'SOL-126' }))).toMatchObject({
      estado: 'Pendiente de Aprobación',
      monto: 185.5,
      cantidadGasto: '1 frasco',
    })
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-apr', titulo: 'Solicitud por aprobar: SOL-126' })),
    ).toBeDefined()
  })

  it('un retiro avisa si pide más de lo disponible, pero deja guardar (F5.2)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/solicitudes?id=SOL-125')
    expect(await screen.findByText('Pides 4 L y hay 2,5 L')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toHaveTextContent('Disponible 28 L')
    expect(screen.getByText(/Puedes enviarla así/)).toHaveTextContent(
      'el aprobador verá que acetona grado analítico no alcanza. Ya hay una reposición de acetona grado analítico en curso.',
    )

    await usuario.click(screen.getByRole('button', { name: 'Agregar insumo' }))
    const nuevo = screen.getAllByLabelText('Insumo').at(-1)!
    expect(nuevo).toHaveFocus()
    // Un insumo ya pedido no se repite
    expect(within(nuevo).getByRole('option', { name: 'Etanol 96 %' })).toBeDisabled()
  })

  it('una solicitud enviada ya no se edita; se ve su detalle (HU-15)', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/solicitudes?id=SOL-119')
    const detalle = await screen.findByRole('dialog', { name: 'SOL-119 · Gasto' })
    expect(within(detalle).getByText('cotizacion-quimica-valencia.pdf')).toBeInTheDocument()
    expect(within(detalle).getByText(/ya no se edita/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Insumo o servicio')).not.toBeInTheDocument()
  })

  it('"Crear una nueva" copia los datos de la rechazada en un borrador nuevo', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/solicitudes?nueva=gasto&desde=SOL-118')
    expect(await screen.findByLabelText('Insumo o servicio')).toHaveValue('Filtros de jeringa 0,22 µm')
    expect(screen.getByLabelText('Proyecto')).toHaveValue('QUI-031')
    expect(screen.getByText('Se guarda sola mientras escribes.')).toBeInTheDocument()
  })
})
