import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'
import { idSolicitudSemilla } from '@/testing/mocks/datos/solicitudes'

const cambiar = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } })

async function recepcion(ruta = '/almacen/recepcion') {
  conSesion('aprobador@cpq.local')
  const r = renderApp(ruta)
  await screen.findByRole('heading', { level: 1, name: 'Registrar recepción de lote' })
  return r
}

describe('Almacén y recepción de lote (vista 17, F6.1, HU-18)', () => {
  it('el almacén muestra las tareas del día y lleva a despachar o a recibir cada una', async () => {
    conSesion('aprobador@cpq.local')
    renderApp('/almacen')
    expect(await screen.findByRole('heading', { level: 1, name: 'Almacén' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '2 despachos por entregar' })).toHaveAttribute(
      'href',
      '/almacen/despacho',
    )
    expect(screen.getByRole('link', { name: '1 lote vencido por devolver' })).toHaveAttribute(
      'href',
      '/inventario?alerta=vencido',
    )
    const despachos = screen.getByRole('region', { name: 'Despachos por entregar' })
    expect(within(despachos).getAllByRole('link', { name: 'Despachar' })[0]).toHaveAttribute(
      'href',
      `/almacen/despacho?solicitud=${idSolicitudSemilla('SOL-116')}`,
    )
    const porRecibir = screen.getByRole('region', { name: 'Reposiciones por recibir' })
    expect(within(porRecibir).getByText(/Metanol grado HPLC/)).toHaveTextContent(
      'REP-012 · Metanol grado HPLC',
    )
    expect(within(porRecibir).getAllByRole('link', { name: 'Registrar recepción' })[0]).toHaveAttribute(
      'href',
      `/almacen/recepcion?solicitud=${idSolicitudSemilla('REP-012')}`,
    )
  })

  it('recibir una reposición completa el insumo, suma el stock y la cierra (F6.1, F3.3)', async () => {
    const { usuario } = await recepcion(`/almacen/recepcion?solicitud=${idSolicitudSemilla('REP-012')}`)
    // El selector guarda el UUID y muestra el número
    const solicitud = screen.getByLabelText(/Solicitud de gasto/)
    expect(solicitud).toHaveValue(idSolicitudSemilla('REP-012'))
    expect(within(solicitud).getByRole('option', { selected: true })).toHaveTextContent(/^REP-012 · /)
    expect(screen.getByLabelText('Insumo')).toHaveValue('ins-metanol')
    expect(screen.getByLabelText('Cantidad recibida')).toHaveValue('8')
    const efecto = screen.getByRole('complementary', { name: 'Efecto en el stock' })
    expect(efecto).toHaveTextContent('Stock hoy1 L')
    expect(efecto).toHaveTextContent('Después9 L')
    expect(within(efecto).getByText('Se retira')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Número de lote del proveedor'), 'MH-26-0412')
    await usuario.type(screen.getByLabelText('Costo unitario'), '21,90')
    await usuario.type(screen.getByLabelText('Proveedor'), 'Química Valencia, C.A.')
    cambiar(screen.getByLabelText('Fecha de vencimiento'), '2099-09-30')
    expect(within(efecto).getByText('US$ 175,20')).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Registrar lote' }))

    expect(await screen.findByText(/Registraste el lote/)).toHaveTextContent(
      'Registraste el lote L-0432 de metanol grado HPLC.',
    )
    expect(db.lotes.findFirst((q) => q.where({ codigo: 'L-0432' }))).toMatchObject({
      insumoId: 'ins-metanol',
      cantidad: 8,
      costoUnitario: 21.9,
      loteProveedor: 'MH-26-0412',
      vence: '2099-09-30',
      ubicacionId: 'ub-solv',
      solicitud: idSolicitudSemilla('REP-012'),
    })
    expect(db.insumos.findFirst((q) => q.where({ id: 'ins-metanol' }))?.stock).toBe(9)
    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'REP-012' }))?.estado).toBe('Ejecutado')
    expect(db.auditoria.findFirst((q) => q.where({ entidad: 'lote:L-0432' }))).toBeDefined()
  })

  it('un lote vencido no se registra: avisa y bloquea el botón (F6.1)', async () => {
    await recepcion('/almacen/recepcion?insumo=ins-acetona')
    cambiar(screen.getByLabelText('Fecha de vencimiento'), '2020-10-15')
    expect(screen.getByText('La fecha de vencimiento ya pasó (15/10/2020).')).toBeInTheDocument()
    expect(screen.getByLabelText('Fecha de vencimiento')).toHaveAttribute('aria-invalid', 'true')
    expect(screen.getByRole('button', { name: 'Registrar lote' })).toBeDisabled()
  })

  it('pide los datos que faltan, y la fecha de vencimiento si el insumo vence', async () => {
    const { usuario } = await recepcion('/almacen/recepcion?insumo=ins-acetona')
    expect(screen.getByLabelText('Ubicación')).toHaveValue('ub-solv')
    await usuario.click(screen.getByRole('button', { name: 'Registrar lote' }))
    expect(screen.getByText('Escribe el número de lote que trae el proveedor.')).toBeInTheDocument()
    expect(screen.getByText('Escribe la cantidad recibida, mayor que cero.')).toBeInTheDocument()
    expect(screen.getByLabelText('Número de lote del proveedor')).toHaveFocus()

    await usuario.type(screen.getByLabelText('Número de lote del proveedor'), 'AC-26-1187')
    await usuario.type(screen.getByLabelText('Cantidad recibida'), '10')
    await usuario.type(screen.getByLabelText('Costo unitario'), '13,25')
    await usuario.type(screen.getByLabelText('Proveedor'), 'Química Valencia, C.A.')
    await usuario.click(screen.getByRole('button', { name: 'Registrar lote' }))
    expect(
      await screen.findByText('Acetona grado analítico vence: escribe la fecha de vencimiento del lote.'),
    ).toBeInTheDocument()
    expect(db.lotes.findFirst((q) => q.where({ loteProveedor: 'AC-26-1187' }))).toBeUndefined()
  })
})
