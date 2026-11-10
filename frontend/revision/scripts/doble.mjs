import { entrar, ir, navegador } from './lib.mjs'
const n = await navegador()
const [c, p] = await entrar(n, 'apr')
await ir(p, '/almacen/despacho?solicitud=SOL-121')
await p.getByRole('button', { name: 'Confirmar despacho' }).dblclick()
await p.waitForTimeout(2500)
console.log('éxito:', await p.locator('main h2').first().innerText())
await ir(p, '/proyectos/bitacora?desde=2026-01-01')
const t = await p.evaluate(() => document.querySelector('main').innerText)
console.log(
  'DES-0319 líneas:',
  (t.match(/DES-0319/g) || []).length,
  '| DES-0320:',
  (t.match(/DES-0320/g) || []).length,
)
await ir(p, '/bandeja?tipo=reserva')
const antes = await p.getByRole('button', { name: /^Reservas/ }).innerText()
await p.getByRole('button', { name: 'Aprobar reserva' }).dblclick()
await p.waitForTimeout(2500)
console.log(
  'reservas antes:',
  antes.replace(/\s+/g, ' '),
  '| después:',
  (await p.getByRole('button', { name: /^Reservas/ }).innerText()).replace(/\s+/g, ' '),
  '|',
  (await p.locator('main [role="status"]').allInnerTexts()).join(' / ').slice(0, 200),
)
await c.close()
await n.close()
