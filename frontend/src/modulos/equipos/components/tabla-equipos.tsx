import { ChipEstado } from '@/components/ui/estado'
import { TIPO_ESTADO_EQUIPO } from '@/components/ui/estados-dominio'
import { TablaDatos } from '@/components/ui/tabla'
import { diaCorto, diaMes, hora } from '@/lib/formato'
import type { Equipo } from '../types'

type Props = {
  equipos: Equipo[]
  alMantenimiento: (e: Equipo, origen: HTMLElement) => void
  alFinMantenimiento: (e: Equipo, origen: HTMLElement) => void
  /** Equipo cuyo fin de mantenimiento se está guardando. */
  terminando: string | null
}

/** Tabla del mockup 11: equipo y código, ubicación, estado, próxima reserva y la acción de mantenimiento. */
export function TablaEquipos({ equipos, alMantenimiento, alFinMantenimiento, terminando }: Props) {
  return (
    <TablaDatos apilable titulo="Equipos">
      <thead>
        <tr>
          <th scope="col">Equipo</th>
          <th scope="col">Ubicación</th>
          <th scope="col">Estado</th>
          <th scope="col">Próxima reserva</th>
          <th scope="col">
            <span className="vh">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {equipos.map((e) => {
          const r = e.proximaReserva
          const enMantenimiento = e.estado === 'En mantenimiento'
          return (
            <tr key={e.id}>
              <td>
                <div className="eq">
                  <b>{e.nombre}</b>
                  <small className="mono">{e.codigo}</small>
                </div>
              </td>
              <td data-e="">{e.ubicacion.nombre}</td>
              <td className="estado-eq">
                <ChipEstado tipo={TIPO_ESTADO_EQUIPO[e.estado]}>{e.estado}</ChipEstado>
                {e.mantenimiento && <small>Desde el {diaMes(e.mantenimiento.desde)}</small>}
              </td>
              <td className="prox-res" data-e="Próxima:">
                {enMantenimiento ? (
                  <>
                    <span aria-hidden="true">—</span>
                    <span className="vh">No se puede reservar</span>
                  </>
                ) : r ? (
                  <>
                    {diaCorto(r.inicio)} · {hora(r.inicio)} · <span className="mono">{r.proyecto}</span>
                    {!r.aprobada && <small>por aprobar</small>}
                  </>
                ) : (
                  'Sin reservas'
                )}
              </td>
              <td className="acc-fila">
                {enMantenimiento ? (
                  <button
                    className="btn btn-pri btn-chico"
                    type="button"
                    aria-disabled={terminando === e.id || undefined}
                    onClick={(ev) => {
                      if (terminando !== e.id) alFinMantenimiento(e, ev.currentTarget)
                    }}
                  >
                    {terminando === e.id ? 'Guardando…' : 'Registrar fin del mantenimiento'}{' '}
                    <span className="vh">de {e.nombre}</span>
                  </button>
                ) : (
                  <button
                    className="btn btn-sec btn-chico"
                    type="button"
                    onClick={(ev) => alMantenimiento(e, ev.currentTarget)}
                  >
                    Pasar a mantenimiento <span className="vh">{e.nombre}</span>
                  </button>
                )}
              </td>
            </tr>
          )
        })}
      </tbody>
    </TablaDatos>
  )
}
