// Revisión A.3: líneas del mockup que no aparecen en la app (y viceversa), sin contar cifras y fechas.
import fs from 'node:fs'
import { SALIDA } from './lib.mjs'
const [, , archivoApp, ...pares] = process.argv
const m = JSON.parse(fs.readFileSync(SALIDA + 'textos-mockups.json'))
const a = JSON.parse(fs.readFileSync(SALIDA + archivoApp))
const norm = (s) =>
  s
    .replace(/\d+([.,]\d+)*/g, '#')
    .replace(/\s+/g, ' ')
    .toLowerCase()
for (const par of pares) {
  const [mk, ap] = par.split('|')
  const lm = m[`${mk}-1280-light`] ?? []
  const la = a[ap]?.texto ?? []
  const sa = new Set(la.map(norm)),
    sm = new Set(lm.map(norm))
  console.log(`\n=== ${mk} vs ${ap}`)
  console.log('  FALTA EN LA APP:', lm.filter((l) => !sa.has(norm(l))).join(' ¦ '))
  console.log('  SOLO EN LA APP:', la.filter((l) => !sm.has(norm(l))).join(' ¦ '))
}
