import { describe, expect, it } from 'vitest'
import { DESPACHOS } from './despachos'
import { INSUMOS, LOTES } from './inventario'

describe('semilla de inventario', () => {
  it('el stock de cada insumo es la suma de sus lotes (F3.3)', () => {
    for (const insumo of INSUMOS) {
      const suma = LOTES.filter((l) => l.insumoId === insumo.id).reduce((t, l) => t + l.cantidad, 0)
      expect(Math.round(suma * 1000) / 1000, insumo.nombre).toBe(insumo.stock)
    }
  })

  it('cada lote es de un insumo del catálogo y su código no se repite', () => {
    const ids = new Set(INSUMOS.map((i) => i.id))
    expect(LOTES.every((l) => ids.has(l.insumoId))).toBe(true)
    expect(new Set(LOTES.map((l) => l.codigo)).size).toBe(LOTES.length)
  })

  it('la bitácora numera sus despachos sin chocar con los de QUI-024 del mes (DES-0301 en adelante)', () => {
    const generados = DESPACHOS.filter((d) => d.id.startsWith('des-h'))
    expect(generados.every((d) => d.codigo < 'DES-0300')).toBe(true)
    expect(new Set(DESPACHOS.map((d) => d.id)).size).toBe(DESPACHOS.length)
  })

  it('lo que se cuenta por pieza no se despacha en fracciones (REV-023)', () => {
    const porPieza = new Set(
      INSUMOS.filter((i) => ['unidades', 'bolsas', 'cajas', 'rollos'].includes(i.unidad)).map((i) => i.id),
    )
    const fraccionados = DESPACHOS.filter((d) => porPieza.has(d.insumoId) && !Number.isInteger(d.cantidad))
    expect(fraccionados.map((d) => `${d.codigo} ${d.insumoId} ${d.cantidad}`)).toEqual([])
  })

  it('la bitácora trae un movimiento de corrección aprobado y enlazado a su despacho (REV-024)', () => {
    const original = DESPACHOS.find((d) => d.codigo === 'DES-0297')!
    const correccion = DESPACHOS.find((d) => d.corrige === 'DES-0297')!
    expect(correccion.cantidad).toBe(-20)
    expect(correccion.lote).toBe(original.lote)
    expect(correccion.registradoPor).toBe('u-apr')
  })
})
