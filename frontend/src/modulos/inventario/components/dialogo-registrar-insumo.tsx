import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, type RefObject } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada, Selector } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { OpcionesTarjeta } from '@/components/ui/opciones'
import { esApiError } from '@/lib/api-client'
import { leerMonto } from '@/lib/formato'
import { useRegistrarInsumo } from '../api/insumos'
import { esquemaInsumo, type DatosInsumo, type EntradaInsumo } from '../schemas/insumo'
import { TIPOS, UNIDADES, type ConflictoInsumo, type ResumenInsumo } from '../types'

type Props = {
  alCerrar: () => void
  alRegistrar: (insumo: ResumenInsumo, reposicion: string | null) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

/** "en litros", "en cajas": para el mensaje del nombre repetido (mockup 09). */
const enUnidad: Record<string, string> = {
  L: 'en litros',
  mL: 'en mililitros',
  g: 'en gramos',
  kg: 'en kilogramos',
  unidades: 'por unidad',
  cajas: 'en cajas',
  bolsas: 'en bolsas',
  rollos: 'en rollos',
}

/** "Registrar insumo" (mockup 09, capa de alta; F3.1 y F3.2). Solo el Administrador. */
export function DialogoRegistrarInsumo({ alCerrar, alRegistrar, focoAlCerrar }: Props) {
  const registrar = useRegistrarInsumo()
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    formState: { errors },
  } = useForm<EntradaInsumo, unknown, DatosInsumo>({
    resolver: zodResolver(esquemaInsumo),
    defaultValues: { nombre: '', unidad: '', stockMinimo: '', tipo: undefined },
  })
  // En orden de pantalla, para que un error enfoque el primer campo.
  const rNombre = register('nombre')
  const rUnidad = register('unidad')
  const rMinimo = register('stockMinimo')
  const unidad = useWatch({ control, name: 'unidad' })
  const nombre = useWatch({ control, name: 'nombre' })

  // 409: ya existe con ese nombre y esa unidad; el mensaje enlaza al insumo (F3.1). 422: junto a cada campo.
  const error = registrar.error
  const conflicto =
    esApiError(error) && error.status === 409
      ? (error.conflicto as ConflictoInsumo | undefined)?.insumo
      : undefined
  // El aviso del repetido se va en cuanto se cambia el nombre o la unidad
  const conflictoVigente =
    conflicto && conflicto.unidad === unidad && nombre.trim().toLowerCase() === conflicto.nombre.toLowerCase()
      ? conflicto
      : undefined
  useEffect(() => {
    if (!esApiError(error)) return
    for (const [campo, mensaje] of Object.entries(error.errores)) {
      if (['nombre', 'unidad', 'stockMinimo', 'tipo'].includes(campo)) {
        setError(campo as keyof EntradaInsumo, { message: mensaje }, { shouldFocus: true })
      }
    }
  }, [error, setError])
  useEffect(() => {
    if (conflicto) setFocus('nombre')
  }, [conflicto, setFocus])
  const errorGeneral =
    error && !conflicto && !(esApiError(error) && error.status === 422) ? error.message : null

  const enviar = handleSubmit((d) => {
    if (registrar.isPending) return
    registrar.mutate(
      { nombre: d.nombre, unidad: d.unidad, stockMinimo: leerMonto(d.stockMinimo) ?? 0, tipo: d.tipo },
      { onSuccess: (r) => alRegistrar(r.insumo, r.reposicion) },
    )
  })

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo="Registrar insumo"
      descripcion="Nace con stock cero. Solo cambia con recepciones y despachos."
      ancho={620}
      alEnviar={enviar}
      focoAlCerrar={focoAlCerrar}
    >
      <div className="form-rejilla">
        <Campo
          className="ancho"
          etiqueta="Nombre"
          id="a-nom"
          error={
            conflictoVigente ? (
              <>
                Ya existe{' '}
                <Link to={`/inventario/${conflictoVigente.id}`}>
                  {conflictoVigente.nombre}{' '}
                  {enUnidad[conflictoVigente.unidad] ?? `en ${conflictoVigente.unidad}`}
                </Link>
                . Abre ese insumo o cambia el nombre o la unidad.
              </>
            ) : (
              errors.nombre?.message
            )
          }
        >
          {(c) => <Entrada {...c} autoComplete="off" {...rNombre} />}
        </Campo>
        <Campo etiqueta="Unidad de medida" id="a-uni" error={errors.unidad?.message}>
          {(c) => (
            <Selector {...c} {...rUnidad}>
              <option value="" disabled>
                Elige la unidad
              </option>
              {UNIDADES.map((u) => (
                <option key={u.valor} value={u.valor}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <Campo
          etiqueta="Stock mínimo"
          id="a-min"
          ayuda="Si el stock baja de aquí, aparece la alerta y se crea una reposición en Borrador."
          error={errors.stockMinimo?.message}
        >
          {(c) => (
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Entrada
                {...c}
                className="num"
                inputMode="decimal"
                autoComplete="off"
                style={{ textAlign: 'right' }}
                {...rMinimo}
              />
              {unidad && (
                <span className="sec" aria-hidden="true">
                  {unidad}
                </span>
              )}
            </div>
          )}
        </Campo>
        <div className="ancho">
          <Controller
            control={control}
            name="tipo"
            render={({ field, fieldState }) => (
              <OpcionesTarjeta
                leyenda="Tipo"
                nombre="a-tipo"
                valor={field.value}
                alCambiar={field.onChange}
                refControl={field.ref}
                error={fieldState.error?.message}
                ayuda="Los de uso general no se cargan a un proyecto al comprarlos: su costo se reparte al cerrar el período."
                opciones={TIPOS.map((t) => ({ valor: t, etiqueta: t }))}
              />
            )}
          />
        </div>
      </div>
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}
      <div className="acc-form">
        <button className="btn btn-sec" type="button" onClick={alCerrar}>
          Cancelar
        </button>
        <button className="btn btn-pri" type="submit" aria-disabled={registrar.isPending || undefined}>
          {registrar.isPending ? 'Registrando…' : 'Registrar insumo'}
        </button>
      </div>
    </Dialogo>
  )
}
