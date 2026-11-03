import { cuandoCorto, diaMes, fechaIso, hace, hora } from '@/lib/formato'
import type { FiltroBandeja, GrupoBandeja, Pedido } from '../types/bandeja'

export const GRUPOS: { grupo: GrupoBandeja; clase: string; etiqueta: string }[] = [
  { grupo: 'Crítica', clase: 'critica', etiqueta: 'Crítica' },
  { grupo: 'Alta', clase: 'alta', etiqueta: 'Alta' },
  { grupo: 'Media', clase: 'media', etiqueta: 'Media' },
  { grupo: 'Baja', clase: 'baja', etiqueta: 'Baja' },
  { grupo: 'auto', clase: 'auto', etiqueta: 'Reposiciones automáticas' },
]

/** Botones de filtro del mockup, más "Por ejecutar" (F5.5, plan §7.2). */
export const FILTROS: { valor: FiltroBandeja; etiqueta: string }[] = [
  { valor: 'todos', etiqueta: 'Todos' },
  { valor: 'solicitud', etiqueta: 'Solicitudes' },
  { valor: 'reserva', etiqueta: 'Reservas' },
  { valor: 'correccion', etiqueta: 'Correcciones' },
  { valor: 'reposicion', etiqueta: 'Reposiciones' },
  { valor: 'ejecutar', etiqueta: 'Por ejecutar' },
]

export const esFiltro = (v: string | null): v is FiltroBandeja => FILTROS.some((f) => f.valor === v)

export function coincide(p: Pedido, filtro: FiltroBandeja) {
  if (filtro === 'todos') return true
  if (filtro === 'solicitud') return p.clase === 'gasto' || p.clase === 'retiro'
  return p.clase === filtro
}

/** Columna de la derecha de la lista: "hoy 08:12", "ayer 16:05" o "hace 2 días" (mockup 15). */
export function cuandoLista(fecha: string) {
  const ayer = fechaIso(new Date(Date.now() - 86_400_000))
  const dia = fechaIso(fecha)
  return dia === fechaIso() || dia === ayer ? cuandoCorto(fecha) : hace(fecha)
}

/** Para la frase del detalle: "hoy a las 07:44", "ayer a las 16:05" o "el 25/10 a las 10:30". */
export function cuandoFrase(fecha: string) {
  const dia = fechaIso(fecha)
  if (dia === fechaIso()) return `hoy a las ${hora(fecha)}`
  if (dia === fechaIso(new Date(Date.now() - 86_400_000))) return `ayer a las ${hora(fecha)}`
  return `el ${diaMes(fecha)} a las ${hora(fecha)}`
}

export const minuscula = (t: string) => t.charAt(0).toLowerCase() + t.slice(1)

/** "Juan Pérez" → "Juan", para "Juan lo verá junto al pedido". */
export const nombrePila = (nombre: string) => nombre.split(' ')[0]

/** "de los tres insumos" (mockup 15); con más de cuatro, en cifras. */
export function deLosInsumos(n: number) {
  if (n === 1) return 'del insumo'
  const palabras = ['', '', 'dos', 'tres', 'cuatro']
  return `de los ${palabras[n] ?? n} insumos`
}

/** Etiquetas de los botones de cada tipo de pedido (mockup 15). */
export function etiquetas(p: Pedido) {
  switch (p.clase) {
    case 'gasto':
      return {
        aprobar: 'Aprobar solicitud',
        no: 'Rechazar',
        confirmarNo: 'Rechazar solicitud',
        hecho: 'Rechazaste',
      }
    case 'retiro':
      return {
        aprobar: 'Aprobar retiro',
        no: 'Rechazar',
        confirmarNo: 'Rechazar solicitud',
        hecho: 'Rechazaste',
      }
    case 'reserva':
      return {
        aprobar: 'Aprobar reserva',
        no: 'Rechazar',
        confirmarNo: 'Rechazar reserva',
        hecho: 'Rechazaste',
      }
    case 'correccion':
      return {
        aprobar: 'Aprobar corrección',
        no: 'Denegar con nota',
        confirmarNo: 'Denegar corrección',
        hecho: 'Denegaste',
      }
    case 'reposicion':
      return {
        aprobar: 'Aprobar reposición',
        no: 'Descartar',
        confirmarNo: 'Descartar reposición',
        hecho: 'Descartaste',
      }
  }
}

/** "FIS-008", "FIS-008 y QUI-027" o "BIO-015, QUI-024 y FIS-008". */
export function enumerar(items: string[]) {
  if (items.length <= 1) return items.join('')
  return `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`
}
