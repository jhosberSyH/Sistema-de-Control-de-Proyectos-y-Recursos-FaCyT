import { http, HttpResponse } from 'msw'
import { nombreMes } from '@/lib/formato'
import { alertasInventario, insumo, parametro, proyectosActivos } from '../consultas'
import { dia, mesAtras } from '../datos/fechas'
import { db } from '../db'
import { demora, exigir } from '../utils'

/*
 * Dashboard ejecutivo (M8; vista 03; F8.1). Solo el Administrador.
 *   GET /api/dashboard?periodo&prioridad
 * Los indicadores se calculan al día: proyectos activos (RN-05), presupuesto global ejecutado (F2.7),
 * insumos bajo su mínimo (F3.4) y lotes por vencer y vencidos (F3.6). El período elige los meses del
 * gráfico de gasto; la prioridad filtra los proyectos de todo el tablero.
 */

const TRIMESTRE = ['Primer', 'Segundo', 'Tercer', 'Cuarto']
const mayuscula = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/** Los meses (de más antiguo a más reciente) de cada opción del filtro de período. */
function opciones() {
  const hoy = dia(0)
  const cinco = [4, 3, 2, 1, 0].map((n) => mesAtras(n))
  const pasado = mesAtras(1)
  // El último trimestre completo
  const m = Number(hoy.slice(5, 7))
  const q = Math.floor((m - 1) / 3) // trimestre en curso (0 a 3)
  const anio = Number(hoy.slice(0, 4)) - (q === 0 ? 1 : 0)
  const tq = (q + 3) % 4
  const trimestre = [0, 1, 2].map((i) => {
    const inicio = new Date(Date.UTC(anio, tq * 3 + i, 1))
    const fin = new Date(Date.UTC(anio, tq * 3 + i + 1, 0))
    return { inicio: inicio.toISOString().slice(0, 10), fin: fin.toISOString().slice(0, 10) }
  })
  const de = (r: { inicio: string }) => `${nombreMes(r.inicio)} de ${r.inicio.slice(0, 4)}`
  return [
    {
      valor: 'ultimos-5',
      etiqueta: `${mayuscula(nombreMes(cinco[0].inicio))} a ${de(cinco[4])}`,
      meses: cinco,
    },
    { valor: `mes-${pasado.inicio.slice(0, 7)}`, etiqueta: mayuscula(de(pasado)), meses: [pasado] },
    {
      valor: `trimestre-${anio}-${tq + 1}`,
      etiqueta: `${TRIMESTRE[tq]} trimestre de ${anio}`,
      meses: trimestre,
    },
  ]
}

export const handlersDashboard = [
  http.get('/api/dashboard', async ({ request }) => {
    await demora()
    const quien = exigir(request, ['administrador'])
    if (quien instanceof Response) return quien
    const url = new URL(request.url)
    const prioridad = url.searchParams.get('prioridad') ?? ''
    const todas = opciones()
    const elegida = todas.find((o) => o.valor === url.searchParams.get('periodo')) ?? todas[0]
    const hoy = dia(0)

    const activos = proyectosActivos()
      .filter((p) => !prioridad || p.prioridad === prioridad)
      .map((p) => ({
        id: p.id,
        codigo: p.codigo,
        nombre: p.nombre,
        prioridad: p.prioridad,
        presupuesto: p.presupuesto,
        gasto: p.gastoEjecutado,
      }))
      // Del que más ejecutó al que menos (mockup 03)
      .sort((a, b) => b.gasto / b.presupuesto - a.gasto / a.presupuesto)
    const codigos = new Set(activos.map((p) => p.codigo))
    const cargos = db.cargos.findMany((q) => q.where({ proyecto: (c) => codigos.has(c) }))

    const a = alertasInventario()
    const reposicion = (insumoId: string) =>
      db.solicitudes.findFirst((q) =>
        q.where({
          tipo: 'reposicion',
          insumoId,
          estado: (e) => e === 'Borrador' || e === 'Pendiente de Aprobación' || e === 'Aprobado',
        }),
      )

    return HttpResponse.json({
      periodos: todas.map(({ valor, etiqueta }) => ({ valor, etiqueta })),
      periodo: elegida.valor,
      proyectos: activos,
      meses: elegida.meses.map((r) => {
        const enCurso = r.inicio <= hoy && hoy <= r.fin
        const valor = cargos
          .filter((c) => c.fecha >= r.inicio && c.fecha <= r.fin)
          .reduce((t, c) => t + c.monto, 0)
        return {
          clave: r.inicio.slice(0, 7),
          etiqueta: mayuscula(nombreMes(r.inicio).slice(0, 3)),
          etiquetaLarga: `${mayuscula(nombreMes(r.inicio))} de ${r.inicio.slice(0, 4)}`,
          valor: Math.round(valor * 100) / 100,
          // El mes en curso va hasta hoy
          hasta: enCurso ? hoy : null,
        }
      }),
      // En el orden del catálogo, como el inicio del aprobador (mockups 02 y 03)
      stock: a.bajoMinimo.map((i) => {
        const r = reposicion(i.id)
        return {
          id: i.id,
          nombre: i.nombre,
          unidad: i.unidad,
          stock: i.stock,
          minimo: i.stockMinimo,
          reposicion: r ? { id: r.id, numero: r.numero, estado: r.estado } : null,
        }
      }),
      vencimientos: [...a.vencidos.sort((x, y) => x.dias - y.dias), ...a.porVencer].map((l) => ({
        lote: l.codigo,
        insumoId: l.insumoId,
        insumo: insumo(l.insumoId).nombre,
        vence: l.vence,
        dias: l.dias,
      })),
      anticipacion: parametro('anticipacion_vencimiento_dias', 30),
      actualizado: new Date().toISOString(),
    })
  }),
]
