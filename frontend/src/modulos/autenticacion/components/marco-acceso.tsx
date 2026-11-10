import type { ReactNode } from 'react'
import escudoUc from '@/assets/logos/escudo-uc.png'
import isotipoFacyt from '@/assets/logos/facyt-isotipo.png'
import './inicio-sesion.css'

type Props = {
  /** Id del primer campo del formulario, destino de "Saltar al formulario". */
  primerCampo: string
  children: ReactNode
}

/**
 * Marco de las pantallas sin sesión (vista 01): banda institucional, nombre del sistema, columna del
 * formulario y pie. Lo comparten el inicio de sesión y "Crea tu contraseña".
 */
export function MarcoAcceso({ primerCampo, children }: Props) {
  return (
    <div className="login">
      <a className="saltar" href={`#${primerCampo}`}>
        Saltar al formulario
      </a>

      <div className="banda">
        <div className="banda-logos">
          <img
            className="escudo"
            src={escudoUc}
            alt="Escudo de la Universidad de Carabobo"
            width={54}
            height={71}
          />
          <img className="logo-iso" src={isotipoFacyt} alt="Logo de la FaCyT" width={48} height={48} />
        </div>
        <p>
          <strong>Universidad de Carabobo</strong> · Facultad Experimental de Ciencias y Tecnología
        </p>
      </div>

      <div className="lg">
        <section className="lg-marca" aria-label="Universidad y sistema">
          <div style={{ display: 'grid', gap: 14 }}>
            <h1 className="lg-sistema">Control de Proyectos y Recursos</h1>
            <p className="lg-bajada">
              Proyectos, inventario, equipos y aprobaciones de los laboratorios de Física, Química y Biología
              en un solo lugar.
            </p>
          </div>
          <ul className="lg-datos" aria-label="Áreas">
            <li>
              <span className="mono">FIS</span> Física
            </li>
            <li>
              <span className="mono">QUI</span> Química
            </li>
            <li>
              <span className="mono">BIO</span> Biología
            </li>
          </ul>
        </section>

        <main className="lg-form">{children}</main>
      </div>

      <footer className="lg-pie">
        <span>Facultad Experimental de Ciencias y Tecnología · Universidad de Carabobo</span>
        <span>Valencia, Venezuela</span>
      </footer>
    </div>
  )
}
