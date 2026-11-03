import { useState, type ReactNode } from 'react'
import { Icono } from '@/components/icono'
import { ChipEstado } from '@/components/ui/estado'
import { DialogoAlerta } from '@/components/ui/dialogo'
import { Aviso } from '@/components/ui/aviso'
import { fechaCorta, hora, leerMonto } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useAprobarReposicion, useDescartarReposicion } from '../api/insumos'
import type { FichaInsumo, ReposicionInsumo } from '../types'
import { cantidad, mesLargo } from '../utils/cantidad'

type Props = {
  insumo: FichaInsumo
  reposicion: ReposicionInsumo
  /** Solo el Aprobador decide; el Administrador la ve sin botones. */
  puedeDecidir: boolean
  alResultado: (texto: ReactNode) => void
}

/** Qué pasaría con esa cantidad, frente al pronóstico y al mínimo (mockup 10). */
function efecto(i: FichaInsumo, reponer: number) {
  const queda = i.stock + reponer
  const base = `Con ${cantidad(reponer, i.unidad)} quedarías en ${cantidad(queda, i.unidad)}.`
  const p = i.pronostico
  if (p.valor === null) {
    return `${base} ${queda >= i.stockMinimo ? 'Quedarías sobre' : 'Seguirías bajo'} el mínimo de ${cantidad(i.stockMinimo, i.unidad)}.`
  }
  const despues = queda - p.valor
  const alcance =
    despues >= i.stockMinimo
      ? 'alcanzaría para el mes con margen sobre el mínimo'
      : despues >= 0
        ? `alcanzaría para el mes, pero terminaría bajo el mínimo de ${cantidad(i.stockMinimo, i.unidad)}`
        : 'no alcanzaría para el consumo pronosticado'
  return `${base} El pronóstico de ${mesLargo(p.mes)} es ${cantidad(p.valor, i.unidad)}, así que ${alcance}.`
}

/**
 * Reposición automática del insumo (mockup 10, F3.5). El Aprobador la decide en un paso: aprueba con la
 * cantidad que corrija, o la descarta. Una ya aprobada se muestra hasta que llegue la recepción.
 */
export function BloqueReposicion({ insumo: i, reposicion: r, puedeDecidir, alResultado }: Props) {
  const aprobar = useAprobarReposicion(r.id)
  const descartar = useDescartarReposicion(r.id)
  const [texto, setTexto] = useState(r.cantidad !== null ? String(r.cantidad).replace('.', ',') : '')
  const [errorCantidad, setErrorCantidad] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const valor = leerMonto(texto)
  const ocupado = aprobar.isPending || descartar.isPending

  if (r.estado === 'Aprobado') {
    return (
      <section className="tarjeta repo aprobada" aria-labelledby="t-repo">
        <div style={{ display: 'grid', gap: 4 }}>
          <ChipEstado tipo="ok">Reposición aprobada</ChipEstado>
          <h2 id="t-repo" style={{ fontSize: 20 }}>
            <span className="mono">{r.id}</span> aprobada
          </h2>
          <p className="sec">
            {r.decididaPor ?? 'El aprobador'} la aprobó el {fechaCorta(r.fecha)}
            {r.cantidad !== null && ` por ${cantidad(r.cantidad, i.unidad)}`}. Se cierra cuando se registre la
            recepción del lote.
          </p>
        </div>
      </section>
    )
  }

  const enviar = () => {
    if (ocupado) return
    if (valor === null || valor <= 0) {
      setErrorCantidad('Escribe una cantidad mayor que cero.')
      document.getElementById('cant')?.focus()
      return
    }
    aprobar.mutate(valor, {
      onSuccess: (x) =>
        alResultado(
          <p>
            Aprobaste <span className="mono">{x.id}</span> por {cantidad(x.cantidad, i.unidad)}. Quedó
            registrado su paso por Pendiente de Aprobación, y se cierra cuando se registre la recepción.
          </p>,
        ),
    })
  }

  const error = aprobar.error ?? descartar.error
  return (
    <section className="tarjeta repo" aria-labelledby="t-repo">
      <div className="fila">
        <div style={{ display: 'grid', gap: 4 }}>
          <ChipEstado tipo="info">Reposición automática</ChipEstado>
          <h2 id="t-repo" style={{ fontSize: 20 }}>
            <span className="mono">{r.id}</span> en{' '}
            {r.estado === 'Borrador' ? 'Borrador' : 'Pendiente de Aprobación'}
          </h2>
          <p className="sec">
            El sistema la creó el {fechaCorta(r.fecha)} a las {hora(r.fecha)}, cuando el stock bajó de{' '}
            {cantidad(i.stockMinimo, i.unidad)}. No se compra nada hasta que{' '}
            {puedeDecidir ? 'la apruebes' : 'la apruebe el aprobador'}.
          </p>
        </div>
        {puedeDecidir ? (
          <div className="cant">
            <div className={cn('campo', errorCantidad && 'error')}>
              <label htmlFor="cant">Cantidad a reponer</label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  className="entrada num"
                  id="cant"
                  inputMode="decimal"
                  autoComplete="off"
                  value={texto}
                  aria-invalid={errorCantidad ? true : undefined}
                  aria-describedby={errorCantidad ? 'cant-error' : undefined}
                  onChange={(e) => {
                    setTexto(e.target.value)
                    setErrorCantidad(null)
                  }}
                />
                <span className="sec" aria-hidden="true">
                  {i.unidad}
                </span>
              </div>
              {errorCantidad && (
                <p className="msg-error" id="cant-error">
                  <Icono nombre="error" />
                  <span>{errorCantidad}</span>
                </p>
              )}
            </div>
          </div>
        ) : (
          r.cantidad !== null && (
            <p>
              Cantidad sugerida: <b>{cantidad(r.cantidad, i.unidad)}</b>
            </p>
          )
        )}
      </div>
      {valor !== null && valor > 0 && (
        <p style={{ fontSize: 15 }} aria-live="polite">
          {efecto(i, valor)}
        </p>
      )}
      {error && (
        <Aviso tipo="err">
          <p>{error.message}</p>
        </Aviso>
      )}
      {puedeDecidir ? (
        <div className="acc-form" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-pri" type="button" aria-disabled={ocupado || undefined} onClick={enviar}>
            {aprobar.isPending ? 'Aprobando…' : 'Aprobar reposición'}
          </button>
          <button
            className="btn btn-sec"
            type="button"
            aria-disabled={ocupado || undefined}
            onClick={() => {
              if (!ocupado) setConfirmando(true)
            }}
          >
            Descartar
          </button>
          <span className="sec" style={{ fontSize: 14, alignSelf: 'center' }}>
            Al aprobar, queda registrado su paso por Pendiente de Aprobación.
          </span>
        </div>
      ) : (
        <p className="sec" style={{ fontSize: 14 }}>
          La decide el aprobador, desde aquí o desde su bandeja.
        </p>
      )}

      <DialogoAlerta
        abierto={confirmando}
        alCambiar={setConfirmando}
        titulo={`¿Descartar ${r.id}?`}
        descripcion={`No se compra nada y ${i.nombre} sigue con la alerta de stock bajo. Se creará otra reposición cuando su stock vuelva a cambiar y siga bajo el mínimo.`}
        confirmar="Descartar reposición"
        peligro
        ocupado={descartar.isPending}
        alConfirmar={() =>
          descartar.mutate(undefined, {
            onSuccess: () => {
              setConfirmando(false)
              alResultado(
                <p>
                  Descartaste <span className="mono">{r.id}</span>. No se compra nada y la alerta de stock
                  bajo sigue visible.
                </p>,
              )
            },
          })
        }
      />
    </section>
  )
}
