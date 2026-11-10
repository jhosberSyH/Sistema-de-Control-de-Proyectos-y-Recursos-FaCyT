import type { ReactNode } from 'react'
import { Link } from 'react-router'

export type Miga = { texto: string; a?: string }

type Props = {
  titulo: ReactNode
  subtitulo?: ReactNode
  /** Ruta de migas en mono mayúscula; la última es la página actual. */
  migas?: Miga[]
  /** Botones a la derecha del título. */
  acciones?: ReactNode
}

/** Encabezado de las vistas internas (.cab): migas, h1, subtítulo y acciones. */
export function EncabezadoPagina({ titulo, subtitulo, migas, acciones }: Props) {
  return (
    <div className="cab">
      <div>
        {migas && migas.length > 0 && (
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              {migas.map((m, i) => (
                <li key={`${m.texto}-${i}`} aria-current={i === migas.length - 1 ? 'page' : undefined}>
                  {m.a ? <Link to={m.a}>{m.texto}</Link> : m.texto}
                </li>
              ))}
            </ol>
          </nav>
        )}
        <h1>{titulo}</h1>
        {subtitulo && <p className="sub">{subtitulo}</p>}
      </div>
      {acciones && <div className="acc">{acciones}</div>}
    </div>
  )
}
