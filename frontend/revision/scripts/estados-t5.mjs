// Tanda 5: 18 Despacho, 19 Bitácora, 20 Uso de materia prima, 21 Revisión de cargos, 22 Cierre,
// 23 Reparto, 24 Reportes y 25 Auditoría.
const cerrarYRepartir = async (p, aplicar) => {
  await p
    .getByRole('button', { name: /^Cerrar / })
    .first()
    .click()
  await p
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Cerrar / })
    .click()
  await p.getByRole('link', { name: 'Repartir gastos compartidos' }).click()
  await p.waitForTimeout(1800)
  if (aplicar) {
    await p.getByRole('button', { name: /^Aplicar reparto/ }).click()
    await p.waitForTimeout(1500)
  }
}
export const ESTADOS = [
  { id: '18-Elegir_lotes', rol: 'apr', ruta: '/almacen/despacho?solicitud=SOL-121' },
  {
    id: '18-Despacho_registrado',
    rol: 'apr',
    ruta: '/almacen/despacho?solicitud=SOL-121',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Confirmar despacho' }).click()
      await p.waitForTimeout(1500)
    },
  },
  { id: '19-Bitácora', rol: 'coo', ruta: '/proyectos/bitacora?despacho=DES-0318' },
  {
    id: '19-Pedir_corrección',
    rol: 'coo',
    ruta: '/proyectos/bitacora?despacho=DES-0318',
    pasos: async (p) => {
      await p
        .getByRole('row')
        .filter({ hasText: 'DES-0318' })
        .first()
        .getByRole('button', { name: /Pedir corrección/ })
        .click()
      const d = p.getByRole('dialog')
      await d.getByLabel('Cantidad correcta').fill('0,5')
      await d.getByLabel('Motivo').fill('Devolví un frasco de 0,5 L sin abrir.')
    },
  },
  {
    id: '19-Sin_motivo',
    rol: 'coo',
    ruta: '/proyectos/bitacora?despacho=DES-0318',
    pasos: async (p) => {
      await p
        .getByRole('row')
        .filter({ hasText: 'DES-0318' })
        .first()
        .getByRole('button', { name: /Pedir corrección/ })
        .click()
      const d = p.getByRole('dialog')
      await d.getByLabel('Cantidad correcta').fill('0,5')
      await d.getByRole('button', { name: 'Enviar corrección' }).click()
      await p.waitForTimeout(400)
    },
  },
  {
    id: '19-Aprobador',
    rol: 'apr',
    ruta: '/proyectos/bitacora',
    modos: [
      [1280, 'light'],
      [390, 'light'],
    ],
  },
  {
    id: '20-Normal',
    rol: 'coo',
    ruta: '/proyectos/uso-materia-prima?proyecto=QUI-024&insumo=ins-etanol',
    pasos: async (p) => {
      await p.getByLabel('Cantidad usada').fill('0,8')
    },
  },
  {
    id: '20-Supera_lo_despachado',
    rol: 'coo',
    ruta: '/proyectos/uso-materia-prima?proyecto=QUI-024&insumo=ins-etanol',
    pasos: async (p) => {
      await p.getByLabel('Cantidad usada').fill('3')
    },
  },
  { id: '21-Por_confirmar', rol: 'coo', ruta: '/cierre/cargos?proyecto=QUI-024' },
  {
    id: '21-Confirmado',
    rol: 'coo',
    ruta: '/cierre/cargos?proyecto=QUI-024',
    pasos: async (p) => {
      await p.getByRole('button', { name: /^Confirmar los/ }).click()
      await p.waitForTimeout(1500)
    },
  },
  {
    id: '21-Correccion_pendiente',
    rol: 'bio',
    ruta: '/cierre/cargos',
    modos: [
      [1280, 'light'],
      [390, 'light'],
    ],
  },
  { id: '22-Confirmaciones', rol: 'apr', ruta: '/gastos-compartidos/cierre' },
  {
    id: '22-Abrir_revisión',
    rol: 'apr',
    ruta: '/gastos-compartidos/cierre',
    pasos: async (p) => {
      await cerrarYRepartir(p, true)
      await p.getByRole('link', { name: 'Abrir la revisión del siguiente período' }).click()
      await p.waitForTimeout(1500)
    },
  },
  {
    id: '22-Período_cruzado',
    rol: 'apr',
    ruta: '/gastos-compartidos/cierre',
    pasos: async (p) => {
      await cerrarYRepartir(p, true)
      await p.getByRole('link', { name: 'Abrir la revisión del siguiente período' }).click()
      await p.waitForTimeout(1500)
      const f = p.getByRole('form', { name: 'Abrir revisión' })
      const desde = await f.getByLabel('Desde').inputValue()
      const d = new Date(desde + 'T12:00:00Z')
      d.setUTCDate(d.getUTCDate() - 17)
      await f.getByLabel('Desde').fill(d.toISOString().slice(0, 10))
      await f.getByRole('button', { name: 'Abrir revisión y enviar cargos' }).click()
      await p.waitForTimeout(1200)
    },
  },
  {
    id: '23-Comparar',
    rol: 'apr',
    ruta: '/gastos-compartidos/cierre',
    pasos: (p) => cerrarYRepartir(p, false),
  },
  {
    id: '23-Aplicado',
    rol: 'apr',
    ruta: '/gastos-compartidos/cierre',
    pasos: (p) => cerrarYRepartir(p, true),
  },
  {
    id: '23-Sin_periodo',
    rol: 'apr',
    ruta: '/gastos-compartidos/reparto',
    modos: [
      [1280, 'light'],
      [390, 'light'],
    ],
  },
  { id: '24-Coordinador', rol: 'coo', ruta: '/reportes' },
  { id: '24-Aprobador', rol: 'apr', ruta: '/reportes' },
  {
    id: '24-Sin_datos',
    rol: 'coo',
    ruta: '/reportes',
    pasos: async (p) => {
      await p.getByLabel('Proyectos').selectOption('QUI-031')
      await p.getByLabel('Desde').fill('2026-01-01')
      await p.getByLabel('Hasta').fill('2026-01-31')
      await p.waitForTimeout(1500)
    },
  },
  {
    id: '24-Hoja_de_vida',
    rol: 'coo',
    ruta: '/reportes?tipo=hoja-de-vida&equipo=eq-mufla',
    modos: [
      [1280, 'light'],
      [390, 'light'],
    ],
  },
  { id: '25-Recientes', rol: 'adm', ruta: '/auditoria' },
  {
    id: '25-Con_filtros',
    rol: 'adm',
    ruta: '/auditoria',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Filtrar' }).click()
      await p.getByLabel('Usuario').selectOption({ label: 'Carmen Pérez' })
      await p.waitForTimeout(1500)
    },
  },
]
