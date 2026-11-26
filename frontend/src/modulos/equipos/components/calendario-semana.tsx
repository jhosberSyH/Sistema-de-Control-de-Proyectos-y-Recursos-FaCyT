import { useState, type PointerEvent } from 'react'
import { Link } from 'react-router'
import { diaYFecha, fechaIso, mayuscula } from '@/lib/formato'
import { APERTURA, CIERRE, horaDe, sumarDias } from '@/lib/horarios'
import { cn } from '@/lib/utils'
import type { Bloque } from '../utils/reservas'

const PX_HORA = 48
const DIAS = 6
const HORAS = [8, 9, 10, 11, 12, 13, 14, 15, 16, 17]

type Props = {
  semana: string
  bloques: Bloque[]
  /** Clic elige una hora; arrastrar selecciona un bloque de varias horas. */
  alElegir?: (fecha: string, desde: number, hasta: number) => void
}

/**
 * Calendario semanal del mockup 12: de lunes a sábado, de 07:00 a 18:00, con lo ocupado antes de pedir.
 * En el teléfono se ve como agenda por día (mockup, @container 760 px).
 */
export function CalendarioSemana({ semana, bloques, alElegir }: Props) {
  const [seleccion, setSeleccion] = useState<{ fecha: string; ancla: number; inicio: number; fin: number } | null>(null)
  const hoy = fechaIso()
  const dias = Array.from({ length: DIAS }, (_, i) => sumarDias(semana, i))
  const corto = (f: string) => {
    const [nombre, fecha] = diaYFecha(f).split(' ')
    return { nombre: mayuscula(nombre.slice(0, 3)), numero: fecha.slice(0, 2) }
  }
  const minutoEn = (e: PointerEvent<HTMLDivElement>) => {
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    return Math.max(APERTURA, Math.min(CIERRE, APERTURA + Math.floor(y / PX_HORA) * 60))
  }
  const iniciarSeleccion = (fecha: string) => (e: PointerEvent<HTMLDivElement>) => {
    if (!alElegir || e.target !== e.currentTarget || e.button !== 0) return
    const inicio = minutoEn(e)
    if (inicio >= CIERRE) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setSeleccion({ fecha, ancla: inicio, inicio, fin: inicio + 60 })
  }
  const actualizarSeleccion = (fecha: string) => (e: PointerEvent<HTMLDivElement>) => {
    if (!seleccion || seleccion.fecha !== fecha) return
    const cursor = minutoEn(e)
    const inicio = Math.min(seleccion.ancla, cursor)
    const fin = cursor >= seleccion.ancla ? Math.max(seleccion.ancla + 60, cursor) : seleccion.ancla + 60
    setSeleccion({ ...seleccion, inicio, fin: Math.min(CIERRE, fin) })
  }
  const terminarSeleccion = (fecha: string) => (e: PointerEvent<HTMLDivElement>) => {
    if (!seleccion || seleccion.fecha !== fecha) return
    const cursor = minutoEn(e)
    const inicio = Math.min(seleccion.ancla, cursor)
    const fin = Math.min(CIERRE, cursor >= seleccion.ancla ? Math.max(seleccion.ancla + 60, cursor) : seleccion.ancla + 60)
    alElegir?.(fecha, inicio, Math.max(inicio + 60, fin))
    setSeleccion(null)
  }

  return (
    <>
      <div className="cal-env">
        <div className="cal">
          <div />
          {dias.map((f) => {
            const d = corto(f)
            return (
              <div key={f} className={cn('dia', f === hoy && 'hoy')}>
                {d.nombre}
                <b>{d.numero}</b>
              </div>
            )
          })}
          <div className="horas" aria-hidden="true">
            {HORAS.map((h) => (
              <span key={h} style={{ top: (h * 60 - APERTURA) * (PX_HORA / 60) }}>
                {horaDe(h * 60)}
              </span>
            ))}
          </div>
          {dias.map((f) => (
            <div
              key={f}
              className={cn('col', alElegir && 'elegible')}
              role="group"
              aria-label={mayuscula(diaYFecha(f))}
              onPointerDown={iniciarSeleccion(f)}
              onPointerMove={actualizarSeleccion(f)}
              onPointerUp={terminarSeleccion(f)}
              onPointerCancel={() => setSeleccion(null)}
            >
              {bloques
                .filter((b) => b.fecha === f)
                .map((b) => {
                  const desde = Math.max(b.desde, APERTURA)
                  const hasta = Math.min(b.hasta, CIERRE)
                  const contenido = (
                    <>
                      <b className={b.clase === 'libre' || b.clase === 'nuevo' ? undefined : 'mono'}>
                        {b.titulo}
                      </b>
                      {horaDe(b.desde)} a {horaDe(b.hasta)}
                      <br />
                      {b.estado}
                    </>
                  )
                  return (
                    <div
                      key={b.clave}
                      className={cn('blq', b.clase, b.resaltada && 'resaltada')}
                      style={{
                        top: ((desde - APERTURA) / 60) * PX_HORA + 2,
                        height: ((hasta - desde) / 60) * PX_HORA - 4,
                      }}
                    >
                      {b.enlace ? <Link to={b.enlace}>{contenido}</Link> : contenido}
                    </div>
                  )
                })}
              {seleccion?.fecha === f && (
                <div
                  className="blq seleccion-calendario"
                  aria-hidden="true"
                  style={{
                    top: ((seleccion.inicio - APERTURA) / 60) * PX_HORA + 2,
                    height: ((seleccion.fin - seleccion.inicio) / 60) * PX_HORA - 4,
                  }}
                >
                  {horaDe(seleccion.inicio)} a {horaDe(seleccion.fin)}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Teléfono: agenda por día, solo los días con algo */}
      <div className="agenda">
        {dias.filter((f) => bloques.some((b) => b.fecha === f)).length === 0 && (
          <p className="vacia">Esta semana el equipo no tiene reservas.</p>
        )}
        {dias
          .filter((f) => bloques.some((b) => b.fecha === f))
          .map((f) => (
            <div key={f} style={{ display: 'grid', gap: 8 }}>
              <p className="d">{mayuscula(diaYFecha(f))}</p>
              {bloques
                .filter((b) => b.fecha === f)
                .sort((a, b) => a.desde - b.desde)
                .map((b) => (
                  <div key={b.clave} className={cn('it', b.clase)}>
                    <div>
                      {horaDe(b.desde)} a {horaDe(b.hasta)}
                      <small>{b.estado}</small>
                    </div>
                    {(b.clase === 'otro' || b.clase === 'mio' || b.clase === 'pend') && (
                      <span className="mono">{b.titulo}</span>
                    )}
                  </div>
                ))}
            </div>
          ))}
      </div>
    </>
  )
}
