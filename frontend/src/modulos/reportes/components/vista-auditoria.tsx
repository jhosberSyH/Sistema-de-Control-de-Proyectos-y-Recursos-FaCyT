import { useCallback, useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { ListaClaveValor } from '@/components/ui/listas'
import { EnvTabla, Paginacion } from '@/components/ui/tabla'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { fechaCorta, hora, numero } from '@/lib/formato'
import { useAuditoria } from '../api/auditoria'
import type { FiltrosAuditoria, PaginaAuditoria, RegistroAuditoria } from '../types'
import './auditoria.css'

const SIN_FILTROS: FiltrosAuditoria = { usuario: '', accion: '', objeto: '', desde: '' }

const ACCIONES = [
  { valor: 'cambio-estado', texto: 'Cambio de estado' },
  { valor: 'creacion', texto: 'Creación' },
  { valor: 'edicion', texto: 'Edición' },
  { valor: 'sesion', texto: 'Inicio y cierre de sesión' },
] as const

/** Clase del cuadrito de color de cada acción (mockup 25). */
const CLASE: Record<RegistroAuditoria['accion'], string> = {
  creacion: 'crea',
  edicion: 'edita',
  'cambio-estado': 'estado-c',
  sesion: 'sesion',
}

/** "Proyecto BIO-011" con el código en mono. */
function ConCodigo({ texto, codigo }: { texto: string; codigo: string | null }) {
  if (!codigo || !texto.includes(codigo)) return <>{texto}</>
  const [antes, ...resto] = texto.split(codigo)
  return (
    <>
      {antes}
      <span className="mono">{codigo}</span>
      {resto.join(codigo)}
    </>
  )
}

/** "27/10/2026 08:42:16" */
const conSegundos = (f: string) =>
  `${fechaCorta(f)} ${new Intl.DateTimeFormat('es-VE', {
    timeZone: 'America/Caracas',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).format(new Date(f))}`

/** "Cambio de prioridad de BIO-011", "Inicio de sesión de Daniela Rivas" */
function tituloDe(r: RegistroAuditoria): ReactNode {
  if (r.accion === 'sesion') return `${r.etiqueta} de ${r.usuario?.nombre ?? 'el sistema'}`
  const objeto = r.objeto.replace(/ a .*$/, '')
  if (r.codigo) {
    return (
      <>
        {r.etiqueta} de <span className="mono">{r.codigo}</span>
      </>
    )
  }
  return `${r.etiqueta} de ${objeto.charAt(0).toLowerCase()}${objeto.slice(1)}`
}

/**
 * Vista 25: auditoría global (F8.5, F8.6). Los registros más recientes primero, filtros opcionales y el
 * detalle con el valor anterior y el nuevo. Es de solo lectura (RN-06).
 */
export function VistaAuditoria() {
  const [filtros, setFiltros] = useState(SIN_FILTROS)
  const [pagina, setPagina] = useState(1)
  const [abiertos, setAbiertos] = useState(false)
  const [elegido, setElegido] = useState<string | null>(null)
  const datos = useAuditoria(filtros, pagina)
  const refDetalle = useRef<HTMLElement>(null)
  useTituloPagina('Auditoría')

  const cambiar = useCallback((c: Partial<FiltrosAuditoria>) => {
    setFiltros((f) => ({ ...f, ...c }))
    setPagina(1)
    setElegido(null)
  }, [])

  const cab = (
    <div className="cab">
      <div>
        <nav aria-label="Ruta de navegación">
          <ol className="migas">
            <li>
              <Link to="/inicio">Inicio</Link>
            </li>
            <li aria-current="page">Auditoría</li>
          </ol>
        </nav>
        <h1>Auditoría</h1>
        <p className="sub">
          Cada creación, edición y cambio de estado del sistema, con fecha, usuario y dirección IP. Es de solo
          lectura.
        </p>
      </div>
    </div>
  )

  if (datos.isPending) {
    return (
      <div className="vista-auditoria">
        {cab}
        <Cargando etiqueta="Cargando la auditoría…">
          <Esqueleto alto={520} />
        </Cargando>
      </div>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />
  const d = datos.data
  // El elegido, o el primero de la página
  const actual = d.registros.find((r) => r.id === elegido) ?? d.registros[0] ?? null

  const elegir = (id: string) => {
    setElegido(id)
    // En el teléfono el detalle queda debajo de la tabla: se lleva a la vista
    if (window.matchMedia?.('(max-width: 760px)').matches) refDetalle.current?.scrollIntoView?.()
  }
  const alTeclear = (e: KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      elegir(id)
    }
  }

  return (
    <div className="vista-auditoria">
      {cab}
      <div className="dos">
        <section className="tarjeta aud" aria-label="Registros de auditoría">
          <div className="cab-a">
            <span className="conteo">{conteo(d, filtros)}</span>
            <button
              className="btn btn-sec btn-chico"
              type="button"
              aria-expanded={abiertos}
              aria-controls="filtros-aud"
              onClick={() => setAbiertos((a) => !a)}
            >
              <Icono nombre="filtro" />
              Filtrar
            </button>
          </div>
          {abiertos && <Filtros d={d} filtros={filtros} alCambiar={cambiar} />}
          {d.registros.length === 0 ? (
            <EstadoVacio titulo="No hay registros con esos filtros">
              Cambia el usuario, la acción, el objeto o la fecha.
            </EstadoVacio>
          ) : (
            <EnvTabla>
              <table className="datos apilable">
                <caption className="vh">Registros de auditoría</caption>
                <thead>
                  <tr>
                    <th scope="col">Fecha y hora</th>
                    <th scope="col">Usuario</th>
                    <th scope="col">Acción</th>
                    <th scope="col">Objeto</th>
                    <th scope="col">IP</th>
                  </tr>
                </thead>
                <tbody aria-busy={datos.isPlaceholderData || undefined}>
                  {d.registros.map((r) => (
                    <tr
                      key={r.id}
                      tabIndex={0}
                      aria-current={r.id === actual?.id || undefined}
                      onClick={() => elegir(r.id)}
                      onKeyDown={(e) => alTeclear(e, r.id)}
                    >
                      <td className="num" data-e="Fecha:">
                        {fechaCorta(r.fecha)} {hora(r.fecha)}
                      </td>
                      <td data-e="Usuario:">{r.usuario?.nombre ?? 'Sistema'}</td>
                      <td>
                        <span className={`accion ${CLASE[r.accion]}`}>
                          <i aria-hidden="true" />
                          {r.etiqueta}
                        </span>
                      </td>
                      <td>
                        <ConCodigo texto={r.objeto} codigo={r.codigo} />
                      </td>
                      <td className="mono" data-e="IP:">
                        {r.ip ?? '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </EnvTabla>
          )}
          <div style={{ padding: '12px 18px 16px', borderTop: '1px solid var(--line)' }}>
            <Paginacion
              pagina={d.pagina}
              paginas={d.paginas}
              alCambiar={(n) => {
                setPagina(n)
                setElegido(null)
              }}
              resumen={
                d.filtrados === 0
                  ? 'Sin registros'
                  : `${numero((d.pagina - 1) * d.porPagina + 1)} a ${numero(Math.min(d.pagina * d.porPagina, d.filtrados))}`
              }
            />
          </div>
        </section>

        <aside className="tarjeta det" aria-labelledby="t-det" aria-live="polite" ref={refDetalle}>
          {actual ? <Detalle r={actual} /> : <p className="sec">Elige un registro para ver su detalle.</p>}
        </aside>
      </div>
    </div>
  )
}

/** "Mostrando los registros más recientes · 2.418 en total" o, con filtros, qué se filtró y cuántos quedan. */
function conteo(d: PaginaAuditoria, f: FiltrosAuditoria) {
  const partes = [
    f.usuario && `Usuario: ${d.usuarios.find((u) => u.id === f.usuario)?.nombre ?? f.usuario}`,
    f.accion && `Acción: ${ACCIONES.find((a) => a.valor === f.accion)?.texto.toLowerCase()}`,
    f.objeto && `Objeto: ${f.objeto}`,
    f.desde && `Desde el ${fechaCorta(f.desde)}`,
  ].filter(Boolean)
  if (partes.length === 0) return `Mostrando los registros más recientes · ${numero(d.total)} en total`
  return `${partes.join(' · ')} · ${numero(d.filtrados)} de ${numero(d.total)} registros`
}

function Filtros({
  d,
  filtros,
  alCambiar,
}: {
  d: PaginaAuditoria
  filtros: FiltrosAuditoria
  alCambiar: (c: Partial<FiltrosAuditoria>) => void
}) {
  const [texto, setTexto] = useState(filtros.objeto)
  useEffect(() => {
    if (texto === filtros.objeto) return
    const t = window.setTimeout(() => alCambiar({ objeto: texto }), 300)
    return () => window.clearTimeout(t)
  }, [texto, filtros.objeto, alCambiar])

  return (
    <form
      className="herr"
      id="filtros-aud"
      aria-label="Filtros"
      role="search"
      onSubmit={(e) => e.preventDefault()}
    >
      <div className="campo">
        <label htmlFor="f-usr">Usuario</label>
        <select
          className="entrada"
          id="f-usr"
          value={filtros.usuario}
          onChange={(e) => alCambiar({ usuario: e.target.value })}
        >
          <option value="">Todos</option>
          {d.usuarios.map((u) => (
            <option key={u.id} value={u.id}>
              {u.nombre}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-acc">Acción</label>
        <select
          className="entrada"
          id="f-acc"
          value={filtros.accion}
          onChange={(e) => alCambiar({ accion: e.target.value })}
        >
          <option value="">Todas</option>
          {ACCIONES.map((a) => (
            <option key={a.valor} value={a.valor}>
              {a.texto}
            </option>
          ))}
        </select>
      </div>
      <div className="campo busq">
        <label htmlFor="f-obj">Objeto</label>
        <Icono nombre="buscar" />
        <input
          className="entrada"
          id="f-obj"
          type="search"
          placeholder="Código: BIO-011, SOL-119, L-0425…"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="f-desde">Desde</label>
        <input
          className="entrada"
          id="f-desde"
          type="date"
          value={filtros.desde}
          onChange={(e) => alCambiar({ desde: e.target.value })}
        />
      </div>
    </form>
  )
}

/** Panel de detalle: quién, cuándo, desde dónde, qué cambió y por qué (HU-02). */
function Detalle({ r }: { r: RegistroAuditoria }) {
  const objeto = r.objeto.replace(/ a .*$/, '')
  return (
    <>
      <h2 id="t-det">{tituloDe(r)}</h2>
      {/* Sin valores antes y después, la frase dice qué pasó ("registró la recepción del lote L-0431") */}
      {!r.valorAnterior && !r.valorNuevo && (
        <p className="sec" style={{ fontSize: 14.5 }}>
          {r.descripcion}
        </p>
      )}
      <ListaClaveValor
        datos={[
          { clave: 'Fecha', valor: conSegundos(r.fecha) },
          { clave: 'Usuario', valor: r.usuario ? `${r.usuario.nombre} · ${r.usuario.rol}` : 'El sistema' },
          { clave: 'IP', valor: <span className="mono">{r.ip ?? '—'}</span> },
          {
            clave: 'Objeto',
            valor: r.enlace ? (
              <Link to={r.enlace}>
                <ConCodigo texto={objeto} codigo={r.codigo} />
              </Link>
            ) : (
              <ConCodigo texto={objeto} codigo={r.codigo} />
            ),
          },
        ]}
      />
      {(r.valorAnterior || r.valorNuevo) && (
        <div className="cambio">
          <div>
            <span>Antes</span>
            <b>{r.valorAnterior ?? '—'}</b>
          </div>
          <Icono nombre="flecha" />
          <div className="nuevo">
            <span>Después</span>
            <b>{r.valorNuevo ?? '—'}</b>
          </div>
        </div>
      )}
      {r.justificacion && (
        <div>
          <b style={{ fontSize: 14 }}>Justificación</b>
          <p style={{ marginTop: 4 }}>«{r.justificacion}».</p>
        </div>
      )}
      {r.detalle && (
        <div>
          <b style={{ fontSize: 14 }}>Detalle</b>
          <p style={{ marginTop: 4 }}>{r.detalle}</p>
        </div>
      )}
      <p className="inmutable">
        <Icono nombre="candado" />
        Nadie puede editar ni borrar este registro, ni siquiera el administrador.
      </p>
    </>
  )
}
