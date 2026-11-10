import { useEffect, useRef, useState } from 'react'
import type { ComponentProps, ReactNode } from 'react'
import { cn } from '@/lib/utils'

type PropsTabla = ComponentProps<'table'> & {
  /** Título de la tabla para lectores de pantalla y, si es visible, sobre la tabla. */
  titulo?: ReactNode
  tituloVisible?: boolean
  /** En el teléfono cada fila se vuelve una tarjeta; cada <td data-e="Etiqueta"> muestra su etiqueta. */
  apilable?: boolean
}

/**
 * Contenedor con desplazamiento horizontal de una tabla (.tabla-env). Cuando la tabla no cabe, se vuelve
 * una región con foco y con el nombre de la tabla para llegar a las columnas ocultas con el teclado (WCAG 2.1.1).
 */
export function EnvTabla({ children, ...props }: ComponentProps<'div'>) {
  const ref = useRef<HTMLDivElement>(null)
  const [nombre, setNombre] = useState<string | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const desborda = el.scrollWidth > el.clientWidth + 1
      const titulo = el.querySelector('caption')?.textContent?.trim()
      setNombre(desborda ? titulo || 'Tabla de datos' : null)
    }
    medir()
    if (typeof ResizeObserver === 'undefined') return
    const obs = new ResizeObserver(medir)
    obs.observe(el)
    if (el.firstElementChild) obs.observe(el.firstElementChild)
    return () => obs.disconnect()
  }, [])
  return (
    <div
      ref={ref}
      className="tabla-env"
      {...(nombre ? { tabIndex: 0, role: 'region', 'aria-label': nombre } : {})}
      {...props}
    >
      {children}
    </div>
  )
}

/**
 * Tabla de datos (table.datos): cabecera en mono mayúscula, columnas numéricas con la clase "n"
 * y acciones con "acc-fila". Va dentro de un contenedor con desplazamiento horizontal.
 */
export function TablaDatos({ titulo, tituloVisible, apilable, className, children, ...props }: PropsTabla) {
  return (
    <EnvTabla>
      <table className={cn('datos', apilable && 'apilable', className)} {...props}>
        {titulo && <caption className={tituloVisible ? undefined : 'vh'}>{titulo}</caption>}
        {children}
      </table>
    </EnvTabla>
  )
}

type PropsPaginacion = {
  pagina: number
  paginas: number
  alCambiar: (pagina: number) => void
  /** Texto del conteo a la izquierda, como "8 de 14 cuentas activas". */
  resumen: ReactNode
}

/** Hasta 7 páginas, todas; con más, la primera, la última y las vecinas de la actual, con "…" entre medio. */
function numeros(pagina: number, paginas: number): (number | string)[] {
  if (paginas <= 7) return Array.from({ length: paginas }, (_, i) => i + 1)
  const visibles = [...new Set([1, pagina - 1, pagina, pagina + 1, paginas])]
    .filter((n) => n >= 1 && n <= paginas)
    .sort((a, b) => a - b)
  return visibles.flatMap((n, i) => (i > 0 && n - visibles[i - 1] > 1 ? [`…${n}`, n] : [n]))
}

/** Paginación del mockup (.paginacion): conteo a la izquierda y números de página a la derecha. */
export function Paginacion({ pagina, paginas, alCambiar, resumen }: PropsPaginacion) {
  return (
    <div className="paginacion">
      <span>{resumen}</span>
      {paginas > 1 && (
        <nav aria-label="Páginas">
          <div className="pags">
            {numeros(pagina, paginas).map((n) =>
              typeof n === 'string' ? (
                <span key={n} className="salto" aria-hidden="true">
                  …
                </span>
              ) : (
                <button
                  key={n}
                  type="button"
                  aria-current={n === pagina ? 'page' : undefined}
                  aria-label={`Página ${n}`}
                  onClick={() => alCambiar(n)}
                >
                  {n}
                </button>
              ),
            )}
          </div>
        </nav>
      )}
    </div>
  )
}
