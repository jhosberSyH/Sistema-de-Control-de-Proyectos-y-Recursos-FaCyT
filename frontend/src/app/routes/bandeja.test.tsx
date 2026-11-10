import { screen, within } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'
import { idSolicitudSemilla } from '@/testing/mocks/datos/solicitudes'

const lista = () => document.querySelector<HTMLElement>('.col-lista')!
const detalle = () => document.querySelector<HTMLElement>('.col-det')!

/** Monta la bandeja y espera a que cargue. */
async function abrir(ruta: string) {
  conSesion('aprobador@cpq.local')
  const r = renderApp(ruta)
  await screen.findByRole('heading', { level: 1, name: 'Bandeja de aprobación' })
  return r
}

describe('Bandeja de aprobación (vista 15; F3.5, F4.5, F5.4, F5.5, F6.6)', () => {
  it('agrupa los pedidos por prioridad, del más antiguo al más nuevo, y filtra por tipo', async () => {
    const { usuario } = await abrir('/bandeja')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Bandeja de aprobación' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/9 decisiones pendientes/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Todos 9' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: 'Por ejecutar 2' })).toBeInTheDocument()

    const grupos = within(lista())
      .getAllByRole('heading', { level: 2 })
      .map((h) => h.textContent)
    expect(grupos).toEqual([
      'Crítica · 2',
      'Alta · 1',
      'Media · 2',
      'Baja · 2',
      'Reposiciones automáticas · 2',
    ])
    // El primero queda abierto
    expect(within(detalle()).getByRole('heading', { level: 2 })).toHaveTextContent(
      'SOL-124 · Retiro de insumos',
    )
    expect(within(detalle()).getByText(/Hay stock de los tres insumos/)).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Reservas 2' }))
    const pedidos = within(lista()).getAllByRole('button')
    // Las reservas se nombran por su día (no tienen código visible)
    expect(pedidos.map((b) => b.textContent)).toEqual([
      expect.stringMatching(/^Reserva del/),
      expect.stringMatching(/^Reserva del/),
    ])
  })

  it('la cotización adjunta a un gasto se puede abrir (F5.4, REV-008)', async () => {
    const crear = vi.fn(() => 'blob:cotizacion')
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: crear, revokeObjectURL: vi.fn() }))
    const { usuario } = await abrir(`/bandeja?pedido=${idSolicitudSemilla('SOL-119')}`)
    await usuario.click(
      await within(detalle()).findByRole('button', { name: /cotizacion-quimica-valencia\.pdf/ }),
    )
    await vi.waitFor(() => expect(crear).toHaveBeenCalledTimes(1))
    const archivo = (crear.mock.calls[0] as unknown as [Blob])[0]
    expect(archivo.type).toBe('application/pdf')
    vi.unstubAllGlobals()
  })

  it('una solicitud de gasto muestra su efecto en el presupuesto; rechazarla exige el motivo (RN-03)', async () => {
    const { usuario } = await abrir(`/bandeja?pedido=${idSolicitudSemilla('SOL-119')}`)
    expect(
      await within(detalle()).findByText('Nitrato de cerio hexahidratado', { exact: false }),
    ).toBeInTheDocument()
    const efecto = detalle().querySelector('.efecto')!
    expect(efecto).toHaveTextContent(/Ejecución actual de QUI-024\s*48,1\s%/)
    expect(efecto).toHaveTextContent(/Con esta solicitud\s*54,5\s%/)
    expect(efecto).toHaveTextContent('Presupuesto restanteUS$ 4.548')

    await usuario.click(screen.getByRole('button', { name: 'Rechazar' }))
    expect(screen.getByLabelText('Motivo del rechazo')).toHaveFocus()
    await usuario.click(screen.getByRole('button', { name: 'Rechazar solicitud' }))
    expect(screen.getByText('Escribe el motivo. Sin motivo no se puede rechazar.')).toBeInTheDocument()
    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-119' }))?.estado).toBe(
      'Pendiente de Aprobación',
    )

    await usuario.type(screen.getByLabelText('Motivo del rechazo'), 'Falta la cotización firmada')
    await usuario.click(screen.getByRole('button', { name: 'Rechazar solicitud' }))
    expect((await screen.findByText(/Rechazaste SOL-119/)).closest('p')).toHaveTextContent(
      'Rechazaste SOL-119. Daniela Rivas recibe el aviso. Sigue SOL-124.',
    )
    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-119' }))).toMatchObject({
      estado: 'Rechazado',
      motivoRechazo: 'Falta la cotización firmada',
    })
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-qui', titulo: 'Solicitud rechazada: SOL-119' })),
    ).toBeDefined()
    expect(screen.getByRole('button', { name: 'Todos 8' })).toBeInTheDocument()
  })

  it('aprobar una corrección devuelve la diferencia al lote con un movimiento nuevo (F6.6, RN-06)', async () => {
    const gastoAntes = db.proyectos.findFirst((q) => q.where({ codigo: 'BIO-011' }))!.gastoEjecutado
    const { usuario } = await abrir('/bandeja?tipo=correccion')
    expect(await within(detalle()).findByText('Registrado en la bitácora')).toBeInTheDocument()
    expect(
      within(detalle()).getByText(/Si apruebas, un movimiento devuelve 450\sg al lote/),
    ).toHaveTextContent('descuenta US$ 26,10 del gasto de BIO-011')

    await usuario.click(screen.getByRole('button', { name: 'Aprobar corrección' }))
    expect(await screen.findByText(/Aprobaste COR-006/)).toHaveTextContent(
      'Aprobaste COR-006. María Fernanda Ochoa recibe el aviso.',
    )
    expect(screen.getByText('No quedan pedidos de este tipo.')).toBeInTheDocument()
    expect(db.correcciones.findFirst((q) => q.where({ id: 'COR-006' }))?.estado).toBe('Aprobado')
    expect(db.lotes.findFirst((q) => q.where({ codigo: 'L-0425' }))?.cantidad).toBe(0.95)
    // El despacho original no cambia: la corrección es otra línea
    expect(db.despachos.findFirst((q) => q.where({ codigo: 'DES-0312' }))?.cantidad).toBe(0.5)
    expect(db.despachos.findFirst((q) => q.where({ corrige: 'DES-0312' }))?.cantidad).toBe(-0.45)
    const gastoDespues = db.proyectos.findFirst((q) => q.where({ codigo: 'BIO-011' }))!.gastoEjecutado
    expect(Math.round((gastoAntes - gastoDespues) * 100) / 100).toBe(26.1)
  })

  it('una reserva que choca con otra aprobada no se puede aprobar; una libre sí (F4.4, F4.5)', async () => {
    const r = db.reservas.findFirst((q) => q.where({ id: 'RES-052' }))!
    await db.reservas.create({ ...r, id: 'RES-090', proyecto: 'BIO-011', estado: 'aprobada' })
    const { usuario } = await abrir('/bandeja?pedido=RES-052')
    expect(await within(detalle()).findByText(/Choca con/)).toHaveTextContent(
      'Choca con la reserva de BIO-011',
    )
    expect(screen.queryByRole('button', { name: 'Aprobar reserva' })).not.toBeInTheDocument()

    await usuario.click(within(lista()).getAllByRole('button', { name: /^Reserva del/ })[1])
    expect(
      await within(detalle()).findByText('No choca con otras reservas. El horario sigue libre.'),
    ).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Aprobar reserva' }))
    expect(await screen.findByText(/Aprobaste la reserva del/)).toBeInTheDocument()
    expect(db.reservas.findFirst((q) => q.where({ id: 'RES-051' }))?.estado).toBe('aprobada')
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-qui', enlace: '/reservas?reserva=RES-051' })),
    ).toBeDefined()
  })

  it('una reposición se aprueba con la cantidad ajustada (F3.5)', async () => {
    const { usuario } = await abrir(`/bandeja?tipo=reposicion&pedido=${idSolicitudSemilla('REP-014')}`)
    const cantidad = await screen.findByLabelText('Cantidad a pedir (L)')
    expect(cantidad).toHaveValue('10')
    expect(screen.getByText('Sugerida: 10 L')).toBeInTheDocument()
    await usuario.clear(cantidad)
    await usuario.type(cantidad, '12,5')
    await usuario.click(screen.getByRole('button', { name: 'Aprobar reposición' }))
    expect(await screen.findByText(/Aprobaste REP-014 por 12,5 L/)).toBeInTheDocument()
    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'REP-014' }))).toMatchObject({
      estado: 'Aprobado',
      cantidad: 12.5,
    })
  })

  it('un gasto aprobado se marca como ejecutado con el monto real y se carga al proyecto (F5.5)', async () => {
    const gastoAntes = db.proyectos.findFirst((q) => q.where({ codigo: 'FIS-008' }))!.gastoEjecutado
    // El aviso lleva solo el código: se abre el segmento "Por ejecutar"
    const { usuario } = await abrir(`/bandeja?pedido=${idSolicitudSemilla('SOL-113')}`)
    expect(await screen.findByRole('button', { name: 'Por ejecutar 2' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    await usuario.click(screen.getByRole('button', { name: 'Marcar como ejecutada' }))
    expect(screen.getByText('Escribe el monto real pagado.')).toBeInTheDocument()

    await usuario.type(screen.getByLabelText('Monto real pagado (US$)'), '200')
    expect(screen.getByText(/El monto real es 33\s% mayor que el estimado/)).toBeInTheDocument()
    await usuario.click(screen.getByRole('button', { name: 'Marcar como ejecutada' }))
    const confirmar = await screen.findByRole('alertdialog', { name: '¿Marcar SOL-113 como ejecutada?' })
    expect(confirmar).toHaveTextContent('Se cargan US$ 200,00 al gasto de FIS-008')
    await usuario.click(within(confirmar).getByRole('button', { name: 'Marcar como ejecutada' }))

    expect(await screen.findByText(/Marcaste SOL-113 como ejecutada/)).toHaveTextContent(
      'se cargaron US$ 200,00 a FIS-008',
    )
    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-113' }))).toMatchObject({
      estado: 'Ejecutado',
      montoReal: 200,
    })
    expect(db.cargos.findFirst((q) => q.where({ referencia: 'SOL-113' }))?.monto).toBe(200)
    expect(db.proyectos.findFirst((q) => q.where({ codigo: 'FIS-008' }))!.gastoEjecutado).toBe(
      gastoAntes + 200,
    )
    expect(screen.getByRole('button', { name: 'Por ejecutar 1' })).toBeInTheDocument()
  })
})
