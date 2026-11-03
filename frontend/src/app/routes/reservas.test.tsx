import { fireEvent, screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { fechaIso } from '@/lib/formato'
import { instante, lunesDe, partesCaracas, sumarDias } from '@/lib/horarios'
import { db } from '@/testing/mocks/db'
import { conSesion, renderApp } from '@/testing/render'

/** Jueves de la semana que viene: siempre a futuro, cualquier día que se corran las pruebas. */
const jueves = () => sumarDias(lunesDe(fechaIso()), 10)

/** Otra reserva del espectrofotómetro ese jueves, de 09:00 a 11:00 (el choque del mockup 12). */
async function ocupadoPorBio011() {
  await db.reservas.create({
    id: 'RES-090',
    equipoId: 'eq-uvvis',
    proyecto: 'BIO-011',
    inicio: instante(jueves(), '09:00'),
    fin: instante(jueves(), '11:00'),
    estado: 'aprobada',
    pedidaPor: 'u-bio',
    pedidaEl: new Date().toISOString(),
    decididaEl: null,
    motivoRechazo: null,
  })
}

const cambiar = (campo: HTMLElement, valor: string) => fireEvent.change(campo, { target: { value: valor } })

describe('Reservas (vista 12, F4.3, F4.4, HU-13)', () => {
  it('el coordinador ve lo ocupado por otros proyectos y sus propias reservas', async () => {
    conSesion('coord.quimica@cpq.local')
    // La semana de las reservas de otros proyectos (RES-040): según el día, caen en la actual o en la siguiente
    const ocupada = db.reservas.findFirst((q) => q.where({ id: 'RES-040' }))!
    renderApp(`/reservas?semana=${lunesDe(partesCaracas(ocupada.inicio).fecha)}`)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reservar espectrofotómetro UV-Vis' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Equipo')).toHaveValue('eq-uvvis')
    // RN-07: lo de otros proyectos se ve como "Ocupado"; lo suyo, con su estado
    const ocupados = screen.getAllByText('Ocupado')
    expect(ocupados.length).toBeGreaterThan(0)
    expect(screen.getAllByText('Aprobada').length).toBeGreaterThan(0)
    expect(screen.getByText('Tu reserva pendiente')).toBeInTheDocument()
  })

  it('el coordinador ve sus reservas rechazadas con el motivo, y no ocupan horario (HU-13)', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp('/reservas')
    const rechazadas = await screen.findByRole('region', { name: 'Reservas rechazadas' })
    const fila = within(rechazadas).getByText(/^Potenciostato · /)
    expect(fila.closest('li')).toHaveTextContent('QUI-024')
    expect(fila.closest('li')).toHaveTextContent(/Ese día se calibra el equipo/)
    expect(within(rechazadas).getByRole('button', { name: 'Ver equipo' })).toBeInTheDocument()
    // El horario queda libre: el potenciostato no tiene bloques en su calendario
    expect(db.reservas.findFirst((q) => q.where({ id: 'RES-053' }))?.estado).toBe('rechazada')
  })

  it('muestra el choque y los horarios libres; elige uno y la reserva queda pendiente (HU-13)', async () => {
    await ocupadoPorBio011()
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reservas')
    cambiar(await screen.findByLabelText('Fecha'), jueves())
    cambiar(screen.getByLabelText('Desde'), '10:00')
    cambiar(screen.getByLabelText('Hasta'), '12:00')

    const choque = await screen.findByText(/Choca con la reserva de/)
    expect(choque).toHaveTextContent('Choca con la reserva de BIO-011')
    const aviso = choque.closest('.aviso') as HTMLElement
    expect(within(aviso).getByRole('button', { name: '07:00 a 09:00' })).toBeInTheDocument()

    // Si igual la envía, el servidor la rechaza (F4.4) y no se guarda
    const antes = db.reservas.findMany().length
    await usuario.click(screen.getByRole('button', { name: 'Solicitar reserva' }))
    expect(await screen.findByText(/Choca con la reserva de/)).toBeInTheDocument()
    expect(db.reservas.findMany()).toHaveLength(antes)

    await usuario.click(within(aviso).getByRole('button', { name: '11:00 a 18:00' }))
    expect(screen.getByLabelText('Desde')).toHaveValue('11:00')
    expect(screen.getByLabelText('Hasta')).toHaveValue('13:00')
    expect(screen.getByText(/El horario está libre/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Solicitar reserva' })).toHaveFocus()
    await usuario.click(screen.getByRole('button', { name: 'Solicitar reserva' }))

    expect(await screen.findByText(/Solicitaste/)).toHaveTextContent(
      'Queda pendiente hasta que la apruebe el aprobador',
    )
    const nueva = db.reservas.findFirst((q) => q.where({ inicio: instante(jueves(), '11:00') }))
    expect(nueva).toMatchObject({
      estado: 'pendiente',
      proyecto: 'QUI-024',
      equipoId: 'eq-uvvis',
      pedidaPor: 'u-qui',
    })
    expect(
      db.avisos.findFirst((q) =>
        q.where({ usuarioId: 'u-apr', titulo: 'Reserva por aprobar: Espectrofotómetro UV-Vis' }),
      ),
    ).toBeDefined()
  })

  it('valida el horario antes de enviar', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reservas')
    await usuario.click(await screen.findByRole('button', { name: 'Solicitar reserva' }))
    expect(await screen.findByText('Elige la hora de inicio.')).toBeInTheDocument()
    expect(screen.getByLabelText('Desde')).toHaveFocus()

    cambiar(screen.getByLabelText('Fecha'), sumarDias(jueves(), 3))
    cambiar(screen.getByLabelText('Desde'), '17:00')
    cambiar(screen.getByLabelText('Hasta'), '19:00')
    await usuario.click(screen.getByRole('button', { name: 'Solicitar reserva' }))
    expect(await screen.findByText('Los domingos los laboratorios están cerrados.')).toBeInTheDocument()
  })

  it('un equipo en mantenimiento no deja enviar (F4.4)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/reservas?equipo=eq-cabina')
    expect(await screen.findByText(/El equipo está en mantenimiento desde el/)).toBeInTheDocument()
    const boton = screen.getByRole('button', { name: 'No admite reservas' })
    expect(boton).toHaveAttribute('aria-disabled', 'true')
    cambiar(screen.getByLabelText('Fecha'), jueves())
    cambiar(screen.getByLabelText('Desde'), '10:00')
    cambiar(screen.getByLabelText('Hasta'), '12:00')
    await usuario.click(boton)
    expect(db.reservas.findFirst((q) => q.where({ equipoId: 'eq-cabina' }))).toBeUndefined()
  })

  it('el aprobador consulta el calendario y decide las pendientes en la bandeja (plan §7.1)', async () => {
    conSesion('aprobador@cpq.local')
    renderApp('/reservas?equipo=eq-rotavapor')
    expect(await screen.findByRole('heading', { level: 1, name: 'Rotavapor R-300' })).toBeInTheDocument()
    const pendientes = screen.getByRole('region', { name: 'Pendientes de aprobación' })
    expect(within(pendientes).getByText('RES-051')).toBeInTheDocument()
    expect(within(pendientes).getByRole('link', { name: 'Decidir en la bandeja' })).toHaveAttribute(
      'href',
      '/bandeja?tipo=reserva',
    )
    expect(screen.queryByRole('button', { name: 'Solicitar reserva' })).not.toBeInTheDocument()
  })

  it('"Ver en el calendario" del inicio abre el equipo y la semana de esa reserva', async () => {
    conSesion('coord.quimica@cpq.local')
    const { container } = renderApp('/reservas?reserva=RES-046')
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Reservar difractómetro de rayos X' }),
    ).toBeInTheDocument()
    expect(container.querySelector('.blq.resaltada')).toHaveTextContent('QUI-024')
  })
})
