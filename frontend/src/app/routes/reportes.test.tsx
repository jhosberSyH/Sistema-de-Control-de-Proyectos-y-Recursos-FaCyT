import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { guardarArchivo } from '@/lib/descargas'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'
import { idProyecto } from '@/testing/mocks/datos/proyectos'

vi.mock('@/lib/descargas', () => ({ guardarArchivo: vi.fn() }))

/** Los primeros bytes del archivo descargado: "%PDF" o "PK" (el .xlsx es un ZIP). */
async function inicioDe(archivo: Blob, n: number) {
  return String.fromCharCode(...new Uint8Array(await archivo.arrayBuffer()).slice(0, n))
}

beforeEach(() => vi.mocked(guardarArchivo).mockClear())

describe('Reportes (vista 24, F8.2 a F8.4)', () => {
  it('el coordinador exporta el análisis de gastos de sus proyectos (RN-07)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reportes')
    expect(await screen.findByRole('heading', { level: 1, name: 'Reportes' })).toBeInTheDocument()
    const form = screen.getByRole('form', { name: 'Generar reporte' })
    expect(within(form).getByRole('radio', { name: /Análisis de gastos/ })).toBeChecked()
    expect(within(form).getByLabelText('Proyectos')).toHaveDisplayValue(
      'Mis 3 proyectos (QUI-024, QUI-031, QUI-035)',
    )
    expect(within(form).getByText('Ves y exportas solo tus proyectos asignados.')).toBeInTheDocument()
    // RN-07: solo sus proyectos en la lista
    expect(within(form).queryByRole('option', { name: /BIO-011/ })).not.toBeInTheDocument()

    // Vista previa con los datos: el desglose de QUI-024 del mockup 07
    const previa = screen.getByRole('complementary', { name: 'Vista previa del PDF' })
    await waitFor(() => expect(previa).toHaveTextContent('Análisis de gastos'))
    const fila = within(previa)
      .getAllByRole('row', { hidden: true })
      .find((r) => r.textContent?.startsWith('QUI-024'))!
    expect(fila).toHaveTextContent('QUI-0243.150,001.402,00260,004.812,00')

    await usuario.click(within(form).getByRole('button', { name: 'Descargar PDF' }))
    await waitFor(() => expect(guardarArchivo).toHaveBeenCalledTimes(1))
    const [archivo, nombre] = vi.mocked(guardarArchivo).mock.calls[0]
    expect(nombre).toMatch(/^analisis-de-gastos-\d{4}-\d{2}-\d{2}\.pdf$/)
    expect(await inicioDe(archivo, 5)).toBe('%PDF-')
    expect(await screen.findByText('Descargaste el reporte en PDF.')).toBeInTheDocument()
  })

  it('sin datos en el filtro avisa y no genera un archivo vacío', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reportes')
    const form = await screen.findByRole('form', { name: 'Generar reporte' })
    await usuario.selectOptions(within(form).getByLabelText('Proyectos'), idProyecto('QUI-031'))
    fireEvent.change(within(form).getByLabelText('Desde'), { target: { value: '2026-01-01' } })
    fireEvent.change(within(form).getByLabelText('Hasta'), { target: { value: '2026-01-31' } })
    expect(
      await within(form).findByText('No hay gastos de QUI-031 entre el 01/01/2026 y el 31/01/2026.'),
    ).toBeInTheDocument()
    expect(within(form).getByText(/no generamos un archivo vacío/)).toBeInTheDocument()
    expect(within(form).getByRole('button', { name: 'Descargar PDF' })).toBeDisabled()
    expect(within(form).getByRole('button', { name: 'Descargar Excel' })).toBeDisabled()
  })

  it('la hoja de vida llega con el equipo elegido y solo cuenta los usos de sus proyectos', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reportes?tipo=hoja-de-vida&equipo=eq-mufla')
    const form = await screen.findByRole('form', { name: 'Generar reporte' })
    expect(within(form).getByRole('radio', { name: /Hoja de vida de un equipo/ })).toBeChecked()
    expect(within(form).getByLabelText('Equipo')).toHaveDisplayValue('Horno mufla 1200 °C · UC-FACYT-0275')
    const previa = screen.getByRole('complementary', { name: 'Vista previa del PDF' })
    await waitFor(() => expect(previa).toHaveTextContent('Hoja de vida: Horno mufla 1200 °C'))
    expect(previa).toHaveTextContent('QUI-031')
    expect(previa).not.toHaveTextContent('QUI-027')

    await usuario.click(within(form).getByRole('button', { name: 'Descargar Excel' }))
    await waitFor(() => expect(guardarArchivo).toHaveBeenCalledTimes(1))
    const [archivo, nombre] = vi.mocked(guardarArchivo).mock.calls[0]
    expect(nombre).toBe('hoja-de-vida-UC-FACYT-0275.xlsx')
    expect(await inicioDe(archivo, 2)).toBe('PK')
  })

  it('el aprobador exporta el resumen de un reparto con el criterio usado', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/reportes')
    const form = await screen.findByRole('form', { name: 'Generar reporte' })
    expect(within(form).getByLabelText('Proyectos')).toHaveDisplayValue('Todos los proyectos (12)')
    await usuario.click(within(form).getByRole('radio', { name: /Resumen del reparto/ }))
    expect(within(form).getByLabelText('Período repartido')).toBeInTheDocument()
    const previa = screen.getByRole('complementary', { name: 'Vista previa del PDF' })
    await waitFor(() => expect(previa).toHaveTextContent('Criterio: según el consumo de cada proyecto'))
    expect(previa).toHaveTextContent('QUI-024')
  })

  it('un período cerrado pero sin repartir sale marcado y no se puede elegir (HU-25)', async () => {
    const abierto = db.periodos.findFirst((q) => q.where({ estado: 'en_revision' }))!
    await db.periodos.update(abierto, {
      data(p) {
        p.estado = 'cerrado'
      },
    })
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/reportes')
    const form = await screen.findByRole('form', { name: 'Generar reporte' })
    await usuario.click(within(form).getByRole('radio', { name: /Resumen del reparto/ }))
    const selector = within(form).getByLabelText('Período repartido')
    const sinRepartir = within(selector).getByRole('option', { name: /\(sin repartir\)$/ })
    expect(sinRepartir).toBeDisabled()
    // El elegido por defecto es uno ya repartido
    expect(selector).not.toHaveDisplayValue(/sin repartir/)
    expect(within(form).getByText(/no tienen resumen todavía/)).toBeInTheDocument()
  })
})
