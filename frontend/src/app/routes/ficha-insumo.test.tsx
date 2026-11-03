import { screen, within } from '@testing-library/react'
import { beforeAll, describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

// La vista trae Recharts: la primera vez que se transforma tarda más que la espera de findBy.
beforeAll(() => import('./ficha-insumo'), 60_000)

describe('Ficha de insumo (vista 10, F3.2 a F3.7)', () => {
  it('muestra stock, pronóstico, último movimiento, lotes y el gráfico como tabla', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/inventario/ins-acetona')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Acetona grado analítico' }),
    ).toBeInTheDocument()
    expect(screen.getByText('Materia prima · litros · Gabinete de solventes inflamables')).toBeInTheDocument()

    const stock = screen.getByRole('region', { name: 'Stock actual' })
    expect(within(stock).getByText('2,5 L')).toBeInTheDocument()
    expect(within(stock).getByText('Bajo el mínimo de 5 L')).toBeInTheDocument()
    // plan §7.3: el Aprobador ve el mínimo, pero lo cambia el Administrador
    expect(within(stock).getByText('El mínimo lo define el Administrador del Sistema.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Cambiar stock mínimo' })).not.toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Registrar recepción' })).toHaveAttribute(
      'href',
      '/almacen/recepcion?insumo=ins-acetona',
    )

    const pronostico = screen.getByRole('region', { name: 'Consumo pronosticado' })
    expect(within(pronostico).getByText('6,1 L')).toBeInTheDocument()
    expect(within(pronostico).getByText(/Holt-Winters con 7 meses de despachos/)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Último movimiento' })).getByText('DES-0318'),
    ).toBeInTheDocument()

    const lotes = screen.getByRole('table', { name: 'Lotes de Acetona grado analítico' })
    expect(within(lotes).getByText('L-0402')).toBeInTheDocument()
    expect(within(lotes).getByText('Química Valencia, C.A.')).toBeInTheDocument()
    expect(within(lotes).getByText('US$ 13,10')).toBeInTheDocument()

    const verTabla = screen.getByRole('button', { name: 'Ver como tabla' })
    expect(verTabla).toHaveAttribute('aria-expanded', 'false')
    await usuario.click(verTabla)
    expect(screen.getByRole('button', { name: 'Ocultar tabla' })).toHaveAttribute('aria-expanded', 'true')
    const tabla = screen.getByRole('table', {
      name: 'Consumo mensual de Acetona grado analítico y pronóstico',
    })
    expect(within(tabla).getByText(/\(pronóstico\)/)).toBeInTheDocument()
    expect(within(tabla).getByText('6,1 L (5,1 a 7,1)')).toBeInTheDocument()
  })

  it('el aprobador aprueba la reposición en un paso y el audit log guarda las dos transiciones (F3.5, HU-09)', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/inventario/ins-acetona')
    const reposicion = await screen.findByRole('region', { name: 'REP-014 en Borrador' })
    const cantidad = within(reposicion).getByLabelText('Cantidad a reponer')
    expect(cantidad).toHaveValue('10')
    await usuario.clear(cantidad)
    await usuario.type(cantidad, '8')
    expect(within(reposicion).getByText(/Con 8 L quedarías en 10,5 L\./)).toBeInTheDocument()
    await usuario.click(within(reposicion).getByRole('button', { name: 'Aprobar reposición' }))

    expect(await screen.findByText(/Aprobaste/)).toHaveTextContent('Aprobaste REP-014 por 8 L.')
    expect(await screen.findByRole('region', { name: 'REP-014 aprobada' })).toBeInTheDocument()
    expect(db.solicitudes.findFirst((q) => q.where({ id: 'REP-014' }))).toMatchObject({
      estado: 'Aprobado',
      cantidad: 8,
      decididaPor: 'u-apr',
    })
    const pasos = db.auditoria
      .findMany((q) => q.where({ entidad: 'solicitud:REP-014', usuarioId: (u) => u !== 'sistema' }))
      .map((a) => `${a.valorAnterior} → ${a.valorNuevo}`)
    expect(pasos).toEqual(['Borrador → Pendiente de Aprobación', 'Pendiente de Aprobación → Aprobado'])
    // La creación en Borrador la registra el sistema, sin usuario (REV-025)
    expect(
      db.auditoria.findMany((q) => q.where({ entidad: 'solicitud:REP-014', usuarioId: 'sistema' })),
    ).toHaveLength(1)
  })

  it('descartar no compra nada y la alerta sigue visible (HU-09)', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/inventario/ins-acetona')
    const reposicion = await screen.findByRole('region', { name: 'REP-014 en Borrador' })
    await usuario.click(within(reposicion).getByRole('button', { name: 'Descartar' }))
    const alerta = await screen.findByRole('alertdialog', { name: '¿Descartar REP-014?' })
    await usuario.click(within(alerta).getByRole('button', { name: 'Descartar reposición' }))

    expect(await screen.findByText(/Descartaste/)).toHaveTextContent('la alerta de stock bajo sigue visible')
    expect(db.solicitudes.findFirst((q) => q.where({ id: 'REP-014' }))?.estado).toBe('Rechazado')
    expect(screen.queryByRole('region', { name: /REP-014/ })).not.toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Stock actual' })).getByText('Bajo el mínimo de 5 L'),
    ).toBeInTheDocument()
  })

  it('el administrador sube el mínimo sobre el stock y la reposición se crea de inmediato (F3.2, HU-07)', async () => {
    conSesion('admin@cpq.local')
    const { usuario } = renderApp('/inventario/ins-etanol')
    await usuario.click(await screen.findByRole('button', { name: 'Cambiar stock mínimo' }))
    const dialogo = await screen.findByRole('dialog', { name: 'Cambiar stock mínimo' })
    const campo = within(dialogo).getByLabelText('Stock mínimo')
    await usuario.clear(campo)
    await usuario.type(campo, '30')
    expect(
      within(dialogo).getByText(/queda bajo este mínimo: la alerta aparece de inmediato/),
    ).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Guardar mínimo' }))

    expect(await screen.findByText(/ahora es 30 L/)).toHaveTextContent('se creó la reposición REP-016')
    expect(db.insumos.findFirst((q) => q.where({ id: 'ins-etanol' }))?.stockMinimo).toBe(30)
    expect(db.solicitudes.findFirst((q) => q.where({ id: 'REP-016' }))).toMatchObject({
      estado: 'Borrador',
      insumoId: 'ins-etanol',
    })
    // El Administrador la ve, pero la decide el Aprobador
    const reposicion = await screen.findByRole('region', { name: 'REP-016 en Borrador' })
    expect(within(reposicion).queryByRole('button', { name: 'Aprobar reposición' })).not.toBeInTheDocument()
    expect(
      within(reposicion).getByText('La decide el aprobador, desde aquí o desde su bandeja.'),
    ).toBeInTheDocument()
  })

  it('sin historial suficiente no pronostica, y una reposición aprobada se muestra hasta la recepción (F3.7)', async () => {
    conSesion('aprobador@cpq.local')
    renderApp('/inventario/ins-puntas')
    expect(await screen.findByText('Sin historial suficiente para pronosticar.')).toBeInTheDocument()
    expect(screen.getByText(/tiene 3 meses de despachos y hacen falta 6/)).toBeInTheDocument()
    expect(
      within(screen.getByRole('region', { name: 'Consumo pronosticado' })).getByText('No disponible'),
    ).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Ver como tabla' })).not.toBeInTheDocument()
    expect(screen.getByRole('region', { name: 'REP-013 aprobada' })).toHaveTextContent('por 20 bolsas')
  })

  it('un insumo que no existe, y el coordinador no abre fichas', async () => {
    conSesion('aprobador@cpq.local')
    const { unmount } = renderApp('/inventario/ins-nada')
    expect(await screen.findByText('No encontramos ese insumo')).toBeInTheDocument()
    unmount()

    conSesion('coord.quimica@cpq.local')
    renderApp('/inventario/ins-acetona')
    expect(await screen.findByText('No tienes permiso para abrir esta sección')).toBeInTheDocument()
  })
})
