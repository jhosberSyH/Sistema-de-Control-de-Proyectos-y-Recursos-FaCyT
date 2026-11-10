import { screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fechaIso } from '@/lib/formato'
import { periodoEnCurso } from '@/testing/mocks/consultas'
import { conSesion, renderApp } from '@/testing/render'
import { idProyecto } from '@/testing/mocks/datos/proyectos'

describe('Inicio por rol (vista 02)', () => {
  it('coordinador: pendientes, solo sus proyectos (RN-07), reservas y solicitudes', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/inicio')

    expect(await screen.findByRole('heading', { level: 1, name: /Daniela$/ })).toBeInTheDocument()
    expect(screen.getByText(/Tienes 3 pendientes\./)).toBeInTheDocument()
    // REV-006: con el mes ya terminado no se escribe una fecha de cierre pasada
    const fin = periodoEnCurso()!.fin
    if (fin < fechaIso()) {
      expect(screen.getByText(/El cierre de \p{L}+ está en revisión\./u)).toBeInTheDocument()
    } else {
      expect(screen.getAllByText(/El período de \p{L}+ cierra /u).length).toBeGreaterThan(0)
    }

    const pendientes = screen.getByRole('region', { name: 'Pendientes' })
    expect(within(pendientes).getByRole('link', { name: 'Revisar cargos' })).toHaveAttribute(
      'href',
      `/cierre/cargos?proyecto=${idProyecto('QUI-024')}`,
    )
    expect(within(pendientes).getByText(/rechazó tu solicitud/)).toBeInTheDocument()

    const proyectos = screen.getByRole('region', { name: 'Mis proyectos' })
    expect(within(proyectos).getByText('QUI-024')).toBeInTheDocument()
    expect(within(proyectos).getByText('QUI-031')).toBeInTheDocument()
    expect(within(proyectos).queryByText('BIO-011')).not.toBeInTheDocument()

    expect(screen.getByRole('link', { name: /Solicitud de retiro/ })).toHaveAttribute(
      'href',
      '/solicitudes?nueva=retiro',
    )
  })

  it('aprobador: contadores, bandeja por prioridad y recordatorio del cierre', async () => {
    conSesion('aprobador@cpq.local')
    const { usuario } = renderApp('/inicio')

    expect(
      await screen.findByText('Tienes 9 decisiones pendientes y 2 despachos por entregar.'),
    ).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /4\s*solicitudes pendientes/ })).toHaveAttribute(
      'href',
      '/bandeja?tipo=solicitud',
    )

    const filas = within(screen.getByRole('table')).getAllByRole('row').slice(1)
    expect(filas).toHaveLength(5)
    expect(within(filas[0]).getByText('Crítica')).toBeInTheDocument()
    // REV-015: la última fila es una reposición automática y un enlace lleva al resto
    expect(within(filas[4]).getByText('REP-014')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver los 9 pedidos' })).toHaveAttribute('href', '/bandeja')

    await usuario.click(screen.getByRole('button', { name: 'Enviar recordatorio' }))
    expect(await screen.findByText(/Enviamos el recordatorio a 4 coordinadores/)).toBeInTheDocument()
  })

  it('el contador de la bandeja del aprobador separa lo que hay por decidir de lo por ejecutar (REV-015)', async () => {
    conSesion('aprobador@cpq.local')
    renderApp('/inicio')
    const enlace = await screen.findByRole('link', { name: /^Bandeja/ })
    await waitFor(() => expect(enlace).toHaveTextContent('(9 por decidir y 2 por ejecutar)'))
  })

  it('administrador: proyecto sin coordinador, plan confirmado y actividad reciente', async () => {
    conSesion('admin@cpq.local')
    renderApp('/inicio')

    expect(await screen.findByText(/Hay 7 proyectos activos\./)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Asignar coordinador' })).toHaveAttribute(
      'href',
      `/proyectos/${idProyecto('BIO-015')}?asignar=coordinador`,
    )
    expect(screen.getByText(/tiene su plan de hitos confirmado/)).toBeInTheDocument()
    const actividad = screen.getByRole('region', { name: 'Actividad reciente' })
    const items = within(actividad).getAllByRole('listitem')
    expect(items).toHaveLength(3)
    // REV-001: lo más reciente primero, sin cortar antes de ordenar
    expect(items[0]).toHaveTextContent('cambió la prioridad de BIO-011')
    expect(items[1]).toHaveTextContent('envió la solicitud SOL-119')
    expect(items[2]).toHaveTextContent('registró la recepción del lote L-0431')
  })
})
