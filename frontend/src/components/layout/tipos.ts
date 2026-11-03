import type { NombreIcono } from '@/components/icono'

/** Entrada del menú lateral (riel) y del cajón del teléfono. */
export type ItemNavegacion = {
  clave: string
  icono: NombreIcono
  etiqueta: string
  ruta: string
  /** Pendientes de esa sección; 0 o vacío no muestra la píldora. */
  contador?: number
  /** Qué cuenta el contador, para lectores de pantalla ('9 por decidir y 2 por ejecutar'); sin él, 'N pendientes'. */
  detalleContador?: string
}

export type PersonaSesion = { nombre: string; iniciales: string; rol: string }
