import { Fragment } from 'react'

/** Códigos del sistema: proyectos (QUI-024), solicitudes (SOL-119), lotes (L-0431), despachos (DES-0312)... */
const CODIGO = /\b([A-Z]{1,3}-\d{2,4})\b/g

/** Muestra un texto con sus códigos en Plex Mono, como en los mockups (span.mono). */
export function ConCodigos({ texto }: { texto: string }) {
  const partes = texto.split(CODIGO)
  return (
    <>
      {partes.map((p, i) =>
        i % 2 === 1 ? (
          <span key={i} className="mono codigo">
            {p}
          </span>
        ) : (
          <Fragment key={i}>{p}</Fragment>
        ),
      )}
    </>
  )
}
