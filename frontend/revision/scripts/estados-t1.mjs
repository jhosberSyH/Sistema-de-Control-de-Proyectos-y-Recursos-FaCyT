// Tanda 1: marco, 01 Inicio de sesión, 02 Inicio por rol, 03 Dashboard y vistas sin mockup del marco.
export const ESTADOS = [
  { id: '01-Normal', rol: null, ruta: '/iniciar-sesion', mockup: '01-Normal' },
  {
    id: '01-Con_error',
    rol: null,
    ruta: '/iniciar-sesion',
    mockup: '01-Con_error',
    pasos: async (p) => {
      await p.getByLabel('Correo').fill('coord.quimica@cpq.local')
      await p.getByLabel('Contraseña', { exact: true }).fill('clave-mal')
      await p.getByRole('button', { name: 'Iniciar sesión' }).click()
      await p.waitForTimeout(1200)
    },
  },
  {
    id: '01-Vacio',
    rol: null,
    ruta: '/iniciar-sesion',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Iniciar sesión' }).click()
      await p.waitForTimeout(500)
    },
  },
  {
    id: '01-Desactivada',
    rol: null,
    ruta: '/iniciar-sesion',
    pasos: async (p) => {
      await p.getByLabel('Correo').fill('p.gil@cpq.local')
      await p.getByLabel('Contraseña', { exact: true }).fill('Demo2026*')
      await p.getByRole('button', { name: 'Iniciar sesión' }).click()
      await p.waitForTimeout(1200)
    },
  },
  {
    id: '01-CrearClave',
    rol: null,
    ruta: '/iniciar-sesion',
    pasos: async (p) => {
      await p.getByLabel('Correo').fill('v.ruiz@cpq.local')
      await p.getByLabel('Contraseña', { exact: true }).fill('Demo2026*')
      await p.getByRole('button', { name: 'Iniciar sesión' }).click()
      await p.waitForTimeout(1800)
    },
  },
  { id: '02-Coordinador', rol: 'coo', ruta: '/inicio', mockup: '02-Coordinador' },
  { id: '02-Aprobador', rol: 'apr', ruta: '/inicio', mockup: '02-Aprobador' },
  { id: '02-Administrador', rol: 'adm', ruta: '/inicio', mockup: '02-Administrador' },
  { id: '03-unico', rol: 'adm', ruta: '/dashboard', espera: 2500, mockup: '03-unico' },
  {
    id: '03-Detalle',
    rol: 'adm',
    ruta: '/dashboard',
    espera: 2500,
    pasos: async (p) => {
      await p.getByRole('button', { name: /Lotes próximos a vencer/ }).click()
    },
  },
  {
    id: 'M-Cajon',
    rol: 'apr',
    ruta: '/inicio',
    modos: [
      [390, 'light'],
      [390, 'dark'],
    ],
    pasos: async (p) => {
      await p.getByRole('button', { name: /Abrir menú/ }).click()
      await p.waitForTimeout(400)
    },
  },
  {
    id: 'M-Avisos',
    rol: 'coo',
    ruta: '/inicio',
    modos: [
      [1280, 'light'],
      [390, 'light'],
      [1280, 'dark'],
    ],
    pasos: async (p) => {
      await p.getByRole('button', { name: /^Avisos/ }).click()
      await p.waitForTimeout(600)
    },
  },
  { id: 'M-404', rol: 'coo', ruta: '/no-existe' },
  { id: 'M-SinPermiso', rol: 'coo', ruta: '/usuarios' },
  { id: 'M-Perfil', rol: 'coo', ruta: '/perfil' },
  { id: 'M-Buscar', rol: 'coo', ruta: '/buscar?q=acetona', modos: [[1280, 'light']] },
]
