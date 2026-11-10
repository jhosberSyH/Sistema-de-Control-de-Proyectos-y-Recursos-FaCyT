import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { esApiError, establecerTokenCsrf } from '@/lib/api-client'
import { subirCotizacion } from '@/modulos/solicitudes/api/solicitudes'
import { idProyecto } from '@/testing/mocks/datos/proyectos'
import { db } from '@/testing/mocks/db'
import { leerSesion } from '@/testing/mocks/utils'
import { conSesion, renderApp } from '@/testing/render'
import { dia } from '@/testing/mocks/datos/fechas'
import { idSolicitudSemilla } from '@/testing/mocks/datos/solicitudes'

/** Número de la primera solicitud nueva del año (SOL-2026-0001): la semilla usa la numeración vieja. */
const NUEVA = `SOL-${dia(0).slice(0, 4)}-0001`
/** UUID de la solicitud nueva: va en la URL y en la API, nunca en pantalla. */
const idNueva = () => db.solicitudes.findFirst((q) => q.where({ numero: NUEVA }))?.id

const filas = () => within(screen.getByRole('tabpanel')).getAllByRole('row').slice(1)

/** Un PDF mínimo (empieza con "%PDF-", como exige el servidor). */
const pdf = (nombre = 'cotizacion-titanio.pdf', relleno = 0) =>
  new File(['%PDF-1.4\n', new Uint8Array(relleno), '\n%%EOF'], nombre, { type: 'application/pdf' })

/** El error de la API al subir directo, con la sesión de la prueba. */
async function errorAlSubir(id: string, archivo: File) {
  establecerTokenCsrf(leerSesion()!.csrf)
  try {
    await subirCotizacion(id, archivo)
  } catch (e) {
    if (esApiError(e)) return e
    throw e
  }
  throw new Error('La subida debía fallar')
}

describe('Mis solicitudes (vista 14, F5.1 a F5.3, HU-15)', () => {
  it('lista las solicitudes de sus proyectos por estado, con la acción de cada una (RN-07)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp('/solicitudes')
    expect(await screen.findByRole('heading', { level: 1, name: 'Mis solicitudes' })).toBeInTheDocument()
    expect(screen.getByRole('tab', { name: 'Todas (6)' })).toHaveAttribute('aria-selected', 'true')
    expect(filas()).toHaveLength(6)
    // De otros coordinadores no aparece nada (SOL-124 es de BIO-011)
    expect(screen.queryByText('SOL-124')).not.toBeInTheDocument()

    const rechazada = filas().find((f) => within(f).queryByText('SOL-118'))!
    expect(within(rechazada).getByText('«Falta la cotización del proveedor»')).toBeInTheDocument()
    expect(within(rechazada).getByRole('link', { name: /Crear una nueva/ })).toHaveAttribute(
      'href',
      `/solicitudes?nueva=gasto&desde=${idSolicitudSemilla('SOL-118')}`,
    )
    const ejecutada = filas().find((f) => within(f).queryByText('SOL-120'))!
    expect(within(ejecutada).getByRole('link', { name: /Ver despacho/ })).toHaveAttribute(
      'href',
      '/proyectos/bitacora?despacho=DES-0318',
    )

    await usuario.click(screen.getByRole('tab', { name: 'Ejecutadas (2)' }))
    expect(filas()).toHaveLength(2)
  })

  it('el borrador se guarda solo mientras escribe y sigue ahí al volver (HU-15)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario, router } = renderApp(`/solicitudes?nueva=gasto&proyecto=${idProyecto('QUI-031')}`)
    expect(
      await screen.findByRole('heading', { level: 1, name: 'Nueva solicitud de gasto' }),
    ).toBeInTheDocument()
    expect(screen.getByLabelText('Proyecto')).toHaveValue(idProyecto('QUI-031'))
    await usuario.type(screen.getByLabelText('Insumo o servicio'), 'Dióxido de titanio P25, 500 g')

    expect(await screen.findByText(/guardado a las/)).toHaveTextContent(`Borrador ${NUEVA}`)
    await waitFor(() => expect(router.state.location.search).toBe(`?id=${idNueva()}`))
    expect(idNueva()).toMatch(/^[0-9a-f-]{36}$/)
    expect(db.solicitudes.findFirst((q) => q.where({ numero: NUEVA }))).toMatchObject({
      estado: 'Borrador',
      tipo: 'gasto',
      proyecto: 'QUI-031',
      insumoServicio: 'Dióxido de titanio P25, 500 g',
    })

    await usuario.click(screen.getByRole('button', { name: 'Volver a mis solicitudes' }))
    await usuario.click(await screen.findByRole('link', { name: `Seguir editando ${NUEVA}` }))
    expect(await screen.findByLabelText('Insumo o servicio')).toHaveValue('Dióxido de titanio P25, 500 g')
  })

  it('con datos vacíos no envía y los marca; completa y envía con confirmación (F5.3)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario, router } = renderApp(`/solicitudes?nueva=gasto&proyecto=${idProyecto('QUI-031')}`)
    await usuario.type(await screen.findByLabelText('Insumo o servicio'), 'Dióxido de titanio P25, 500 g')
    await usuario.type(
      screen.getByLabelText('Descripción'),
      'Catalizador de referencia para comparar la degradación.',
    )
    await usuario.click(screen.getByRole('button', { name: 'Enviar a aprobación' }))

    expect(await screen.findByText('Faltan 2 datos para enviar.')).toBeInTheDocument()
    expect(screen.getByText('Escribe la cantidad, por ejemplo 1 frasco.')).toBeInTheDocument()
    expect(screen.getByLabelText('Cantidad')).toHaveFocus()
    expect(db.solicitudes.findFirst((q) => q.where({ numero: NUEVA }))?.estado).toBe('Borrador')

    await usuario.type(screen.getByLabelText('Cantidad'), '1 frasco')
    await usuario.type(screen.getByLabelText('Monto estimado (US$)'), '185,5')
    await usuario.click(screen.getByRole('button', { name: 'Enviar a aprobación' }))
    const confirmar = await screen.findByRole('alertdialog', { name: `¿Enviar ${NUEVA} a aprobación?` })
    await usuario.click(within(confirmar).getByRole('button', { name: 'Enviar a aprobación' }))

    expect(await screen.findByText(/Enviaste/)).toHaveTextContent(`Enviaste ${NUEVA} a aprobación.`)
    expect(router.state.location.pathname).toBe('/solicitudes')
    expect(db.solicitudes.findFirst((q) => q.where({ numero: NUEVA }))).toMatchObject({
      estado: 'Pendiente de Aprobación',
      monto: 185.5,
      cantidadGasto: '1 frasco',
    })
    expect(
      db.avisos.findFirst((q) => q.where({ usuarioId: 'u-apr', titulo: `Solicitud por aprobar: ${NUEVA}` })),
    ).toBeDefined()
  })

  it('un retiro avisa si pide más de lo disponible, pero deja guardar (F5.2)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp(`/solicitudes?id=${idSolicitudSemilla('SOL-125')}`)
    expect(await screen.findByText('Pides 4 L y hay 2,5 L')).toBeInTheDocument()
    expect(screen.getByText('Disponible')).toHaveTextContent('Disponible 28 L')
    expect(screen.getByText(/Puedes enviarla así/)).toHaveTextContent(
      'el aprobador verá que acetona grado analítico no alcanza. Ya hay una reposición de acetona grado analítico en curso.',
    )

    await usuario.click(screen.getByRole('button', { name: 'Agregar insumo' }))
    const nuevo = screen.getAllByLabelText('Insumo').at(-1)!
    expect(nuevo).toHaveFocus()
    // Un insumo ya pedido no se repite
    expect(within(nuevo).getByRole('option', { name: 'Etanol 96 %' })).toBeDisabled()
  })

  it('una solicitud enviada ya no se edita; se ve su detalle (HU-15)', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp(`/solicitudes?id=${idSolicitudSemilla('SOL-119')}`)
    const detalle = await screen.findByRole('dialog', { name: 'SOL-119 · Gasto' })
    expect(within(detalle).getByText('cotizacion-quimica-valencia.pdf')).toBeInTheDocument()
    expect(within(detalle).getByText(/ya no se edita/)).toBeInTheDocument()
    expect(screen.queryByLabelText('Insumo o servicio')).not.toBeInTheDocument()
  })

  it('"Crear una nueva" copia los datos de la rechazada en un borrador nuevo', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp(`/solicitudes?nueva=gasto&desde=${idSolicitudSemilla('SOL-118')}`)
    expect(await screen.findByLabelText('Insumo o servicio')).toHaveValue('Filtros de jeringa 0,22 µm')
    expect(screen.getByLabelText('Proyecto')).toHaveValue(idProyecto('QUI-031'))
    expect(screen.getByText('Se guarda sola mientras escribes.')).toBeInTheDocument()
  })

  it('adjunta la cotización en PDF: guarda el borrador primero y sube el archivo (F5.1)', async () => {
    conSesion('coord.quimica@cpq.local')
    const { usuario } = renderApp(`/solicitudes?nueva=gasto&proyecto=${idProyecto('QUI-031')}`)
    const campo = await screen.findByLabelText(/^Cotización/)
    expect(screen.getByText('PDF de hasta 10 MB.')).toBeInTheDocument()

    await usuario.upload(campo, pdf())
    expect(await screen.findByText('cotizacion-titanio.pdf')).toBeInTheDocument()
    expect(screen.getByText(/Adjuntaste/)).toHaveTextContent('Adjuntaste cotizacion-titanio.pdf')
    // El borrador no existía: se creó para tener dónde adjuntar el archivo
    const s = db.solicitudes.findFirst((q) => q.where({ numero: NUEVA }))
    expect(s).toMatchObject({ estado: 'Borrador', proyecto: 'QUI-031', cotizacion: 'cotizacion-titanio.pdf' })
    expect(atob(s!.cotizacionContenido!).startsWith('%PDF-')).toBe(true)
    expect(screen.getByText(/guardado a las/)).toHaveTextContent(`Borrador ${NUEVA}`)

    // Se puede cambiar por otro PDF; el último reemplaza al anterior
    await usuario.click(screen.getByRole('button', { name: 'Cambiar la cotización' }))
    await usuario.upload(screen.getByLabelText(/^Cotización/), pdf('cotizacion-nueva.pdf'))
    expect(await screen.findByText('cotizacion-nueva.pdf')).toBeInTheDocument()
    expect(db.solicitudes.findFirst((q) => q.where({ numero: NUEVA }))?.cotizacion).toBe(
      'cotizacion-nueva.pdf',
    )
  })

  it('no adjunta lo que no es un PDF ni un archivo de más de 10 MB', async () => {
    conSesion('coord.quimica@cpq.local')
    renderApp(`/solicitudes?nueva=gasto&proyecto=${idProyecto('QUI-031')}`)
    const campo = await screen.findByLabelText(/^Cotización/)

    fireEvent.change(campo, {
      target: { files: [new File(['foto'], 'cotizacion.png', { type: 'image/png' })] },
    })
    expect(await screen.findByText('La cotización tiene que ser un PDF.')).toBeInTheDocument()

    const grande = pdf('grande.pdf')
    Object.defineProperty(grande, 'size', { value: 10 * 1024 * 1024 + 1 })
    fireEvent.change(campo, { target: { files: [grande] } })
    expect(
      await screen.findByText('El archivo pesa más de 10 MB. Prueba con uno más liviano.'),
    ).toBeInTheDocument()
    // No se subió nada (y sin otros cambios, ni siquiera se creó el borrador)
    expect(db.solicitudes.findFirst((q) => q.where({ numero: NUEVA }))).toBeUndefined()
  })

  it('el servidor valida la cotización: PDF, 10 MB, borrador y solicitud propia', async () => {
    conSesion('coord.quimica@cpq.local')
    // SOL-125 es un retiro en borrador; SOL-119, un gasto ya enviado; se crea un gasto en borrador
    const borrador = await db.solicitudes.create({
      ...db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-119' }))!,
      id: idSolicitudSemilla('SOL-200'),
      numero: 'SOL-200',
      estado: 'Borrador',
      cotizacion: null,
    })

    const noPdf = await errorAlSubir(
      borrador.id,
      new File(['hola'], 'cotizacion.pdf', { type: 'application/pdf' }),
    )
    expect(noPdf.status).toBe(422)
    expect(noPdf.errores.archivo).toBe('La cotización tiene que ser un PDF.')

    const grande = await errorAlSubir(borrador.id, pdf('grande.pdf', 10 * 1024 * 1024))
    expect(grande.status).toBe(422)
    expect(grande.errores.archivo).toBe('El archivo pesa más de 10 MB. Prueba con uno más liviano.')

    const enviada = await errorAlSubir(idSolicitudSemilla('SOL-119'), pdf())
    expect(enviada.status).toBe(409)
    expect(enviada.message).toBe('SOL-119 ya se envió a aprobación: su cotización ya no se puede cambiar.')

    const ajena = await errorAlSubir(idSolicitudSemilla('SOL-124'), pdf())
    expect(ajena.status).toBe(404)
    const inexistente = await errorAlSubir(idSolicitudSemilla('SOL-999'), pdf())
    expect(inexistente.status).toBe(404)
    expect(inexistente.message).toBe('Esa solicitud no existe.')
    // El número no sirve como identificador: la API pide el UUID
    expect((await errorAlSubir('SOL-200', pdf())).status).toBe(404)

    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-200' }))?.cotizacion).toBeNull()
    await expect(subirCotizacion(borrador.id, pdf())).resolves.toEqual({
      nombre: 'cotizacion-titanio.pdf',
      tamano: pdf().size,
    })
    expect(db.solicitudes.findFirst((q) => q.where({ numero: 'SOL-200' }))?.cotizacion).toBe(
      'cotizacion-titanio.pdf',
    )
  })
})
