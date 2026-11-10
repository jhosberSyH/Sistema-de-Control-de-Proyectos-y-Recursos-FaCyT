import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { Icono } from '@/components/icono'
import { Aviso, type TipoAviso } from '@/components/ui/aviso'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { Bloque } from '@/components/ui/tarjeta'
import { esApiError } from '@/lib/api-client'
import { fechaCorta } from '@/lib/formato'
import { useGuardarParametros, useParametros } from '../api/catalogos'
import { esquemaParametros, PARAMETROS, type DatosParametros } from '../schemas/catalogos'
import type { ClaveParametro, Parametro } from '../types'

const CLAVES = Object.keys(PARAMETROS) as ClaveParametro[]

const comoTexto = (items: Parametro[]) =>
  Object.fromEntries(
    CLAVES.map((c) => [c, String(items.find((p) => p.clave === c)?.valor ?? '')]),
  ) as DatosParametros

/** Parámetros generales (mockup 05, columna derecha; F1.5). */
export function BloqueParametros() {
  const parametros = useParametros()
  return (
    <Bloque titulo="Parámetros generales">
      {parametros.isPending ? (
        <Cargando etiqueta="Cargando los parámetros…">
          <Esqueleto alto={44} ancho="60%" />
          <Esqueleto ancho="90%" />
          <Esqueleto alto={44} ancho="60%" />
        </Cargando>
      ) : parametros.isError ? (
        <ErrorCarga mensaje={parametros.error.message} alReintentar={() => parametros.refetch()} />
      ) : (
        <FormularioParametros parametros={parametros.data} />
      )}
    </Bloque>
  )
}

function FormularioParametros({ parametros }: { parametros: Parametro[] }) {
  const guardar = useGuardarParametros()
  const [resultado, setResultado] = useState<{ tipo: TipoAviso; textos: string[] } | null>(null)
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, dirtyFields },
  } = useForm<DatosParametros>({
    resolver: zodResolver(esquemaParametros),
    defaultValues: comoTexto(parametros),
  })
  const registros = Object.fromEntries(CLAVES.map((c) => [c, register(c)])) as Record<
    ClaveParametro,
    ReturnType<typeof register>
  >

  // Errores 422 del servidor junto a cada parámetro.
  useEffect(() => {
    if (!esApiError(guardar.error)) return
    for (const [clave, mensaje] of Object.entries(guardar.error.errores)) {
      if (CLAVES.includes(clave as ClaveParametro)) {
        setError(clave as ClaveParametro, { message: mensaje }, { shouldFocus: true })
      }
    }
  }, [guardar.error, setError])

  const enviar = handleSubmit((datos) => {
    if (guardar.isPending) return
    const cambiados = CLAVES.filter((c) => dirtyFields[c] && Number(datos[c]) !== valorDe(parametros, c))
    if (cambiados.length === 0) {
      setResultado({ tipo: 'info', textos: ['No cambiaste ningún valor.'] })
      return
    }
    const valores = Object.fromEntries(cambiados.map((c) => [c, Number(datos[c])]))
    guardar.mutate(valores, {
      onSuccess: (items) => {
        reset(comoTexto(items))
        // El valor nuevo aplica desde este momento (F1.5): se dice qué cambia.
        setResultado({
          tipo: 'ok',
          textos: [
            'Guardaste los parámetros.',
            ...cambiados.map((c) => PARAMETROS[c].aplicado(Number(datos[c]))),
          ],
        })
      },
    })
  })

  return (
    <form noValidate aria-label="Parámetros generales" style={{ display: 'grid', gap: 4 }} onSubmit={enviar}>
      {CLAVES.map((clave) => {
        const def = PARAMETROS[clave]
        const p = parametros.find((x) => x.clave === clave)
        const error = errors[clave]?.message
        const id = `p-${clave}`
        return (
          <div key={clave} className={error ? 'param campo error' : 'param campo'}>
            <label htmlFor={id}>{def.etiqueta}</label>
            <div className="fila">
              <input
                className="entrada"
                id={id}
                inputMode="numeric"
                autoComplete="off"
                aria-invalid={error ? true : undefined}
                aria-describedby={[error && `${id}-err`, `${id}-a`].filter(Boolean).join(' ')}
                {...registros[clave]}
              />
              <span className="unidad">{def.unidad}</span>
            </div>
            <span className="ayuda" id={`${id}-a`}>
              {def.ayuda}
            </span>
            {error && (
              <p className="msg-error" id={`${id}-err`}>
                <Icono nombre="error" />
                <span>{error}</span>
              </p>
            )}
            <p className="hist">
              <Icono nombre="auditoria" />
              <span>
                {p?.ultimoCambio
                  ? `${p.ultimoCambio.usuario} lo cambió de ${p.ultimoCambio.anterior} a ${p.ultimoCambio.nuevo} el ${fechaCorta(p.ultimoCambio.fecha)}.`
                  : 'Valor inicial del sistema.'}
              </span>
            </p>
          </div>
        )
      })}

      {resultado && (
        <Aviso tipo={resultado.tipo}>
          {resultado.textos.map((t) => (
            <p key={t}>{t}</p>
          ))}
        </Aviso>
      )}
      {guardar.isError && !(esApiError(guardar.error) && guardar.error.status === 422) && (
        <Aviso tipo="err">
          <p>{guardar.error.message}</p>
        </Aviso>
      )}

      <div className="acc-form">
        <button
          className="btn btn-sec"
          type="button"
          onClick={() => {
            reset(comoTexto(parametros))
            setResultado(null)
          }}
        >
          Descartar cambios
        </button>
        <button className="btn btn-pri" type="submit" aria-disabled={guardar.isPending || undefined}>
          {guardar.isPending ? 'Guardando…' : 'Guardar parámetros'}
        </button>
      </div>
    </form>
  )
}

function valorDe(parametros: Parametro[], clave: ClaveParametro) {
  return parametros.find((p) => p.clave === clave)?.valor
}
