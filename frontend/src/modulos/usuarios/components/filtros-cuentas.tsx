import { useEffect, useState } from 'react'
import { Icono } from '@/components/icono'
import { NOMBRE_ROL, ROLES, type Rol } from '@/types/roles'
import type { EstadoCuentas, FiltrosCuentas } from '../types'

type Props = {
  filtros: FiltrosCuentas
  alCambiar: (cambios: Partial<FiltrosCuentas>) => void
}

/** Filtros del mockup 04: búsqueda por nombre o correo, rol y estado. La búsqueda espera a que dejes de escribir. */
export function FiltrosDeCuentas({ filtros, alCambiar }: Props) {
  const [texto, setTexto] = useState(filtros.q)

  // Si la búsqueda cambia desde fuera (por ejemplo, con "Ver esa cuenta"), el campo la muestra.
  const [anterior, setAnterior] = useState(filtros.q)
  if (filtros.q !== anterior) {
    setAnterior(filtros.q)
    setTexto(filtros.q)
  }

  useEffect(() => {
    if (texto === filtros.q) return
    const t = window.setTimeout(() => alCambiar({ q: texto, pagina: 1 }), 300)
    return () => window.clearTimeout(t)
  }, [texto, filtros.q, alCambiar])

  return (
    <form className="herr" aria-label="Filtros de cuentas" role="search" onSubmit={(e) => e.preventDefault()}>
      <div className="campo busq">
        <label htmlFor="q">Buscar</label>
        <Icono nombre="buscar" />
        <input
          className="entrada"
          id="q"
          type="search"
          placeholder="Nombre o correo"
          autoComplete="off"
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
        />
      </div>
      <div className="campo">
        <label htmlFor="f-rol">Rol</label>
        <select
          className="entrada"
          id="f-rol"
          value={filtros.rol}
          onChange={(e) => alCambiar({ rol: e.target.value as Rol | '', pagina: 1 })}
        >
          <option value="">Todos</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>
              {NOMBRE_ROL[r]}
            </option>
          ))}
        </select>
      </div>
      <div className="campo">
        <label htmlFor="f-est">Estado</label>
        <select
          className="entrada"
          id="f-est"
          value={filtros.estado}
          onChange={(e) => alCambiar({ estado: e.target.value as EstadoCuentas, pagina: 1 })}
        >
          <option value="activas">Activas</option>
          <option value="desactivadas">Desactivadas</option>
          <option value="todas">Todas</option>
        </select>
      </div>
    </form>
  )
}
