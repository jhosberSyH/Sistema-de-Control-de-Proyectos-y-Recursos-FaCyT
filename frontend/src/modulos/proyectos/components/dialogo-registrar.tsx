import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, type RefObject } from 'react'
import { Controller, useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada, EntradaPrefijo, Selector } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { OpcionesTarjeta } from '@/components/ui/opciones'
import { esApiError } from '@/lib/api-client'
import { leerMonto, monto } from '@/lib/formato'
import { useCoordinadores, useRegistrarProyecto } from '../api/proyectos'
import {
  AREA_DEL_PREFIJO,
  esquemaProyecto,
  type DatosProyecto,
  type EntradaProyecto,
} from '../schemas/proyecto'
import { AREAS, PRIORIDADES, type ConflictoCodigo, type ResumenProyecto } from '../types'

type Props = {
  alCerrar: () => void
  alRegistrar: (proyecto: ResumenProyecto) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

/** "Registrar proyecto" (mockup 06, capa de registro; F2.1 y F2.2). Nace en estatus Propuesta. */
export function DialogoRegistrar({ alCerrar, alRegistrar, focoAlCerrar }: Props) {
  const registrar = useRegistrarProyecto()
  const coordinadores = useCoordinadores(true)
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    getValues,
    formState: { errors },
  } = useForm<EntradaProyecto, unknown, DatosProyecto>({
    resolver: zodResolver(esquemaProyecto),
    defaultValues: {
      codigo: '',
      area: '',
      nombre: '',
      presupuesto: '',
      coordinadorId: '',
      prioridad: undefined,
    },
  })
  // En orden de pantalla, para que un error enfoque el primer campo.
  const rCodigo = register('codigo')
  const rArea = register('area')
  const rNombre = register('nombre')
  const rPresupuesto = register('presupuesto')
  const rCoordinador = register('coordinadorId')

  // Al escribir el código se sugiere el área de su prefijo si todavía no se eligió (L10: capturar una vez).
  const codigo = useWatch({ control, name: 'codigo' })
  useEffect(() => {
    const area = AREA_DEL_PREFIJO[codigo?.trim().toUpperCase().slice(0, 3) ?? '']
    if (area && !getValues('area')) setValue('area', area)
  }, [codigo, getValues, setValue])

  // 409: el código ya existe y se muestra el proyecto que lo tiene (F2.1). 422: junto a cada campo.
  const error = registrar.error
  const conflicto =
    esApiError(error) && error.status === 409
      ? (error.conflicto as ConflictoCodigo | undefined)?.proyecto
      : undefined
  const conflictoVigente =
    conflicto && codigo?.trim().toUpperCase() === conflicto.codigo ? conflicto : undefined
  useEffect(() => {
    if (!esApiError(error)) return
    for (const [campo, mensaje] of Object.entries(error.errores)) {
      if (['codigo', 'area', 'nombre', 'presupuesto', 'prioridad', 'coordinadorId'].includes(campo)) {
        setError(campo as keyof EntradaProyecto, { message: mensaje }, { shouldFocus: true })
      }
    }
  }, [error, setError])
  // El código repetido lleva el foco al campo: así se lee el error con el enlace al proyecto existente.
  useEffect(() => {
    if (conflicto) setFocus('codigo')
  }, [conflicto, setFocus])
  const errorGeneral =
    error && !conflicto && !(esApiError(error) && error.status === 422) ? error.message : null

  const enviar = handleSubmit((d) => {
    if (registrar.isPending) return
    registrar.mutate(
      {
        codigo: d.codigo,
        area: d.area,
        nombre: d.nombre,
        presupuesto: leerMonto(d.presupuesto) ?? 0,
        prioridad: d.prioridad,
        coordinadorId: d.coordinadorId || null,
      },
      { onSuccess: alRegistrar },
    )
  })

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo="Registrar proyecto"
      descripcion="Nace en estatus Propuesta. Los campos sin marca son obligatorios."
      ancho={640}
      alEnviar={enviar}
      focoAlCerrar={focoAlCerrar}
    >
      <div className="form-rejilla">
        <Campo
          etiqueta="Código institucional"
          id="r-cod"
          error={
            conflictoVigente ? (
              <>
                Ya existe el proyecto{' '}
                <Link to={`/proyectos/${conflictoVigente.id}`}>
                  {conflictoVigente.codigo}, {conflictoVigente.nombre}
                </Link>
                . Usa otro código o abre ese proyecto.
              </>
            ) : (
              errors.codigo?.message
            )
          }
        >
          {(c) => (
            <Entrada
              {...c}
              className="mono"
              autoComplete="off"
              spellCheck={false}
              placeholder="QUI-032"
              {...rCodigo}
              onBlur={(e) => {
                setValue('codigo', e.target.value.trim().toUpperCase())
                void rCodigo.onBlur(e)
              }}
            />
          )}
        </Campo>
        <Campo etiqueta="Área" id="r-area" error={errors.area?.message}>
          {(c) => (
            <Selector {...c} {...rArea}>
              <option value="" disabled>
                Elige el área
              </option>
              {AREAS.map((a) => (
                <option key={a} value={a}>
                  {a}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <Campo className="ancho" etiqueta="Nombre" id="r-nom" error={errors.nombre?.message}>
          {(c) => <Entrada {...c} autoComplete="off" {...rNombre} />}
        </Campo>
        <Campo
          etiqueta="Presupuesto asignado"
          id="r-pres"
          ayuda="Mayor que cero. Se usa para la ejecución presupuestaria."
          error={errors.presupuesto?.message}
        >
          {(c) => (
            <EntradaPrefijo
              {...c}
              prefijo="US$"
              className="num"
              inputMode="decimal"
              autoComplete="off"
              placeholder="0,00"
              {...rPresupuesto}
              onBlur={(e) => {
                // Al salir del campo se muestra con el formato de la app: 9500 → 9.500,00
                const n = leerMonto(e.target.value)
                if (n !== null && n > 0) setValue('presupuesto', monto(n))
                void rPresupuesto.onBlur(e)
              }}
            />
          )}
        </Campo>
        <Campo
          etiqueta={
            <>
              Coordinador <span className="obligatorio">(puedes asignarlo después)</span>
            </>
          }
          id="r-coord"
          error={errors.coordinadorId?.message}
          ayuda={
            coordinadores.isError
              ? 'No pudimos cargar los coordinadores: asígnalo después desde la ficha.'
              : undefined
          }
        >
          {(c) => (
            <Selector {...c} {...rCoordinador}>
              <option value="">Sin asignar</option>
              {coordinadores.data?.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                  {u.proyectos > 0 ? ` (${u.proyectos} ${u.proyectos === 1 ? 'proyecto' : 'proyectos'})` : ''}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
        <div className="ancho">
          <Controller
            control={control}
            name="prioridad"
            render={({ field, fieldState }) => (
              <OpcionesTarjeta
                leyenda="Prioridad"
                nombre="r-prio"
                valor={field.value}
                alCambiar={field.onChange}
                refControl={field.ref}
                error={fieldState.error?.message}
                opciones={PRIORIDADES.map((p) => ({ valor: p, etiqueta: p }))}
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
          {registrar.isPending ? 'Registrando…' : 'Registrar proyecto'}
        </button>
      </div>
    </Dialogo>
  )
}
