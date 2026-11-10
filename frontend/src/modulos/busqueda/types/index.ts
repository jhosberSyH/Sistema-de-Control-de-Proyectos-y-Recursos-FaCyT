export type ResultadoBusqueda = { id: string; titulo: string; detalle: string; enlace: string }

export type GrupoBusqueda = {
  clave: 'proyectos' | 'insumos' | 'equipos' | 'solicitudes'
  titulo: string
  /** Cuántos coinciden en total; la lista trae los primeros. */
  total: number
  resultados: ResultadoBusqueda[]
}

export type RespuestaBusqueda = { q: string; grupos: GrupoBusqueda[] }
