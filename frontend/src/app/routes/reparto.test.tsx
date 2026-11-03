import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { periodoEnCurso } from '@/testing/mocks/consultas'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

/** Cierra el período en revisión, como en el paso 3 del cierre (vista 22). */
async function cerrarPeriodo() {
  const p = periodoEnCurso()!
  await db.periodos.update(p, {
    data(x) {
      x.estado = 'cerrado'
    },
  })
  return p
}

const montoDe = (texto: string) => Number(texto.replace(/[^\d,]/g, '').replace(',', '.'))

describe('Reparto de gastos compartidos (vista 23, F7.3, F7.4)', () => {
  it('calcula los dos criterios lado a lado y aplica el elegido en un solo paso', async () => {
    conSesion('aprobador@cpq.local')
    const p = await cerrarPeriodo()
    const gastoAntes = db.proyectos.findFirst((q) => q.where({ codigo: 'QUI-027' }))!.gastoEjecutado
    const { usuario } = renderApp('/gastos-compartidos/reparto')
    expect(
      await screen.findByRole('heading', { level: 1, name: /^Reparto de los gastos compartidos de / }),
    ).toBeInTheDocument()
    // RN-05: solo los 7 proyectos En ejecución; FIS-006 está Suspendido
    expect(screen.getByText(/estuvo Suspendido y no participa/).closest('p')).toHaveTextContent('FIS-006')
    // SP-09: los 4 lotes de uso general recibidos en el período suman US$ 1.000,00 (mockup 23)
    expect(screen.getByText('Gastos compartidos del período').nextSibling).toHaveTextContent('US$ 1.000,00')
    expect(screen.getByText(/\(4 lotes\)$/)).toBeInTheDocument()

    const tabla = screen.getByRole('table', { name: /Reparto de US\$ 1\.000,00/ })
    const filas = within(tabla).getAllByRole('row').slice(2, -1) as HTMLTableRowElement[]
    expect(filas.map((f) => f.cells[0].textContent)).toEqual([
      'BIO-011',
      'BIO-015',
      'FIS-008',
      'FIS-010',
      'QUI-024',
      'QUI-027',
      'QUI-031',
    ])
    // Cada columna de montos suma el total
    for (const columna of [3, 4]) {
      const suma = filas.reduce((t, f) => t + montoDe(f.cells[columna].textContent!), 0)
      expect(Math.round(suma * 100) / 100).toBe(1000)
    }
    // En partes iguales, el residuo del redondeo va al proyecto de código menor (F7.4)
    expect(filas[1].cells[4]).toHaveTextContent('US$ 142,85')
    expect(filas[0].cells[4]).toHaveTextContent('US$ 142,90')

    const iguales = screen.getByRole('radio', { name: 'En partes iguales' })
    await usuario.click(iguales)
    expect(iguales).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByText(/El redondeo deja US\$ 0,05 que se suman a/)).toHaveTextContent('BIO-011')
    await usuario.click(screen.getByRole('button', { name: 'Aplicar reparto en partes iguales' }))

    const hecho = await screen.findByRole('status', { name: '' })
    expect(within(hecho).getByRole('heading')).toHaveTextContent('Reparto en partes iguales aplicado')
    expect(screen.queryByRole('table')).not.toBeInTheDocument()
    expect(db.periodos.findFirst((q) => q.where({ id: p.id }))?.estado).toBe('prorrateado')
    expect(db.repartos.findFirst((q) => q.where({ periodoId: p.id }))).toMatchObject({
      criterio: 'iguales',
      total: 1000,
    })
    // F2.7: cada monto entra al gasto ejecutado de su proyecto
    expect(db.proyectos.findFirst((q) => q.where({ codigo: 'QUI-027' }))!.gastoEjecutado).toBeCloseTo(
      gastoAntes + 142.85,
    )
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-rli', titulo: (t) => t.includes('QUI-027') })),
    ).toBeDefined()
  })

  it('sin un período cerrado no hay nada que repartir', async () => {
    conSesion('aprobador@cpq.local')
    renderApp('/gastos-compartidos/reparto')
    expect(
      await screen.findByRole('heading', { name: 'No hay gastos compartidos por repartir' }),
    ).toBeInTheDocument()
    expect(screen.getByText(/El último, el de .+, se aplicó según el consumo/)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir al cierre de período' })).toHaveAttribute(
      'href',
      '/gastos-compartidos/cierre',
    )
  })
})
