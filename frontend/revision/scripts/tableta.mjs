// Tableta (768 px) y otros anchos: recorre las rutas de cada rol, mide el desborde y guarda una captura.
//   MODULOS=C:/ruta/node_modules ANCHO=768 node tableta.mjs
import fs from 'node:fs'
import { SALIDA, entrar, ir, navegador } from './lib.mjs'

const ANCHO = Number(process.env.ANCHO ?? 768)
const RUTAS = {
  adm: [
    '/inicio',
    '/dashboard',
    '/usuarios',
    '/ubicaciones-parametros',
    '/proyectos',
    '/proyectos/QUI-024',
    '/inventario',
    '/inventario/ins-acetona',
    '/equipos',
    '/reportes',
    '/auditoria',
    '/priorizacion',
    '/buscar?q=etanol',
    '/perfil',
  ],
  apr: [
    '/inicio',
    '/bandeja',
    '/inventario',
    '/inventario/ins-acetona',
    '/almacen',
    '/almacen/recepcion',
    '/almacen/despacho',
    '/priorizacion',
    '/gastos-compartidos/cierre',
    '/gastos-compartidos/reparto',
    '/reservas',
    '/reportes',
    '/proyectos/bitacora',
  ],
  coo: [
    '/inicio',
    '/solicitudes',
    '/proyectos',
    '/proyectos/QUI-024',
    '/proyectos/QUI-024/plan',
    '/proyectos/bitacora',
    '/proyectos/uso-materia-prima',
    '/reservas',
    '/reservas/uso',
    '/cierre/cargos',
    '/reportes',
    '/inventario',
    '/buscar?q=QUI',
  ],
}
const carpeta = `${SALIDA}ancho-${ANCHO}/`
fs.mkdirSync(carpeta, { recursive: true })
const n = await navegador()
const malas = []
let total = 0
for (const [rol, rutas] of Object.entries(RUTAS)) {
  const [c, p] = await entrar(n, rol, ANCHO)
  for (const ruta of rutas) {
    await ir(p, ruta)
    await p.waitForTimeout(500)
    const m = await p.evaluate(() => ({ scroll: document.documentElement.scrollWidth, ancho: innerWidth }))
    total += 1
    if (m.scroll > m.ancho) malas.push(`${rol} ${ruta}: ${m.scroll} > ${m.ancho}`)
    await p.screenshot({ path: `${carpeta}${rol}-${ruta.replace(/[^a-z0-9]+/gi, '_')}.png`, fullPage: true })
  }
  await c.close()
}
console.log(`${total} vistas a ${ANCHO} px. Con scroll horizontal:`, malas.length ? malas : 'ninguna')
await n.close()
