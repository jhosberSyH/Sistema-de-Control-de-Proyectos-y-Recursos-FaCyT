import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { periodoEnCurso } from '@/testing/mocks/consultas'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'
import { idProyecto } from '@/testing/mocks/datos/proyectos'

describe('Revisión de cargos (vista 21, F7.1)', () => {
  it('el coordinador revisa los cargos del período de cada proyecto y los confirma', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp(`/cierre/cargos?proyecto=${idProyecto('QUI-024')}`)
    expect(await screen.findByRole('heading', { level: 1, name: /^Cargos de / })).toBeInTheDocument()
    const proyectos = screen.getByRole('group', { name: 'Proyecto' })
    expect(within(proyectos).getByRole('button', { name: /QUI-024/ })).toHaveAttribute('aria-pressed', 'true')
    expect(within(proyectos).getByRole('button', { name: /QUI-024/ })).toHaveTextContent(
      'Por confirmar12 cargos · US$ 1.284,50',
    )
    expect(within(proyectos).getByRole('button', { name: /QUI-031/ })).toHaveTextContent(/Confirmado el/)

    const tabla = screen.getByRole('table', { name: 'Cargos de QUI-024' })
    expect(within(tabla).getAllByRole('row').slice(1)).toHaveLength(12)
    // Un despacho se corrige desde la bitácora (F6.5)
    const fila = within(tabla)
      .getAllByRole('row')
      .find((f) => within(f).queryByText('DES-0318'))!
    expect(within(fila).getByRole('link', { name: /Pedir corrección/ })).toHaveAttribute(
      'href',
      '/proyectos/bitacora?despacho=DES-0318&corregir=1',
    )

    await usuario.click(screen.getByRole('button', { name: 'Confirmar los 12 cargos de QUI-024' }))
    expect(
      await screen.findByRole('heading', { name: 'Confirmaste los cargos de QUI-024' }),
    ).toBeInTheDocument()
    expect(
      db.confirmaciones.findFirst((q) => q.where({ periodoId: periodoEnCurso()!.id, proyecto: 'QUI-024' })),
    ).toMatchObject({ confirmado: true, confirmadoPor: 'u-qui' })
    expect(screen.queryByRole('link', { name: /Pedir corrección/ })).not.toBeInTheDocument()
  })

  it('con una corrección pendiente todavía no se confirma', async () => {
    conSesion('coord.biologia@cpq.local')
    renderApp('/cierre/cargos')
    // COR-006 (de BIO-011) espera al aprobador
    expect((await screen.findByText('COR-006')).closest('p')).toHaveTextContent(
      'espera la decisión del aprobador',
    )
    expect(screen.getByRole('button', { name: /Confirmar/ })).toBeDisabled()
  })
})

describe('Cierre de período (vista 22, F7.1, F7.2)', () => {
  it('el tablero muestra quién confirmó, envía el recordatorio y cierra el período', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/gastos-compartidos/cierre')
    expect(await screen.findByRole('heading', { level: 1, name: 'Cierre de período' })).toBeInTheDocument()
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Confirmaciones')
    expect(screen.getByText('2 de 7 proyectos confirmaron')).toBeInTheDocument()
    const tabla = screen.getByRole('table', { name: 'Confirmaciones de cargos' })
    expect(within(tabla).getByText('Sin coordinador')).toBeInTheDocument()
    expect(within(tabla).getByText('Corrección pendiente')).toBeInTheDocument()

    await usuario.click(screen.getByRole('button', { name: 'Enviar recordatorio a 4 coordinadores' }))
    expect(await screen.findByText(/Enviamos el recordatorio a 4 coordinadores/)).toBeInTheDocument()
    expect(
      db.avisos.findFirst((q) =>
        q.where({ usuarioId: 'u-rli', titulo: (t) => t.startsWith('Recordatorio') }),
      ),
    ).toBeDefined()

    const nombre = screen.getByRole('button', { name: /^Cerrar / }).textContent!
    await usuario.click(screen.getByRole('button', { name: nombre }))
    const confirmar = screen.getByRole('alertdialog', { name: `¿${nombre}?` })
    expect(confirmar).toHaveTextContent('Faltan 5 proyectos por confirmar')
    await usuario.click(within(confirmar).getByRole('button', { name: nombre }))

    expect(await screen.findByText(/^Cerraste /)).toBeInTheDocument()
    expect(db.periodos.findFirst((q) => q.where({ estado: 'cerrado' }))).toBeDefined()
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Reparto de gastos')
    expect(screen.getByRole('link', { name: 'Repartir gastos compartidos' })).toHaveAttribute(
      'href',
      '/gastos-compartidos/reparto',
    )
    expect(screen.getByRole('form', { name: 'Abrir revisión' })).toBeInTheDocument()
  })

  it('al abrir la revisión, un rango que se cruza con otro período no envía nada', async () => {
    conSesion('aprobador@cpq.local')
    const p = periodoEnCurso()!
    await db.periodos.update(p, {
      data(x) {
        x.estado = 'cerrado'
      },
    })
    const { usuario } = renderApp('/gastos-compartidos/cierre')
    const form = await screen.findByRole('form', { name: 'Abrir revisión' })
    expect(within(form).getByLabelText('Desde')).not.toHaveValue('')

    fireEvent.change(within(form).getByLabelText('Desde'), {
      target: { value: p.inicio.replace(/-01$/, '-15') },
    })
    await usuario.click(within(form).getByRole('button', { name: 'Abrir revisión y enviar cargos' }))
    expect(await within(form).findByText(/Se cruza con el período cerrado/)).toBeInTheDocument()
    expect(within(form).getByText(/No se envió nada a los coordinadores/)).toBeInTheDocument()

    // Con las fechas sugeridas (el mes siguiente) se abre y cada coordinador recibe sus cargos
    const siguiente = new Date(`${p.fin}T12:00:00Z`)
    siguiente.setUTCDate(siguiente.getUTCDate() + 1)
    fireEvent.change(within(form).getByLabelText('Desde'), {
      target: { value: siguiente.toISOString().slice(0, 10) },
    })
    await usuario.click(within(form).getByRole('button', { name: 'Abrir revisión y enviar cargos' }))
    expect(await screen.findByText(/^Abriste la revisión de/)).toBeInTheDocument()
    expect(screen.getByRole('listitem', { current: 'step' })).toHaveTextContent('Confirmaciones')
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-qui', titulo: 'Revisa los cargos de QUI-024' })),
    ).toBeDefined()
  })
})
