import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { Boton } from '@/components/ui/boton'
import { Campo, Entrada } from '@/components/ui/campo'
import { DialogoAlerta } from '@/components/ui/dialogo'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { OpcionesTarjeta } from '@/components/ui/opciones'
import { BarraProgreso } from '@/components/ui/progreso'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { diaMes, fechaCorta, moneda } from '@/lib/formato'
import { cn } from '@/lib/utils'
import { useAbrirRevision, useCerrarPeriodo, useRecordatorioCierre, useTableroCierre } from '../api/cierre'
import type { TableroCierre, TipoPeriodo } from '../types'
import { finSugerido, nombrePeriodo, tituloPeriodo } from '../utils/periodo'
import './cierre.css'

const PASOS = ['Abrir revisión', 'Confirmaciones', 'Cierre', 'Reparto de gastos']

function Pasos({ actual }: { actual: number }) {
  return (
    <ol className="pasos" aria-label="Pasos del cierre">
      {PASOS.map((p, i) => (
        <li
          key={p}
          className={cn(i + 1 < actual && 'hecho')}
          aria-current={i + 1 === actual ? 'step' : undefined}
        >
          <span className="num">{i + 1}</span>
          {p}
          {i + 1 < actual && <span className="vh"> (hecho)</span>}
        </li>
      ))}
    </ol>
  )
}

function Estado({ f }: { f: TableroCierre['filas'][number] }) {
  switch (f.estado) {
    case 'confirmado':
      return <ChipEstado tipo="ok">Confirmado el {diaMes(f.confirmadoEl!)}</ChipEstado>
    case 'correccion':
      return <ChipEstado tipo="warn">Corrección pendiente</ChipEstado>
    case 'sin-coordinador':
      return <ChipEstado tipo="err">Sin coordinador</ChipEstado>
    default:
      return <ChipEstado tipo="warn">Por confirmar</ChipEstado>
  }
}

type Resultado = { tipo: 'abierta' | 'cerrado' | 'recordatorio'; texto: string } | null

/**
 * Vista 22: cierre de período (F7.1, F7.2). Sin período en revisión, el paso 1: abrirla (el rango no se
 * puede cruzar con otro período). Con la revisión abierta, el tablero de confirmaciones, el recordatorio
 * y el cierre. El reparto de gastos compartidos (paso 4) es la vista 23.
 */
export function VistaCierre() {
  const datos = useTableroCierre()
  const [resultado, setResultado] = useState<Resultado>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useTituloPagina('Cierre de período')
  useEffect(() => {
    if (resultado) refResultado.current?.focus()
  }, [resultado])

  if (datos.isPending) {
    return (
      <Cargando etiqueta="Cargando el cierre…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={420} />
      </Cargando>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
  const d = datos.data
  const confirmados = d.filas.filter((f) => f.estado === 'confirmado').length
  // Sin revisión abierta: el reparto pendiente (paso 4) o abrir la siguiente (paso 1)
  const actual = !d.periodo ? (d.porRepartir ? 4 : 1) : confirmados === d.filas.length ? 3 : 2

  return (
    <div className="vista-cierre">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/inicio">Inicio</Link>
              </li>
              <li aria-current="page">Gastos compartidos</li>
            </ol>
          </nav>
          <h1>Cierre de período</h1>
          <p className="sub">
            Primero los coordinadores revisan sus cargos. Después cierras el período y repartes los gastos
            compartidos.
          </p>
        </div>
      </div>
      <Pasos actual={actual} />

      {resultado && (
        <div ref={refResultado} tabIndex={-1} className="hecho">
          <Aviso tipo="ok">
            <p>{resultado.texto}</p>
          </Aviso>
        </div>
      )}

      {d.periodo ? (
        <Tablero d={d} alResultado={setResultado} />
      ) : (
        <>
          {d.porRepartir && (
            <Aviso tipo="info" rol="none">
              <p>
                <b>{tituloPeriodo(d.porRepartir)} está cerrado</b> y espera el reparto de los gastos
                compartidos. <Link to="/gastos-compartidos/reparto">Repartir gastos compartidos</Link>
              </p>
            </Aviso>
          )}
          <AbrirRevision sugerido={d.sugerido} alAbrir={setResultado} />
        </>
      )}
    </div>
  )
}

function Tablero({ d, alResultado }: { d: TableroCierre; alResultado: (r: Resultado) => void }) {
  const p = d.periodo!
  const recordatorio = useRecordatorioCierre()
  const cerrar = useCerrarPeriodo()
  const [confirmando, setConfirmando] = useState(false)
  const confirmados = d.filas.filter((f) => f.estado === 'confirmado').length
  const faltan = d.filas.length - confirmados
  const avance = d.filas.length ? Math.round((confirmados / d.filas.length) * 100) : 0
  const nombre = nombrePeriodo(p)

  return (
    <>
      <section className="tarjeta tablero" aria-labelledby="t-tab">
        <div className="cab-t">
          <div>
            <h2 id="t-tab" style={{ fontSize: 19 }}>
              {tituloPeriodo(p)} · del {diaMes(p.inicio)} al {diaMes(p.fin)}
            </h2>
            {p.abiertoEl && (
              <p className="sec" style={{ fontSize: 14.5 }}>
                Revisión abierta el {diaMes(p.abiertoEl)}
                {p.abiertoPor ? ` por ${p.abiertoPor}` : ''}
              </p>
            )}
          </div>
          <div className="prog">
            <div className="t">
              <span>
                {confirmados} de {d.filas.length} proyectos confirmaron
              </span>
              <b className="num">{avance} %</b>
            </div>
            <BarraProgreso valor={avance} etiqueta="Proyectos que confirmaron sus cargos" alto={faltan > 0} />
          </div>
        </div>
        <TablaDatos apilable titulo="Confirmaciones de cargos">
          <thead>
            <tr>
              <th scope="col">Proyecto</th>
              <th scope="col">Coordinador</th>
              <th scope="col" className="n">
                Cargos
              </th>
              <th scope="col" className="n">
                Monto
              </th>
              <th scope="col">Estado</th>
            </tr>
          </thead>
          <tbody>
            {d.filas.map((f) => (
              <tr key={f.proyecto}>
                <td className="mono">{f.proyecto}</td>
                <td data-e="Coordinador:">
                  {f.coordinador ?? <span className="sec">Sin coordinador: lo asigna el Administrador</span>}
                </td>
                <td className="n" data-e="Cargos:">
                  {f.cargos}
                </td>
                <td className="n" data-e="Monto:">
                  {moneda(f.monto)}
                </td>
                <td>
                  <Estado f={f} />
                </td>
              </tr>
            ))}
          </tbody>
        </TablaDatos>
      </section>

      <section className="tarjeta cerrar" aria-labelledby="t-cerrar">
        <h2 id="t-cerrar" style={{ fontSize: 19 }}>
          Cerrar el período
        </h2>
        <Aviso tipo={faltan > 0 ? 'warn' : 'ok'} rol="none">
          <p>
            {faltan > 0 ? (
              <>
                <b>
                  {faltan === 1
                    ? '1 proyecto todavía no confirmó.'
                    : `${faltan} proyectos todavía no confirmaron.`}
                </b>{' '}
                Puedes enviarles un recordatorio o cerrar igual; el cierre queda registrado con las
                confirmaciones que falten.
              </>
            ) : (
              <b>Todos los proyectos confirmaron sus cargos.</b>
            )}
          </p>
          <p>
            Al cerrar, no se aceptan despachos, gastos ni correcciones con fecha entre el {diaMes(p.inicio)} y
            el {diaMes(p.fin)}.
          </p>
        </Aviso>
        {(recordatorio.isError || cerrar.isError) && (
          <Aviso tipo="err">
            <p>{(recordatorio.error ?? cerrar.error)?.message}</p>
          </Aviso>
        )}
        <div className="acc-form" style={{ justifyContent: 'flex-start' }}>
          {d.coordinadoresPendientes > 0 && (
            <Boton
              aria-disabled={recordatorio.isPending || undefined}
              onClick={async () => {
                if (recordatorio.isPending) return
                try {
                  const r = await recordatorio.mutateAsync(p.id)
                  alResultado({
                    tipo: 'recordatorio',
                    texto: `Enviamos el recordatorio a ${r.enviados} ${r.enviados === 1 ? 'coordinador' : 'coordinadores'}.${
                      r.sinCoordinador > 0
                        ? ` ${r.sinCoordinador === 1 ? 'Un proyecto no tiene' : `${r.sinCoordinador} proyectos no tienen`} coordinador: no hay a quién avisar.`
                        : ''
                    }`,
                  })
                } catch {
                  // El aviso de error se muestra arriba
                }
              }}
            >
              {recordatorio.isPending
                ? 'Enviando…'
                : `Enviar recordatorio a ${d.coordinadoresPendientes} ${d.coordinadoresPendientes === 1 ? 'coordinador' : 'coordinadores'}`}
            </Boton>
          )}
          <Boton variante="pri" onClick={() => setConfirmando(true)}>
            Cerrar {nombre}
          </Boton>
        </div>
      </section>

      <DialogoAlerta
        abierto={confirmando}
        alCambiar={setConfirmando}
        titulo={`¿Cerrar ${nombre}?`}
        descripcion={`${
          faltan > 0
            ? `${faltan === 1 ? 'Falta 1 proyecto' : `Faltan ${faltan} proyectos`} por confirmar; el cierre lo deja registrado. `
            : ''
        }Después no entran despachos, gastos ni correcciones del ${fechaCorta(p.inicio)} al ${fechaCorta(p.fin)}, y el período queda listo para repartir los gastos compartidos.`}
        confirmar={cerrar.isPending ? 'Cerrando…' : `Cerrar ${nombre}`}
        ocupado={cerrar.isPending}
        alConfirmar={async () => {
          try {
            await cerrar.mutateAsync(p.id)
            setConfirmando(false)
            alResultado({
              tipo: 'cerrado',
              texto: `Cerraste ${nombre}. Ya puedes repartir los gastos compartidos (paso 4).`,
            })
          } catch {
            setConfirmando(false)
          }
        }}
      />
    </>
  )
}

/** Paso 1 (F7.1): tipo y fechas del período; el cruce con otro período se avisa antes de enviar nada. */
function AbrirRevision({
  sugerido,
  alAbrir,
}: {
  sugerido: TableroCierre['sugerido']
  alAbrir: (r: Resultado) => void
}) {
  const abrir = useAbrirRevision()
  const [tipo, setTipo] = useState<TipoPeriodo>('mensual')
  const [inicio, setInicio] = useState(sugerido?.inicio ?? '')
  const [fin, setFin] = useState(sugerido?.fin ?? '')
  const [errores, setErrores] = useState<Record<string, string>>({})
  const cruce = esApiError(abrir.error) && abrir.error.status === 409 ? abrir.error.message : null

  async function enviar(e: FormEvent) {
    e.preventDefault()
    if (abrir.isPending) return
    const x: Record<string, string> = {}
    if (!inicio) x.inicio = 'Elige la fecha de inicio.'
    if (!fin) x.fin = 'Elige la fecha de fin.'
    else if (inicio && fin < inicio) x.fin = 'El fin tiene que ser después del inicio.'
    setErrores(x)
    if (Object.keys(x).length > 0) return
    try {
      const p = await abrir.mutateAsync({ tipo, inicio, fin })
      alAbrir({
        tipo: 'abierta',
        texto: `Abriste la revisión de ${nombrePeriodo(p)}. Cada coordinador ya recibió los cargos de sus proyectos.`,
      })
    } catch (err) {
      if (esApiError(err) && err.status === 422) setErrores(err.errores)
    }
  }

  return (
    <form className="tarjeta abrir" noValidate aria-label="Abrir revisión" onSubmit={enviar}>
      <h2 style={{ fontSize: 19 }}>Abrir la revisión del período</h2>
      <OpcionesTarjeta
        leyenda="Tipo"
        opciones={[
          { valor: 'mensual', etiqueta: 'Mensual' },
          { valor: 'trimestral', etiqueta: 'Trimestral' },
        ]}
        valor={tipo}
        alCambiar={(v) => {
          setTipo(v)
          if (inicio) setFin(finSugerido(inicio, v))
        }}
      />
      <div className="form-rejilla">
        <Campo etiqueta="Desde" error={errores.inicio} invalido={Boolean(cruce)}>
          {(c) => (
            <Entrada
              {...c}
              type="date"
              value={inicio}
              onChange={(e) => {
                setInicio(e.target.value)
                if (e.target.value) setFin(finSugerido(e.target.value, tipo))
                abrir.reset()
              }}
            />
          )}
        </Campo>
        <Campo etiqueta="Hasta" error={errores.fin}>
          {(c) => (
            <Entrada
              {...c}
              type="date"
              value={fin}
              min={inicio || undefined}
              onChange={(e) => {
                setFin(e.target.value)
                abrir.reset()
              }}
            />
          )}
        </Campo>
      </div>
      {cruce ? (
        <Aviso tipo="err">
          <p>
            <b>{cruce.split('. ')[0]}.</b>
          </p>
          <p>{cruce.split('. ').slice(1).join('. ')} No se envió nada a los coordinadores.</p>
        </Aviso>
      ) : (
        <p className="sec" style={{ fontSize: 14.5 }}>
          Al abrir, cada coordinador recibe en su bandeja la lista de cargos de sus proyectos para revisarla.
        </p>
      )}
      {abrir.isError && !cruce && !(esApiError(abrir.error) && abrir.error.status === 422) && (
        <Aviso tipo="err">
          <p>{abrir.error.message}</p>
        </Aviso>
      )}
      <div className="acc-form" style={{ justifyContent: 'flex-start' }}>
        <button className="btn btn-pri" type="submit" aria-disabled={abrir.isPending || undefined}>
          {abrir.isPending ? 'Abriendo…' : 'Abrir revisión y enviar cargos'}
        </button>
      </div>
    </form>
  )
}
