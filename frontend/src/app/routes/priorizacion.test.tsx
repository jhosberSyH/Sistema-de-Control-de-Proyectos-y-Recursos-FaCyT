import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

async function abrir(correo: string) {
  conSesion(correo)
  const r = renderApp('/priorizacion')
  await screen.findByRole('heading', { level: 1, name: 'Priorización de proyectos' })
  return r
}

const grupo = (nivel: string) => screen.getByRole('region', { name: `Prioridad ${nivel}` })

describe('Priorización (vista 16, F5.6, F5.7)', () => {
  it('agrupa los proyectos en ejecución de Crítica a Baja, con su último cambio', async () => {
    const { usuario } = await abrir('aprobador@cpq.local')
    expect(within(grupo('Crítica')).getByText('1 proyecto')).toBeInTheDocument()
    expect(within(grupo('Crítica')).getByText(/Último cambio: Hoy 08:42, desde Alta/)).toBeInTheDocument()
    expect(within(grupo('Alta')).getByText('Sin coordinador')).toBeInTheDocument()
    expect(within(grupo('Media')).getByText(/desde Baja/)).toBeInTheDocument()
    expect(within(grupo('Baja')).getByText('2 proyectos')).toBeInTheDocument()
    expect(screen.queryByText('FIS-012')).not.toBeInTheDocument()

    // "Todos" suma las propuestas, los suspendidos y los finalizados
    await usuario.selectOptions(screen.getByLabelText('Estatus'), 'todos')
    expect(await within(grupo('Media')).findByText('FIS-012')).toBeInTheDocument()
    const finalizado = within(grupo('Baja')).getByText('QUI-019').closest('.fila-p') as HTMLElement
    expect(within(finalizado).queryByRole('button', { name: /Cambiar prioridad/ })).not.toBeInTheDocument()
  })

  it('cambiar la prioridad exige una justificación y queda en la auditoría (F5.7, RN-04)', async () => {
    const { usuario } = await abrir('aprobador@cpq.local')
    await usuario.click(screen.getByRole('button', { name: 'Cambiar prioridad de QUI-031' }))
    const dialogo = screen.getByRole('dialog', { name: 'Cambiar prioridad de QUI-031' })
    expect(within(dialogo).getByRole('radio', { name: 'Media (actual)' })).toBeDisabled()

    await usuario.click(within(dialogo).getByRole('radio', { name: 'Alta' }))
    expect(within(dialogo).getByText(/pasa delante de/)).toHaveTextContent(
      'Con Alta, QUI-031 pasa delante de FIS-008 en la bandeja de aprobación.',
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cambiar a Alta' }))
    expect(
      within(dialogo).getByText(
        'Escribe por qué cambias la prioridad. Sin justificación el cambio no se guarda.',
      ),
    ).toBeInTheDocument()
    expect(within(dialogo).getByLabelText('Justificación')).toHaveFocus()
    expect(db.proyectos.findFirst((q) => q.where({ codigo: 'QUI-031' }))?.prioridad).toBe('Media')

    await usuario.type(
      within(dialogo).getByLabelText('Justificación'),
      'La industria textil aliada adelantó la entrega de muestras al 20/11.',
    )
    await usuario.click(within(dialogo).getByRole('button', { name: 'Cambiar a Alta' }))
    expect(await screen.findByText(/Cambiaste QUI-031/)).toHaveTextContent(
      'Cambiaste QUI-031 de Media a Alta. Daniela Rivas recibe el aviso.',
    )
    expect(within(grupo('Alta')).getByText('QUI-031')).toBeInTheDocument()
    expect(within(grupo('Alta')).getByText(/desde Media/)).toBeInTheDocument()
    expect(db.proyectos.findFirst((q) => q.where({ codigo: 'QUI-031' }))?.prioridad).toBe('Alta')
    expect(
      db.auditoria.findFirst((q) =>
        q.where({ entidad: 'proyecto:QUI-031', valorAnterior: 'Media', valorNuevo: 'Alta' }),
      )?.justificacion,
    ).toBe('La industria textil aliada adelantó la entrega de muestras al 20/11.')
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-qui', enlace: '/proyectos/QUI-031' })),
    ).toBeDefined()
  })

  it('al bajar la prioridad dice qué proyectos le pasan delante', async () => {
    const { usuario } = await abrir('aprobador@cpq.local')
    await usuario.click(screen.getByRole('button', { name: 'Cambiar prioridad de QUI-024' }))
    await usuario.click(screen.getByRole('radio', { name: 'Baja' }))
    expect(screen.getByText(/pasan delante de/)).toHaveTextContent(
      'Con Baja, BIO-015, FIS-008 y QUI-031 pasan delante de QUI-024 en la bandeja de aprobación.',
    )
  })

  it('el coordinador consulta solo sus proyectos, sin cambiar nada (F5.6, RN-07)', async () => {
    await abrir('coord.quimica@cpq.local')
    expect(screen.getByText('QUI-024')).toBeInTheDocument()
    expect(screen.getByText('QUI-031')).toBeInTheDocument()
    expect(screen.queryByText('BIO-011')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Cambiar prioridad/ })).not.toBeInTheDocument()
  })
})
