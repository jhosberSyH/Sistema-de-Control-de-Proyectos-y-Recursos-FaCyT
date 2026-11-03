import type { MouseEvent } from 'react'
import { ChipEstado } from '@/components/ui/estado'
import { TablaDatos } from '@/components/ui/tabla'
import { momentoRelativo } from '@/lib/formato'
import type { Cuenta } from '../types'
import { RolChip } from './rol-chip'

type Props = {
  cuentas: Cuenta[]
  alEditar: (cuenta: Cuenta, e: MouseEvent<HTMLButtonElement>) => void
  alReactivar: (cuenta: Cuenta, e: MouseEvent<HTMLButtonElement>) => void
}

/** Tabla del mockup 04: en el teléfono cada fila pasa a tarjeta con sus etiquetas (data-e). */
export function TablaCuentas({ cuentas, alEditar, alReactivar }: Props) {
  return (
    <TablaDatos apilable titulo="Cuentas de usuario">
      <thead>
        <tr>
          <th scope="col">Persona</th>
          <th scope="col">Rol</th>
          <th scope="col">Proyectos que coordina</th>
          <th scope="col">Último acceso</th>
          <th scope="col">Estado</th>
          <th scope="col">
            <span className="vh">Acciones</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {cuentas.map((c) => (
          <tr key={c.id}>
            <td>
              <div className="persona">
                <span className="avatar" aria-hidden="true">
                  {c.iniciales}
                </span>
                <div>
                  <b>
                    {c.nombre}
                    {c.esPropia && <span className="sec"> (tú)</span>}
                  </b>
                  <small className="mono">{c.correo}</small>
                </div>
              </div>
            </td>
            <td data-e="Rol:">
              <RolChip rol={c.rol} />
            </td>
            <td data-e="Coordina:">
              {c.proyectos.length === 0 ? (
                <>
                  <span aria-hidden="true">—</span>
                  <span className="vh">Ninguno</span>
                </>
              ) : (
                c.proyectos.map((p, i) => (
                  <span key={p}>
                    {i > 0 && ', '}
                    <span className="mono">{p}</span>
                  </span>
                ))
              )}
            </td>
            <td data-e="Último acceso:">
              {c.ultimoAcceso ? momentoRelativo(c.ultimoAcceso) : 'Todavía no entra'}
            </td>
            <td>
              {c.activo ? (
                <ChipEstado tipo="ok">Activa</ChipEstado>
              ) : (
                <ChipEstado tipo="neutro">Desactivada</ChipEstado>
              )}
              {c.activo && c.debeCambiarClave && <span className="chip-nota">Con contraseña temporal</span>}
            </td>
            <td className="acc-fila">
              {c.activo ? (
                <button className="btn btn-sec btn-chico" type="button" onClick={(e) => alEditar(c, e)}>
                  Editar <span className="vh">la cuenta de {c.nombre}</span>
                </button>
              ) : (
                <button className="btn btn-sec btn-chico" type="button" onClick={(e) => alReactivar(c, e)}>
                  Reactivar <span className="vh">la cuenta de {c.nombre}</span>
                </button>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TablaDatos>
  )
}
