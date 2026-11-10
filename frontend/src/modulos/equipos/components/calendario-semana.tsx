import type { MouseEvent } from 'react'
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
  /** Clic en un horario vacío: llena la fecha y la hora del formulario (atajo con el mouse; el formulario es la vía con teclado). */
  alElegir?: (fecha: string, minutos: number) => void
}

/**
 * Calendario semanal del mockup 12: de lunes a sábado, de 07:00 a 18:00, con lo ocupado antes de pedir.
 * En el teléfono se ve como agenda por día (mockup, @container 760 px).
 */
export function CalendarioSemana({ semana, bloques, alElegir }: Props) {
  const hoy = fechaIso()
  const dias = Array.from({ length: DIAS }, (_, i) => sumarDias(semana, i))
  const corto = (f: string) => {
    const [nombre, fecha] = diaYFecha(f).split(' ')
    return { nombre: mayuscula(nombre.slice(0, 3)), numero: fecha.slice(0, 2) }
  }
  const elegir = (fecha: string) => (e: MouseEvent<HTMLDivElement>) => {
    if (!alElegir || e.target !== e.currentTarget) return
    const y = e.clientY - e.currentTarget.getBoundingClientRect().top
    const minutos = APERTURA + Math.floor(y / PX_HORA) * 60
    if (minutos >= APERTURA && minutos < CIERRE) alElegir(fecha, minutos)
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
              onClick={elegir(f)}
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
