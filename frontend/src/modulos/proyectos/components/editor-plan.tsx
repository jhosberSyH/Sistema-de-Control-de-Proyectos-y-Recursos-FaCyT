import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useRef, useState } from 'react'
import { useFieldArray, useForm, useWatch } from 'react-hook-form'
import { useBlocker } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada } from '@/components/ui/campo'
import { DialogoAlerta } from '@/components/ui/dialogo'
import { esApiError } from '@/lib/api-client'
import { porcentaje } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useGuardarPlan } from '../api/proyectos'
import { esquemaPlan, type DatosPlan, type EntradaPlan } from '../schemas/plan'
import type { PlanProyecto } from '../types'
import { avanceFisico, leerEntero } from '../utils/avance'

type Props = {
  plan: PlanProyecto
  /** Al guardar: el plan como quedó y si fue un borrador. */
  alGuardar: (plan: PlanProyecto, borrador: boolean) => void
  /** Solo al editar un plan ya confirmado: vuelve a la tabla de avance sin guardar. */
  alCancelar?: () => void
}

const HITO_VACIO = { hitoId: null, conCargas: false, nombre: '', fechaPrevista: '', peso: '' }

function valoresDe(plan: PlanProyecto): EntradaPlan {
  return {
    hitos: plan.hitos.length
      ? plan.hitos.map((h) => ({
          hitoId: h.id,
          conCargas: h.cargas > 0,
          nombre: h.nombre,
          fechaPrevista: h.fechaPrevista,
          peso: String(h.peso),
        }))
      : [HITO_VACIO],
  }
}

/**
 * Editor del plan de hitos (mockup 08, modo "Plan incompleto"; F2.4). La suma de pesos se ve en vivo
 * y "Confirmar plan" solo avanza con 100 % (HU-05). Un plan ya confirmado se edita con la misma
 * pantalla, pero tiene que seguir sumando 100 para no dejar el avance físico como "No disponible".
 */
export function EditorPlan({ plan, alGuardar, alCancelar }: Props) {
  const guardar = useGuardarPlan(plan.codigo)
  const confirmado = plan.planConfirmado
  const {
    register,
    control,
    handleSubmit,
    reset,
    setError,
    setFocus,
    formState: { errors, isDirty },
  } = useForm<EntradaPlan, unknown, DatosPlan>({
    resolver: zodResolver(esquemaPlan),
    defaultValues: valoresDe(plan),
  })
  const { fields, append, remove } = useFieldArray({ control, name: 'hitos' })
  const hitos = useWatch({ control, name: 'hitos' })
  const [errorSuma, setErrorSuma] = useState<string | null>(null)
  const refEditor = useRef<HTMLElement>(null)

  const suma = hitos.reduce((t, h) => t + (leerEntero(h.peso) ?? 0), 0)
  const lista = suma === 100
  const textoSuma = lista
    ? confirmado
      ? 'Los pesos suman 100 %. Ya puedes guardar los cambios.'
      : 'Los pesos suman 100 %. Ya puedes confirmar el plan.'
    : suma < 100
      ? `Faltan ${porcentaje(100 - suma)} para llegar a 100 %.`
      : `Sobran ${porcentaje(suma - 100)}. Baja algún peso para llegar a 100 %.`

  // Con el plan confirmado, cuánto quedaría el avance físico con los pesos nuevos (F2.6, H1).
  const avanceDeHito = new Map(plan.hitos.map((h) => [h.id, h.avance]))
  const avanceNuevo = avanceFisico(
    hitos.map((h) => ({
      peso: leerEntero(h.peso) ?? 0,
      avance: h.hitoId ? (avanceDeHito.get(h.hitoId) ?? 0) : 0,
    })),
  )
  const textoConfirmar = !lista
    ? 'Ajusta los pesos para que sumen 100 %.'
    : !confirmado
      ? 'Al confirmar, el avance físico empieza a calcularse.'
      : plan.avance !== null && avanceNuevo !== plan.avance
        ? `Al guardar, el avance físico pasa de ${porcentaje(plan.avance)} a ${porcentaje(avanceNuevo)}.`
        : `El avance físico se mantiene en ${porcentaje(avanceNuevo)}.`

  // Cambios sin guardar: avisa antes de salir de la pantalla (H5; plan §7.1, un error no borra lo escrito).
  // En una ref para que guardar y salir en el mismo clic no pregunte (el estado llega un render después).
  const sinGuardar = useRef(false)
  const bloqueo = useBlocker(
    ({ currentLocation: de, nextLocation: a }) =>
      sinGuardar.current && (de.pathname !== a.pathname || de.search !== a.search),
  )
  useEffect(() => {
    sinGuardar.current = isDirty
    if (!isDirty) return
    const avisar = (e: BeforeUnloadEvent) => e.preventDefault()
    window.addEventListener('beforeunload', avisar)
    return () => window.removeEventListener('beforeunload', avisar)
  }, [isDirty])

  // 422 del servidor: junto a cada campo ("hitos.2.peso") o, si es del plan entero, arriba de los botones.
  const error = guardar.error
  useEffect(() => {
    if (!esApiError(error)) return
    for (const [campo, mensaje] of Object.entries(error.errores)) {
      if (/^hitos\.\d+\.(nombre|fechaPrevista|peso)$/.test(campo)) {
        setError(campo as `hitos.${number}.nombre`, { message: mensaje }, { shouldFocus: true })
      }
    }
  }, [error, setError])
  const errorGeneral =
    errorSuma ??
    errors.hitos?.message ??
    errors.hitos?.root?.message ??
    (error ? (esApiError(error) && error.status === 422 ? error.errores.hitos : error.message) : null)

  const enviar = (borrador: boolean) =>
    handleSubmit(async (d) => {
      if (guardar.isPending) return
      // HU-05: con 90 no se confirma, y se dice cuánto falta
      if (!borrador && !lista) {
        setErrorSuma(
          `Los pesos suman ${porcentaje(suma)}: ${suma < 100 ? `faltan ${porcentaje(100 - suma)}` : `sobran ${porcentaje(suma - 100)}`} para llegar a 100 %.`,
        )
        const primero = hitos.findIndex((h) => (leerEntero(h.peso) ?? 0) > 0)
        setFocus(`hitos.${Math.max(0, primero)}.peso`)
        return
      }
      setErrorSuma(null)
      // mutateAsync y no los callbacks de mutate: al confirmar, el editor se desmonta (la vista pasa a la
      // tabla de avance) antes de que terminen, y TanStack Query no llama los de un componente desmontado.
      try {
        const r = await guardar.mutateAsync({
          confirmar: !borrador,
          hitos: d.hitos.map((h) => ({
            id: h.hitoId,
            nombre: h.nombre,
            fechaPrevista: h.fechaPrevista,
            peso: h.peso,
          })),
        })
        sinGuardar.current = false
        reset(valoresDe(r))
        alGuardar(r, borrador)
      } catch {
        // El error queda en guardar.error y se muestra junto a los campos o sobre los botones.
      }
    })

  const agregar = () => {
    setErrorSuma(null)
    append(HITO_VACIO, { focusName: `hitos.${fields.length}.nombre` })
  }

  // Al quitar una fila, el foco pasa a la que queda en su lugar, o a "Agregar hito" (WCAG 2.4.3).
  const quitar = (i: number) => {
    setErrorSuma(null)
    remove(i)
    window.setTimeout(() => {
      const editor = refEditor.current
      const siguiente =
        editor?.querySelector<HTMLElement>(`[data-quitar="${i}"]`) ??
        editor?.querySelector<HTMLElement>(`[data-quitar="${i - 1}"]`) ??
        editor?.querySelector<HTMLElement>('[data-agregar]')
      siguiente?.focus()
    })
  }

  const hayConCargas = hitos.some((h) => h.conCargas)

  return (
    <>
      <div className="dos">
        <section className="tarjeta editor" aria-labelledby="t-plan" ref={refEditor}>
          <form
            noValidate
            onSubmit={(e) => {
              e.preventDefault()
              void enviar(false)()
            }}
          >
            <div className="bloque-cab">
              <h2 id="t-plan">Hitos</h2>
              <span className="conteo">
                {fields.length} {fields.length === 1 ? 'hito' : 'hitos'}
              </span>
            </div>
            <div>
              {fields.map((f, i) => {
                const e = errors.hitos?.[i]
                const conCargas = hitos[i]?.conCargas
                return (
                  <div className="fila-h" key={f.id}>
                    <span className="n-h" aria-hidden="true">
                      {i + 1}
                    </span>
                    <Campo
                      className="nom"
                      id={`h${i}`}
                      etiqueta={
                        <>
                          Hito <span className="vh">{i + 1}</span>
                        </>
                      }
                      error={e?.nombre?.message}
                    >
                      {(c) => <Entrada {...c} {...register(`hitos.${i}.nombre`)} maxLength={120} />}
                    </Campo>
                    <Campo
                      className="fecha"
                      id={`f${i}`}
                      etiqueta={
                        <>
                          Fecha prevista <span className="vh">del hito {i + 1}</span>
                        </>
                      }
                      error={e?.fechaPrevista?.message}
                    >
                      {(c) => <Entrada {...c} type="date" {...register(`hitos.${i}.fechaPrevista`)} />}
                    </Campo>
                    <Campo
                      className="peso"
                      id={`p${i}`}
                      etiqueta={
                        <>
                          Peso <span className="vh">del hito {i + 1}</span>
                        </>
                      }
                      error={e?.peso?.message}
                    >
                      {(c) => (
                        <div className="sufijo-pct">
                          <Entrada
                            {...c}
                            inputMode="numeric"
                            {...register(`hitos.${i}.peso`, { onChange: () => setErrorSuma(null) })}
                          />
                          <span aria-hidden="true">%</span>
                        </div>
                      )}
                    </Campo>
                    <button
                      className="quitar"
                      type="button"
                      data-quitar={i}
                      aria-label={
                        conCargas
                          ? `Quitar hito ${i + 1} (no se puede: ya tiene cargas de avance)`
                          : `Quitar hito ${i + 1}`
                      }
                      aria-disabled={conCargas || undefined}
                      onClick={() => {
                        if (!conCargas) quitar(i)
                      }}
                    >
                      <Icono nombre={conCargas ? 'candado' : 'error'} />
                    </button>
                  </div>
                )
              })}
            </div>
            <div className="agregar">
              <button className="btn btn-sec" type="button" data-agregar onClick={agregar}>
                <Icono nombre="mas" />
                Agregar hito
              </button>
            </div>
            {hayConCargas && (
              <p className="nota-plan">
                Los hitos con el candado ya tienen cargas de avance: no se pueden quitar, para no perder su
                historial.
              </p>
            )}
            <div className={cn('suma', lista && 'lista')} aria-live="polite">
              <div className="t">
                <span>{textoSuma}</span>
                <b>{porcentaje(suma)}</b>
              </div>
              <div className="pista" role="presentation">
                <i style={{ width: `${Math.min(suma, 100)}%` }} />
                <span className="meta" />
              </div>
            </div>
            {errorGeneral && (
              <Aviso tipo="err" className="error-plan">
                <p>{errorGeneral}</p>
              </Aviso>
            )}
            <div className="confirmar">
              <p id="conf-txt">{textoConfirmar}</p>
              {confirmado ? (
                <button className="btn btn-sec" type="button" onClick={alCancelar}>
                  Cancelar
                </button>
              ) : (
                <button
                  className="btn btn-sec"
                  type="button"
                  aria-disabled={guardar.isPending || undefined}
                  onClick={() => void enviar(true)()}
                >
                  Guardar borrador
                </button>
              )}
              <button
                className="btn btn-pri"
                type="submit"
                aria-disabled={!lista || guardar.isPending || undefined}
                aria-describedby="conf-txt"
              >
                {guardar.isPending ? 'Guardando…' : confirmado ? 'Guardar cambios' : 'Confirmar plan'}
              </button>
            </div>
          </form>
        </section>
        <aside className="lado">
          <section className="tarjeta bloque" aria-labelledby="t-como">
            <div className="bloque-cab">
              <h2 id="t-como">Cómo se calcula el avance</h2>
            </div>
            <p style={{ fontSize: 15 }}>
              El avance físico suma el avance de cada hito multiplicado por su peso. Por ejemplo, un hito de
              peso 60 al 50 % y uno de peso 40 al 100 % dan 70 %.
            </p>
            {!confirmado && (
              <Aviso tipo="info" rol="none">
                <p>
                  Mientras el plan no esté confirmado, el proyecto muestra el avance como "No disponible".
                </p>
              </Aviso>
            )}
          </section>
        </aside>
      </div>

      <DialogoAlerta
        abierto={bloqueo.state === 'blocked'}
        alCambiar={(abierto) => {
          if (!abierto) bloqueo.reset?.()
        }}
        titulo="¿Salir sin guardar el plan?"
        descripcion="Los cambios en los hitos todavía no están guardados. Si sales, se pierden."
        confirmar="Salir sin guardar"
        cancelar="Seguir editando"
        peligro
        alConfirmar={() => bloqueo.proceed?.()}
      />
    </>
  )
}
