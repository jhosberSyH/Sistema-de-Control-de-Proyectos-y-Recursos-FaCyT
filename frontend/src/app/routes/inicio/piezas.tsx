import type { ReactNode } from 'react'
import { ChipEstado, ChipPrioridad } from '@/components/ui/estado'
import { TIPO_ESTATUS_PROYECTO } from '@/components/ui/estados-dominio'
import { moneda, monto, porcentaje } from '@/lib/formato'
import type { ResumenProyecto } from './tipos'

/** Código del sistema en Plex Mono (span.mono del mockup). */
export function Codigo({ children }: { children: ReactNode }) {
  return <span className="mono">{children}</span>
}

/** Encabezado del inicio (.saludo): "Buenos días, Daniela" y el resumen del día, con una acción opcional. */
export function Saludo({ titulo, resumen, accion }: { titulo: string; resumen: string; accion?: ReactNode }) {
  return (
    <div className="saludo">
      <div>
        <h1>{titulo}</h1>
        <p>{resumen}</p>
      </div>
      {accion}
    </div>
  )
}

/** Barra de 8 px del mockup 02 (.barra-prog); en la tarjeta acompaña a un número visible, por eso es decorativa. */
function Barra({ valor, alto }: { valor: number; alto?: boolean }) {
  return (
    <div className={alto ? 'barra-prog alto' : 'barra-prog'} role="presentation">
      <i style={{ width: `${Math.max(0, Math.min(valor, 100))}%` }} />
    </div>
  )
}

/** Tarjeta de proyecto del coordinador (article.proy, mockup 02). La ejecución desde 80 % va en color de advertencia. */
export function TarjetaProyecto({ p }: { p: ResumenProyecto }) {
  return (
    <article className="proy">
      <div>
        <span className="cod mono">{p.codigo}</span>
        <h3>{p.nombre}</h3>
      </div>
      <div className="chips">
        <ChipEstado tipo={TIPO_ESTATUS_PROYECTO[p.estatus]}>{p.estatus}</ChipEstado>
        <ChipPrioridad prioridad={p.prioridad} />
      </div>
      <div className="metrica">
        <div className="fila">
          <span>Avance físico</span>
          <b>{p.avance === null ? 'No disponible' : porcentaje(p.avance)}</b>
        </div>
        <Barra valor={p.avance ?? 0} />
      </div>
      <div className="metrica">
        <div className="fila">
          <span>Ejecución presupuestaria</span>
          <b>{porcentaje(p.ejecucion)}</b>
        </div>
        <Barra valor={p.ejecucion} alto={p.ejecucion >= 80} />
        <span className="sec num">
          {moneda(p.gastoEjecutado)} de {monto(p.presupuesto)}
        </span>
      </div>
    </article>
  )
}
