// Revisiones A y C sobre la app: reproduce cada estado, captura (1280 claro, 390 claro, 1280 oscuro),
// corre axe en claro y oscuro, mide scroll y objetivos chicos, y guarda el texto de main.
import fs from 'node:fs'
import { SALIDA, axe, entrar, guardar, metricas, navegador, texto } from './lib.mjs'
const tanda = process.argv[2]
const { ESTADOS } = await import(`./estados-${tanda}.mjs`)
const filtro = process.argv[3]
const n = await navegador()
const dir = SALIDA + 'app/'
fs.mkdirSync(dir, { recursive: true })
const resultado = {}
for (const e of ESTADOS.filter((x) => !filtro || x.id.startsWith(filtro))) {
  resultado[e.id] = { modos: {} }
  for (const [ancho, tema] of e.modos ?? [
    [1280, 'light'],
    [390, 'light'],
    [1280, 'dark'],
    [320, 'light'],
  ]) {
    const [c, p] = await entrar(n, e.rol, ancho, tema)
    try {
      if (e.ruta) await p.goto('http://localhost:5173' + e.ruta)
      await p.waitForTimeout(e.espera ?? 1800)
      if (e.pasos) await e.pasos(p, { ancho, tema })
      await p.waitForTimeout(500)
      const m = await metricas(p)
      const r = {
        scroll: m.scroll <= m.ancho ? 'OK' : `MAL ${m.scroll}>${m.ancho}`,
        chicos: m.chicos,
        errores: p.errores,
      }
      if (ancho !== 320)
        await p.screenshot({ path: `${dir}${e.id}-${ancho}-${tema}.png`, fullPage: e.completa ?? true })
      if (ancho === 1280) r.axe = await axe(p)
      if (ancho === 1280 && tema === 'light') resultado[e.id].texto = await texto(p, 'main')
      resultado[e.id].modos[`${ancho}-${tema}`] = r
    } catch (err) {
      resultado[e.id].modos[`${ancho}-${tema}`] = { fallo: String(err.message).split('\n')[0] }
      await p.screenshot({ path: `${dir}${e.id}-${ancho}-${tema}-FALLO.png` }).catch(() => {})
    }
    await c.close()
  }
  console.log(
    e.id,
    Object.entries(resultado[e.id].modos)
      .map(
        ([k, v]) => `${k}:${v.fallo ? 'FALLO ' + v.fallo : v.scroll + ' axe' + (v.axe ? v.axe.length : '-')}`,
      )
      .join(' | '),
  )
}
guardar(`app-${tanda}${filtro ? '-' + filtro : ''}.json`, resultado)
await n.close()
