import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { ChipEstado, ChipPrioridad } from '@/components/ui/estado'
import { TIPO_ESTATUS_PROYECTO } from '@/components/ui/estados-dominio'
import { MiniBarra } from '@/components/ui/progreso'
import { TablaDatos } from '@/components/ui/tabla'
import type { ResumenProyecto } from '../types'

type Props = {
  proyectos: ResumenProyecto[]
  /**
   * Vista del Administrador: columna de coordinador con "Asignar" si falta (F2.2). En "Mis proyectos" el
   * coordinador siempre es quien mira, así que la columna no aporta y se oculta.
   */
  esAdministrador: boolean
}

/** Tabla del mockup 06. El código lleva a la ficha del proyecto (vista 07). */
export function TablaProyectos({ proyectos, esAdministrador }: Props) {
  return (
    <TablaDatos apilable titulo="Proyectos">
      <thead>
        <tr>
          <th scope="col">Proyecto</th>
          {esAdministrador && <th scope="col">Coordinador</th>}
          <th scope="col">Estatus</th>
          <th scope="col">Prioridad</th>
          <th scope="col">Avance físico</th>
          <th scope="col">Ejecución</th>
        </tr>
      </thead>
      <tbody>
        {proyectos.map((p) => (
          <tr key={p.codigo}>
            <td>
              <div className="nom-p">
                <Link to={`/proyectos/${p.codigo}`}>
                  <b className="mono">{p.codigo}</b>
                  <small>{p.nombre}</small>
                </Link>
              </div>
            </td>
            {esAdministrador && (
              <td data-e="Coordinador:">
                {p.coordinador ? (
                  p.coordinador.nombre
                ) : (
                  <span className="sin-coord">
                    <Icono nombre="alerta" />
                    Sin coordinador{' · '}
                    <Link to={`/proyectos/${p.codigo}?asignar=coordinador`}>
                      Asignar <span className="vh">coordinador a {p.codigo}</span>
                    </Link>
                  </span>
                )}
              </td>
            )}
            <td>
              <ChipEstado tipo={TIPO_ESTATUS_PROYECTO[p.estatus]}>{p.estatus}</ChipEstado>
            </td>
            <td>
              <ChipPrioridad prioridad={p.prioridad} />
            </td>
            <td data-e="Avance físico:">
              {p.estatus === 'Propuesta' ? (
                // Todavía no se ejecuta: lo que importa es si el plan de hitos está listo (F2.4)
                <span className="sec">
                  {p.planConfirmado ? 'Plan de hitos confirmado' : 'Plan de hitos sin confirmar'}
                </span>
              ) : p.avance !== null ? (
                <MiniBarra valor={p.avance} etiqueta={`Avance físico de ${p.codigo}`} />
              ) : (
                <span className="sec">Sin plan de hitos</span>
              )}
            </td>
            <td data-e="Ejecución:">
              {p.estatus === 'Propuesta' && p.gastoEjecutado === 0 ? (
                <>
                  <span aria-hidden="true" className="sec">
                    —
                  </span>
                  <span className="vh">Sin gastos todavía</span>
                </>
              ) : (
                <MiniBarra
                  valor={p.ejecucion}
                  etiqueta={`Ejecución presupuestaria de ${p.codigo}`}
                  alto={p.ejecucion >= 80}
                />
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </TablaDatos>
  )
}
