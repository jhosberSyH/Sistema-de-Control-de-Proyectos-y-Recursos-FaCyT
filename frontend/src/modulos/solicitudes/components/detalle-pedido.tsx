import { useEffect, useRef, useState, type ReactNode } from 'react'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { Boton } from '@/components/ui/boton'
import { AreaTexto, Campo, Entrada, EntradaPrefijo } from '@/components/ui/campo'
import { DialogoAlerta } from '@/components/ui/dialogo'
import { ChipEstado, ChipPrioridad } from '@/components/ui/estado'
import { ListaClaveValor } from '@/components/ui/listas'
import { esApiError } from '@/lib/api-client'
import {
  diaCorto,
  diaYFecha,
  fechaCorta,
  hora,
  leerMonto,
  mayuscula,
  moneda,
  numero,
  porcentaje,
} from '@/lib/formato'
import { useDecidir, useEjecutarGasto } from '../api/bandeja'
import { EnlaceCotizacion } from './enlace-cotizacion'
import type { Pedido, PedidoGasto } from '../types/bandeja'
import { codigoPedido, cuandoFrase, deLosInsumos, etiquetas, minuscula, nombrePila } from '../utils/bandeja'

const M = ({ children }: { children: ReactNode }) => <span className="mono">{children}</span>

/** "Solicitud de gasto · enviada ayer a las 16:05 por Daniela Rivas" */
function meta(p: Pedido) {
  const cuando = cuandoFrase(p.fecha)
  switch (p.clase) {
    case 'gasto':
      return p.estado === 'Aprobado'
        ? `Solicitud de gasto · aprobada ${cuando}${p.decididaPor ? ` por ${p.decididaPor}` : ''}`
        : `Solicitud de gasto · enviada ${cuando} por ${p.pedidaPor}`
    case 'retiro':
      return `Solicitud de retiro · enviada ${cuando} por ${p.pedidaPor}`
    case 'reserva':
      return `Reserva de equipo · pedida ${cuando} por ${p.pedidaPor}`
    case 'correccion':
      return `Corrección de despacho · pedida ${cuando} por ${p.pedidaPor}`
    case 'reposicion':
      return `Reposición automática · creada ${cuando} por el sistema`
  }
}

function titulo(p: Pedido) {
  switch (p.clase) {
    case 'gasto':
      return (
        <>
          <M>{p.numero}</M> · {p.insumoServicio}
        </>
      )
    case 'retiro':
      return (
        <>
          <M>{p.numero}</M> · Retiro de insumos
        </>
      )
    case 'reserva':
      return (
        <>
          {/* Las reservas no tienen código visible (su id es un UUID) */}
          Reserva de {p.equipo.nombre}
        </>
      )
    case 'correccion':
      return (
        <>
          <M>{p.id}</M> sobre <M>{p.despacho.codigo}</M>
        </>
      )
    case 'reposicion':
      return (
        <>
          <M>{p.numero}</M> · {p.insumo.nombre}
        </>
      )
  }
}

const proyectoKv = (p: Pedido) =>
  p.proyecto && {
    clave: 'Proyecto',
    valor: (
      <>
        <M>{p.proyecto.codigo}</M> {p.proyecto.nombre}
      </>
    ),
  }

const cantidad = (valor: number, unidad: string) => `${numero(valor, 3)} ${unidad}`

/** "Jueves 05/11/2026, de 14:00 a 16:00 (2 h)" */
function horario(inicio: string, fin: string) {
  const horas = (Date.parse(fin) - Date.parse(inicio)) / 3_600_000
  const dia = mayuscula(diaYFecha(inicio).split(' ')[0])
  return `${dia} ${fechaCorta(inicio)}, de ${hora(inicio)} a ${hora(fin)} (${numero(horas, 1)} h)`
}

function datos(p: Pedido): { clave: ReactNode; valor: ReactNode }[] {
  const lista: ({ clave: ReactNode; valor: ReactNode } | null | false)[] = []
  switch (p.clase) {
    case 'gasto':
      lista.push(
        proyectoKv(p),
        Boolean(p.cantidad) && { clave: 'Cantidad', valor: p.cantidad },
        { clave: 'Monto estimado', valor: moneda(p.monto) },
        Boolean(p.descripcion) && { clave: 'Descripción', valor: p.descripcion },
        { clave: 'Cotización', valor: <EnlaceCotizacion solicitud={p.id} archivo={p.cotizacion} /> },
      )
      break
    case 'retiro':
      lista.push(
        proyectoKv(p),
        {
          clave: 'Insumos',
          valor: p.lineas.map((l) => `${l.insumo} ${cantidad(l.cantidad, l.unidad)}`).join(' · '),
        },
        Boolean(p.proposito) && { clave: 'Para qué', valor: p.proposito },
        { clave: 'Retira', valor: p.pedidaPor },
        { clave: 'Valor estimado', valor: moneda(p.valor) },
      )
      break
    case 'reserva':
      lista.push(
        proyectoKv(p),
        { clave: 'Fecha', valor: horario(p.inicio, p.fin) },
        { clave: 'Estado del equipo', valor: p.equipo.estado },
      )
      break
    case 'correccion':
      lista.push(
        {
          clave: 'Insumo',
          valor: (
            <>
              {p.insumo} · lote <M>{p.lote}</M>
            </>
          ),
        },
        proyectoKv(p),
        Boolean(p.despacho.fecha) && {
          clave: 'Despachado',
          valor: `${fechaCorta(p.despacho.fecha!)}, ${hora(p.despacho.fecha!)}`,
        },
      )
      break
    case 'reposicion':
      lista.push(
        { clave: 'Stock actual', valor: cantidad(p.insumo.stock, p.insumo.unidad) },
        { clave: 'Stock mínimo', valor: cantidad(p.insumo.minimo, p.insumo.unidad) },
        {
          clave: 'Consumo previsto',
          valor:
            p.consumoPrevisto === null
              ? 'Sin historial suficiente para pronosticarlo'
              : `${cantidad(p.consumoPrevisto, p.insumo.unidad)} en las próximas 8 semanas`,
        },
      )
      break
  }
  return lista.filter((x): x is { clave: ReactNode; valor: ReactNode } => Boolean(x))
}

/** Ejecución del proyecto antes y después del gasto (el aprobador decide viendo el presupuesto, F5.4). */
function Efecto({ p, monto }: { p: PedidoGasto; monto: number }) {
  const despues = p.gastoEjecutado + monto
  const ejecucion = (g: number) => (p.presupuesto > 0 ? (g / p.presupuesto) * 100 : 0)
  const pasa = ejecucion(despues) > 100
  return (
    <>
      <div className="efecto">
        <div>
          <span>Ejecución actual de {p.proyecto?.codigo}</span>
          <b>{porcentaje(ejecucion(p.gastoEjecutado))}</b>
        </div>
        <div>
          <span>{p.estado === 'Aprobado' ? 'Con este gasto' : 'Con esta solicitud'}</span>
          <b>
            {pasa && <Icono nombre="alerta" />}
            {porcentaje(ejecucion(despues))}
          </b>
        </div>
        <div>
          <span>Presupuesto restante</span>
          <b>US$ {numero(p.presupuesto - despues)}</b>
        </div>
      </div>
      {pasa && (
        <Aviso tipo="warn" rol="none">
          <p>
            Con {p.estado === 'Aprobado' ? 'este gasto' : 'esta solicitud'} {p.proyecto?.codigo} pasa del{' '}
            {porcentaje(100)} de su presupuesto.
          </p>
        </Aviso>
      )}
    </>
  )
}

/** Aviso de cada tipo de pedido: lo que el aprobador tiene que saber antes de decidir. */
function AvisoPedido({ p }: { p: Pedido }) {
  switch (p.clase) {
    case 'retiro': {
      const faltan = p.lineas.filter((l) => l.cantidad > l.disponible)
      if (faltan.length === 0) {
        return (
          <Aviso tipo="info" rol="none">
            <p>
              Hay stock {deLosInsumos(p.lineas.length)}. Al aprobar, Almacén prepara el despacho con los lotes
              que vencen primero.
            </p>
          </Aviso>
        )
      }
      const reposiciones = faltan.filter((l) => l.reposicion)
      return (
        <Aviso tipo="warn" rol="none">
          <p>
            {faltan.map((l, i) => (
              <span key={l.insumo}>
                {i > 0 && ' '}
                No alcanza {minuscula(l.insumo)}: pide {cantidad(l.cantidad, l.unidad)} y hay{' '}
                {cantidad(l.disponible, l.unidad)}.
              </span>
            ))}
            {reposiciones.length > 0 && (
              <>
                {' '}
                Ya hay una reposición en curso (
                {reposiciones.map((l, i) => (
                  <span key={l.reposicion}>
                    {i > 0 && ', '}
                    <M>{l.reposicion}</M>
                  </span>
                ))}
                ).
              </>
            )}{' '}
            Si la apruebas, Almacén la despacha cuando haya stock suficiente.
          </p>
        </Aviso>
      )
    }
    case 'reserva':
      if (p.choque) {
        return (
          <Aviso tipo="err" rol="none">
            <p>
              Choca con la reserva de <M>{p.choque.proyecto}</M> ({diaCorto(p.choque.inicio)},{' '}
              {hora(p.choque.inicio)} a {hora(p.choque.fin)}), que ya está aprobada. No se puede aprobar:
              recházala con un motivo.
            </p>
          </Aviso>
        )
      }
      if (p.equipo.estado === 'En mantenimiento') {
        return (
          <Aviso tipo="warn" rol="none">
            <p>{p.equipo.nombre} está en mantenimiento. No se puede aprobar hasta que vuelva a Disponible.</p>
          </Aviso>
        )
      }
      return (
        <Aviso tipo="ok" rol="none">
          <p>No choca con otras reservas. El horario sigue libre.</p>
        </Aviso>
      )
    case 'correccion': {
      const e = p.efecto
      const codigo = p.proyecto?.codigo
      return (
        <Aviso tipo="info" rol="none">
          <p>
            <b>Motivo:</b> «{p.motivo}».{' '}
            {e?.tipo === 'devolucion' &&
              `Si apruebas, un movimiento devuelve ${e.cantidad} al lote y descuenta ${moneda(e.monto)} del gasto de ${codigo}. `}
            {e?.tipo === 'descuento' &&
              `Si apruebas, un movimiento descuenta ${e.cantidad} más del lote y suma ${moneda(e.monto)} al gasto de ${codigo}. `}
            {e?.tipo === 'traslado' &&
              `Si apruebas, el cargo de ${moneda(e.monto)} pasa de ${codigo} a ${p.valorNuevo}. `}
            El despacho original no cambia.
          </p>
        </Aviso>
      )
    }
    case 'reposicion':
      return (
        <Aviso tipo="info" rol="none">
          <p>
            Compara la cantidad sugerida con el consumo previsto y ajústala antes de aprobar si hace falta.
          </p>
        </Aviso>
      )
    default:
      return null
  }
}

function Cabecera({ p }: { p: Pedido }) {
  return (
    <div className="det-cab">
      <div style={{ display: 'grid', gap: 4 }}>
        <span className="sec">{meta(p)}</span>
        <h2 id="detalle-titulo" tabIndex={-1}>
          {titulo(p)}
        </h2>
      </div>
      {p.grupo === 'auto' ? (
        <ChipEstado tipo="info">Automática</ChipEstado>
      ) : (
        <ChipPrioridad prioridad={p.grupo} />
      )}
    </div>
  )
}

const mensajeError = (e: unknown) => (esApiError(e) ? e.message : 'No se pudo guardar. Inténtalo de nuevo.')

/**
 * Detalle de un pedido por decidir (F3.5, F4.5, F5.4, F6.6). Aprobar es directo; rechazar, denegar o
 * descartar pide el motivo en el mismo panel, como el mockup, y sin motivo no se puede (RN-03).
 */
export function DetallePedido({ p, alResuelto }: { p: Pedido; alResuelto: (texto: string) => void }) {
  const decidir = useDecidir()
  const textos = etiquetas(p)
  const [rechazando, setRechazando] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [errorMotivo, setErrorMotivo] = useState<string | null>(null)
  const [cantidadTexto, setCantidadTexto] = useState(
    p.clase === 'reposicion' ? numero(p.sugerida, 3).replaceAll('.', '') : '',
  )
  const [errorCantidad, setErrorCantidad] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const refMotivo = useRef<HTMLTextAreaElement>(null)
  const refCantidad = useRef<HTMLInputElement>(null)
  const avisa = p.pedidaPor ? ` ${p.pedidaPor} recibe el aviso.` : ''

  useEffect(() => {
    if (rechazando) refMotivo.current?.focus()
  }, [rechazando])

  const bloqueada = p.clase === 'reserva' && (p.choque !== null || p.equipo.estado === 'En mantenimiento')

  async function aprobar() {
    setErrorGeneral(null)
    let cantidad: number | undefined
    if (p.clase === 'reposicion') {
      const n = leerMonto(cantidadTexto)
      if (n === null || n <= 0) {
        setErrorCantidad('Escribe una cantidad mayor que cero.')
        refCantidad.current?.focus()
        return
      }
      cantidad = n
    }
    try {
      await decidir.mutateAsync({ pedido: p, aprobar: true, cantidad })
      alResuelto(
        p.clase === 'reposicion'
          ? `Aprobaste ${p.numero} por ${cantidad!.toString().replace('.', ',')} ${p.insumo.unidad}.`
          : `Aprobaste ${codigoPedido(p)}.${avisa}`,
      )
    } catch (e) {
      if (esApiError(e) && e.errores.cantidad) setErrorCantidad(e.errores.cantidad)
      else setErrorGeneral(mensajeError(e))
    }
  }

  async function confirmarNo() {
    setErrorGeneral(null)
    if (!motivo.trim()) {
      setErrorMotivo(
        `${p.clase === 'correccion' ? 'Escribe la nota' : 'Escribe el motivo'}. Sin ${
          p.clase === 'correccion' ? 'nota' : 'motivo'
        } no se puede ${p.clase === 'reposicion' ? 'descartar' : p.clase === 'correccion' ? 'denegar' : 'rechazar'}.`,
      )
      refMotivo.current?.focus()
      return
    }
    try {
      await decidir.mutateAsync({ pedido: p, aprobar: false, motivo: motivo.trim() })
      alResuelto(`${textos.hecho} ${codigoPedido(p)}.${avisa}`)
    } catch (e) {
      const campo = esApiError(e) ? (e.errores.motivo ?? e.errores.nota) : undefined
      if (campo) setErrorMotivo(campo)
      else setErrorGeneral(mensajeError(e))
    }
  }

  const etiquetaNota =
    p.clase === 'correccion'
      ? `Nota para ${p.pedidaPor}`
      : p.clase === 'reposicion'
        ? 'Motivo para descartar'
        : 'Motivo del rechazo'

  return (
    <>
      <Cabecera p={p} />
      <ListaClaveValor datos={datos(p)} />
      {p.clase === 'gasto' && <Efecto p={p} monto={p.monto} />}
      {p.clase === 'correccion' && (
        <div className="comparar">
          <div className="caja">
            <span>Registrado en la bitácora</span>
            <b>{p.valorOriginal}</b>
          </div>
          <Icono nombre="flecha" />
          <div className="caja nuevo">
            <span>Corrección pedida</span>
            <b>{p.valorNuevo}</b>
          </div>
        </div>
      )}
      {p.clase === 'reposicion' && (
        <Campo
          className="cant"
          etiqueta={`Cantidad a pedir (${p.insumo.unidad})`}
          ayuda={`Sugerida: ${cantidad(p.sugerida, p.insumo.unidad)}`}
          error={errorCantidad}
        >
          {(c) => (
            <Entrada
              {...c}
              ref={refCantidad}
              inputMode="decimal"
              value={cantidadTexto}
              onChange={(e) => {
                setCantidadTexto(e.target.value)
                setErrorCantidad(null)
              }}
            />
          )}
        </Campo>
      )}
      <AvisoPedido p={p} />
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}

      {rechazando ? (
        <>
          <Campo
            etiqueta={etiquetaNota}
            ayuda={
              p.pedidaPor
                ? `${nombrePila(p.pedidaPor)} lo verá junto al pedido.`
                : 'Queda en la auditoría del insumo.'
            }
            error={errorMotivo}
          >
            {(c) => (
              <AreaTexto
                {...c}
                ref={refMotivo}
                className="motivo"
                maxLength={300}
                value={motivo}
                onChange={(e) => {
                  setMotivo(e.target.value)
                  setErrorMotivo(null)
                }}
              />
            )}
          </Campo>
          <div className="decision">
            <Boton variante="peligro" onClick={confirmarNo} disabled={decidir.isPending}>
              {textos.confirmarNo}
            </Boton>
            <Boton
              variante="sec"
              onClick={() => {
                setRechazando(false)
                setErrorMotivo(null)
                setMotivo('')
              }}
            >
              Cancelar
            </Boton>
          </div>
        </>
      ) : (
        <div className="decision">
          {!bloqueada && (
            <Boton variante="pri" onClick={aprobar} disabled={decidir.isPending}>
              {decidir.isPending ? 'Guardando…' : textos.aprobar}
            </Boton>
          )}
          <Boton variante="sec" onClick={() => setRechazando(true)} disabled={decidir.isPending}>
            {textos.no}
          </Boton>
        </div>
      )}
    </>
  )
}

/** Diferencia que merece una revisión: más de un 20 % entre lo estimado y lo pagado (plan §7.2). */
const DIFERENCIA_GRANDE = 0.2

/**
 * F5.5: un gasto aprobado se marca como ejecutado con el monto real pagado. No estaba dibujado; usa el
 * mismo panel (plan §7.2). Ejecutado es final (RN-03), así que pide confirmación con el resumen.
 */
export function DetalleEjecutar({ p, alResuelto }: { p: PedidoGasto; alResuelto: (texto: string) => void }) {
  const ejecutar = useEjecutarGasto()
  const [texto, setTexto] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [errorGeneral, setErrorGeneral] = useState<string | null>(null)
  const [confirmando, setConfirmando] = useState(false)
  const refMonto = useRef<HTMLInputElement>(null)
  const real = leerMonto(texto)
  const valido = real !== null && real > 0
  const diferencia = valido && p.monto > 0 ? (real - p.monto) / p.monto : 0

  function pedirConfirmacion() {
    setErrorGeneral(null)
    if (!valido) {
      setError(
        texto.trim() ? 'Escribe un monto válido, por ejemplo 655,40.' : 'Escribe el monto real pagado.',
      )
      refMonto.current?.focus()
      return
    }
    setConfirmando(true)
  }

  async function confirmar() {
    try {
      await ejecutar.mutateAsync({ id: p.id, montoReal: real! })
      setConfirmando(false)
      alResuelto(
        `Marcaste ${p.numero} como ejecutada: se cargaron ${moneda(real!)} a ${p.proyecto?.codigo}.${
          p.pedidaPor ? ` ${p.pedidaPor} recibe el aviso.` : ''
        }`,
      )
    } catch (e) {
      setConfirmando(false)
      if (esApiError(e) && e.errores.montoReal) setError(e.errores.montoReal)
      else setErrorGeneral(mensajeError(e))
    }
  }

  return (
    <>
      <Cabecera p={p} />
      <ListaClaveValor datos={datos(p)} />
      <Efecto p={p} monto={valido ? real : p.monto} />
      <Campo
        className="monto-real"
        etiqueta="Monto real pagado (US$)"
        ayuda={`Estimado: ${moneda(p.monto)}`}
        error={error}
      >
        {(c) => (
          <EntradaPrefijo
            {...c}
            ref={refMonto}
            prefijo="US$"
            inputMode="decimal"
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setError(null)
            }}
          />
        )}
      </Campo>
      {Math.abs(diferencia) > DIFERENCIA_GRANDE && (
        <Aviso tipo="warn">
          <p>
            El monto real es {porcentaje(Math.round(Math.abs(diferencia) * 100))}{' '}
            {diferencia > 0 ? 'mayor' : 'menor'} que el estimado. Revisa la factura antes de seguir.
          </p>
        </Aviso>
      )}
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}
      <div className="decision">
        <Boton variante="pri" onClick={pedirConfirmacion}>
          Marcar como ejecutada
        </Boton>
      </div>
      <DialogoAlerta
        abierto={confirmando}
        alCambiar={setConfirmando}
        titulo={`¿Marcar ${p.numero} como ejecutada?`}
        descripcion={`Se cargan ${valido ? moneda(real) : ''} al gasto de ${p.proyecto?.codigo} y la solicitud pasa a Ejecutado. Ejecutado es final: no se puede deshacer.`}
        confirmar={ejecutar.isPending ? 'Guardando…' : 'Marcar como ejecutada'}
        alConfirmar={confirmar}
        ocupado={ejecutar.isPending}
      />
    </>
  )
}
