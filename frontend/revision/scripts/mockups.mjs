// Revisión A: captura cada estado del comparador de los 25 mockups (1280 y 390 px, claro y oscuro) y su texto.
import fs from 'node:fs'
import { MOCKUPS, SALIDA, guardar, navegador } from './lib.mjs'
const n = await navegador()
const dir = SALIDA + 'mockups/'
fs.mkdirSync(dir, { recursive: true })
const textos = {}
const soloUno = process.argv[2]
for (const m of fs
  .readdirSync(MOCKUPS)
  .filter((d) => /^\d\d-/.test(d) && (!soloUno || d.startsWith(soloUno)))) {
  for (const [ancho, tema] of [
    ['escritorio', 'light'],
    ['telefono', 'light'],
    ['escritorio', 'dark'],
  ]) {
    const c = await n.newContext({ viewport: { width: 1360, height: 950 } })
    const p = await c.newPage()
    await p.goto(`file:///${MOCKUPS}/${m}/index.html`)
    await p.waitForTimeout(500)
    await p.click(`#comparador [data-ancho="${ancho}"]`)
    await p.click(`#comparador [data-tema="${tema}"]`)
    const botones = await p.$$eval('#comparador button', (bs) =>
      bs
        .map((b, i) => ({ i, t: b.innerText.trim(), extra: !b.dataset.ancho && !b.dataset.tema }))
        .filter((b) => b.extra),
    )
    const estados = botones.length ? botones : [{ i: -1, t: 'unico' }]
    for (const b of estados) {
      if (b.i >= 0) {
        await p.locator('#comparador button').nth(b.i).click()
        await p.waitForTimeout(400)
      }
      const nombre = `${m.slice(0, 2)}-${b.t.replace(/[^\wáéíóúñ]+/gi, '_').slice(0, 28)}-${ancho === 'escritorio' ? 1280 : 390}-${tema}`
      await p.locator('.marco').screenshot({ path: `${dir}${nombre}.png` })
      if (ancho === 'escritorio' && tema === 'light') {
        textos[nombre] = await p.evaluate(() =>
          (document.querySelector('.mk main')?.innerText ?? '')
            .split('\n')
            .map((l) => l.trim())
            .filter(Boolean),
        )
      }
    }
    await c.close()
  }
  console.log('listo', m)
}
guardar(soloUno ? `textos-mockups-${soloUno}.json` : 'textos-mockups.json', textos)
await n.close()
