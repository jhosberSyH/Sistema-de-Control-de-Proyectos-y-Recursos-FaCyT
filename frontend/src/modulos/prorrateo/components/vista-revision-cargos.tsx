import { useEffect, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { diaMes, elDia, fechaCorta, fechaIso, moneda, nombreMes } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useCargosCierre, useConfirmarCargos } from '../api/cierre'
import type { CargosCierre } from '../types'
import { cuandoFrase, nombrePeriodo } from '../utils/periodo'
import './cierre.css'

/** "−US$ 25,60" para las correcciones: el signo va delante del símbolo, como en el mockup. */
const monto = (n: number) => (n < 0 ? `−${moneda(-n)}` : moneda(n))

function Estado({ p }: { p: CargosCierre['proyectos'][number] }) {
  if (p.estado === 'confirmado') {
    const hoy = p.confirmadoEl && fechaIso(p.confirmadoEl) === fechaIso()
    return (
      <ChipEstado tipo="ok">{hoy ? 'Confirmado hoy' : `Confirmado el ${diaMes(p.confirmadoEl!)}`}</ChipEstado>
    )
  }
  if (p.estado === 'correccion') return <ChipEstado tipo="warn">Corrección pendiente</ChipEstado>
  return <ChipEstado tipo="warn">Por confirmar</ChipEstado>
}

/**
 * Vista 21: el coordinador revisa los cargos de sus proyectos en el período antes del cierre y los
 * confirma (F7.1). Un despacho mal cargado se corrige desde la bitácora (F6.5).
 */
export function VistaRevisionCargos() {
  const [params, setParams] = useSearchParams()
  const datos = useCargosCierre(params.get('proyecto') ?? '')
  const confirmar = useConfirmarCargos()
  const [confirmadoAhora, setConfirmadoAhora] = useState<string | null>(null)
  const refOk = useRef<HTMLElement>(null)
  useTituloPagina('Revisión de cargos')

  useEffect(() => {
    if (confirmadoAhora) refOk.current?.focus()
  }, [confirmadoAhora])

  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando tus cargos…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
  const d = datos.data

  const migas = (
    <nav aria-label="Ruta de navegación">
      <ol className="migas">
        <li>
          <Link to="/inicio">Inicio</Link>
        </li>
        <li aria-current="page">Cierre de período</li>
      </ol>
    </nav>
  )
  if (!d.periodo || d.proyectos.length === 0) {
    return (
      <div className="vista-cargos">
        <div className="cab">
          <div>
            {migas}
            <h1>Revisión de cargos</h1>
          </div>
        </div>
        <EstadoVacio
          icono="prorrateo"
          titulo={d.periodo ? 'Tus proyectos no tienen cargos que revisar' : 'No hay un período en revisión'}
        >
          Cuando el aprobador abra la revisión del período, te llegará un aviso con los cargos de tus
          proyectos.
        </EstadoVacio>
      </div>
    )
  }

  const per = d.periodo
  const p = d.proyectos.find((x) => x.id === d.proyectoId)!
  const confirmado = p.estado === 'confirmado'
  const terminado = per.fin < fechaIso()

  return (
    <div className="vista-cargos">
      <div className="cab">
        <div>
          {migas}
          <h1>Cargos de {nombrePeriodo(per)}</h1>
          <p className="sub">
            Revisa lo que se cargó a tus proyectos del {diaMes(per.inicio)} al {diaMes(per.fin)}.{' '}
            {d.cierra ?? 'El aprobador'} cierra el período{' '}
            {terminado ? 'en cuanto confirmen todos' : elDia(per.fin)}; después ya no se pueden corregir.
          </p>
        </div>
      </div>

      <div className="selector" role="group" aria-label="Proyecto">
        {d.proyectos.map((x) => (
          <button
            key={x.id}
            type="button"
            className="tarjeta"
            aria-pressed={x.id === p.id}
            onClick={() => {
              setConfirmadoAhora(null)
              setParams({ proyecto: x.id }, { replace: true })
            }}
          >
            <b>{x.codigo}</b>
            <span>
              <Estado p={x} />
            </span>
            <span className="sec" style={{ fontSize: 14 }}>
              {x.cargos} {x.cargos === 1 ? 'cargo' : 'cargos'} · {moneda(x.monto)}
            </span>
          </button>
        ))}
      </div>

      {confirmado && (
        <section className="tarjeta confirmado" role="status" tabIndex={-1} ref={refOk}>
          <Icono nombre="ok" />
          <div>
            <h2 style={{ fontSize: 19 }}>
              Confirmaste los cargos de <span className="mono">{p.codigo}</span>
            </h2>
            <p className="sec">
              {p.confirmadoEl ? cuandoFrase(p.confirmadoEl) : ''}. {d.cierra ?? 'El aprobador'} ya lo ve en su
              tablero de cierre.
            </p>
          </div>
        </section>
      )}

      <section className="tarjeta cargos" aria-labelledby="t-c">
        <div className="cab-c">
          <h2 id="t-c" style={{ fontSize: 18 }}>
            Cargos de <span className="mono">{p.codigo}</span>
          </h2>
          <span className="sec" style={{ fontSize: 14 }}>
            Los gastos compartidos se reparten después del cierre y no entran en esta revisión.
          </span>
        </div>
        {d.cargos.length === 0 ? (
          <EstadoVacio icono="prorrateo" titulo="Sin cargos en este período">
            No hubo gastos ni despachos para {p.codigo}.
          </EstadoVacio>
        ) : (
          <TablaDatos apilable titulo={`Cargos de ${p.codigo}`}>
            <thead>
              <tr>
                <th scope="col">Fecha</th>
                <th scope="col">Concepto</th>
                <th scope="col">Origen</th>
                <th scope="col" className="n">
                  Monto
                </th>
                <th scope="col">
                  <span className="vh">Acción</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {d.cargos.map((c) => {
                const correccion = c.monto < 0
                return (
                  <tr key={c.id} className={cn(correccion && 'neg')}>
                    <td>{fechaCorta(c.fecha)}</td>
                    <td>{c.concepto}</td>
                    <td data-e="Origen:">
                      {c.referencia ? <span className="mono">{c.referencia}</span> : '—'}{' '}
                      {c.tipo === 'despacho' ? 'despacho' : 'gasto'}
                    </td>
                    <td className="n" data-e="Monto:">
                      {monto(c.monto)}
                    </td>
                    <td className="acc-fila">
                      {correccion ? (
                        <span className="sec" style={{ fontSize: 13.5 }}>
                          Corrección aprobada
                        </span>
                      ) : !confirmado && c.tipo === 'despacho' && c.referencia ? (
                        <BotonEnlace
                          variante="txt"
                          chico
                          to={`/proyectos/bitacora?despacho=${c.referencia}&corregir=1`}
                        >
                          Pedir corrección <span className="vh">de {c.referencia}</span>
                        </BotonEnlace>
                      ) : null}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </TablaDatos>
        )}
        <div className="total">
          <span>{per.tipo === 'mensual' ? `Total de ${nombreMes(per.inicio)}` : 'Total del trimestre'}</span>
          <b>{moneda(p.monto)}</b>
        </div>
      </section>

      {!confirmado && (
        <>
          {p.correcciones.length > 0 && (
            <Aviso tipo="warn">
              <p>
                <span className="mono">{p.correcciones.join(', ')}</span>{' '}
                {p.correcciones.length === 1 ? 'espera' : 'esperan'} la decisión del aprobador. Cuando la
                decida, podrás confirmar los cargos.
              </p>
            </Aviso>
          )}
          {confirmar.isError && (
            <Aviso tipo="err">
              <p>{confirmar.error.message}</p>
            </Aviso>
          )}
          <div className="acc-form">
            <button
              className="btn btn-pri"
              type="button"
              disabled={p.correcciones.length > 0}
              aria-disabled={confirmar.isPending || undefined}
              onClick={async () => {
                if (confirmar.isPending) return
                try {
                  await confirmar.mutateAsync(p.id)
                  setConfirmadoAhora(p.codigo)
                } catch {
                  // El aviso de error se muestra arriba del botón
                }
              }}
            >
              {confirmar.isPending
                ? 'Confirmando…'
                : `Confirmar ${p.cargos === 1 ? 'el cargo' : `los ${p.cargos} cargos`} de ${p.codigo}`}
            </button>
          </div>
        </>
      )}
    </div>
  )
}
