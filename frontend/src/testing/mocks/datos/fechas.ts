/**
 * Fechas de la semilla, relativas al día en que se cargan los mocks. Así los vencimientos, las
 * reservas y el cierre del período siguen teniendo sentido cualquier día que se pruebe la app.
 * Todas en la zona horaria de la organización (America/Caracas, UTC-4 sin horario de verano).
 */

const DESFASE = '-04:00'

function hoyCaracas() {
  const partes = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Caracas',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date())
  return new Date(`${partes}T00:00:00${DESFASE}`)
}

function aIso(fecha: Date) {
  return fecha.toISOString().slice(0, 10)
}

/** Fecha (AAAA-MM-DD) a n días de hoy. */
export function dia(n: number) {
  const f = hoyCaracas()
  f.setUTCDate(f.getUTCDate() + n)
  return aIso(new Date(f.getTime() + 12 * 3600_000))
}

/** Fecha y hora ISO a n días de hoy, a la hora indicada ("08:42"). */
export function momento(n: number, hora: string) {
  return `${dia(n)}T${hora}:00${DESFASE}`
}

/** Fecha y hora ISO de hace h horas. */
export function haceHoras(h: number) {
  return new Date(Date.now() - h * 3600_000).toISOString()
}

/** Primer y último día del mes en curso. */
export function mesEnCurso() {
  const hoy = dia(0)
  const [a, m] = hoy.split('-').map(Number)
  const ultimo = new Date(Date.UTC(a, m, 0)).getUTCDate()
  const mm = String(m).padStart(2, '0')
  return { inicio: `${a}-${mm}-01`, fin: `${a}-${mm}-${String(ultimo).padStart(2, '0')}` }
}

/** Primer y último día del mes anterior. */
export function mesAnterior() {
  const { inicio } = mesEnCurso()
  const f = new Date(`${inicio}T12:00:00Z`)
  f.setUTCDate(0)
  const fin = aIso(f)
  return { inicio: `${fin.slice(0, 8)}01`, fin }
}

/** Primer y último día del mes que está n meses antes del actual (0 = el mes en curso). */
export function mesAtras(n: number) {
  const [a, m] = dia(0).split('-').map(Number)
  const primero = new Date(Date.UTC(a, m - 1 - n, 1))
  const ultimo = new Date(Date.UTC(a, m - n, 0))
  return { inicio: aIso(primero), fin: aIso(ultimo) }
}

/**
 * Mes cuyo cierre está en revisión: durante los primeros 10 días del mes, el mes pasado; después, el
 * mes en curso (datos/cierre.ts).
 */
export function mesEnRevision() {
  return mesAtras(Number(dia(0).slice(8)) <= 10 ? 1 : 0)
}

/** Días entre hoy y una fecha AAAA-MM-DD, para las semillas que se escriben en días desde hoy. */
export function diasDesdeHoy(fecha: string) {
  return Math.round((Date.parse(`${fecha}T12:00:00Z`) - Date.parse(`${dia(0)}T12:00:00Z`)) / 86400_000)
}

/** El día n (1 = el primero) del mes en revisión, en días desde hoy; nunca después de ayer. */
export function diaEnRevision(n: number) {
  return Math.min(diasDesdeHoy(mesEnRevision().inicio) + n - 1, -1)
}
