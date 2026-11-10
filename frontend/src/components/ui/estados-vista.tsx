import { useEffect, useState, type ReactNode } from 'react'
import { Icono, type NombreIcono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { cn } from '@/lib/utils'

type PropsVacio = {
  titulo: string
  children?: ReactNode
  icono?: NombreIcono
  accion?: ReactNode
  className?: string
}

/** Estado vacío (.vacio, mockup 10): explica por qué no hay datos y qué hacer. */
export function EstadoVacio({ titulo, children, icono = 'info', accion, className }: PropsVacio) {
  return (
    <div className={cn('vacio', className)}>
      <Icono nombre={icono} />
      <h2>{titulo}</h2>
      {children && <p className="sec">{children}</p>}
      {accion}
    </div>
  )
}

/** Línea gris con la forma del contenido que va a aparecer. */
export function Esqueleto({
  className,
  ancho,
  alto,
}: {
  className?: string
  ancho?: number | string
  alto?: number
}) {
  return (
    <span className={cn('esqueleto esqueleto-linea', className)} style={{ width: ancho, height: alto }} />
  )
}

/**
 * Zona que está cargando. Los esqueletos solo aparecen si la respuesta tarda más de ~300 ms,
 * para no parpadear en respuestas rápidas (plan_frontend.md §7.1).
 */
export function Cargando({ children, etiqueta = 'Cargando…' }: { children?: ReactNode; etiqueta?: string }) {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = window.setTimeout(() => setVisible(true), 300)
    return () => window.clearTimeout(t)
  }, [])
  return (
    <div aria-busy="true" style={{ display: 'grid', gap: 12 }}>
      <span className="vh" role="status">
        {etiqueta}
      </span>
      {visible &&
        (children ?? (
          <>
            <Esqueleto className="esqueleto-titulo" />
            <Esqueleto ancho="90%" />
            <Esqueleto ancho="75%" />
            <Esqueleto ancho="82%" />
          </>
        ))}
    </div>
  )
}

/** Error al cargar datos: dice qué pasó en lenguaje claro y ofrece reintentar (H9). */
export function ErrorCarga({ mensaje, alReintentar }: { mensaje: string; alReintentar?: () => void }) {
  return (
    <Aviso tipo="err">
      <p>{mensaje}</p>
      {alReintentar && (
        <p>
          <button
            className="btn btn-txt"
            type="button"
            onClick={alReintentar}
            style={{ paddingInline: 0, minHeight: 32 }}
          >
            Reintentar
          </button>
        </p>
      )}
    </Aviso>
  )
}
