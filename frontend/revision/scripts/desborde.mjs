// Reflujo a 320 px (WCAG 1.4.10): lista los elementos que se salen del ancho de la pantalla.
//   MODULOS=C:/ruta/node_modules node desborde.mjs coo /inicio /reservas
import { entrar, ir, navegador } from './lib.mjs'

const [rol, ...rutas] = process.argv.slice(2)
const n = await navegador()
const [c, p] = await entrar(n, rol, Number(process.env.ANCHO ?? 320))
for (const ruta of rutas) {
  await ir(p, ruta)
  const r = await p.evaluate(() => {
    const ancho = innerWidth
    const fuera = []
    for (const el of document.querySelectorAll('main *')) {
      const b = el.getBoundingClientRect()
      if (b.width && b.right > ancho + 1) {
        // Se ignora lo que está dentro de un contenedor con desplazamiento propio
        let ancestro = el.parentElement
        let propio = false
        while (ancestro && ancestro.tagName !== 'MAIN') {
          const o = getComputedStyle(ancestro).overflowX
          if (o === 'auto' || o === 'scroll' || o === 'hidden') propio = true
          ancestro = ancestro.parentElement
        }
        if (!propio)
          fuera.push(
            `${el.tagName.toLowerCase()}.${String(el.className).slice(0, 40)} right=${Math.round(b.right)} w=${Math.round(b.width)}`,
          )
      }
    }
    return { scroll: document.documentElement.scrollWidth, ancho, fuera: fuera.slice(0, 12) }
  })
  console.log(rol, ruta, JSON.stringify(r, null, 1))
}
await n.close()
