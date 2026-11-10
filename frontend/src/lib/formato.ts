/**
 * Formatos de la interfaz: montos en US$, números con coma decimal (es-VE) y fechas en la
 * zona horaria de la organización (APP_TIMEZONE, README §11).
 */

export const ZONA_HORARIA = 'America/Caracas'
const LOCALE = 'es-VE'

const fmtMonto = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
const fmtEntero = new Intl.NumberFormat(LOCALE, { maximumFractionDigits: 0 })

/** 1284.5 → "US$ 1.284,50" */
export function moneda(valor: number) {
  return `US$ ${fmtMonto.format(valor)}`
}

/** 1284.5 → "1.284,50" (sin símbolo) */
export function monto(valor: number) {
  return fmtMonto.format(valor)
}

/** Número con los decimales justos: 6.2 → "6,2"; 12 → "12" */
export function numero(valor: number, decimales = 0) {
  if (decimales === 0) return fmtEntero.format(valor)
  return new Intl.NumberFormat(LOCALE, { maximumFractionDigits: decimales }).format(valor)
}

/**
 * 62 → "62 %"; 66.5 → "66,5 %" (el avance físico lleva hasta un decimal, mockup 08). Con espacio de no
 * separación: el número y el "%" no se parten entre dos líneas.
 */
export function porcentaje(valor: number) {
  return `${numero(valor, 1)}\u00a0%`
}

const fmtUnDecimal = new Intl.NumberFormat(LOCALE, { minimumFractionDigits: 1, maximumFractionDigits: 1 })

/** Siempre con un decimal, para columnas que suman 100: 32.55 → "32,6 %"; 100 → "100,0 %" (mockup 23). */
export function porcentajeFijo(valor: number) {
  return `${fmtUnDecimal.format(valor)}${String.fromCharCode(160)}%`
}

function aFecha(valor: string | Date) {
  return typeof valor === 'string' ? new Date(valor.length === 10 ? `${valor}T12:00:00` : valor) : valor
}

function partes(valor: string | Date, opciones: Intl.DateTimeFormatOptions) {
  return new Intl.DateTimeFormat(LOCALE, { timeZone: ZONA_HORARIA, ...opciones }).format(aFecha(valor))
}

const mayuscula = (texto: string) => texto.charAt(0).toUpperCase() + texto.slice(1)

/** "Martes 27 de octubre de 2026" (encabezado editorial) */
export function fechaLarga(valor: string | Date) {
  const dia = partes(valor, { weekday: 'long' })
  return `${mayuscula(dia)} ${partes(valor, { day: 'numeric', month: 'long', year: 'numeric' })}`
}

/** "sábado 31/10" */
export function diaYFecha(valor: string | Date) {
  return `${partes(valor, { weekday: 'long' })} ${diaMes(valor)}`
}

/** Plazos como el cierre del período: "hoy, sábado 31/10", "mañana, domingo 01/11" o "el sábado 31/10" */
export function elDia(valor: string | Date, ahora: Date = new Date()) {
  const clave = (d: string | Date) => partes(d, { year: 'numeric', month: '2-digit', day: '2-digit' })
  const dia = clave(valor)
  if (dia === clave(ahora)) return `hoy, ${diaYFecha(valor)}`
  if (dia === clave(new Date(ahora.getTime() + 86400000))) return `mañana, ${diaYFecha(valor)}`
  return `el ${diaYFecha(valor)}`
}

/**
 * Día, mes y año con dos dígitos, armados a mano: algunos navegadores ignoran "2-digit" en es-VE
 * y escriben "2/11" en lugar de "02/11".
 */
function dma(valor: string | Date) {
  const p = new Intl.DateTimeFormat('en-CA', {
    timeZone: ZONA_HORARIA,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(aFecha(valor))
  const v = (t: string) => p.find((x) => x.type === t)?.value ?? ''
  return { d: v('day').padStart(2, '0'), m: v('month').padStart(2, '0'), a: v('year') }
}

/** "27/10/2026" */
export function fechaCorta(valor: string | Date) {
  const { d, m, a } = dma(valor)
  return `${d}/${m}/${a}`
}

/** "2026-11-01": el día en Caracas, para campos de fecha y comparaciones (hoy por defecto) */
export function fechaIso(valor: string | Date = new Date()) {
  const { d, m, a } = dma(valor)
  return `${a}-${m}-${d}`
}

/** "10:42" */
export function hora(valor: string | Date) {
  return partes(valor, { hour: '2-digit', minute: '2-digit', hour12: false })
}

/** "octubre" */
export function nombreMes(valor: string | Date) {
  return partes(valor, { month: 'long' })
}

/** "Hace 5 min", "Hoy, 09:15", "Ayer, 17:40" o "23/10/2026" */
export function momentoRelativo(valor: string | Date, ahora: Date = new Date()) {
  const fecha = aFecha(valor)
  const minutos = Math.round((ahora.getTime() - fecha.getTime()) / 60000)
  if (minutos < 1) return 'Hace un momento'
  if (minutos < 60) return `Hace ${minutos} min`
  const dia = (d: Date) => partes(d, { year: 'numeric', month: '2-digit', day: '2-digit' })
  if (dia(fecha) === dia(ahora)) return `Hoy, ${hora(fecha)}`
  const ayer = new Date(ahora.getTime() - 86400000)
  if (dia(fecha) === dia(ayer)) return `Ayer, ${hora(fecha)}`
  return fechaCorta(fecha)
}

/** "05/11" */
export function diaMes(valor: string | Date) {
  const { d, m } = dma(valor)
  return `${d}/${m}`
}

/** "Jue 29/10" */
export function diaCorto(valor: string | Date) {
  const semana = partes(valor, { weekday: 'short' }).replace('.', '')
  return `${mayuscula(semana)} ${diaMes(valor)}`
}

/** "hace 20 min", "hace 3 h", "hace 1 día", "hace 4 días" */
export function hace(valor: string | Date, ahora: Date = new Date()) {
  const minutos = Math.max(0, Math.round((ahora.getTime() - aFecha(valor).getTime()) / 60000))
  if (minutos < 60) return minutos <= 1 ? 'hace un momento' : `hace ${minutos} min`
  const horas = Math.round(minutos / 60)
  if (horas < 24) return `hace ${horas} h`
  const dias = Math.round(horas / 24)
  return dias === 1 ? 'hace 1 día' : `hace ${dias} días`
}

/** "hoy 08:42", "ayer 16:05" o "23/10 09:00", para usar dentro de una frase */
export function cuandoCorto(valor: string | Date, ahora: Date = new Date()) {
  const fecha = aFecha(valor)
  const dia = (d: Date) => partes(d, { year: 'numeric', month: '2-digit', day: '2-digit' })
  if (dia(fecha) === dia(ahora)) return `hoy ${hora(fecha)}`
  if (dia(fecha) === dia(new Date(ahora.getTime() - 86400000))) return `ayer ${hora(fecha)}`
  return `${diaMes(fecha)} ${hora(fecha)}`
}

/** Saludo según la hora en Caracas: "Buenos días", "Buenas tardes" o "Buenas noches". */
export function saludo(ahora: Date = new Date()) {
  const h = Number(partes(ahora, { hour: '2-digit', hour12: false }))
  if (h >= 5 && h < 12) return 'Buenos días'
  if (h >= 12 && h < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

/** Primera letra en mayúscula ("sábado 31/10" → "Sábado 31/10"). */
export { mayuscula }

/**
 * Lee un monto escrito como en Venezuela: "9.500,00", "9500", "9.500" o "9500,5" → 9500.5.
 * La coma es el decimal y el punto separa miles; un punto seguido de 1 o 2 cifras se toma como
 * decimal ("9500.5"), por costumbre del teclado. Devuelve null si no es un número.
 */
export function leerMonto(texto: string): number | null {
  const t = texto.replace(/\s|US\$/g, '')
  if (!/^\d[\d.,]*$/.test(t)) return null
  let normal: string
  if (t.includes(',')) normal = t.replaceAll('.', '').replace(',', '.')
  else if (/^\d+\.\d{1,2}$/.test(t)) normal = t
  else normal = t.replaceAll('.', '')
  const n = Number(normal)
  return Number.isFinite(n) ? n : null
}
