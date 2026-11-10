// Revisiones transversales: guardas por rol, error de carga, estado de carga, sesión por expirar y doble envío.
import { SALIDA, entrar, guardar, ir, navegador } from './lib.mjs'
const n = await navegador()
const R = {}
const RUTAS = {
  '/dashboard': ['adm'],
  '/usuarios': ['adm'],
  '/ubicaciones-parametros': ['adm'],
  '/proyectos': ['adm', 'coo'],
  '/proyectos/bitacora': ['coo', 'apr'],
  '/proyectos/uso-materia-prima': ['coo'],
  '/proyectos/QUI-024': ['adm', 'coo'],
  '/proyectos/QUI-024/plan': ['coo'],
  '/inventario': ['apr', 'adm', 'coo'],
  '/inventario/ins-acetona': ['apr', 'adm'],
  '/equipos': ['adm'],
  '/reservas': ['coo', 'apr'],
  '/reservas/uso': ['coo'],
  '/solicitudes': ['coo'],
  '/bandeja': ['apr'],
  '/priorizacion': ['apr', 'adm', 'coo'],
  '/almacen': ['apr'],
  '/almacen/recepcion': ['apr'],
  '/almacen/despacho': ['apr'],
  '/cierre/cargos': ['coo'],
  '/gastos-compartidos/cierre': ['apr'],
  '/gastos-compartidos/reparto': ['apr'],
  '/reportes': ['coo', 'apr', 'adm'],
  '/auditoria': ['adm'],
}
const textoMain = (p) => p.evaluate(() => document.querySelector('main')?.innerText ?? '')
const solo = process.argv[2]

if (!solo || solo === 'guardas') {
  R.guardas = []
  for (const rol of ['adm', 'apr', 'coo']) {
    const [c, p] = await entrar(n, rol)
    for (const [ruta, roles] of Object.entries(RUTAS)) {
      await ir(p, ruta)
      const t = await textoMain(p)
      const bloqueada = t.includes('no está disponible para tu cuenta')
      const esperado = !roles.includes(rol)
      if (bloqueada !== esperado)
        R.guardas.push(
          `${rol} ${ruta}: ${bloqueada ? 'bloqueada' : 'abierta'} (se esperaba ${esperado ? 'bloqueada' : 'abierta'})`,
        )
    }
    if (rol === 'coo') {
      await ir(p, '/proyectos/BIO-011')
      R.rn07 = (await textoMain(p)).replace(/\s+/g, ' ').slice(0, 220)
    }
    await c.close()
  }
  console.log('guardas', R.guardas.length ? R.guardas : 'todas conformes', '| RN-07:', R.rn07)
}

/** msw, el worker y la base desde la página (servidor de desarrollo de Vite). */
async function msw(p) {
  return p.evaluate(async () => {
    // Las mismas URL (con su ?t= de Vite) que cargó la app: así es la misma instancia del módulo
    const urls = performance.getEntriesByType('resource').map((e) => e.name)
    const de = (re) => urls.find((u) => re.test(u))
    const ruta = de(/deps\/msw\.js/)
    window.__worker = (await import(de(/mocks\/browser\.ts/))).worker
    window.__msw = await import(ruta)
    window.__db = (await import(de(/mocks\/db\.ts/))).db
    return ruta
  })
}

if (!solo || solo === 'estados') {
  R.error = {}
  R.carga = {}
  const VISTAS = {
    adm: [
      '/dashboard',
      '/usuarios',
      '/ubicaciones-parametros',
      '/proyectos',
      '/proyectos/QUI-024',
      '/equipos',
      '/auditoria',
      '/inicio',
    ],
    apr: [
      '/bandeja',
      '/inventario',
      '/inventario/ins-acetona',
      '/almacen',
      '/almacen/despacho',
      '/almacen/recepcion',
      '/priorizacion',
      '/gastos-compartidos/cierre',
      '/gastos-compartidos/reparto',
      '/reservas',
    ],
    coo: [
      '/solicitudes',
      '/proyectos/QUI-024/plan',
      '/proyectos/bitacora',
      '/proyectos/uso-materia-prima',
      '/reservas/uso',
      '/cierre/cargos',
      '/reportes',
    ],
  }
  for (const [rol, rutas] of Object.entries(VISTAS)) {
    for (const modo of ['error', 'carga']) {
      const [c, p] = await entrar(n, rol)
      const ruta = await msw(p)
      if (!ruta) {
        console.log('sin ruta de msw')
        await c.close()
        continue
      }
      await p.evaluate((m) => {
        const { http, HttpResponse, delay } = window.__msw
        // Anclada al origen: los módulos de código (/src/modulos/x/api/…) no deben caer aquí
        const re = /^https?:\/\/localhost:5173\/api\/(?!auth|navegacion|avisos|periodos\/actual|__mocks).+/
        window.__worker.use(
          m === 'error'
            ? http.get(re, () => HttpResponse.json({ detail: 'Falla simulada' }, { status: 500 }))
            : http.get(re, async () => {
                await delay(3000)
              }),
        )
      }, modo)
      for (const r of rutas) {
        await p.evaluate((x) => {
          history.pushState({}, '', x)
          dispatchEvent(new PopStateEvent('popstate'))
        }, r)
        await p.waitForTimeout(modo === 'error' ? 6000 : 1000)
        const info = await p.evaluate(() => ({
          texto: (document.querySelector('main')?.innerText ?? '').replace(/\s+/g, ' ').slice(0, 160),
          reintentar: [...document.querySelectorAll('main button')].some((b) =>
            /Reintentar/.test(b.innerText),
          ),
          ocupado: !!document.querySelector('main [aria-busy="true"]'),
          esqueletos: document.querySelectorAll('main .esqueleto').length,
        }))
        ;(modo === 'error' ? R.error : R.carga)[`${rol} ${r}`] = info
        if (modo === 'error' && ['/dashboard', '/bandeja', '/solicitudes'].includes(r))
          await p.screenshot({ path: `${SALIDA}app/X-error${r.replace(/\//g, '_')}.png` })
        if (modo === 'carga' && ['/proyectos', '/bandeja', '/cierre/cargos'].includes(r))
          await p.screenshot({ path: `${SALIDA}app/X-carga${r.replace(/\//g, '_')}.png` })
        if (modo === 'carga') await p.waitForTimeout(2600)
      }
      await c.close()
    }
  }
  console.log(
    'ERROR sin "Reintentar":',
    Object.entries(R.error)
      .filter(([, v]) => !v.reintentar)
      .map(([k, v]) => `${k} → ${v.texto}`),
  )
  console.log(
    'CARGA sin esqueleto ni aria-busy:',
    Object.entries(R.carga)
      .filter(([, v]) => !v.ocupado && !v.esqueletos)
      .map(([k, v]) => `${k} → ${v.texto}`),
  )
}

if (!solo || solo === 'sesion') {
  const c = await n.newContext({ viewport: { width: 1280, height: 900 } })
  const p = await c.newPage()
  await p.clock.install()
  await p.goto('http://localhost:5173/iniciar-sesion')
  await p.getByLabel('Correo').fill('coord.quimica@cpq.local')
  await p.getByLabel('Contraseña', { exact: true }).fill('Demo2026*')
  await p.getByRole('button', { name: 'Iniciar sesión' }).click()
  await p.waitForURL(/inicio/)
  await p.clock.fastForward('28:30')
  await p.waitForTimeout(800)
  R.sesion = await p.evaluate(() =>
    [...document.querySelectorAll('[role="alertdialog"]')]
      .map((d) => d.innerText.replace(/\s+/g, ' '))
      .join(' | '),
  )
  R.sesionFoco = await p.evaluate(() => document.activeElement?.innerText)
  await p.screenshot({ path: `${SALIDA}app/X-sesion.png` })
  await c.close()
  console.log('sesión:', R.sesion, '| foco en:', R.sesionFoco)
}

if (!solo || solo === 'doble') {
  const [c, p] = await entrar(n, 'apr')
  await msw(p)
  await ir(p, '/almacen/despacho?solicitud=SOL-121')
  await p.getByRole('button', { name: 'Confirmar despacho' }).dblclick()
  await p.waitForTimeout(2500)
  R.dobleDespacho = await p.evaluate(() =>
    [...new Set(window.__db.despachos.findMany().map((d) => d.codigo))].filter((x) => x >= 'DES-0319'),
  )
  await ir(p, '/bandeja?tipo=reserva')
  await p.getByRole('button', { name: 'Aprobar reserva' }).dblclick()
  await p.waitForTimeout(2000)
  R.dobleReserva = await p.evaluate(
    () => window.__db.auditoria.findMany().filter((a) => /aprobó la reserva/.test(a.descripcion)).length,
  )
  await c.close()
  console.log(
    'doble clic: despachos nuevos',
    R.dobleDespacho,
    '| aprobaciones de reserva auditadas',
    R.dobleReserva,
  )
}
guardar(`transversal${solo ? '-' + solo : ''}.json`, R)
await n.close()
