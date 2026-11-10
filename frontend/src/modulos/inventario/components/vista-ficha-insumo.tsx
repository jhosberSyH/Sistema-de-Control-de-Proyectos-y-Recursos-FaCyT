import { useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { GraficoColumnas } from '@/components/ui/grafico-columnas'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { fechaCorta, hora, moneda } from '@/lib/formato'
import { useFichaInsumo } from '../api/insumos'
import type { FichaInsumo } from '../types'
import { cantidad, mesConAnio, mesCorto, mesLargo, UNIDAD_LARGA } from '../utils/cantidad'
import { DialogoMinimo } from './dialogo-minimo'
import { BloqueReposicion } from './reposicion-insumo'
import './ficha-insumo.css'

type Props = {
  id: string
  /** El Aprobador decide la reposición y registra recepciones; el Administrador cambia el mínimo (plan §7.3). */
  rol: 'aprobador' | 'administrador'
}

/** Vista 10: ficha del insumo (F3.2 a F3.7). */
export function VistaFichaInsumo({ id, rol }: Props) {
  const ficha = useFichaInsumo(id)
  useTituloPagina(ficha.data?.nombre ?? 'Ficha de insumo')
  const [cambiando, setCambiando] = useState(false)
  const [resultado, setResultado] = useState<ReactNode>(null)
  const refFoco = useRef<HTMLElement | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (!resultado) return
    refFoco.current = refResultado.current
    // Al decidir la reposición, su bloque cambia y el botón desaparece: el foco va al resultado.
    if (!cambiando) refResultado.current?.focus()
  }, [resultado, cambiando])

  if (ficha.isPending) {
    return (
      <Cargando etiqueta="Cargando el insumo…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto ancho="50%" />
        <Esqueleto alto={130} />
        <Esqueleto alto={260} />
      </Cargando>
    )
  }
  if (ficha.isError) {
    if (esApiError(ficha.error) && ficha.error.status === 404) {
      return (
        <EstadoVacio
          icono="buscar"
          titulo="No encontramos ese insumo"
          accion={
            <BotonEnlace to="/inventario" chico>
              Ver el inventario
            </BotonEnlace>
          }
        >
          {ficha.error.message}
        </EstadoVacio>
      )
    }
    return <ErrorCarga mensaje={ficha.error.message} alReintentar={() => ficha.refetch()} />
  }

  const i = ficha.data
  const esAdministrador = rol === 'administrador'

  return (
    <div className="vista-ficha-insumo">
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/inventario">Inventario</Link>
              </li>
              <li aria-current="page">{i.nombre}</li>
            </ol>
          </nav>
          <h1>{i.nombre}</h1>
          <p className="sub">{[i.tipo, UNIDAD_LARGA[i.unidad] ?? i.unidad, ...i.ubicaciones].join(' · ')}</p>
        </div>
        <div className="acc">
          {esAdministrador ? (
            <button
              className="btn btn-sec"
              type="button"
              onClick={(e) => {
                refFoco.current = e.currentTarget
                setResultado(null)
                setCambiando(true)
              }}
            >
              Cambiar stock mínimo
            </button>
          ) : (
            <BotonEnlace variante="pri" to={`/almacen/recepcion?insumo=${i.id}`}>
              <Icono nombre="almacen" />
              Registrar recepción
            </BotonEnlace>
          )}
        </div>
      </div>

      {resultado && (
        <div className="resultado" ref={refResultado} tabIndex={-1}>
          <Aviso tipo="ok">{resultado}</Aviso>
        </div>
      )}

      <Resumen i={i} esAdministrador={esAdministrador} />

      {i.reposicion && (
        <BloqueReposicion
          key={`${i.reposicion.id}-${i.reposicion.estado}`}
          insumo={i}
          reposicion={i.reposicion}
          puedeDecidir={rol === 'aprobador'}
          alResultado={setResultado}
        />
      )}

      <div className="dos">
        <Lotes i={i} />
        <Pronostico i={i} />
      </div>

      {cambiando && (
        <DialogoMinimo
          insumo={i}
          alCerrar={() => setCambiando(false)}
          focoAlCerrar={refFoco}
          alListo={(r) => {
            setCambiando(false)
            setResultado(
              <p>
                El stock mínimo de {i.nombre} ahora es {cantidad(r.stockMinimo, i.unidad)}.
                {r.reposicion && (
                  <>
                    {' '}
                    Como el stock quedó bajo el mínimo, se creó la reposición{' '}
                    <span className="mono">{r.reposicion}</span> en Borrador para el aprobador.
                  </>
                )}
              </p>,
            )
          }}
        />
      )}
    </div>
  )
}

/** Las tres tarjetas del mockup: stock actual (F3.4), consumo pronosticado (F3.7) y último movimiento. */
function Resumen({ i, esAdministrador }: { i: FichaInsumo; esAdministrador: boolean }) {
  const p = i.pronostico
  const m = i.ultimoMovimiento
  const bajo = i.stock < i.stockMinimo
  return (
    <div className="resumen">
      <section className="tarjeta res" aria-label="Stock actual">
        <span className="eti">Stock actual</span>
        <span className="val">{cantidad(i.stock, i.unidad)}</span>
        <ChipEstado tipo={bajo ? 'err' : 'ok'}>
          {bajo ? 'Bajo el mínimo' : 'Sobre el mínimo'} de {cantidad(i.stockMinimo, i.unidad)}
        </ChipEstado>
        {/* plan §7.3: el Aprobador ve el mínimo y sabe quién lo cambia */}
        {!esAdministrador && (
          <span className="sec" style={{ fontSize: 14 }}>
            El mínimo lo define el Administrador del Sistema.
          </span>
        )}
      </section>

      <section className="tarjeta res" aria-label="Consumo pronosticado">
        <span className="eti">Consumo pronosticado para {mesLargo(p.mes)}</span>
        {p.valor !== null ? (
          <>
            <span className="val">{cantidad(p.valor, i.unidad)}</span>
            <span className="sec" style={{ fontSize: 14 }}>
              Entre {cantidad(p.minimo!, i.unidad).replace(` ${i.unidad}`, '')} y{' '}
              {cantidad(p.maximo!, i.unidad)} · {p.metodo} con {p.meses} meses de despachos
            </span>
          </>
        ) : (
          <>
            <span className="val nd">No disponible</span>
            <span className="sec" style={{ fontSize: 14 }}>
              Hacen falta {p.requeridos} meses de despachos
            </span>
          </>
        )}
      </section>

      <section className="tarjeta res" aria-label="Último movimiento">
        <span className="eti">Último movimiento</span>
        {!m ? (
          <span className="sec">Todavía no hay recepciones ni despachos.</span>
        ) : m.tipo === 'despacho' ? (
          <>
            <span style={{ fontWeight: 600, fontSize: 17 }}>
              Despacho de {cantidad(m.cantidad!, i.unidad)}{' '}
              {m.proyecto ? (
                <>
                  a <span className="mono">{m.proyecto}</span>
                </>
              ) : (
                'para uso general'
              )}
            </span>
            <span className="sec" style={{ fontSize: 14 }}>
              {fechaCorta(m.fecha)}, {hora(m.fecha)} · lote <span className="mono">{m.lote}</span> ·{' '}
              <span className="mono">{m.codigo}</span>
            </span>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 600, fontSize: 17 }}>
              Recepción del lote <span className="mono">{m.lote}</span>
            </span>
            <span className="sec" style={{ fontSize: 14 }}>
              {fechaCorta(m.fecha)}
            </span>
          </>
        )}
      </section>
    </div>
  )
}

/** Lotes con stock, del que vence antes al que vence después (F3.6). */
function Lotes({ i }: { i: FichaInsumo }) {
  return (
    <section className="tarjeta bloque" aria-labelledby="t-lotes">
      <div className="bloque-cab">
        <h2 id="t-lotes">Lotes</h2>
        <span className="conteo">{i.lotes.length} con stock</span>
      </div>
      {i.lotes.length === 0 ? (
        <p className="sec">No hay lotes con stock. El stock entra con cada recepción.</p>
      ) : (
        <TablaDatos apilable titulo={`Lotes de ${i.nombre}`}>
          <thead>
            <tr>
              <th scope="col">Lote</th>
              <th scope="col">Ingreso</th>
              <th scope="col">Vence</th>
              <th scope="col" className="n">
                Stock
              </th>
              <th scope="col" className="n">
                Costo unitario
              </th>
              <th scope="col">Proveedor</th>
            </tr>
          </thead>
          <tbody>
            {i.lotes.map((l) => {
              const vencido = l.dias !== null && l.dias < 0
              const pronto = l.dias !== null && l.dias >= 0 && l.dias <= i.anticipacion
              return (
                <tr key={l.codigo} className={vencido ? 'vencido' : undefined}>
                  <td className="mono">{l.codigo}</td>
                  <td data-e="Ingreso:">{fechaCorta(l.ingreso)}</td>
                  <td data-e="Vence:" className="venc">
                    {l.vence ? fechaCorta(l.vence) : 'No vence'}
                    {vencido && <ChipEstado tipo="err">Vencido</ChipEstado>}
                    {pronto && <small>{l.dias === 0 ? 'vence hoy' : `en ${l.dias} días`}</small>}
                  </td>
                  <td className="n" data-e="Stock:">
                    {cantidad(l.cantidad, i.unidad)}
                  </td>
                  <td className="n" data-e="Costo:">
                    {moneda(l.costoUnitario)}
                  </td>
                  <td data-e="Proveedor:">{l.proveedor}</td>
                </tr>
              )
            })}
          </tbody>
        </TablaDatos>
      )}
      <p className="sec" style={{ fontSize: 14 }}>
        Al despachar se sugiere primero el lote que vence antes. Los lotes vencidos aparecen aquí, pero no se
        pueden elegir.
      </p>
    </section>
  )
}

/** Consumo mensual y pronóstico (F3.7): columnas, el mes pronosticado rayado con su intervalo y el mínimo. */
function Pronostico({ i }: { i: FichaInsumo }) {
  const [tabla, setTabla] = useState(false)
  const p = i.pronostico
  const con = p.valor !== null
  const formato = (v: number) => cantidad(v, i.unidad)
  return (
    <section className="tarjeta bloque" aria-labelledby="t-pron">
      <div className="bloque-cab">
        <h2 id="t-pron">Consumo mensual y pronóstico</h2>
        {con && (
          <button
            className="btn btn-sec btn-chico"
            type="button"
            aria-expanded={tabla}
            aria-controls="tabla-pron"
            onClick={() => setTabla((t) => !t)}
          >
            {tabla ? 'Ocultar tabla' : 'Ver como tabla'}
          </button>
        )}
      </div>
      {con ? (
        <div>
          <GraficoColumnas
            formato={formato}
            referencia={{ valor: i.stockMinimo, etiqueta: `Mínimo ${formato(i.stockMinimo)}` }}
            columnas={[
              ...p.historial.slice(-7).map((h) => ({
                clave: h.mes,
                etiqueta: mesCorto(h.mes),
                etiquetaLarga: mesConAnio(h.mes),
                valor: h.consumo,
              })),
              {
                clave: p.mes,
                etiqueta: mesCorto(p.mes),
                etiquetaLarga: `${mesConAnio(p.mes)} (pronóstico)`,
                valor: p.valor!,
                pronostico: { minimo: p.minimo!, maximo: p.maximo! },
              },
            ]}
          />
          <div className="leyenda" style={{ marginTop: 10 }}>
            <span>
              <i aria-hidden="true" />
              Consumo despachado
            </span>
            <span>
              <i
                aria-hidden="true"
                style={{
                  background: 'repeating-linear-gradient(135deg,var(--primary) 0 4px,transparent 4px 6px)',
                  outline: '1px solid var(--primary)',
                }}
              />
              Pronóstico con intervalo
            </span>
            <span>
              <i
                aria-hidden="true"
                style={{
                  background: 'none',
                  borderTop: '2px dashed var(--err)',
                  height: 0,
                  width: 16,
                  borderRadius: 0,
                }}
              />
              Stock mínimo
            </span>
          </div>
          <div id="tabla-pron" hidden={!tabla}>
            <TablaDatos titulo={`Consumo mensual de ${i.nombre} y pronóstico`} tituloVisible>
              <thead>
                <tr>
                  <th scope="col">Mes</th>
                  <th scope="col" className="n">
                    Consumo
                  </th>
                </tr>
              </thead>
              <tbody>
                {p.historial.map((h) => (
                  <tr key={h.mes}>
                    <td>{mesConAnio(h.mes)}</td>
                    <td className="n">{formato(h.consumo)}</td>
                  </tr>
                ))}
                <tr>
                  <td>{mesConAnio(p.mes)} (pronóstico)</td>
                  <td className="n">
                    {formato(p.valor!)} ({formato(p.minimo!).replace(` ${i.unidad}`, '')} a{' '}
                    {formato(p.maximo!).replace(` ${i.unidad}`, '')})
                  </td>
                </tr>
              </tbody>
            </TablaDatos>
          </div>
          <p className="sec" style={{ fontSize: 13.5, marginTop: 8 }}>
            El pronóstico no crea solicitudes ni compras.
          </p>
        </div>
      ) : (
        <div className="vacio">
          <Icono nombre="reportes" />
          <p>
            <b>Sin historial suficiente para pronosticar.</b>
          </p>
          <p className="sec">
            {p.meses === 0
              ? `Este insumo todavía no tiene despachos y hacen falta ${p.requeridos} meses.`
              : `Este insumo tiene ${p.meses} ${p.meses === 1 ? 'mes' : 'meses'} de despachos y hacen falta ${p.requeridos}.`}{' '}
            El pronóstico aparecerá solo cuando haya historial.
          </p>
        </div>
      )}
    </section>
  )
}
