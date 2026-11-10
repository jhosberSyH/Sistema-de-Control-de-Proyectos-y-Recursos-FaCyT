// Tanda 2: 04 Usuarios, 05 Ubicaciones y parámetros, 06 Proyectos, 07 Ficha de proyecto y 08 Plan de hitos.
const fila = (p, t) => p.getByRole('row').filter({ hasText: t }).first()
export const ESTADOS = [
  { id: '04-Lista', rol: 'adm', ruta: '/usuarios' },
  {
    id: '04-Cambiar_rol',
    rol: 'adm',
    ruta: '/usuarios?q=ochoa',
    pasos: async (p) => {
      await fila(p, 'María Fernanda Ochoa')
        .getByRole('button', { name: /Editar/ })
        .click()
      await p.getByRole('dialog').getByRole('radio', { name: 'Aprobador / Gestor' }).check()
    },
  },
  {
    id: '04-Desactivar',
    rol: 'adm',
    ruta: '/usuarios?q=salazar',
    pasos: async (p) => {
      await fila(p, 'Andrés Salazar')
        .getByRole('button', { name: /Editar/ })
        .click()
      await p
        .getByRole('dialog')
        .getByRole('button', { name: /Desactivar/ })
        .first()
        .click()
      await p.waitForTimeout(400)
    },
  },
  {
    id: '04-Crear',
    rol: 'adm',
    ruta: '/usuarios',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Crear cuenta' }).first().click()
      await p.getByRole('dialog').getByRole('button', { name: 'Crear cuenta' }).click()
    },
  },
  { id: '05-Normal', rol: 'adm', ruta: '/ubicaciones-parametros' },
  {
    id: '05-Con_errores',
    rol: 'adm',
    ruta: '/ubicaciones-parametros',
    pasos: async (p) => {
      const alta = p.getByRole('form', { name: 'Agregar ubicación' })
      await alta.getByLabel('Nombre').fill('Depósito de reactivos B')
      await alta.getByRole('button', { name: 'Agregar' }).click()
      await p.getByLabel(/Anticipación de la alerta/).fill('0')
      await p.getByRole('button', { name: 'Guardar parámetros' }).click()
      await p.waitForTimeout(800)
    },
  },
  { id: '06-Lista', rol: 'adm', ruta: '/proyectos' },
  {
    id: '06-Registrar_código_repetido_',
    rol: 'adm',
    ruta: '/proyectos',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Registrar proyecto' }).first().click()
      const d = p.getByRole('dialog', { name: 'Registrar proyecto' })
      await d.getByLabel('Código institucional').fill('QUI-024')
      await d.getByLabel('Nombre').fill('Síntesis verde de nanopartículas de plata')
      await d.getByLabel('Presupuesto asignado').fill('9500')
      await d.getByRole('radio', { name: 'Media' }).check()
      await d.getByRole('button', { name: 'Registrar proyecto' }).click()
      await p.waitForTimeout(900)
    },
  },
  { id: '06-Coordinador', rol: 'coo', ruta: '/proyectos' },
  { id: '07-Administrador', rol: 'adm', ruta: '/proyectos/QUI-024' },
  { id: '07-Coordinador', rol: 'coo', ruta: '/proyectos/QUI-024' },
  {
    id: '07-Cambiar_estatus',
    rol: 'adm',
    ruta: '/proyectos/QUI-024',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Cambiar estatus' }).click()
      await p.getByRole('dialog').getByRole('radio', { name: 'Suspendido' }).check()
    },
  },
  {
    id: '07-Historial',
    rol: 'adm',
    ruta: '/proyectos/QUI-024',
    modos: [
      [1280, 'light'],
      [390, 'light'],
    ],
    pasos: async (p) => {
      await p.getByRole('tab', { name: 'Historial' }).click()
    },
  },
  {
    id: '07-Gastos',
    rol: 'coo',
    ruta: '/proyectos/QUI-024',
    modos: [
      [1280, 'light'],
      [390, 'light'],
    ],
    pasos: async (p) => {
      await p.getByRole('tab', { name: 'Gastos y despachos' }).click()
    },
  },
  { id: '08-Plan_incompleto', rol: 'coo', ruta: '/proyectos/QUI-035/plan' },
  {
    id: '08-Cargar_avance',
    rol: 'coo',
    ruta: '/proyectos/QUI-024/plan',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Cargar avance del hito 3' }).click()
      await p.getByRole('dialog').getByLabel('Avance alcanzado').fill('85')
    },
  },
  {
    id: '08-Avance_con_error',
    rol: 'coo',
    ruta: '/proyectos/QUI-024/plan',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Cargar avance del hito 3' }).click()
      const d = p.getByRole('dialog')
      await d.getByLabel('Avance alcanzado').fill('120')
      await d.getByRole('button', { name: 'Guardar avance' }).click()
      await p.waitForTimeout(500)
    },
  },
]
