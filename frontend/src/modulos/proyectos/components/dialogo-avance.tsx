import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useMemo, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Aviso } from '@/components/ui/aviso'
import { AreaTexto, Campo, Entrada } from '@/components/ui/campo'
import { Dialogo } from '@/components/ui/dialogo'
import { esApiError } from '@/lib/api-client'
import { fechaCorta, fechaIso, porcentaje } from '@/lib/formato'
import { useCargarAvance, useCargasHito } from '../api/proyectos'
import { esquemaAvance, type DatosAvance, type EntradaAvance } from '../schemas/plan'
import type { HitoPlan, PlanProyecto, ResultadoCarga } from '../types'
import { avanceFisico, leerEntero } from '../utils/avance'

type Props = {
  plan: PlanProyecto
  hito: HitoPlan
  alCerrar: () => void
  alListo: (r: ResultadoCarga & { porcentaje: number }) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}

const CAMPOS = ['porcentaje', 'fecha', 'comentario'] as const

/**
 * "Cargar avance" (mockup 08, capa de carga; F2.5). Antes de guardar dice cuánto queda el avance
 * físico del proyecto (F2.6) y muestra las cargas anteriores del hito, que no se borran.
 */
export function DialogoAvance({ plan, hito, alCerrar, alListo, focoAlCerrar }: Props) {
  const cargar = useCargarAvance(plan.codigo, hito.id)
  const cargas = useCargasHito(plan.codigo, hito.id)
  const hoy = fechaIso()
  const esquema = useMemo(
    () => esquemaAvance({ hoy, ultimaCarga: hito.ultimaCarga }),
    [hoy, hito.ultimaCarga],
  )
  const {
    register,
    control,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<EntradaAvance, unknown, DatosAvance>({
    resolver: zodResolver(esquema),
    defaultValues: { porcentaje: '', fecha: hoy, comentario: '' },
  })
  const rPorcentaje = register('porcentaje')
  const rFecha = register('fecha')
  const rComentario = register('comentario')

  // 422 del servidor: junto a cada campo.
  const error = cargar.error
  useEffect(() => {
    if (!esApiError(error)) return
    for (const [campo, mensaje] of Object.entries(error.errores)) {
      if ((CAMPOS as readonly string[]).includes(campo)) {
        setError(campo as (typeof CAMPOS)[number], { message: mensaje }, { shouldFocus: true })
      }
    }
  }, [error, setError])
  const errorGeneral = error && !(esApiError(error) && error.status === 422) ? error.message : null

  // Vista previa del avance físico con el valor escrito (mockup: "pasa de 62 % a 66,5 %").
  const escrito = leerEntero(useWatch({ control, name: 'porcentaje' }) ?? '')
  const valido = escrito !== null && escrito <= 100 && !errors.porcentaje
  const despues = valido
    ? avanceFisico(plan.hitos.map((h) => (h.id === hito.id ? { ...h, avance: escrito } : h)))
    : null
  const antes = plan.avance ?? 0

  const enviar = handleSubmit((d) => {
    if (cargar.isPending) return
    cargar.mutate(
      { porcentaje: d.porcentaje, fecha: d.fecha, comentario: d.comentario },
      { onSuccess: (r) => alListo({ ...r, porcentaje: d.porcentaje }) },
    )
  })

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo="Cargar avance"
      descripcion={`Hito ${hito.numero} · ${hito.nombre} · peso ${porcentaje(hito.peso)}`}
      alEnviar={(e) => {
        e.preventDefault()
        void enviar()
      }}
      focoAlCerrar={focoAlCerrar}
    >
      <div className="form-rejilla">
        <Campo
          etiqueta="Avance alcanzado"
          id="av"
          ayuda={`Entre 0 y 100. Hoy está en ${porcentaje(hito.avance)}.`}
          error={errors.porcentaje?.message}
        >
          {(c) => (
            <div className="sufijo-pct">
              <Entrada {...c} {...rPorcentaje} inputMode="numeric" autoComplete="off" />
              <span aria-hidden="true">%</span>
            </div>
          )}
        </Campo>
        <Campo etiqueta="Fecha" id="av-f" error={errors.fecha?.message}>
          {(c) => <Entrada {...c} {...rFecha} type="date" max={hoy} min={hito.ultimaCarga ?? undefined} />}
        </Campo>
        <Campo etiqueta="Comentario" opcional id="av-c" className="ancho" error={errors.comentario?.message}>
          {(c) => <AreaTexto {...c} {...rComentario} maxLength={300} />}
        </Campo>
      </div>

      {despues !== null && escrito !== null && (
        <Aviso tipo={escrito < hito.avance ? 'warn' : 'info'}>
          {escrito < hito.avance && (
            <p>
              <b>
                Es menos que la última carga ({porcentaje(hito.avance)}). Guárdalo solo si estás corrigiendo
                un error.
              </b>
            </p>
          )}
          <p>
            {despues === antes
              ? `Con ${porcentaje(escrito)} en este hito, el avance físico del proyecto se mantiene en ${porcentaje(antes)}.`
              : `Con ${porcentaje(escrito)} en este hito, el avance físico del proyecto pasa de ${porcentaje(antes)} a ${porcentaje(despues)}.`}
          </p>
        </Aviso>
      )}

      <div>
        <h3 style={{ fontSize: 15, fontFamily: 'var(--f-body)', marginBottom: 4 }}>Cargas anteriores</h3>
        {cargas.isPending ? (
          <p className="sec">Cargando…</p>
        ) : cargas.isError ? (
          <p className="sec">No pudimos traer las cargas anteriores. Igual puedes guardar esta.</p>
        ) : cargas.data.length === 0 ? (
          <p className="sec">Todavía no hay cargas de este hito.</p>
        ) : (
          <ul className="hist-av">
            {cargas.data.map((c) => (
              <li key={c.id}>
                <time dateTime={c.fecha}>{fechaCorta(c.fecha)}</time>
                <b>{porcentaje(c.porcentaje)}</b>
                {c.comentario ? <span>{c.comentario}</span> : <span className="sec">Sin comentario</span>}
              </li>
            ))}
          </ul>
        )}
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
        <button className="btn btn-pri" type="submit" aria-disabled={cargar.isPending || undefined}>
          {cargar.isPending ? 'Guardando…' : 'Guardar avance'}
        </button>
      </div>
    </Dialogo>
  )
}
