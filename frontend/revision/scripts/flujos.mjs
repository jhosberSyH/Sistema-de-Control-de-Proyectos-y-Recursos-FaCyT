// Revisión E: flujos completos entre roles en una sola pestaña, sin recargar (la base en memoria se conserva).
import { CUENTAS, SALIDA, guardar, ir, navegador } from './lib.mjs'
const n = await navegador()
const c = await n.newContext({ viewport: { width: 1280, height: 900 } })
const p = await c.newPage()
const errores = []
p.on('pageerror', (e) => errores.push(e.message))
const R = {}
const paso = (flujo, texto, ok) => {
  ;(R[flujo] ??= []).push(`${ok ? 'OK' : 'FALLA'} · ${texto}`)
  console.log(flujo, ok ? 'OK' : 'FALLA', texto)
}
const main = () => p.evaluate(() => document.querySelector('main')?.innerText ?? '')
const contador = async (etiqueta) =>
  p.evaluate((e) => {
    const a = [...document.querySelectorAll('nav a')].find((x) => x.innerText.includes(e))
    return a?.querySelector('.cuenta')?.innerText ?? '0'
  }, etiqueta)

/** El cierre de sesión está en Mi perfil (decisión del paso 2). */
async function salir() {
  await ir(p, '/perfil')
  await p.getByRole('button', { name: 'Cerrar sesión' }).first().click()
  await p.waitForURL(/iniciar-sesion/)
}

async function entrarComo(rol) {
  if (!p.url().includes('/iniciar-sesion')) {
    if (p.url().startsWith('http')) {
      await salir()
    } else await p.goto('http://localhost:5173/iniciar-sesion')
  }
  await p.getByLabel('Correo').fill(CUENTAS[rol])
  await p.getByLabel('Contraseña', { exact: true }).fill('Demo2026*')
  await p.getByRole('button', { name: 'Iniciar sesión' }).click()
  await p.waitForURL(/inicio/)
  await p.waitForTimeout(1500)
}

try {
  // 1. Retiro: coordinador pide → aprobador aprueba y despacha → coordinador lo ve, registra uso y pide corrección → aprobador decide
  await entrarComo('coo')
  await ir(p, '/solicitudes?nueva=retiro')
  await p.getByLabel('Proyecto').selectOption('QUI-024')
  await p.getByLabel('Insumo').first().selectOption({ label: 'Etanol 96 %' })
  await p
    .getByLabel(/^Cantidad/)
    .first()
    .fill('3')
  await p.getByLabel(/Para qué se usará/).fill('Lavado de material del hito 4')
  await p.getByRole('button', { name: 'Enviar a aprobación' }).click()
  await p.getByRole('alertdialog').getByRole('button', { name: 'Enviar a aprobación' }).click()
  await p.waitForTimeout(1500)
  const t1 = await main()
  const sol = /SOL-\d+/.exec(t1.match(/Enviaste[^\n]*/)?.[0] ?? '')?.[0]
  paso('1-retiro', `el coordinador envía el retiro (${sol ?? 'sin código'})`, Boolean(sol))
  await entrarComo('apr')
  const bandejaAntes = await contador('Bandeja')
  await ir(p, `/bandeja?pedido=${sol}`)
  await p
    .getByRole('button', { name: /^Aprobar/ })
    .first()
    .click()
  await p.waitForTimeout(1500)
  paso(
    '1-retiro',
    `el aprobador aprueba ${sol} (bandeja ${bandejaAntes} → ${await contador('Bandeja')})`,
    (await main()).includes(`Aprobaste ${sol}`),
  )
  await ir(p, `/almacen/despacho?solicitud=${sol}`)
  await p.getByRole('button', { name: 'Confirmar despacho' }).click()
  await p.waitForTimeout(1800)
  const des = /DES-\d+/.exec(await main())?.[0]
  paso('1-retiro', `despacha ${sol} como ${des}`, Boolean(des))
  await entrarComo('coo')
  await p.getByRole('button', { name: /^Avisos/ }).click()
  await p.waitForTimeout(500)
  const avisos = await p.evaluate(
    () => document.querySelector('[role="dialog"], [data-radix-popper-content-wrapper]')?.innerText ?? '',
  )
  console.log('   avisos:', avisos.replace(/\s+/g, ' ').slice(0, 400))
  paso(
    '1-retiro',
    'la campana del coordinador avisa del despacho',
    avisos.includes(des ?? '¿?') || avisos.includes(sol ?? '¿?'),
  )
  await p.keyboard.press('Escape')
  await ir(p, '/solicitudes')
  paso(
    '1-retiro',
    `${sol} aparece Ejecutado en Mis solicitudes`,
    new RegExp(`${sol}[\\s\\S]{0,300}Ejecutado`).test(await main()),
  )
  await ir(p, `/proyectos/bitacora?despacho=${des}`)
  paso('1-retiro', `${des} está en la bitácora del coordinador`, (await main()).includes(des))
  await ir(p, '/proyectos/uso-materia-prima?proyecto=QUI-024&insumo=ins-etanol')
  await p.getByLabel('Cantidad usada').fill('1')
  await p
    .getByRole('button', { name: /^Registrar uso|^Guardar/ })
    .first()
    .click()
  await p.waitForTimeout(1500)
  paso('1-retiro', 'registra el uso de 1 L de etanol', (await main()).includes('Registraste'))
  await ir(p, `/proyectos/bitacora?despacho=${des}&corregir=1`)
  await p.waitForTimeout(800)
  const d = p.getByRole('dialog')
  await d.getByLabel('Cantidad correcta').fill('2')
  await d.getByLabel('Motivo').fill('Devolví un litro sin abrir.')
  await d.getByRole('button', { name: 'Enviar corrección' }).click()
  await p.waitForTimeout(1500)
  const cor = /COR-\d+/.exec(await main())?.[0]
  paso('1-retiro', `pide la corrección ${cor} de ${des}`, Boolean(cor))
  await entrarComo('apr')
  await ir(p, `/bandeja?tipo=correccion&pedido=${cor}`)
  await p.getByRole('button', { name: 'Aprobar corrección' }).click()
  await p.waitForTimeout(1500)
  paso('1-retiro', `el aprobador aprueba ${cor}`, (await main()).includes(`Aprobaste ${cor}`))
  await ir(p, `/proyectos/bitacora?despacho=${des}`)
  const bit = await main()
  console.log('   bitácora:', bit.replace(/\s+/g, ' ').slice(0, 900))
  paso(
    '1-retiro',
    'la bitácora muestra el movimiento de corrección enlazado',
    bit.includes(`Corrige a ${des}`) ||
      bit.includes(`Corrige a
${des}`) ||
      /Corrige a\s+DES/.test(bit),
  )

  // 2. Gasto: aprobado → marcar como ejecutada → el gasto ejecutado sube en la ficha
  await entrarComo('adm')
  await ir(p, '/proyectos/BIO-011')
  const gastoAntes = /Gasto ejecutado de US\$ [\d.,]+\s+US\$ ([\d.,]+)/.exec(await main())?.[1]
  await entrarComo('apr')
  await ir(p, '/bandeja')
  await p.getByRole('button', { name: /^Por ejecutar/ }).click()
  await p.waitForTimeout(1200)
  const porEjecutar = await main()
  const gasto = /SOL-\d+/.exec(porEjecutar.split('Por ejecutar').slice(1).join(''))?.[0]
  if (gasto) {
    await p.getByText(gasto).first().click()
    await p.waitForTimeout(800)
    await p.getByRole('button', { name: 'Marcar como ejecutada' }).first().click()
    await p.getByLabel('Monto real pagado (US$)').fill('100')
    await p.getByRole('button', { name: 'Marcar como ejecutada' }).last().click()
    await p.waitForTimeout(600)
    await p.getByRole('alertdialog').getByRole('button', { name: 'Marcar como ejecutada' }).click()
    await p.waitForTimeout(1500)
    await entrarComo('adm')
    await ir(p, '/proyectos/BIO-011')
    const gastoDespues = /Gasto ejecutado de US\$ [\d.,]+\s+US\$ ([\d.,]+)/.exec(await main())?.[1]
    paso(
      '2-gasto',
      `ejecutar ${gasto} por US$ 100 sube el gasto de BIO-011 (${gastoAntes} → ${gastoDespues})`,
      gastoAntes !== gastoDespues,
    )
  } else paso('2-gasto', 'no hay un gasto de QUI-024 por ejecutar en la semilla', false)

  // 3. Stock bajo: aprobar la reposición de acetona → recibir el lote → la alerta desaparece
  await entrarComo('apr')
  await ir(p, '/bandeja?tipo=reposicion&pedido=REP-014')
  await p.getByRole('button', { name: 'Aprobar reposición' }).click()
  await p.waitForTimeout(1500)
  await ir(p, '/almacen/recepcion?solicitud=REP-014')
  await p.getByLabel('Número de lote del proveedor').fill('AC-26-1199')
  await p.getByLabel('Costo unitario').fill('13,25')
  await p.getByLabel('Proveedor', { exact: true }).fill('Química Valencia, C.A.')
  await p.getByLabel('Fecha de vencimiento').fill('2027-09-30')
  await p.getByRole('button', { name: 'Registrar lote' }).click()
  await p.waitForTimeout(1800)
  await ir(p, '/inventario')
  const inv = await main()
  paso(
    '3-stock',
    'tras recibir REP-014 la acetona ya no está bajo el mínimo',
    /Acetona grado analítico[\s\S]{0,200}Al día/.test(inv),
  )

  // 6. Cierre: confirmar → cerrar → repartir → reporte → auditoría
  await entrarComo('coo')
  await ir(p, '/cierre/cargos?proyecto=QUI-024')
  await p.getByRole('button', { name: /^Confirmar / }).click()
  await p.waitForTimeout(1500)
  paso('6-cierre', 'la coordinadora confirma los cargos de QUI-024', (await main()).includes('Confirmaste'))
  await entrarComo('apr')
  await ir(p, '/gastos-compartidos/cierre')
  paso('6-cierre', 'el tablero ya cuenta 3 confirmaciones', (await main()).includes('3 de 7'))
  await p
    .getByRole('button', { name: /^Cerrar / })
    .first()
    .click()
  await p
    .getByRole('alertdialog')
    .getByRole('button', { name: /^Cerrar / })
    .click()
  await p.waitForTimeout(1500)
  await p.getByRole('link', { name: 'Repartir gastos compartidos' }).click()
  await p.waitForTimeout(1800)
  await p.getByRole('button', { name: /^Aplicar reparto/ }).click()
  await p.waitForTimeout(1800)
  paso('6-cierre', 'cierra y reparte', (await main()).includes('aplicado'))
  await ir(p, '/reportes')
  await p.getByRole('radio', { name: /Resumen del reparto/ }).check()
  await p.waitForTimeout(1500)
  const rep = await p.evaluate(
    () => document.querySelector('aside[aria-label="Vista previa del PDF"]')?.innerText ?? '',
  )
  paso('6-cierre', 'el reporte del reparto ofrece el período recién repartido', /octubre/i.test(rep))
  await entrarComo('adm')
  await ir(p, '/auditoria')
  const aud = await main()
  paso(
    '6-cierre',
    'la auditoría muestra el reparto y los inicios de sesión',
    /Período octubre de 2026 a Repartido/.test(aud) && aud.includes('Inicio de sesión'),
  )

  // 7. Administración: desactivar una cuenta → no puede entrar
  await ir(p, '/usuarios?q=linares')
  await p
    .getByRole('row')
    .filter({ hasText: 'Rosa Linares' })
    .getByRole('button', { name: /Editar/ })
    .click()
  await p
    .getByRole('dialog')
    .getByRole('button', { name: /Desactivar/ })
    .first()
    .click()
  await p.waitForTimeout(500)
  await p.getByRole('alertdialog').getByRole('button', { name: 'Desactivar cuenta' }).click()
  await p.waitForTimeout(1500)
  await salir()
  await p.getByLabel('Correo').fill('r.linares@cpq.local')
  await p.getByLabel('Contraseña', { exact: true }).fill('Demo2026*')
  await p.getByRole('button', { name: 'Iniciar sesión' }).click()
  await p.waitForTimeout(1500)
  paso(
    '7-admin',
    'una cuenta desactivada no puede iniciar sesión',
    (await p.evaluate(() => document.body.innerText)).includes('desactivada'),
  )
} catch (e) {
  console.log('CORTE', e.message.split('\n')[0])
  await p.screenshot({ path: SALIDA + 'app/X-flujo-corte.png' })
  R.corte = e.message.split('\n')[0]
}
R.errores = errores
guardar('flujos.json', R)
console.log('errores de página:', errores)
await n.close()
