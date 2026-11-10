// Verifica en el navegador las correcciones de la revisión (REV-001 a REV-027): capturas y axe.
//   MODULOS=C:/ruta/node_modules node correcciones.mjs        (con npm run dev:mock corriendo)
import fs from 'node:fs'
import { SALIDA, axe, entrar, ir, navegador } from './lib.mjs'

const n = await navegador()
const carpeta = SALIDA + 'post/'
fs.mkdirSync(carpeta, { recursive: true })

/** [rol, ruta, ancho, nombre] */
const CASOS = [
  ['coo', '/reservas', 1280, 'reservas-rechazadas'],
  ['adm', '/buscar?q=etanol', 1280, 'buscar-adm'],
  ['coo', '/buscar?q=QUI', 1280, 'buscar-coo'],
  ['coo', '/inicio', 390, 'inicio-coo-390'],
  ['adm', '/ubicaciones-parametros', 1280, 'ubicaciones'],
  ['adm', '/proyectos/QUI-024', 390, 'ficha-390'],
  ['apr', '/inventario/ins-acetona', 1280, 'ficha-insumo'],
  ['adm', '/dashboard', 1280, 'dashboard'],
  ['adm', '/auditoria', 390, 'auditoria-390'],
  ['coo', '/proyectos/bitacora?proyecto=QUI-031', 390, 'bitacora-390'],
  ['coo', '/proyectos/bitacora?proyecto=QUI-031', 1280, 'bitacora'],
  ['adm', '/inicio', 1280, 'inicio-adm'],
]
const AXE = [
  ['apr', '/inventario/ins-acetona', 1280],
  ['adm', '/dashboard', 390],
  ['apr', '/almacen/despacho?solicitud=SOL-121', 1280],
  ['adm', '/buscar?q=etanol', 1280],
  ['coo', '/reservas', 390],
]

const resultado = { capturas: {}, axe: {} }
for (const [rol, ruta, ancho, nombre] of CASOS) {
  const [c, p] = await entrar(n, rol, ancho)
  await ir(p, ruta)
  await p.waitForTimeout(800)
  resultado.capturas[nombre] = await p.evaluate(() => ({
    scroll: document.documentElement.scrollWidth,
    ancho: innerWidth,
    texto: (document.querySelector('main')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 260),
  }))
  await p.screenshot({ path: `${carpeta}${nombre}.png`, fullPage: true })
  await c.close()
}
for (const [rol, ruta, ancho] of AXE) {
  const [c, p] = await entrar(n, rol, ancho)
  await ir(p, ruta)
  const v = await axe(p)
  resultado.axe[`${rol} ${ruta} ${ancho}`] = v.map((x) => `${x.id} (${x.impacto}) ×${x.total}`)
  await c.close()
}
console.log(JSON.stringify(resultado, null, 1))
await n.close()
