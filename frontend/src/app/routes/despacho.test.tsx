import { fireEvent, screen, within } from '@testing-library/react'
import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { dia } from '@/testing/mocks/datos/fechas'
import { db } from '@/testing/mocks/db'
import { server } from '@/testing/mocks/server'
import { conSesion, renderApp } from '@/testing/render'
import { idProyecto } from '@/testing/mocks/datos/proyectos'
import { idSolicitudSemilla } from '@/testing/mocks/datos/solicitudes'

describe('Despacho (vista 18, F6.2, F6.3, HU-19)', () => {
  it('si falla la carga, ofrece reintentar (REV-011)', async () => {
    conSesion('aprobador@cpq.local')
    let falla = true
    server.use(
      http.get('/api/despachos/nuevo', () =>
        falla ? HttpResponse.json({ detail: 'Falla simulada' }, { status: 500 }) : undefined,
      ),
    )
    const { usuario } = renderApp(`/almacen/despacho?solicitud=${idSolicitudSemilla('SOL-121')}`)
    expect(await screen.findByText('Falla simulada')).toBeInTheDocument()
    falla = false
    await usuario.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Despachar SOL-121' })).toBeInTheDocument()
  })

  it('sugiere el lote que vence primero y despacha en una sola operación', async () => {
    conSesion('aprobador@cpq.local')
    const gastoAntes = db.proyectos.findFirst((q) => q.where({ codigo: 'QUI-024' }))!.gastoEjecutado
    const { usuario } = renderApp(`/almacen/despacho?solicitud=${idSolicitudSemilla('SOL-121')}`)
    expect(await screen.findByRole('heading', { level: 1, name: 'Despachar SOL-121' })).toBeInTheDocument()

    const hexano = screen.getByRole('radiogroup', { name: 'Hexano grado reactivo · 2 L' })
    expect(within(hexano).getByRole('radio', { name: /L-0389/ })).toBeChecked()
    expect(within(hexano).getByText('Vence primero')).toBeInTheDocument()
    const papel = screen.getByRole('radiogroup', { name: 'Papel de filtro cualitativo · 1 caja' })
    expect(within(papel).getByText('Ingresó primero')).toBeInTheDocument()

    // Cambia al otro lote de hexano
    await usuario.click(within(hexano).getByRole('radio', { name: /L-0430/ }))
    expect(screen.getByText(/se descuentan 2 L de L-0430 y 1 caja de L-0374/)).toBeInTheDocument()
    expect(screen.getByLabelText('Quién retira')).toHaveValue('Daniela Rivas')
    await usuario.click(screen.getByRole('button', { name: 'Confirmar despacho' }))

    const exito = await screen.findByRole('status', { name: '' })
    expect(within(exito).getByRole('heading', { level: 2 })).toHaveTextContent('Despacho DES-0319 registrado')
    expect(exito).toHaveTextContent('retirados por Daniela Rivas')
    // REV-022: el subtítulo sigue después de registrar
    expect(screen.getByText(/Retiro aprobado para/)).toHaveTextContent(/QUI-024, Daniela Rivas · aprobado /)
    expect(within(exito).getByRole('link', { name: 'Ver en la bitácora' })).toHaveAttribute(
      'href',
      '/proyectos/bitacora?despacho=DES-0319',
    )
    // Se lee el número; el enlace lleva el UUID
    expect(within(exito).getByRole('link', { name: /Siguiente despacho: SOL-116/ })).toHaveAttribute(
      'href',
      `/almacen/despacho?solicitud=${idSolicitudSemilla('SOL-116')}`,
    )

    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-121' }))).toMatchObject({
      estado: 'Ejecutado',
      despacho: 'DES-0319',
    })
    expect(db.lotes.findFirst((q) => q.where({ codigo: 'L-0430' }))?.cantidad).toBe(1.5)
    expect(db.insumos.findFirst((q) => q.where({ id: 'ins-hexano' }))?.stock).toBe(7.5)
    expect(db.despachos.findMany((q) => q.where({ codigo: 'DES-0319' }))).toHaveLength(2)
    const cargo = db.cargos.findFirst((q) => q.where({ referencia: 'DES-0319' }))!
    expect(db.proyectos.findFirst((q) => q.where({ codigo: 'QUI-024' }))!.gastoEjecutado).toBeCloseTo(
      gastoAntes + cargo.monto,
    )
  })

  it('un lote vencido se ve pero no se puede elegir', async () => {
    conSesion('aprobador@cpq.local')
    // Un retiro aprobado de tripsina: L-0311 venció (mockup 09)
    await db.solicitudes.create({
      ...db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-116' }))!,
      id: idSolicitudSemilla('SOL-130'),
      numero: 'SOL-130',
      proyecto: 'BIO-011',
      items: ['Tripsina 0,25 % 0,1 L'],
      lineas: [{ insumoId: 'ins-tripsina', cantidad: 0.1 }],
    })
    renderApp(`/almacen/despacho?solicitud=${idSolicitudSemilla('SOL-130')}`)
    const grupo = await screen.findByRole('radiogroup', { name: /Tripsina/ })
    expect(within(grupo).getByRole('radio', { name: /L-0311/ })).toBeDisabled()
    expect(within(grupo).getByText(/Vencido el/)).toBeInTheDocument()
    expect(within(grupo).getByRole('radio', { name: /L-0412/ })).toBeChecked()
  })
})

describe('Bitácora y corrección (vista 19, F6.3, F6.5)', () => {
  it('el coordinador ve sus despachos y pide una corrección con motivo (RN-06)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/proyectos/bitacora?despacho=DES-0318')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bitácora de despachos' }),
    ).toBeInTheDocument()
    // RN-07: solo sus proyectos (DES-0312 es de BIO-011)
    expect(screen.queryByText('DES-0312')).not.toBeInTheDocument()
    const filas = screen.getAllByRole('row').filter((f) => within(f).queryByText('DES-0318'))
    expect(filas).toHaveLength(2)
    expect(filas[0]).toHaveClass('resaltado')

    await usuario.click(within(filas[0]).getByRole('button', { name: /Pedir corrección/ }))
    const dialogo = screen.getByRole('dialog', { name: 'Pedir corrección de DES-0318' })
    await usuario.type(within(dialogo).getByLabelText('Cantidad correcta'), '0,5')
    expect(within(dialogo).getByText(/movimiento nuevo de −0,5 L/)).toBeInTheDocument()
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar corrección' }))
    expect(
      within(dialogo).getByText('Escribe el motivo de la corrección. Sin motivo no se puede enviar.'),
    ).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Motivo')).toHaveFocus()

    await usuario.type(within(dialogo).getByLabelText('Motivo'), 'Devolví un frasco de 0,5 L sin abrir.')
    await usuario.click(within(dialogo).getByRole('button', { name: 'Enviar corrección' }))
    expect(await screen.findByText(/Enviaste la corrección/)).toHaveTextContent(
      'Enviaste la corrección COR-007 de DES-0318.',
    )
    expect(db.correcciones.findFirst((q) => q.where({ id: 'COR-007' }))).toMatchObject({
      estado: 'Pendiente',
      campo: 'cantidad',
      cantidadNueva: 0.5,
      insumoId: 'ins-acetona',
    })
    // El original no cambia
    expect(db.despachos.findFirst((q) => q.where({ id: 'des-0318-1' }))?.cantidad).toBe(1)
    expect(await screen.findByText('Corrección pendiente')).toBeInTheDocument()
  })

  it('una corrección aprobada aparece como movimiento enlazado al despacho original (F6.6)', async () => {
    conSesion('coord.biologia@cpq.local')
    // COR-006 (mockup 15) la aprueba el aprobador desde la bandeja
    await db.despachos.create({
      ...db.despachos.findFirst((q) => q.where({ codigo: 'DES-0312' }))!,
      id: 'des-0320-1',
      codigo: 'DES-0320',
      fecha: `${dia(0)}T09:00:00-04:00`,
      cantidad: -0.45,
      retiro: null,
      registradoPor: 'u-apr',
      corrige: 'DES-0312',
    })
    renderApp(`/proyectos/bitacora?proyecto=${idProyecto('BIO-011')}`)
    const movimiento = (await screen.findAllByRole('row')).find((f) => within(f).queryByText('DES-0320'))!
    expect(movimiento).toHaveClass('comp')
    expect(movimiento).toHaveTextContent('Corrige a DES-0312, aprobada por Carmen Pérez')
    expect(movimiento).toHaveTextContent('−0,45 kg')
    // REV-027: el movimiento de corrección muestra el lote del despacho corregido
    expect(movimiento).toHaveTextContent('L-0425')
    const original = screen
      .getAllByRole('row')
      .find((f) => (f as HTMLTableRowElement).cells[0]?.textContent === 'DES-0312')!
    expect(original).toHaveTextContent('Corregido por DES-0320')
  })
})

describe('Uso de materia prima (vista 20, F6.4)', () => {
  it('muestra lo despachado y lo usado, y avisa si el uso lo supera (sin bloquear)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp(
      `/proyectos/uso-materia-prima?proyecto=${idProyecto('QUI-024')}&insumo=ins-etanol`,
    )
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Registrar uso de materia prima' }),
    ).toBeInTheDocument()
    const balance = screen.getByRole('complementary', { name: 'Despachado y usado' })
    expect(within(balance).getByText('Usado hasta hoy').nextSibling).toHaveTextContent('2,2 L')
    expect(within(balance).getByText('Extracción de precursores')).toBeInTheDocument()
    const despachado = Number(
      within(balance).getByText('Despachado').nextSibling!.textContent!.replace(' L', '').replace(',', '.'),
    )

    // Más de lo que queda: avisa y deja guardar con la diferencia
    fireEvent.change(screen.getByLabelText('Cantidad usada'), { target: { value: String(despachado) } })
    expect(screen.getByText(/El uso supera lo despachado en 2,2 L/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Guardar con la diferencia' }))
    expect(await screen.findByText(/Registraste/)).toHaveTextContent('de etanol 96 % en QUI-024.')
    expect(db.usosMateria.findMany((q) => q.where({ proyecto: 'QUI-024' }))).toHaveLength(3)
    // SP-07: el stock no cambia, ya bajó con el despacho
    expect(db.insumos.findFirst((q) => q.where({ id: 'ins-etanol' }))?.stock).toBe(28)
  })
})
