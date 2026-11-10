// Tanda 3: 09 Inventario, 10 Ficha de insumo, 11 Equipos, 12 Reservas y 13 Uso de equipo.
const fila = (p, t) => p.getByRole('row').filter({ hasText: t }).first()
/** Jueves de esta semana (RES-042 de BIO-011 ocupa de 09:00 a 11:00, mockup 12). */
function jueves() {
  const h = new Date(new Date().toLocaleString('en-US', { timeZone: 'America/Caracas' }))
  const lunes = new Date(h)
  lunes.setDate(h.getDate() - ((h.getDay() + 6) % 7))
  const j = new Date(lunes)
  j.setDate(lunes.getDate() + (h.getDay() === 0 ? 10 : 3))
  return `${j.getFullYear()}-${String(j.getMonth() + 1).padStart(2, '0')}-${String(j.getDate()).padStart(2, '0')}`
}
const horario = async (p, desde, hasta) => {
  await p.getByLabel('Fecha').fill(jueves())
  await p.getByLabel('Desde').fill(desde)
  await p.getByLabel('Hasta').fill(hasta)
  await p.waitForTimeout(600)
}
export const ESTADOS = [
  { id: '09-Aprobador', rol: 'apr', ruta: '/inventario' },
  { id: '09-Administrador', rol: 'adm', ruta: '/inventario' },
  {
    id: '09-Registrar_nombre_repetido_',
    rol: 'adm',
    ruta: '/inventario',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Registrar insumo' }).first().click()
      const d = p.getByRole('dialog')
      await d.getByLabel('Nombre').fill('Acetona grado analítico')
      await d.getByLabel('Unidad de medida').selectOption('L')
      await d.getByLabel('Stock mínimo').fill('5')
      await d.getByRole('radio', { name: 'Materia prima' }).check()
      await d.getByRole('button', { name: 'Registrar insumo' }).click()
      await p.waitForTimeout(900)
    },
  },
  { id: '09-Coordinador', rol: 'coo', ruta: '/inventario' },
  { id: '10-Con_historial', rol: 'apr', ruta: '/inventario/ins-acetona', espera: 2500 },
  { id: '10-Historial_insuficiente', rol: 'apr', ruta: '/inventario/ins-puntas', espera: 2500 },
  {
    id: '10-Administrador',
    rol: 'adm',
    ruta: '/inventario/ins-acetona',
    espera: 2500,
    modos: [[1280, 'light']],
  },
  { id: '11-Lista', rol: 'adm', ruta: '/equipos' },
  {
    id: '11-Registrar_código_repetido_',
    rol: 'adm',
    ruta: '/equipos',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Registrar equipo' }).first().click()
      const d = p.getByRole('dialog')
      await d.getByLabel('Nombre').fill('Espectrofotómetro UV-Vis')
      await d.getByLabel(/Código de activo/).fill('UC-FACYT-0457')
      await d.getByRole('button', { name: 'Registrar equipo' }).click()
      await p.waitForTimeout(900)
    },
  },
  {
    id: '11-Pasar_a_mantenimiento',
    rol: 'adm',
    ruta: '/equipos',
    pasos: async (p) => {
      await fila(p, 'Difractómetro de rayos X')
        .getByRole('button', { name: 'Pasar a mantenimiento Difractómetro de rayos X' })
        .click()
      await p.waitForTimeout(800)
    },
  },
  { id: '12-Horario_libre', rol: 'coo', ruta: '/reservas', pasos: (p) => horario(p, '11:00', '13:00') },
  { id: '12-Con_choque', rol: 'coo', ruta: '/reservas', pasos: (p) => horario(p, '10:00', '12:00') },
  { id: '12-En_mantenimiento', rol: 'coo', ruta: '/reservas?equipo=eq-cabina' },
  { id: '12-Aprobador', rol: 'apr', ruta: '/reservas' },
  { id: '13-En_uso', rol: 'coo', ruta: '/reservas/uso?equipo=eq-mufla' },
  { id: '13-Disponible', rol: 'coo', ruta: '/reservas/uso?equipo=eq-uvvis' },
]
