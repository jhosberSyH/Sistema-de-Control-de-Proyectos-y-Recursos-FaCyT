// Biblioteca de la revisión de vistas (plan de revisión, revisiones A y C).
import { createRequire } from 'node:module'
import fs from 'node:fs'
import { fileURLToPath } from 'node:url'
// Carpeta node_modules con playwright-core y axe-core, instalados fuera del proyecto:
//   MODULOS=C:/ruta/node_modules node app.mjs t1
const MODULOS = (process.env.MODULOS ?? '').replace(/\\/g, '/').replace(/\/?$/, '/')
const require = createRequire(MODULOS)
export const { chromium } = require('playwright-core')
export const AXE = fs.readFileSync(MODULOS + 'axe-core/axe.min.js', 'utf8')
export const B = 'http://localhost:5173'
export const MOCKUPS = fileURLToPath(new URL('../../../docs/mockups', import.meta.url))
export const SALIDA = fileURLToPath(new URL('./salida/', import.meta.url))
fs.mkdirSync(SALIDA, { recursive: true })

export const CUENTAS = {
  adm: 'admin@cpq.local',
  apr: 'aprobador@cpq.local',
  coo: 'coord.quimica@cpq.local',
  bio: 'coord.biologia@cpq.local',
  fis: 'coord.fisica@cpq.local',
}

export async function navegador() {
  return chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe' })
}

/** Contexto nuevo con la sesión iniciada por el formulario real (01). */
export async function entrar(n, rol, ancho = 1280, tema = 'light') {
  const c = await n.newContext({
    viewport: { width: ancho, height: 900 },
    colorScheme: tema,
    acceptDownloads: true,
  })
  const p = await c.newPage()
  p.errores = []
  p.on('pageerror', (e) => p.errores.push(e.message))
  p.on('console', (m) => m.type() === 'error' && p.errores.push(m.text()))
  if (rol) {
    await p.goto(B + '/iniciar-sesion')
    await p.getByLabel('Correo').fill(CUENTAS[rol])
    await p.getByLabel('Contraseña', { exact: true }).fill('Demo2026*')
    await p.getByRole('button', { name: 'Iniciar sesión' }).click()
    await p.waitForURL(/inicio/)
  }
  return [c, p]
}

/** Navega dentro de la app sin recargar (conserva la base en memoria). */
export async function ir(p, ruta) {
  await p.evaluate((r) => {
    history.pushState({}, '', r)
    dispatchEvent(new PopStateEvent('popstate'))
  }, ruta)
  await p.waitForTimeout(1600)
}

/** axe-core con las reglas de WCAG 2.2 A y AA. */
export async function axe(p) {
  await p.addScriptTag({ content: AXE })
  return p.evaluate(async () => {
    const r = await window.axe.run(document, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'] },
    })
    return r.violations.map((v) => ({
      id: v.id,
      impacto: v.impact,
      ayuda: v.help,
      nodos: v.nodes
        .slice(0, 6)
        .map((n) => n.target.join(' ') + ' :: ' + (n.failureSummary || '').split('\n').slice(1, 2).join('')),
      total: v.nodes.length,
    }))
  })
}

/** Scroll horizontal y objetivos táctiles chicos (< 24 px, WCAG 2.5.8) dentro de main. */
export async function metricas(p) {
  return p.evaluate(() => {
    const chicos = []
    for (const el of document.querySelectorAll(
      'main a, main button, main input, main select, main [tabindex="0"]',
    )) {
      const r = el.getBoundingClientRect()
      if (!r.width || !r.height) continue
      if (
        (r.width < 24 || r.height < 24) &&
        !(el.tagName === 'A' && getComputedStyle(el).display === 'inline')
      ) {
        chicos.push(
          `${el.tagName.toLowerCase()} "${(el.innerText || el.getAttribute('aria-label') || el.value || '').trim().slice(0, 30)}" ${Math.round(r.width)}x${Math.round(r.height)}`,
        )
      }
    }
    return { scroll: document.documentElement.scrollWidth, ancho: innerWidth, chicos: chicos.slice(0, 10) }
  })
}

/** Texto visible de la zona de contenido, en líneas. */
export async function texto(p, selector) {
  return p.evaluate(
    (s) =>
      (document.querySelector(s)?.innerText ?? '')
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    selector,
  )
}

export function guardar(nombre, datos) {
  fs.writeFileSync(SALIDA + nombre, JSON.stringify(datos, null, 1))
}
