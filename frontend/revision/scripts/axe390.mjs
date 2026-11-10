// Revisión C: axe a 390 px (claro) en todos los estados de las cinco tandas.
import { axe, entrar, guardar, navegador } from './lib.mjs'
const n = await navegador()
const salida = {}
for (const t of ['t1', 't2', 't3', 't4', 't5']) {
  const { ESTADOS } = await import(`./estados-${t}.mjs`)
  for (const e of ESTADOS) {
    if (e.modos && !e.modos.some(([a]) => a === 390)) continue
    const [c, p] = await entrar(n, e.rol, 390, 'light')
    try {
      if (e.ruta) await p.goto('http://localhost:5173' + e.ruta)
      await p.waitForTimeout(e.espera ?? 1800)
      if (e.pasos && !/Rechazar_sin_motivo|Por_ejecutar/.test(e.id)) await e.pasos(p, { ancho: 390 })
      await p.waitForTimeout(400)
      salida[e.id] = await axe(p)
    } catch (err) {
      salida[e.id] = { fallo: String(err.message).split('\n')[0] }
    }
    await c.close()
    const v = salida[e.id]
    if (v.fallo || v.length)
      console.log(e.id, v.fallo ?? v.map((x) => `${x.id}(${x.impacto}) ${x.nodos[0]}`).join(' | '))
  }
}
guardar('axe-390.json', salida)
console.log('fin')
await n.close()
