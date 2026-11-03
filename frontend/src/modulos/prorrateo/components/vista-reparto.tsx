import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Boton, BotonEnlace } from '@/components/ui/boton'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { EnvTabla } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { diaMes, fechaCorta, moneda, nombreMes, porcentajeFijo } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useAplicarReparto, useDescargarResumen, useReparto } from '../api/reparto'
import type { CriterioReparto, Reparto, RepartoAplicado } from '../types'
import { nombrePeriodo, tituloPeriodo } from '../utils/periodo'
import './cierre.css'

const CRITERIO: Record<CriterioReparto, string> = {
  consumo: 'según el consumo',
  iguales: 'en partes iguales',
}

/** "de octubre" o "del trimestre del 01/07/2026 al 30/09/2026", para el título. */
const delPeriodo = (p: { tipo: string; inicio: string; fin: string }) =>
  p.tipo === 'mensual' ? `de ${nombreMes(p.inicio)}` : `del ${nombrePeriodo(p).replace(/^el /, '')}`

/** "Guantes de nitrilo talla M, papel absorbente y alcohol isopropílico" */
function enumerar(nombres: string[]) {
  const n = nombres.map((x, i) => (i === 0 ? x : x.charAt(0).toLowerCase() + x.slice(1)))
  return n.length > 1 ? `${n.slice(0, -1).join(', ')} y ${n[n.length - 1]}` : (n[0] ?? '')
}

/**
 * Vista 23: reparto de los gastos compartidos (F7.3, F7.4). Los dos criterios se calculan a la vez y se
 * muestran lado a lado; el aprobador elige uno y lo aplica en un solo paso. Un período ya repartido no
 * se vuelve a repartir.
 */
export function VistaReparto() {
  const datos = useReparto()
  const [aplicado, setAplicado] = useState<{ r: RepartoAplicado; d: Reparto } | null>(null)
  useTituloPagina('Reparto de gastos compartidos')

  if (aplicado) return <Cuerpo d={aplicado.d} aplicado={aplicado.r} />
  if (datos.isPending) {
    return (
      <Cargando etiqueta="Calculando el reparto…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={110} />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
  const d = datos.data
  if (!d.periodo) return <SinPeriodo d={d} />
  return <Cuerpo d={d} alAplicar={(r) => setAplicado({ r, d })} />
}

function Migas({ actual }: { actual: string }) {
  return (
    <nav aria-label="Ruta de navegación">
      <ol className="migas">
        <li>
          <Link to="/gastos-compartidos/cierre">Gastos compartidos</Link>
        </li>
        <li aria-current="page">{actual}</li>
      </ol>
    </nav>
  )
}

/** Sin un período cerrado que repartir: el último reparto y el camino al cierre. */
function SinPeriodo({ d }: { d: Reparto }) {
  const descargar = useDescargarResumen()
  const u = d.ultimo
  return (
    <div className="vista-reparto">
      <div className="cab">
        <div>
          <Migas actual="Reparto" />
          <h1>Reparto de gastos compartidos</h1>
        </div>
      </div>
      <EstadoVacio
        icono="prorrateo"
        titulo="No hay gastos compartidos por repartir"
        accion={
          <div className="acc-form" style={{ justifyContent: 'center' }}>
            {u && (
              <Boton
                aria-disabled={descargar.isPending || undefined}
                onClick={() => !descargar.isPending && descargar.mutate(u.periodo.id)}
              >
                <Icono nombre="descarga" />
                {descargar.isPending ? 'Preparando el PDF…' : `Resumen de ${nombrePeriodo(u.periodo)} en PDF`}
              </Boton>
            )}
            <BotonEnlace variante="pri" to="/gastos-compartidos/cierre">
              Ir al cierre de período
            </BotonEnlace>
          </div>
        }
      >
        Se reparten cuando cierras un período.
        {u &&
          ` El último, el de ${nombrePeriodo(u.periodo)}, se aplicó ${CRITERIO[u.criterio]} el ${diaMes(u.aplicadoEl)} por ${u.aplicadoPor}.`}
      </EstadoVacio>
      {descargar.isError && (
        <Aviso tipo="err">
          <p>{descargar.error.message}</p>
        </Aviso>
      )}
    </div>
  )
}

function Cuerpo({
  d,
  aplicado,
  alAplicar,
}: {
  d: Reparto
  aplicado?: RepartoAplicado
  alAplicar?: (r: RepartoAplicado) => void
}) {
  const p = d.periodo!
  const gastos = d.gastos!
  const n = d.filas.length
  const excluidos = d.excluidos
  return (
    <div className="vista-reparto">
      <div className="cab">
        <div>
          <Migas actual={tituloPeriodo(p)} />
          <h1>Reparto de los gastos compartidos {delPeriodo(p)}</h1>
          <p className="sub">
            Período cerrado el {fechaCorta(p.cerradoEl ?? p.fin)}. Los consumibles de uso general se compran
            para toda la facultad y su costo se reparte entre los {n} proyectos activos.
            {excluidos.length > 0 && (
              <>
                {' '}
                {excluidos.map((c, i) => (
                  <span key={c}>
                    {i > 0 && (i === excluidos.length - 1 ? ' y ' : ', ')}
                    <span className="mono">{c}</span>
                  </span>
                ))}{' '}
                {excluidos.length === 1
                  ? 'estuvo Suspendido y no participa.'
                  : 'estuvieron Suspendidos y no participan.'}
              </>
            )}
          </p>
        </div>
      </div>

      <div className="base">
        <div className="tarjeta">
          <span>Gastos compartidos del período</span>
          <b>{moneda(gastos.total)}</b>
          <span>
            {gastos.lotes > 0
              ? `${enumerar(gastos.insumos)} (${gastos.lotes} ${gastos.lotes === 1 ? 'lote' : 'lotes'})`
              : 'No se recibieron consumibles de uso general'}
          </span>
        </div>
        <div className="tarjeta">
          <span>Consumo total de los proyectos activos</span>
          <b>{moneda(d.consumoTotal)}</b>
          <span>Materia prima e insumos despachados</span>
        </div>
        <div className="tarjeta">
          <span>Proyectos activos</span>
          <b>{n}</b>
          <span>En ejecución durante el período</span>
        </div>
      </div>

      {aplicado ? <Hecho d={d} r={aplicado} /> : <Comparacion d={d} alAplicar={alAplicar!} />}
    </div>
  )
}

/** Tarjeta "Aplicado" del mockup: el reparto ya entró al gasto de cada proyecto. */
function Hecho({ d, r }: { d: Reparto; r: RepartoAplicado }) {
  const descargar = useDescargarResumen()
  const ref = useRef<HTMLElement>(null)
  useEffect(() => ref.current?.focus(), [])
  return (
    <section className="tarjeta hecho" role="status" tabIndex={-1} ref={ref}>
      <h2 style={{ fontSize: 20 }}>Reparto {CRITERIO[r.criterio]} aplicado</h2>
      <p>
        Cada monto entró al gasto ejecutado de su proyecto y avisamos a los coordinadores. Los gastos
        compartidos {delPeriodo(d.periodo!)} ya no se pueden repartir otra vez.
      </p>
      {descargar.isError && (
        <Aviso tipo="err">
          <p>{descargar.error.message}</p>
        </Aviso>
      )}
      <div className="acc-form" style={{ justifyContent: 'flex-start' }}>
        <Boton
          aria-disabled={descargar.isPending || undefined}
          onClick={() => !descargar.isPending && descargar.mutate(r.periodoId)}
        >
          <Icono nombre="descarga" />
          {descargar.isPending ? 'Preparando el PDF…' : 'Descargar resumen en PDF'}
        </Boton>
        <BotonEnlace variante="txt" to="/gastos-compartidos/cierre">
          Abrir la revisión del siguiente período
        </BotonEnlace>
      </div>
    </section>
  )
}

/** Los dos repartos lado a lado: se elige uno con el botón de su columna y se aplica (mockup 23). */
function Comparacion({ d, alAplicar }: { d: Reparto; alAplicar: (r: RepartoAplicado) => void }) {
  const sinConsumo = d.consumoTotal <= 0
  const [elegido, setElegido] = useState<CriterioReparto>(sinConsumo ? 'iguales' : 'consumo')
  const aplicar = useAplicarReparto()
  const total = d.gastos!.total
  const prop = elegido === 'consumo'
  const sp = prop && 'sel'
  const se = !prop && 'sel'
  const maximo = Math.max(...d.filas.map((f) => f.segunConsumo ?? 0), 0.01)
  const resto = d.residuo ? d.residuo[elegido] : 0
  const menor = d.filas[0]?.proyecto

  const opcion = (valor: CriterioReparto, texto: string) => (
    <button
      type="button"
      className="opcion"
      role="radio"
      aria-checked={elegido === valor}
      aria-disabled={(valor === 'consumo' && sinConsumo) || undefined}
      onClick={() => {
        if (valor === 'consumo' && sinConsumo) return
        setElegido(valor)
        aplicar.reset()
      }}
    >
      <span className="punto" aria-hidden="true" />
      {texto}
    </button>
  )

  return (
    <section className="tarjeta comparacion" aria-labelledby="t-comp">
      <div className="bloque-cab" style={{ padding: '18px 18px 0' }}>
        <h2 id="t-comp">Los dos repartos, lado a lado</h2>
        <span className="conteo">Elige uno</span>
      </div>
      <EnvTabla>
        <table className="datos">
          <caption className="vh">Reparto de {moneda(total)} entre los proyectos activos</caption>
          <thead>
            <tr>
              <th scope="col" rowSpan={2}>
                Proyecto
              </th>
              <th scope="col" rowSpan={2} className="n">
                Consumo
              </th>
              <th scope="colgroup" colSpan={2} className={cn('grupo', sp)}>
                {opcion('consumo', 'Según el consumo de cada proyecto')}
              </th>
              <th scope="colgroup" className={cn('grupo', se)}>
                {opcion('iguales', 'En partes iguales')}
              </th>
            </tr>
            <tr>
              <th scope="col" className={cn('n', sp)}>
                Porcentaje
              </th>
              <th scope="col" className={cn('n', sp)}>
                Monto
              </th>
              <th scope="col" className={cn('n', se)}>
                Monto
              </th>
            </tr>
          </thead>
          <tbody>
            {d.filas.map((f) => (
              <tr key={f.proyecto}>
                <td className="mono">{f.proyecto}</td>
                <td className="n">{moneda(f.consumo)}</td>
                <td className={cn('n', sp)}>{sinConsumo ? '—' : porcentajeFijo(f.porcentaje)}</td>
                <td className={cn('n', sp)}>
                  {f.segunConsumo === null ? (
                    '—'
                  ) : (
                    <>
                      <span
                        className="barra-mini"
                        style={{ width: (f.segunConsumo / maximo) * 60 }}
                        aria-hidden="true"
                      />
                      {moneda(f.segunConsumo)}
                    </>
                  )}
                </td>
                <td className={cn('n', se)}>{moneda(f.enPartesIguales)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr>
              <td>Total</td>
              <td className="n">{moneda(d.consumoTotal)}</td>
              <td className={cn('n', sp)}>{sinConsumo ? '—' : porcentajeFijo(100)}</td>
              <td className={cn('n', sp)}>{sinConsumo ? '—' : moneda(total)}</td>
              <td className={cn('n', se)}>{moneda(total)}</td>
            </tr>
          </tfoot>
        </table>
      </EnvTabla>
      {sinConsumo && (
        <div style={{ padding: '0 18px' }}>
          <Aviso tipo="info" rol="none">
            <p>Ningún proyecto activo consumió en el período: solo se puede repartir en partes iguales.</p>
          </Aviso>
        </div>
      )}
      {aplicar.isError && (
        <div style={{ padding: '0 18px' }}>
          <Aviso tipo="err">
            <p>{aplicar.error.message}</p>
          </Aviso>
        </div>
      )}
      <div className="aplicar">
        <p className="sec" style={{ fontSize: 14.5 }}>
          {resto ? (
            <>
              El redondeo deja {moneda(resto)} que se suman a <span className="mono">{menor}</span>, el
              proyecto de código menor.
            </>
          ) : (
            'El reparto no deja residuo de redondeo.'
          )}
        </p>
        <button
          className="btn btn-pri"
          type="button"
          aria-disabled={aplicar.isPending || undefined}
          onClick={async () => {
            if (aplicar.isPending) return
            try {
              alAplicar(await aplicar.mutateAsync({ periodoId: d.periodo!.id, criterio: elegido }))
            } catch {
              // El aviso de error se muestra arriba del botón
            }
          }}
        >
          {aplicar.isPending ? 'Aplicando…' : `Aplicar reparto ${CRITERIO[elegido]}`}
        </button>
      </div>
    </section>
  )
}
