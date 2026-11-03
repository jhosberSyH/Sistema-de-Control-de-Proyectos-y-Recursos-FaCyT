import { Dialog } from 'radix-ui'
import { useRef, type RefObject } from 'react'
import { Link } from 'react-router'
import isotipoFacyt from '@/assets/logos/facyt-isotipo.png'
import { Icono } from '@/components/icono'
import type { ItemNavegacion } from './tipos'

type Props = {
  abierto: boolean
  alCambiar: (abierto: boolean) => void
  navegacion: ItemNavegacion[]
  activo?: string
  /** La hamburguesa: al cerrar sin navegar, el foco vuelve a ella (WCAG 2.4.3). */
  disparador: RefObject<HTMLButtonElement | null>
}

/**
 * Menú del teléfono (no estaba dibujado; plan §7.1). Repite los ítems, íconos y contadores del riel
 * (H6). Radix atrapa el foco y cierra con Escape. Al cerrar, el foco vuelve a la hamburguesa; si se
 * eligió un destino, se queda en el contenido de la página nueva (lo enfoca app-layout).
 */
export function CajonMovil({ abierto, alCambiar, navegacion, activo, disparador }: Props) {
  const navego = useRef(false)
  return (
    <Dialog.Root open={abierto} onOpenChange={alCambiar}>
      <Dialog.Portal>
        <Dialog.Overlay className="cajon-capa" />
        <Dialog.Content
          className="cajon"
          aria-describedby={undefined}
          onOpenAutoFocus={() => {
            navego.current = false
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault()
            if (!navego.current) disparador.current?.focus()
          }}
        >
          <div className="cajon-cab">
            <img src={isotipoFacyt} alt="" width={38} height={38} />
            <div>
              <Dialog.Title asChild>
                <strong>Control de Proyectos</strong>
              </Dialog.Title>
              <span>FaCyT · UC</span>
            </div>
            <Dialog.Close asChild>
              <button className="icono-btn" type="button" aria-label="Cerrar menú">
                <Icono nombre="cerrar" />
              </button>
            </Dialog.Close>
          </div>
          <nav aria-label="Navegación principal">
            <ul>
              {navegacion.map((n) => (
                <li key={n.clave}>
                  <Link
                    className="item"
                    to={n.ruta}
                    aria-current={n.clave === activo ? 'page' : undefined}
                    onClick={() => {
                      navego.current = true
                      alCambiar(false)
                    }}
                  >
                    <Icono nombre={n.icono} />
                    <span>{n.etiqueta}</span>
                    {n.contador ? (
                      <span className="cuenta">
                        <span aria-hidden="true">{n.contador}</span>
                        <span className="vh">
                          {` (${n.detalleContador ?? `${n.contador} ${n.contador === 1 ? 'pendiente' : 'pendientes'}`})`}
                        </span>
                      </span>
                    ) : null}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  )
}
