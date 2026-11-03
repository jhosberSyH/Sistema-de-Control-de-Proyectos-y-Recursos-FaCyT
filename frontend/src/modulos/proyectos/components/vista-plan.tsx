import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto } from '@/components/ui/estados-vista'
import { MiniBarra } from '@/components/ui/progreso'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { fechaCorta, porcentaje } from '@/lib/formato'
import { usePlan } from '../api/proyectos'
import type { HitoPlan, PlanProyecto } from '../types'
import { DialogoAvance } from './dialogo-avance'
import { EditorPlan } from './editor-plan'
import { ErrorProyecto } from './error-proyecto'
import './plan.css'

type Props = { codigo: string }

/**
 * Vista 08: plan de hitos y avance (F2.4, F2.5, F2.6), solo para el coordinador del proyecto (RN-07).
 * Sin plan confirmado se arma el plan; con el plan confirmado se carga el avance de cada hito, y
 * "?modo=editar" vuelve al editor para cambiar los hitos.
 */
export function VistaPlan({ codigo }: Props) {
  const plan = usePlan(codigo)
  const [params, setParams] = useSearchParams()
  const [resultado, setResultado] = useState<{ texto: ReactNode; enfocar: boolean } | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  // Al guardar el plan, el aviso recibe el foco: el editor puede desaparecer (al confirmar) y el aviso
  // queda arriba, fuera de la vista. Al cargar un avance el foco vuelve al botón que abrió el diálogo.
  useLayoutEffect(() => {
    if (resultado?.enfocar) refResultado.current?.focus()
  }, [resultado])
  const avisar = (texto: ReactNode, enfocar = true) => setResultado(texto ? { texto, enfocar } : null)

  const finalizado = plan.data?.estatus === 'Finalizado'
  const editando = !plan.data?.planConfirmado || (params.get('modo') === 'editar' && !finalizado)
  useTituloPagina(editando ? 'Plan de hitos' : 'Hitos')

  if (plan.isPending) {
    return (
      <Cargando etiqueta={`Cargando el plan de ${codigo}…`}>
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto ancho="60%" />
        <Esqueleto alto={320} />
      </Cargando>
    )
  }
  if (plan.isError) {
    return (
      <ErrorProyecto
        codigo={codigo}
        error={plan.error}
        esAdministrador={false}
        alReintentar={() => plan.refetch()}
      />
    )
  }

  const p = plan.data
  const salirDelEditor = () =>
    setParams(
      (actual) => {
        actual.delete('modo')
        return actual
      },
      { replace: true },
    )

  const aviso = resultado && (
    <div ref={refResultado} tabIndex={-1} style={{ outline: 'none' }}>
      <Aviso tipo="ok">{resultado.texto}</Aviso>
    </div>
  )

  return (
    <div className="vista-plan-hitos">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/proyectos">Mis proyectos</Link>
              </li>
              <li className="mono">
                <Link to={`/proyectos/${p.codigo}`}>{p.codigo}</Link>
              </li>
              <li aria-current="page">{editando ? 'Plan de hitos' : 'Hitos'}</li>
            </ol>
          </nav>
          <h1>
            {editando ? 'Plan de hitos de' : 'Hitos de'} <span className="mono">{p.codigo}</span>
          </h1>
          <p className="sub">
            {!editando
              ? `${p.nombre} · avance físico ${porcentaje(p.avance ?? 0)}.`
              : p.planConfirmado
                ? `${p.nombre}. Los pesos tienen que seguir sumando 100 %: el avance físico se recalcula con los pesos nuevos.`
                : `${p.nombre}. Los pesos tienen que sumar 100 % para confirmar el plan y calcular el avance físico.`}
          </p>
        </div>
        {!editando && !finalizado && (
          <div className="acc">
            <BotonEnlace to="?modo=editar">Editar plan</BotonEnlace>
          </div>
        )}
      </div>

      {aviso}

      {editando ? (
        <EditorPlan
          key={p.planConfirmado ? 'editar' : 'armar'}
          plan={p}
          alCancelar={salirDelEditor}
          alGuardar={(r, borrador) => {
            if (borrador) {
              const suma = r.hitos.reduce((t, h) => t + h.peso, 0)
              avisar(
                <p>
                  Guardaste el borrador del plan. Los pesos suman {porcentaje(suma)} de 100 %: el avance
                  físico sigue como "No disponible" hasta que confirmes el plan.
                </p>,
              )
            } else if (!p.planConfirmado) {
              avisar(
                <>
                  <p>
                    <b>Confirmaste el plan de hitos de {r.codigo}.</b>
                  </p>
                  <p>
                    El avance físico empieza en {porcentaje(r.avance ?? 0)} y ya puedes cargar el avance de
                    cada hito.
                    {r.estatus === 'Propuesta' &&
                      ' El administrador ya puede pasar el proyecto a En ejecución.'}
                  </p>
                </>,
              )
            } else {
              salirDelEditor()
              avisar(
                <p>
                  Guardaste los cambios del plan. El avance físico de {r.codigo} es{' '}
                  {porcentaje(r.avance ?? 0)}.
                </p>,
              )
            }
          }}
        />
      ) : (
        <TablaAvance
          plan={p}
          finalizado={finalizado}
          alResultado={(texto) => avisar(texto, false)}
          refResultado={refResultado}
        />
      )}
    </div>
  )
}

/** Modo "Cargar avance" del mockup 08: cada hito con su avance y su última carga (F2.5). */
function TablaAvance({
  plan,
  finalizado,
  alResultado,
  refResultado,
}: {
  plan: PlanProyecto
  finalizado: boolean
  alResultado: (r: ReactNode) => void
  refResultado: RefObject<HTMLDivElement | null>
}) {
  const [abierto, setAbierto] = useState<HitoPlan | null>(null)
  const proximo = plan.hitos.find((h) => h.avance < 100)

  return (
    <>
      {finalizado && (
        <Aviso tipo="info" rol="none">
          <p>{plan.codigo} está finalizado: su avance ya no cambia.</p>
        </Aviso>
      )}
      <section className="tarjeta bloque">
        <TablaDatos apilable titulo={`Hitos de ${plan.codigo}`}>
          <thead>
            <tr>
              <th scope="col">Hito</th>
              <th scope="col" className="n">
                Peso
              </th>
              <th scope="col">Avance</th>
              <th scope="col">Última carga</th>
              <th scope="col">
                <span className="vh">Acción</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {plan.hitos.map((h) => (
              <tr key={h.id}>
                <td>
                  {h.numero}. {h.nombre}
                </td>
                <td className="n" data-e="Peso:">
                  {porcentaje(h.peso)}
                </td>
                <td>
                  <MiniBarra valor={h.avance} etiqueta={`Avance del hito ${h.numero}`} />
                </td>
                <td data-e="Última carga:">
                  {h.ultimaCarga ? (
                    fechaCorta(h.ultimaCarga)
                  ) : (
                    <>
                      <span aria-hidden="true">—</span>
                      <span className="vh">Sin cargas</span>
                    </>
                  )}
                </td>
                <td className="acc-fila">
                  {h.avance >= 100 ? (
                    <ChipEstado tipo="ok">Completo</ChipEstado>
                  ) : (
                    !finalizado && (
                      <button
                        className={h.id === proximo?.id ? 'btn btn-pri btn-chico' : 'btn btn-sec btn-chico'}
                        type="button"
                        onClick={() => {
                          alResultado(null)
                          setAbierto(h)
                        }}
                      >
                        Cargar avance <span className="vh">del hito {h.numero}</span>
                      </button>
                    )
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </TablaDatos>
      </section>

      {abierto && (
        <DialogoAvance
          plan={plan}
          hito={abierto}
          alCerrar={() => setAbierto(null)}
          focoAlCerrar={refResultado}
          alListo={(r) => {
            setAbierto(null)
            const cambio =
              r.antes === r.despues
                ? `El avance físico de ${plan.codigo} se mantiene en ${porcentaje(r.despues ?? 0)}.`
                : `El avance físico de ${plan.codigo} pasó de ${porcentaje(r.antes ?? 0)} a ${porcentaje(r.despues ?? 0)}.`
            alResultado(
              <p>
                {r.completo
                  ? `El hito ${r.hito} quedó completo.`
                  : `Guardaste ${porcentaje(r.porcentaje)} en el hito ${r.hito}.`}{' '}
                {cambio}
              </p>,
            )
          }}
        />
      )}
    </>
  )
}
