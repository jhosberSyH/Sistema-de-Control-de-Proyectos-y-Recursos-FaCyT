import { Popover } from 'radix-ui'
import { useState } from 'react'
import { Link } from 'react-router'
import { Icono, type NombreIcono } from '@/components/icono'
import { ConCodigos } from '@/components/ui/con-codigos'
import type { AvisoUsuario, TipoAvisoUsuario } from '@/hooks/use-avisos'
import { momentoRelativo } from '@/lib/formato'

const ICONO: Record<TipoAvisoUsuario, NombreIcono> = { ok: 'ok', warn: 'reloj', err: 'error', info: 'info' }

type Props = {
  avisos: AvisoUsuario[] | undefined
  cargando: boolean
  alAbrirAviso: (aviso: AvisoUsuario) => void
  alMarcarTodos: () => void
}

/**
 * Campana de la barra superior con su panel (no estaba dibujado; plan §7.1).
 * Cada aviso lleva al elemento, ya filtrado (L8), y se marca como leído al abrirlo.
 */
export function PanelAvisos({ avisos, cargando, alAbrirAviso, alMarcarTodos }: Props) {
  const [abierto, setAbierto] = useState(false)
  const sinLeer = avisos?.filter((a) => !a.leido).length ?? 0
  const etiqueta = sinLeer === 0 ? 'Avisos, ninguno sin leer' : `Avisos, ${sinLeer} sin leer`

  return (
    <Popover.Root open={abierto} onOpenChange={setAbierto}>
      <Popover.Trigger asChild>
        <button className="icono-btn" type="button" aria-label={etiqueta}>
          <Icono nombre="campana" />
          {sinLeer > 0 && (
            <span className="punto" aria-hidden="true">
              {sinLeer}
            </span>
          )}
        </button>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content
          className="flotante panel-avisos"
          align="end"
          sideOffset={8}
          collisionPadding={8}
          aria-label="Avisos"
        >
          <div className="bloque-cab">
            <h2>Avisos</h2>
            {sinLeer > 0 && (
              <button className="btn btn-txt btn-chico" type="button" onClick={alMarcarTodos}>
                Marcar todos como leídos
              </button>
            )}
          </div>
          {cargando && <p className="vacio-avisos">Cargando avisos…</p>}
          {!cargando && (avisos?.length ?? 0) === 0 && (
            <p className="vacio-avisos">
              No tienes avisos. Aquí aparecen las decisiones y asignaciones que te tocan.
            </p>
          )}
          {avisos && avisos.length > 0 && (
            <ul className="pend">
              {avisos.map((a) => (
                <li key={a.id} className={a.leido ? 'leido' : undefined}>
                  <span className={`ic ${a.tipo}`}>
                    <Icono nombre={ICONO[a.tipo]} />
                  </span>
                  <div>
                    <Link
                      className="tit"
                      to={a.enlace}
                      onClick={() => {
                        alAbrirAviso(a)
                        setAbierto(false)
                      }}
                    >
                      {!a.leido && <span className="vh">Sin leer: </span>}
                      <ConCodigos texto={a.titulo} />
                    </Link>
                    {a.detalle && (
                      <div className="det">
                        <ConCodigos texto={a.detalle} />
                      </div>
                    )}
                    <div className="cuando">{momentoRelativo(a.fecha)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  )
}
