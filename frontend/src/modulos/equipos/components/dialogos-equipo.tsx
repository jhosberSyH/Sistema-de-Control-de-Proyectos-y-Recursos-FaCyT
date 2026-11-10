import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState, type RefObject } from 'react'
import { useForm, useWatch } from 'react-hook-form'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { AreaTexto, Campo, Entrada, Selector } from '@/components/ui/campo'
import { Dialogo, DialogoAlerta } from '@/components/ui/dialogo'
import { esApiError } from '@/lib/api-client'
import { diaCorto, hora } from '@/lib/formato'
import { usePasarAMantenimiento, useRegistrarEquipo, useReservasAfectadas } from '../api/equipos'
import { esquemaEquipo, esquemaMotivo, type DatosEquipo, type EntradaEquipo } from '../schemas/equipo'
import type { ConflictoEquipo, Equipo, Ubicacion } from '../types'

const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** "Registrar equipo" (mockup 11, F4.1): nace Disponible; el código de activo no se repite. */
export function DialogoRegistrarEquipo({
  ubicaciones,
  alCerrar,
  alRegistrar,
  focoAlCerrar,
}: {
  /** Todas las ubicaciones activas del catálogo (F1.4), incluidas las que se registren después. */
  ubicaciones: Ubicacion[]
  alCerrar: () => void
  alRegistrar: (e: Equipo) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}) {
  const registrar = useRegistrarEquipo()
  const {
    register,
    control,
    handleSubmit,
    setError,
    setFocus,
    setValue,
    formState: { errors },
  } = useForm<EntradaEquipo, unknown, DatosEquipo>({
    resolver: zodResolver(esquemaEquipo),
    defaultValues: { nombre: '', codigo: '', ubicacionId: '' },
  })
  const rNombre = register('nombre')
  const rCodigo = register('codigo')
  const rUbicacion = register('ubicacionId')
  const codigo = useWatch({ control, name: 'codigo' })

  // 409: el código ya es de otro equipo y el mensaje lo nombra (mockup 11). 422: junto a cada campo.
  const error = registrar.error
  const conflicto =
    esApiError(error) && error.status === 409
      ? (error.conflicto as ConflictoEquipo | undefined)?.equipo
      : undefined
  const enviado = registrar.variables?.codigo
  const conflictoVigente = conflicto && codigo.trim().toUpperCase() === enviado ? conflicto : undefined
  useEffect(() => {
    if (!esApiError(error)) return
    for (const [campo, mensaje] of Object.entries(error.errores)) {
      if (['nombre', 'codigo', 'ubicacionId'].includes(campo)) {
        setError(campo as keyof EntradaEquipo, { message: mensaje }, { shouldFocus: true })
      }
    }
  }, [error, setError])
  useEffect(() => {
    if (conflicto) setFocus('codigo')
  }, [conflicto, setFocus])
  const errorGeneral =
    error && !conflicto && !(esApiError(error) && error.status === 422) ? error.message : null

  const enviar = handleSubmit((d) => {
    if (registrar.isPending) return
    registrar.mutate(d, { onSuccess: alRegistrar })
  })

  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo="Registrar equipo"
      descripcion="Nace en estado Disponible."
      alEnviar={enviar}
      focoAlCerrar={focoAlCerrar}
    >
      <div className="form-rejilla">
        <Campo className="ancho" etiqueta="Nombre" id="e-nom" error={errors.nombre?.message}>
          {(c) => <Entrada {...c} autoComplete="off" {...rNombre} />}
        </Campo>
        <Campo
          etiqueta="Código de activo"
          id="e-cod"
          error={
            conflictoVigente ? (
              <>
                Ese código ya es del {/* Cierra el diálogo y deja la lista filtrada en ese equipo */}
                <Link to={`/equipos?q=${encodeURIComponent(enviado ?? '')}`} onClick={alCerrar}>
                  {minuscula(conflictoVigente.nombre)}
                </Link>
                . Revisa la placa del equipo.
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
              placeholder="UC-FACYT-0000"
              {...rCodigo}
              onBlur={(e) => {
                setValue('codigo', e.target.value.trim().toUpperCase())
                void rCodigo.onBlur(e)
              }}
            />
          )}
        </Campo>
        <Campo etiqueta="Ubicación" id="e-ub" error={errors.ubicacionId?.message}>
          {(c) => (
            <Selector {...c} {...rUbicacion}>
              <option value="" disabled>
                Elige la ubicación
              </option>
              {ubicaciones.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </Selector>
          )}
        </Campo>
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
          {registrar.isPending ? 'Registrando…' : 'Registrar equipo'}
        </button>
      </div>
    </Dialogo>
  )
}

/**
 * "Pasar a mantenimiento" (mockup 11, F4.2): antes de confirmar, lista las reservas pendientes o aprobadas
 * que todavía no terminan (se cancelan) y pide el motivo que reciben sus coordinadores (HU-12).
 */
export function DialogoMantenimiento({
  equipo,
  alCerrar,
  alListo,
  focoAlCerrar,
}: {
  equipo: Equipo
  alCerrar: () => void
  alListo: (r: { avisados: number; reservas: number }) => void
  focoAlCerrar?: RefObject<HTMLElement | null>
}) {
  const afectadas = useReservasAfectadas(equipo.id)
  const pasar = usePasarAMantenimiento(equipo.id)
  const [motivo, setMotivo] = useState('')
  const [error, setError] = useState<string | null>(null)
  const hay = (afectadas.data?.length ?? 0) > 0
  const errorServidor =
    esApiError(pasar.error) && pasar.error.status === 422 ? pasar.error.errores.motivo : null

  const confirmar = () => {
    if (pasar.isPending) return
    const r = esquemaMotivo.safeParse(motivo)
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? 'Escribe el motivo.')
      document.getElementById('m-mot')?.focus()
      return
    }
    pasar.mutate(r.data, { onSuccess: alListo })
  }

  return (
    <DialogoAlerta
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo="Pasar a mantenimiento"
      descripcion={
        <>
          {equipo.nombre} · <span className="mono">{equipo.codigo}</span>
        </>
      }
      confirmar={
        pasar.isPending ? 'Guardando…' : hay ? 'Pasar a mantenimiento y avisar' : 'Pasar a mantenimiento'
      }
      ocupado={pasar.isPending || afectadas.isPending}
      alConfirmar={confirmar}
      focoAlCerrar={focoAlCerrar}
    >
      {afectadas.isPending ? (
        <p className="sec">Buscando sus próximas reservas…</p>
      ) : afectadas.isError ? (
        <Aviso tipo="err">
          <p>No pudimos traer sus reservas. {afectadas.error.message}</p>
        </Aviso>
      ) : hay ? (
        <>
          <p>
            Mientras esté en mantenimiento nadie podrá reservarlo. Estas reservas se cancelan y avisaremos a
            sus coordinadores:
          </p>
          <ul className="afect">
            {afectadas.data.map((r) => (
              <li key={r.id}>
                <div>
                  {diaCorto(r.inicio)} · {hora(r.inicio)} a {hora(r.fin)}
                  <small>{r.coordinador}</small>
                </div>
                <span className="mono">{r.proyecto}</span>
              </li>
            ))}
          </ul>
        </>
      ) : (
        <p>Mientras esté en mantenimiento nadie podrá reservarlo. No tiene reservas próximas.</p>
      )}
      <Campo
        etiqueta={
          <>
            Motivo{' '}
            <span className="obligatorio">({hay ? 'se incluye en el aviso' : 'queda en el historial'})</span>
          </>
        }
        id="m-mot"
        error={error ?? errorServidor ?? undefined}
      >
        {(c) => (
          <AreaTexto
            {...c}
            maxLength={300}
            value={motivo}
            onChange={(e) => {
              setMotivo(e.target.value)
              setError(null)
            }}
          />
        )}
      </Campo>
      {pasar.isError && !errorServidor && (
        <Aviso tipo="err">
          <p>{pasar.error.message}</p>
        </Aviso>
      )}
    </DialogoAlerta>
  )
}
