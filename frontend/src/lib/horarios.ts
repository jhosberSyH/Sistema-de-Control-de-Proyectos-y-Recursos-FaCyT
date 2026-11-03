/*
 * Horarios de los laboratorios para las reservas de equipos (F4.3, F4.4). Venezuela no tiene horario de
 * verano: la hora de Caracas es siempre UTC-4, así que una fecha y una hora locales dan un instante fijo.
 * Lo usan la vista de reservas y los mocks, igual que lo hará el backend.
 */

/** Los laboratorios atienden de 07:00 a 18:00, de lunes a sábado (calendario del mockup 12). */
export const APERTURA = 7 * 60
export const CIERRE = 18 * 60
/** Un hueco más corto no se ofrece como horario libre. */
export const MINIMO_LIBRE = 30

const DESFASE = '-04:00'

/** "2026-11-04" y "11:00" → "2026-11-04T11:00:00-04:00" */
export function instante(fecha: string, hora: string) {
  return `${fecha}T${hora}:00${DESFASE}`
}

/** Fecha (AAAA-MM-DD) y minutos del día en Caracas de un instante ISO. */
export function partesCaracas(iso: string) {
  const local = new Date(Date.parse(iso) - 4 * 3600_000)
  return {
    fecha: local.toISOString().slice(0, 10),
    minutos: local.getUTCHours() * 60 + local.getUTCMinutes(),
  }
}

/** 660 → "11:00" */
export function horaDe(minutos: number) {
  return `${String(Math.floor(minutos / 60)).padStart(2, '0')}:${String(minutos % 60).padStart(2, '0')}`
}

/** "11:30" → 690; null si no es una hora válida. */
export function minutosDe(hora: string) {
  const m = /^(\d{2}):(\d{2})$/.exec(hora)
  if (!m) return null
  const h = Number(m[1])
  const mm = Number(m[2])
  return h < 24 && mm < 60 ? h * 60 + mm : null
}

/** Día de la semana de una fecha AAAA-MM-DD: 0 domingo … 6 sábado. */
export function diaSemana(fecha: string) {
  return new Date(`${fecha}T12:00:00Z`).getUTCDay()
}

export function sumarDias(fecha: string, dias: number) {
  const d = new Date(`${fecha}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}

/** Lunes de la semana de esa fecha. El domingo (laboratorios cerrados) pasa a la semana siguiente. */
export function lunesDe(fecha: string) {
  const dia = diaSemana(fecha)
  return sumarDias(fecha, dia === 0 ? 1 : 1 - dia)
}

/** ¿Se cruzan dos rangos [inicio, fin)? Que uno termine cuando empieza el otro no es choque. */
export function seCruzan(a: { inicio: string; fin: string }, b: { inicio: string; fin: string }) {
  return Date.parse(a.inicio) < Date.parse(b.fin) && Date.parse(b.inicio) < Date.parse(a.fin)
}

/**
 * Horarios libres de un día entre la apertura y el cierre, descontando los ocupados (F4.4: "los rangos
 * libres más cercanos"). Devuelve minutos del día, ordenados de los más cercanos a `cerca` a los más lejanos.
 */
export function rangosLibres(ocupados: { desde: number; hasta: number }[], cerca = APERTURA) {
  const libres: { desde: number; hasta: number }[] = []
  let cursor = APERTURA
  for (const o of [...ocupados].sort((a, b) => a.desde - b.desde)) {
    if (o.desde - cursor >= MINIMO_LIBRE) libres.push({ desde: cursor, hasta: Math.min(o.desde, CIERRE) })
    cursor = Math.max(cursor, o.hasta)
  }
  if (CIERRE - cursor >= MINIMO_LIBRE) libres.push({ desde: cursor, hasta: CIERRE })
  const distancia = (r: { desde: number; hasta: number }) =>
    cerca < r.desde ? r.desde - cerca : cerca > r.hasta ? cerca - r.hasta : 0
  return libres.sort((a, b) => distancia(a) - distancia(b) || a.desde - b.desde)
}
