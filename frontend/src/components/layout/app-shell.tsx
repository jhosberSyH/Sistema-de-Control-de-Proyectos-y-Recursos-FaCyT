import { useRef, useState, type FormEvent, type ReactNode } from 'react'
import { Link, NavLink } from 'react-router'
import escudoUc from '@/assets/logos/escudo-uc.png'
import isotipoFacyt from '@/assets/logos/facyt-isotipo.png'
import { Icono } from '@/components/icono'
import type { AvisoUsuario } from '@/hooks/use-avisos'
import { CajonMovil } from './cajon-movil'
import { PanelAvisos } from './panel-avisos'
import type { ItemNavegacion, PersonaSesion } from './tipos'

type Props = {
  navegacion: ItemNavegacion[]
  /** Clave del ítem del menú que corresponde a la página actual. */
  activo?: string
  /** Nombre de la sección: va en el encabezado editorial y, en el teléfono, junto al isotipo. */
  titulo: string
  /** Módulo en el encabezado editorial (mockups: window.APP.ins); sin él, el título. */
  seccion?: string
  /** Segunda línea del encabezado editorial: la fecha de hoy y el cierre del período. */
  fecha: string
  persona: PersonaSesion
  avisos: {
    lista: AvisoUsuario[] | undefined
    cargando: boolean
    alAbrir: (a: AvisoUsuario) => void
    alMarcarTodos: () => void
  }
  alBuscar: (texto: string) => void
  children: ReactNode
}

/**
 * Marco de las vistas internas (docs/mockups/_fuente/compartido/comun-app.js): riel de íconos con
 * etiqueta, encabezado editorial con el escudo, barra con búsqueda y avisos, y el contenido.
 * En el teléfono el riel se oculta y la hamburguesa abre el cajón.
 * La cuenta (perfil, tema y cierre de sesión) se abre desde el avatar de la barra, no desde el riel.
 */
export function AppShell({
  navegacion,
  activo,
  titulo,
  seccion,
  fecha,
  persona,
  avisos,
  alBuscar,
  children,
}: Props) {
  const [cajon, setCajon] = useState(false)
  const refMenu = useRef<HTMLButtonElement>(null)

  const buscar = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const texto = new FormData(e.currentTarget).get('q')?.toString().trim()
    if (texto) alBuscar(texto)
  }

  return (
    <div className="app">
      <a className="saltar" href="#contenido">
        Saltar al contenido
      </a>

      <aside className="nav-lat" aria-label="Navegación principal">
        <Link className="marca" to="/inicio">
          <img src={isotipoFacyt} alt="" width={38} height={38} />
          <div>
            <strong>Control de Proyectos</strong>
            <span>FaCyT · UC</span>
          </div>
          <span className="vh">Control de Proyectos, ir al inicio</span>
        </Link>
        <nav>
          <ul>
            {navegacion.map((n) => (
              <li key={n.clave}>
                <Link className="item" to={n.ruta} aria-current={n.clave === activo ? 'page' : undefined}>
                  <Icono nombre={n.icono} />
                  <span>{n.etiqueta}</span>
                  {n.contador ? (
                    <span className="cuenta">
                      <span aria-hidden="true">{n.contador}</span>
                      <span className="vh">
                        {` (${n.detalleContador ?? `${n.contador} ${n.contador === 1 ? 'pendiente' : 'pendientes'}`})`}
                      </span>
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </aside>

      <div className="principal">
        <div className="editorial">
          <img src={escudoUc} alt="Escudo de la Universidad de Carabobo" width={40} height={53} />
          <div className="txt">
            <span className="ins">Universidad de Carabobo · FaCyT · {seccion ?? titulo}</span>
            <span className="fecha">{fecha}</span>
          </div>
        </div>

        <header className="barra">
          <button
            ref={refMenu}
            className="icono-btn menu"
            type="button"
            aria-label="Abrir menú"
            aria-expanded={cajon}
            onClick={() => setCajon(true)}
          >
            <Icono nombre="menu" />
          </button>
          <span className="marca-tel">
            <img src={isotipoFacyt} alt="" width={28} height={28} />
            {titulo}
          </span>
          <form className="buscar" role="search" onSubmit={buscar}>
            {/* Distinto del "Buscar" de los filtros de cada lista: dos campos con el mismo nombre confunden (WCAG 2.4.6) */}
            <label htmlFor="buscar" className="vh">
              Buscar en todo el sistema
            </label>
            <Icono nombre="buscar" />
            <input
              className="entrada"
              id="buscar"
              name="q"
              type="search"
              placeholder="Buscar proyecto, insumo, equipo o solicitud"
            />
          </form>
          <div className="der">
            <PanelAvisos
              avisos={avisos.lista}
              cargando={avisos.cargando}
              alAbrirAviso={avisos.alAbrir}
              alMarcarTodos={avisos.alMarcarTodos}
            />
            <NavLink className="perfil-btn" to="/perfil" title={`${persona.nombre} · ${persona.rol}`}>
              <span className="avatar" aria-hidden="true">
                {persona.iniciales}
              </span>
              <span className="vh">Mi perfil: {persona.nombre}</span>
            </NavLink>
          </div>
        </header>

        <main className="contenido" id="contenido" tabIndex={-1}>
          {children}
        </main>
      </div>

      <CajonMovil
        abierto={cajon}
        alCambiar={setCajon}
        navegacion={navegacion}
        activo={activo}
        disparador={refMenu}
      />
    </div>
  )
}
