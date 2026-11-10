import { Link } from 'react-router'
import { ChipEstado } from '@/components/ui/estado'
import { TablaDatos } from '@/components/ui/tabla'
import { fechaCorta } from '@/lib/formato'
import { cn } from '@/lib/utils'
import type { ResumenInsumo } from '../types'
import { cantidad } from '../utils/cantidad'

type Props = {
  insumos: ResumenInsumo[]
  /** Días de anticipación de la alerta de vencimiento (F1.5). */
  anticipacion: number
  /**
   * El Coordinador solo consulta: el nombre no abre la ficha (es del Aprobador y el Administrador) y
   * cada fila lleva "Pedir retiro", que abre la vista 14 con el insumo ya elegido (plan §7.1).
   */
  soloConsulta: boolean
}

function Estado({ i }: { i: ResumenInsumo }) {
  if (i.estado === 'bajo') return <ChipEstado tipo="err">Bajo el mínimo</ChipEstado>
  if (i.estado === 'vencido') {
    return (
      <ChipEstado tipo="err">
        {i.vencidos} {i.vencidos === 1 ? 'lote vencido' : 'lotes vencidos'}
      </ChipEstado>
    )
  }
  if (i.estado === 'vence') {
    return (
      <ChipEstado tipo="warn">
        {i.porVencer === 1 ? 'Lote próximo a vencer' : `${i.porVencer} lotes próximos a vencer`}
      </ChipEstado>
    )
  }
  return <ChipEstado tipo="ok">Al día</ChipEstado>
}

/** HU-10: los días que faltan para los lotes dentro de la anticipación, o que ya venció. */
function Vencimiento({ i, anticipacion }: { i: ResumenInsumo; anticipacion: number }) {
  const v = i.proximoVencimiento
  if (!v) {
    return (
      <>
        <span aria-hidden="true">—</span>
        <span className="vh">No vence</span>
      </>
    )
  }
  const falta =
    v.dias < 0
      ? 'vencido'
      : v.dias <= anticipacion
        ? v.dias === 0
          ? 'vence hoy'
          : v.dias === 1
            ? 'vence mañana'
            : `en ${v.dias} días`
        : null
  return (
    <>
      {fechaCorta(v.fecha)}
      {falta && <small className={cn(v.dias < 0 && 'err')}>{falta}</small>}
    </>
  )
}

/** Tabla del mockup 09: insumo y tipo, stock con su mínimo, lotes, próximo vencimiento y estado. */
export function TablaInsumos({ insumos, anticipacion, soloConsulta }: Props) {
  return (
    <TablaDatos apilable titulo="Catálogo de insumos">
      <thead>
        <tr>
          <th scope="col">Insumo</th>
          <th scope="col">Stock y mínimo</th>
          <th scope="col" className="n">
            Lotes
          </th>
          <th scope="col">Próximo vencimiento</th>
          <th scope="col">Estado</th>
          {soloConsulta && (
            <th scope="col">
              <span className="vh">Acción</span>
            </th>
          )}
        </tr>
      </thead>
      <tbody>
        {insumos.map((i) => {
          const bajo = i.stock < i.stockMinimo
          // Como el mockup: la barra se llena con el doble del mínimo
          const lleno = i.stockMinimo > 0 ? Math.min((i.stock / (i.stockMinimo * 2)) * 100, 100) : 100
          return (
            <tr key={i.id}>
              <td>
                <div className="ins">
                  <b>{soloConsulta ? i.nombre : <Link to={`/inventario/${i.id}`}>{i.nombre}</Link>}</b>
                  <span className="tipo">{i.tipo}</span>
                </div>
              </td>
              <td>
                <div className="stock">
                  <div className="t">
                    <b>{cantidad(i.stock, i.unidad)}</b>
                    <span className="sec">mín. {cantidad(i.stockMinimo, i.unidad)}</span>
                  </div>
                  <div className="barra-prog" aria-hidden="true">
                    <i className={bajo ? 'bajo' : undefined} style={{ width: `${lleno}%` }} />
                  </div>
                </div>
              </td>
              <td className="n" data-e="Lotes:">
                {i.lotes}
              </td>
              <td className="venc" data-e="Vence:">
                <Vencimiento i={i} anticipacion={anticipacion} />
              </td>
              <td>
                <Estado i={i} />
              </td>
              {soloConsulta && (
                <td className="acc-fila">
                  {i.stock > 0 ? (
                    <Link to={`/solicitudes?nueva=retiro&insumo=${i.id}`}>
                      Pedir retiro <span className="vh">de {i.nombre}</span>
                    </Link>
                  ) : (
                    <span className="sec">Sin existencias</span>
                  )}
                </td>
              )}
            </tr>
          )
        })}
      </tbody>
    </TablaDatos>
  )
}
