import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada, EntradaPrefijo, Selector } from '@/components/ui/campo'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { fechaCorta, fechaIso, leerMonto, moneda, numero } from '@/lib/formato'
import { useOpcionesRecepcion, useRegistrarLote } from '../api/almacen'
import { esquemaLote, type EntradaLote, type FormLote } from '../schemas/lote'
import type { LoteRegistrado, OpcionesRecepcion } from '../types'
import './almacen.css'

const cantidad = (n: number, unidad: string) => `${numero(n, 3)} ${unidad}`
/** Para prellenar un campo de texto: 10 → "10", 0.5 → "0,5" (sin separador de miles). */
const aTexto = (n: number) => String(n).replace('.', ',')

/**
 * Vista 17: registrar la recepción de un lote (F6.1). Llega desde el almacén, el inicio o la ficha del
 * insumo: ?solicitud=<UUID de la reposición> la asocia y completa el insumo y la cantidad; ?insumo= elige el
 * insumo.
 */
export function VistaRecepcion() {
  const opciones = useOpcionesRecepcion()
  useTituloPagina('Registrar recepción')
  if (opciones.isPending) {
    return (
      <Cargando etiqueta="Cargando el formulario…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={520} />
      </Cargando>
    )
  }
  if (opciones.isError) {
    return <ErrorCarga mensaje={opciones.error.message} alReintentar={() => opciones.refetch()} />
  }
  return <FormularioRecepcion opciones={opciones.data} />
}

function FormularioRecepcion({ opciones }: { opciones: OpcionesRecepcion }) {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const registrar = useRegistrarLote()
  const [hecho, setHecho] = useState<LoteRegistrado | null>(null)
  const refHecho = useRef<HTMLDivElement>(null)
  const hoy = fechaIso()

  const inicial = (): EntradaLote => {
    const pedida = opciones.reposiciones.find((r) => r.id === params.get('solicitud'))
    const insumoUrl = opciones.insumos.find((i) => i.id === params.get('insumo'))
    // Desde la ficha de un insumo con una reposición aprobada, se asocia sola
    const reposicion = pedida ?? opciones.reposiciones.find((r) => r.insumoId === insumoUrl?.id)
    const insumoId = reposicion?.insumoId ?? insumoUrl?.id ?? ''
    return {
      solicitud: reposicion?.id ?? '',
      insumoId,
      loteProveedor: '',
      cantidad: reposicion ? aTexto(reposicion.cantidad) : '',
      costoUnitario: '',
      proveedor: '',
      ingreso: hoy,
      vence: '',
      ubicacionId: opciones.insumos.find((i) => i.id === insumoId)?.ubicacionId ?? '',
    }
  }

  const {
    register,
    control,
    handleSubmit,
    setValue,
    setError,
    reset,
    formState: { errors },
  } = useForm<EntradaLote, unknown, FormLote>({
    resolver: zodResolver(esquemaLote),
    defaultValues: inicial(),
  })
  const v = useWatch({ control })
  const insumo = opciones.insumos.find((i) => i.id === v.insumoId)
  const cant = leerMonto(v.cantidad ?? '')
  const costo = leerMonto(v.costoUnitario ?? '')
  const vencido = Boolean(v.vence) && v.vence! < hoy

  useEffect(() => {
    if (!esApiError(registrar.error) || registrar.error.status !== 422) return
    for (const [campo, mensaje] of Object.entries(registrar.error.errores)) {
      setError(campo as keyof EntradaLote, { message: mensaje }, { shouldFocus: true })
    }
  }, [registrar.error, setError])
  useEffect(() => {
    if (hecho) refHecho.current?.focus()
  }, [hecho])

  const rSolicitud = register('solicitud', {
    onChange: (e) => {
      const r = opciones.reposiciones.find((x) => x.id === e.target.value)
      if (!r) return
      setValue('insumoId', r.insumoId, { shouldValidate: Boolean(errors.insumoId) })
      setValue('cantidad', aTexto(r.cantidad))
      const sugerida = opciones.insumos.find((i) => i.id === r.insumoId)?.ubicacionId
      if (sugerida) setValue('ubicacionId', sugerida)
    },
  })
  const rInsumo = register('insumoId', {
    onChange: (e) => {
      const i = opciones.insumos.find((x) => x.id === e.target.value)
      if (i?.ubicacionId) setValue('ubicacionId', i.ubicacionId)
      // Otra reposición no corresponde a este insumo: se suelta
      const r = opciones.reposiciones.find((x) => x.id === v.solicitud)
      if (r && r.insumoId !== e.target.value) setValue('solicitud', '')
    },
  })

  const enviar = handleSubmit(async (d) => {
    if (registrar.isPending || vencido) return
    if (!d.vence && insumo?.vence === true) {
      setError(
        'vence',
        { message: `${insumo.nombre} vence: escribe la fecha de vencimiento del lote.` },
        { shouldFocus: true },
      )
      return
    }
    try {
      const r = await registrar.mutateAsync({
        solicitud: d.solicitud || null,
        insumoId: d.insumoId,
        loteProveedor: d.loteProveedor,
        cantidad: leerMonto(d.cantidad)!,
        costoUnitario: leerMonto(d.costoUnitario)!,
        proveedor: d.proveedor,
        ingreso: d.ingreso,
        vence: d.vence || null,
        ubicacionId: d.ubicacionId,
      })
      setHecho(r)
      reset({ ...inicial(), solicitud: '', insumoId: '', cantidad: '', ubicacionId: '' })
    } catch {
      // El error se muestra en su campo (422) o en el aviso general
    }
  })

  const errorGeneral =
    registrar.isError && !(esApiError(registrar.error) && registrar.error.status === 422)
      ? registrar.error.message
      : null

  return (
    <div className="vista-recepcion">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/almacen">Almacén</Link>
              </li>
              <li aria-current="page">Registrar recepción</li>
            </ol>
          </nav>
          <h1>Registrar recepción de lote</h1>
          <p className="sub">El stock aumenta en el mismo momento en que guardas.</p>
        </div>
      </div>

      {hecho && (
        <div ref={refHecho} tabIndex={-1} className="hecho">
          <Aviso tipo="ok">
            <p>
              <b>
                Registraste el lote <span className="mono">{hecho.codigo}</span> de{' '}
                {hecho.insumo.charAt(0).toLowerCase()}
                {hecho.insumo.slice(1)}.
              </b>{' '}
              El stock pasó de {cantidad(hecho.stockAntes, hecho.unidad)} a{' '}
              {cantidad(hecho.stockDespues, hecho.unidad)}.
              {hecho.reposicion && (
                <>
                  {' '}
                  La reposición <span className="mono">{hecho.reposicion}</span> quedó cerrada.
                </>
              )}
              {hecho.nuevaReposicion && (
                <>
                  {' '}
                  Sigue bajo el mínimo: se creó la reposición{' '}
                  <span className="mono">{hecho.nuevaReposicion}</span> en la bandeja.
                </>
              )}
            </p>
            <p className="acciones-hecho">
              <Link to={`/inventario/${hecho.insumoId}`}>Ver la ficha del insumo</Link>
              <Link to="/almacen">Volver al almacén</Link>
            </p>
          </Aviso>
        </div>
      )}

      <div className="dos">
        <form className="tarjeta form-l" noValidate aria-label="Datos del lote" onSubmit={enviar}>
          {vencido && (
            <Aviso tipo="err">
              <p>
                <b>La fecha de vencimiento ya pasó ({fechaCorta(v.vence!)}).</b>
              </p>
              <p>
                Si fue un error al escribirla, corrígela. Un lote vencido no se registra: devuélvelo al
                proveedor.
              </p>
            </Aviso>
          )}
          {errorGeneral && (
            <Aviso tipo="err">
              <p>{errorGeneral}</p>
            </Aviso>
          )}
          <h2>Origen</h2>
          <div className="form-rejilla">
            <Campo
              className="ancho"
              etiqueta="Solicitud de gasto"
              opcional
              ayuda={
                opciones.reposiciones.length === 0
                  ? 'No hay reposiciones aprobadas esperando la compra.'
                  : 'Al asociarla, el insumo y la cantidad se completan solos.'
              }
              error={errors.solicitud?.message}
            >
              {(c) => (
                <Selector {...c} {...rSolicitud}>
                  <option value="">Sin solicitud</option>
                  {opciones.reposiciones.map((r) => {
                    const i = opciones.insumos.find((x) => x.id === r.insumoId)
                    return (
                      <option key={r.id} value={r.id}>
                        {r.numero} · Reposición de{' '}
                        {i ? i.nombre.charAt(0).toLowerCase() + i.nombre.slice(1) : 'insumo'} ·{' '}
                        {cantidad(r.cantidad, i?.unidad ?? '')} · Aprobado
                      </option>
                    )
                  })}
                </Selector>
              )}
            </Campo>
          </div>

          <h2>Lote</h2>
          <div className="form-rejilla">
            <Campo etiqueta="Insumo" error={errors.insumoId?.message}>
              {(c) => (
                <Selector {...c} {...rInsumo}>
                  <option value="">Elige el insumo</option>
                  {opciones.insumos.map((i) => (
                    <option key={i.id} value={i.id}>
                      {i.nombre} ({i.unidad})
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
            <Campo etiqueta="Número de lote del proveedor" error={errors.loteProveedor?.message}>
              {(c) => <Entrada {...c} className="mono" autoComplete="off" {...register('loteProveedor')} />}
            </Campo>
            <Campo etiqueta="Cantidad recibida" error={errors.cantidad?.message}>
              {(c) => (
                <div className="con-unidad">
                  <Entrada
                    {...c}
                    className="num"
                    inputMode="decimal"
                    autoComplete="off"
                    style={{ textAlign: 'right' }}
                    {...register('cantidad')}
                  />
                  {insumo && (
                    <span className="sec" aria-hidden="true">
                      {insumo.unidad}
                    </span>
                  )}
                </div>
              )}
            </Campo>
            <Campo etiqueta="Costo unitario" error={errors.costoUnitario?.message}>
              {(c) => (
                <EntradaPrefijo
                  {...c}
                  prefijo="US$"
                  className="num"
                  inputMode="decimal"
                  autoComplete="off"
                  {...register('costoUnitario')}
                />
              )}
            </Campo>
            <Campo etiqueta="Proveedor" error={errors.proveedor?.message}>
              {(c) => <Entrada {...c} autoComplete="organization" {...register('proveedor')} />}
            </Campo>
            <Campo etiqueta="Fecha de ingreso" error={errors.ingreso?.message}>
              {(c) => <Entrada {...c} type="date" max={hoy} {...register('ingreso')} />}
            </Campo>
            <Campo
              etiqueta="Fecha de vencimiento"
              ayuda="Déjala vacía solo si el insumo no vence."
              error={errors.vence?.message}
              invalido={vencido}
            >
              {(c) => <Entrada {...c} type="date" {...register('vence')} />}
            </Campo>
            <Campo etiqueta="Ubicación" error={errors.ubicacionId?.message}>
              {(c) => (
                <Selector {...c} {...register('ubicacionId')}>
                  <option value="">Elige la ubicación</option>
                  {opciones.ubicaciones.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.nombre}
                    </option>
                  ))}
                </Selector>
              )}
            </Campo>
          </div>
          <div className="acc-form">
            <button className="btn btn-sec" type="button" onClick={() => navigate('/almacen')}>
              Cancelar
            </button>
            <button
              className="btn btn-pri"
              type="submit"
              disabled={vencido}
              aria-disabled={registrar.isPending || undefined}
            >
              {registrar.isPending ? 'Guardando…' : 'Registrar lote'}
            </button>
          </div>
        </form>

        <aside className="tarjeta efecto-s" aria-label="Efecto en el stock">
          <h2 style={{ fontSize: 18 }}>Lo que pasa al guardar</h2>
          {insumo ? (
            <>
              <div className="paso-s">
                <div>
                  <span>Stock hoy</span>
                  <b>{cantidad(insumo.stock, insumo.unidad)}</b>
                </div>
                <Icono nombre="flecha" />
                <div className="despues">
                  <span>Después</span>
                  <b>{cant && cant > 0 ? cantidad(insumo.stock + cant, insumo.unidad) : '—'}</b>
                </div>
              </div>
              <ul className="lista" style={{ fontSize: 15 }}>
                {insumo.stock < insumo.stockMinimo && (
                  <li>
                    <div className="izq">
                      Alerta de stock mínimo
                      <small>Mínimo {cantidad(insumo.stockMinimo, insumo.unidad)}</small>
                    </div>
                    {cant && insumo.stock + cant >= insumo.stockMinimo ? (
                      <ChipEstado tipo="ok">Se retira</ChipEstado>
                    ) : (
                      <ChipEstado tipo="warn">Sigue bajo el mínimo</ChipEstado>
                    )}
                  </li>
                )}
                {v.solicitud && (
                  <li>
                    <div className="izq">
                      Reposición{' '}
                      <span className="mono">
                        {opciones.reposiciones.find((r) => r.id === v.solicitud)?.numero}
                      </span>
                    </div>
                    <ChipEstado tipo="info">Queda asociada al lote</ChipEstado>
                  </li>
                )}
                {cant && costo ? (
                  <li>
                    <div className="izq">
                      Costo del lote
                      <small>
                        {cantidad(cant, insumo.unidad)} × {moneda(costo)}
                      </small>
                    </div>
                    <b className="num">{moneda(Math.round(cant * costo * 100) / 100)}</b>
                  </li>
                ) : null}
              </ul>
            </>
          ) : (
            <p className="sec">Elige el insumo y escribe la cantidad para ver cómo cambia el stock.</p>
          )}
        </aside>
      </div>
    </div>
  )
}
