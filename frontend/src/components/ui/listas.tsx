import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { Icono, type NombreIcono } from '@/components/icono'

export type TipoPendiente = 'ok' | 'warn' | 'err' | 'info'

export type Pendiente = {
  id: string
  tipo: TipoPendiente
  icono: NombreIcono
  titulo: ReactNode
  detalle?: ReactNode
  /** Botón de la derecha: lleva al detalle (L8). */
  accion?: { texto: string; a: string; primaria?: boolean }
}

/** Lista de pendientes (ul.pend): ícono en caja de color, título, detalle y acción. */
export function ListaPendientes({ items }: { items: Pendiente[] }) {
  return (
    <ul className="pend">
      {items.map((p) => (
        <li key={p.id}>
          <span className={`ic ${p.tipo}`}>
            <Icono nombre={p.icono} />
          </span>
          <div>
            <div className="tit">{p.titulo}</div>
            {p.detalle && <div className="det">{p.detalle}</div>}
          </div>
          {p.accion && (
            <Link className={p.accion.primaria ? 'btn btn-pri' : 'btn btn-sec'} to={p.accion.a}>
              {p.accion.texto}
            </Link>
          )}
        </li>
      ))}
    </ul>
  )
}

export type ElementoLista = { id: string; principal: ReactNode; secundario?: ReactNode; derecha?: ReactNode }

/** Lista simple (ul.lista): texto con una línea secundaria y un elemento a la derecha. */
export function Lista({ items }: { items: ElementoLista[] }) {
  return (
    <ul className="lista">
      {items.map((e) => (
        <li key={e.id}>
          <div className="izq">
            {e.principal}
            {e.secundario && <small>{e.secundario}</small>}
          </div>
          {e.derecha}
        </li>
      ))}
    </ul>
  )
}

/** Lista de datos clave-valor (dl.kv), como en el detalle de la bandeja y de la auditoría. */
export function ListaClaveValor({ datos }: { datos: { clave: ReactNode; valor: ReactNode }[] }) {
  return (
    <dl className="kv">
      {datos.map((d, i) => (
        <div key={i} style={{ display: 'contents' }}>
          <dt>{d.clave}</dt>
          <dd>{d.valor}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Contador del inicio (.cont): número grande en primario con su etiqueta; lleva a la lista filtrada (L8). */
export function Contador({ valor, etiqueta, a }: { valor: ReactNode; etiqueta: string; a: string }) {
  return (
    <Link className="tarjeta cont" to={a}>
      {/* El espacio separa el número de la etiqueta al leerlo ("2 despachos"); la rejilla no lo pinta */}
      <b>{valor}</b> <span>{etiqueta}</span>
    </Link>
  )
}
