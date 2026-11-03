import { useEffect, useRef, type ReactNode } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import { Icono } from '@/components/icono'
import { Aviso } from '@/components/ui/aviso'
import { BotonEnlace } from '@/components/ui/boton'
import { Dialogo } from '@/components/ui/dialogo'
import { ChipEstado } from '@/components/ui/estado'
import { TIPO_ESTADO_SOLICITUD } from '@/components/ui/estados-dominio'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { ListaClaveValor } from '@/components/ui/listas'
import { Pestanas } from '@/components/ui/pestanas'
import { TablaDatos } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { esApiError } from '@/lib/api-client'
import { fechaIso, hora, diaMes, moneda, numero } from '@/lib/formato'
import { useSolicitud, useSolicitudes } from '../api/solicitudes'
import type { EstadoSolicitud, FilaSolicitud, ListaSolicitudes, Solicitud, TipoSolicitud } from '../types'
import { EnlaceCotizacion } from './enlace-cotizacion'
import { FormularioSolicitud } from './formulario-solicitud'
import './solicitudes.css'

/** Pestañas del mockup: cada una filtra por un estado del flujo (RN-03). */
const PESTANAS: { valor: string; etiqueta: string; estado: EstadoSolicitud | null }[] = [
  { valor: 'todas', etiqueta: 'Todas', estado: null },
  { valor: 'borrador', etiqueta: 'Borrador', estado: 'Borrador' },
  { valor: 'pendientes', etiqueta: 'Pendientes', estado: 'Pendiente de Aprobación' },
  { valor: 'aprobadas', etiqueta: 'Aprobadas', estado: 'Aprobado' },
  { valor: 'rechazadas', etiqueta: 'Rechazadas', estado: 'Rechazado' },
  { valor: 'ejecutadas', etiqueta: 'Ejecutadas', estado: 'Ejecutado' },
]

/** "Hoy, 10:42", "Ayer, 16:05" o "26/10, 11:20" (columna "Actualizada" del mockup). */
function actualizada(fecha: string) {
  const hoy = fechaIso()
  const ayer = fechaIso(new Date(Date.now() - 86_400_000))
  const dia = fechaIso(fecha)
  const prefijo = dia === hoy ? 'Hoy' : dia === ayer ? 'Ayer' : diaMes(fecha)
  return `${prefijo}, ${hora(fecha)}`
}

type Aviso = { tipo: 'enviada' | 'descartada'; id: string } | null

/**
 * Vista 14: Mis solicitudes (F5.1 a F5.3). La URL decide la pantalla: la lista, ?nueva=retiro|gasto
 * (también con &proyecto=, &insumo= o &desde= para copiar una rechazada) o ?id= de una solicitud.
 */
export function VistaSolicitudes() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const location = useLocation()
  const lista = useSolicitudes()
  const id = params.get('id')
  const nueva = params.get('nueva')
  const desde = params.get('desde')
  const detalle = useSolicitud(id)
  const copia = useSolicitud(nueva ? desde : null)
  useTituloPagina('Solicitudes')

  const tipoNuevo: TipoSolicitud | null = nueva === 'gasto' || nueva === 'retiro' ? nueva : null
  const enFormulario = (tipoNuevo && !id) || (id && detalle.data?.estado === 'Borrador')

  if (lista.isPending || (id && detalle.isPending) || (tipoNuevo && desde && copia.isPending)) {
    return (
      <Cargando etiqueta="Cargando tus solicitudes…">
        <Esqueleto className="esqueleto-titulo" />
        <Esqueleto alto={360} />
      </Cargando>
    )
  }
  if (lista.isError) return <ErrorCarga mensaje={lista.error.message} alReintentar={() => lista.refetch()} />

  if (enFormulario) {
    const tipo = (detalle.data?.tipo ?? tipoNuevo)!
    return (
      <div className="vista-solicitudes">
        {/* Misma key al pasar de ?nueva= a ?id=: el formulario no se vuelve a montar al crearse el borrador */}
        <FormularioSolicitud
          key={`formulario-${tipo}`}
          tipo={tipo}
          inicial={id ? (detalle.data ?? null) : null}
          semilla={{
            proyecto: params.get('proyecto') ?? undefined,
            insumo: params.get('insumo') ?? undefined,
            copia: copia.data ?? null,
          }}
          misProyectos={lista.data.misProyectos}
          insumos={lista.data.insumos}
          alCrear={(nuevo) => setParams({ id: nuevo }, { replace: true })}
          alEnviada={(s) => navigate('/solicitudes', { replace: true, state: { tipo: 'enviada', id: s.id } })}
          alDescartado={(x) =>
            navigate('/solicitudes', { replace: true, state: { tipo: 'descartada', id: x } })
          }
          alVolver={() => navigate('/solicitudes')}
        />
      </div>
    )
  }

  return (
    <div className="vista-solicitudes">
      <Lista
        datos={lista.data}
        pestana={params.get('estado') ?? 'todas'}
        alCambiarPestana={(v) =>
          setParams(
            (p) => {
              const n = new URLSearchParams(p)
              if (v === 'todas') n.delete('estado')
              else n.set('estado', v)
              return n
            },
            { replace: true },
          )
        }
        aviso={(location.state as Aviso) ?? null}
      />
      {id &&
        (detalle.isError ? (
          <Dialogo
            abierto
            alCambiar={() => setParams({}, { replace: true })}
            titulo={`No encontramos la solicitud ${id}`}
          >
            <p>{esApiError(detalle.error) ? detalle.error.message : 'Puede que el enlace esté mal.'}</p>
          </Dialogo>
        ) : detalle.data ? (
          <DetalleSolicitud
            s={detalle.data}
            insumos={lista.data.insumos}
            alCerrar={() =>
              setParams(
                (p) => {
                  const n = new URLSearchParams(p)
                  n.delete('id')
                  return n
                },
                { replace: true },
              )
            }
          />
        ) : null)}
    </div>
  )
}

function Lista({
  datos,
  pestana,
  alCambiarPestana,
  aviso,
}: {
  datos: ListaSolicitudes
  pestana: string
  alCambiarPestana: (v: string) => void
  aviso: Aviso
}) {
  const refAviso = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (aviso) refAviso.current?.focus()
  }, [aviso])
  const conteo = (estado: EstadoSolicitud | null) => (estado ? datos.conteos[estado] : datos.conteos.Todas)
  const sinProyectos = datos.misProyectos.length === 0

  return (
    <>
      <div className="cab">
        <div>
          <nav aria-label="Ruta de navegación">
            <ol className="migas">
              <li>
                <Link to="/inicio">Inicio</Link>
              </li>
              <li aria-current="page">Solicitudes</li>
            </ol>
          </nav>
          <h1>Mis solicitudes</h1>
          <p className="sub">Todo gasto o retiro de insumos sigue el mismo camino.</p>
          <div className="flujo" style={{ marginTop: 10 }} aria-label="Estados de una solicitud" role="group">
            <span className="paso">Borrador</span>→<span className="paso">Pendiente de Aprobación</span>→
            <span className="paso">Aprobado o Rechazado</span>→<span className="paso">Ejecutado</span>
          </div>
        </div>
        {!sinProyectos && (
          <div className="acc">
            <BotonEnlace to="?nueva=gasto">
              <Icono nombre="mas" />
              Solicitud de gasto
            </BotonEnlace>
            <BotonEnlace variante="pri" to="?nueva=retiro">
              <Icono nombre="mas" />
              Solicitud de retiro
            </BotonEnlace>
          </div>
        )}
      </div>

      <section className="tarjeta lista-s" aria-label="Solicitudes">
        {aviso && (
          <div className="resultado" ref={refAviso} tabIndex={-1}>
            <Aviso tipo="ok">
              <p>
                {aviso.tipo === 'enviada' ? (
                  <>
                    Enviaste <span className="mono">{aviso.id}</span> a aprobación. Ya está en la bandeja del
                    aprobador y te llegará un aviso cuando decida.
                  </>
                ) : (
                  <>
                    Descartaste el borrador <span className="mono">{aviso.id}</span>.
                  </>
                )}
              </p>
            </Aviso>
          </div>
        )}
        <Pestanas
          etiqueta="Estado"
          valor={PESTANAS.some((p) => p.valor === pestana) ? pestana : 'todas'}
          alCambiar={alCambiarPestana}
          pestanas={PESTANAS.map((p) => ({
            valor: p.valor,
            etiqueta: `${p.etiqueta} (${conteo(p.estado)})`,
            contenido: (
              <Tabla
                filas={datos.items.filter((s) => !p.estado || s.estado === p.estado)}
                estado={p.etiqueta}
              />
            ),
          }))}
        />
      </section>
    </>
  )
}

function Tabla({ filas, estado }: { filas: FilaSolicitud[]; estado: string }) {
  if (filas.length === 0) {
    return (
      <EstadoVacio
        icono="solicitudes"
        titulo={
          estado === 'Todas'
            ? 'Todavía no tienes solicitudes'
            : `No tienes solicitudes en ${estado.toLowerCase()}`
        }
      >
        {estado === 'Todas'
          ? 'Crea una de gasto o de retiro con los botones de arriba.'
          : 'Mira las demás pestañas.'}
      </EstadoVacio>
    )
  }
  return (
    <TablaDatos apilable titulo={`Solicitudes: ${estado.toLowerCase()}`}>
      <thead>
        <tr>
          <th scope="col">Solicitud</th>
          <th scope="col">Proyecto</th>
          <th scope="col">Detalle</th>
          <th scope="col">Estado</th>
          <th scope="col">Actualizada</th>
          <th scope="col">
            <span className="vh">Acción</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((s) => (
          <tr key={s.id}>
            <td>
              <b className="mono">{s.id}</b>
              <small>{s.tipo === 'gasto' ? 'Gasto' : 'Retiro'}</small>
            </td>
            <td className="mono" data-e="">
              {s.proyecto}
            </td>
            <td>
              {s.detalle}
              {s.motivoRechazo && <small>«{s.motivoRechazo}»</small>}
            </td>
            <td>
              <ChipEstado tipo={TIPO_ESTADO_SOLICITUD[s.estado]}>{s.estado}</ChipEstado>
            </td>
            <td data-e="Actualizada:">{actualizada(s.fecha)}</td>
            <td className="acc-fila">
              <Accion s={s} />
            </td>
          </tr>
        ))}
      </tbody>
    </TablaDatos>
  )
}

/** La acción de cada fila, según su estado (mockup 14). */
function Accion({ s }: { s: FilaSolicitud }) {
  const vh = <span className="vh">{s.id}</span>
  if (s.estado === 'Borrador') {
    return (
      <BotonEnlace chico to={`?id=${s.id}`}>
        Seguir editando {vh}
      </BotonEnlace>
    )
  }
  if (s.estado === 'Rechazado') {
    // Una rechazada no vuelve a pendiente (RN-03): se crea otra con sus datos
    return (
      <BotonEnlace chico to={`?nueva=${s.tipo}&desde=${s.id}`}>
        Crear una nueva <span className="vh">a partir de {s.id}</span>
      </BotonEnlace>
    )
  }
  if (s.estado === 'Ejecutado' && s.despacho) {
    return (
      <BotonEnlace chico to={`/proyectos/bitacora?despacho=${s.despacho}`}>
        Ver despacho <span className="vh">de {s.id}</span>
      </BotonEnlace>
    )
  }
  return (
    <BotonEnlace chico to={`?id=${s.id}`}>
      Ver {vh}
    </BotonEnlace>
  )
}

/** Detalle de una solicitud enviada: ya no se edita (F5.3, HU-15). No estaba dibujado. */
function DetalleSolicitud({
  s,
  insumos,
  alCerrar,
}: {
  s: Solicitud
  insumos: ListaSolicitudes['insumos']
  alCerrar: () => void
}) {
  const datos: { clave: ReactNode; valor: ReactNode }[] = [
    { clave: 'Proyecto', valor: <span className="mono">{s.proyecto}</span> },
    { clave: 'Estado', valor: <ChipEstado tipo={TIPO_ESTADO_SOLICITUD[s.estado]}>{s.estado}</ChipEstado> },
  ]
  if (s.tipo === 'gasto') {
    datos.push(
      { clave: 'Insumo o servicio', valor: s.insumoServicio ?? '—' },
      { clave: 'Cantidad', valor: s.cantidadGasto ?? '—' },
      { clave: 'Monto estimado', valor: s.monto ? moneda(s.monto) : '—' },
      { clave: 'Descripción', valor: s.justificacion ?? '—' },
      { clave: 'Cotización', valor: <EnlaceCotizacion solicitud={s.id} archivo={s.cotizacion} /> },
    )
  } else {
    datos.push(
      {
        clave: 'Insumos',
        valor: s.lineas
          .map((l) => {
            const i = insumos.find((x) => x.id === l.insumoId)
            return `${i?.nombre ?? 'Insumo'} ${numero(l.cantidad, 3)} ${i?.unidad ?? ''}`.trim()
          })
          .join(' · '),
      },
      { clave: 'Para qué se usará', valor: s.proposito ?? '—' },
    )
  }
  if (s.estado === 'Rechazado') {
    datos.push({
      clave: 'Motivo del rechazo',
      valor: `«${s.motivoRechazo ?? 'Sin motivo'}»${s.decididaPor ? `, ${s.decididaPor}` : ''}`,
    })
  } else if (s.decididaPor) {
    datos.push({ clave: 'Aprobada por', valor: s.decididaPor })
  }
  return (
    <Dialogo
      abierto
      alCambiar={(abierto) => {
        if (!abierto) alCerrar()
      }}
      titulo={
        <>
          <span className="mono">{s.id}</span> · {s.tipo === 'gasto' ? 'Gasto' : 'Retiro de insumos'}
        </>
      }
      descripcion={`Actualizada ${actualizada(s.fecha).toLowerCase()}. Una solicitud enviada ya no se edita.`}
    >
      <ListaClaveValor datos={datos} />
      {s.estado === 'Rechazado' && (
        <BotonEnlace variante="pri" to={`?nueva=${s.tipo}&desde=${s.id}`}>
          Crear una nueva con estos datos
        </BotonEnlace>
      )}
    </Dialogo>
  )
}
