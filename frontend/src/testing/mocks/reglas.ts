import { insumo } from './consultas'
import { dia } from './datos/fechas'
import { db } from './db'
import { auditarSistema } from './utils'

/*
 * Reglas que el backend aplica como efecto de otras acciones: la reposición automática después de
 * cambiar el stock o el mínimo de un insumo (alta F3.1, mínimo F3.2, recepciones y despachos F3.3), los
 * cargos que forman el gasto ejecutado (F2.7) y los avisos de la campana.
 */

const ABIERTA = ['Borrador', 'Pendiente de Aprobación', 'Aprobado'] as const

/** Siguiente código de reposición: REP-014, REP-015… */
function siguienteReposicion() {
  const numeros = db.solicitudes
    .findMany((q) => q.where({ tipo: 'reposicion' }))
    .map((s) => Number(s.id.replace('REP-', '')) || 0)
  return `REP-${String(Math.max(0, ...numeros) + 1).padStart(3, '0')}`
}

/**
 * F3.4 y F3.5: si el insumo quedó bajo su mínimo y no tiene una reposición abierta, crea una en
 * "Borrador" para el aprobador y le avisa. Devuelve el código de la reposición creada, o null.
 */
export async function revisarReposicion(insumoId: string) {
  const i = insumo(insumoId)
  if (i.stock >= i.stockMinimo) return null
  const abierta = db.solicitudes.findFirst((q) =>
    q.where({ tipo: 'reposicion', insumoId, estado: (e) => (ABIERTA as readonly string[]).includes(e) }),
  )
  if (abierta) return null

  const id = siguienteReposicion()
  const ahora = new Date().toISOString()
  // Sugerencia: llegar al doble del mínimo, como las reposiciones de la semilla.
  const sugerida = Math.round((i.stockMinimo * 2 - i.stock) * 100) / 100
  await db.solicitudes.create({
    id,
    tipo: 'reposicion',
    proyecto: null,
    estado: 'Borrador',
    descripcion: `Reposición automática de ${i.nombre.charAt(0).toLowerCase()}${i.nombre.slice(1)}`,
    items: [`${i.nombre} ${String(sugerida).replace('.', ',')} ${i.unidad}`],
    insumoId,
    cantidad: sugerida,
    monto: null,
    creadaPor: null,
    fecha: ahora,
    decididaPor: null,
    motivoRechazo: null,
    lineas: [],
    proposito: null,
    insumoServicio: null,
    cantidadGasto: null,
    justificacion: null,
    cotizacion: null,
    despacho: null,
    montoReal: null,
  })
  await auditarSistema(
    `El sistema creó la reposición ${id} en Borrador: el stock de ${i.nombre.charAt(0).toLowerCase()}${i.nombre.slice(1)} bajó del mínimo`,
    { entidad: `solicitud:${id}`, valorNuevo: 'Borrador' },
  )
  for (const apr of db.usuarios.findMany((q) => q.where({ rol: 'aprobador', activo: true }))) {
    await db.avisos.create({
      id: `av-rep-${id}-${apr.id}`,
      usuarioId: apr.id,
      tipo: 'info',
      titulo: `Reposición automática en Borrador: ${i.nombre.charAt(0).toLowerCase()}${i.nombre.slice(1)}`,
      detalle: 'El stock está bajo el mínimo. Revisa la cantidad sugerida antes de aprobar.',
      enlace: `/bandeja?pedido=${id}`,
      fecha: ahora,
      leido: false,
    })
  }
  return id
}

/**
 * F2.7: un cargo nuevo del proyecto suma (o resta, si es negativo) a su gasto ejecutado. Lo usan la
 * ejecución de un gasto (F5.5), los despachos (F6.2) y las correcciones aprobadas (F6.6).
 */
export async function registrarCargo(c: {
  proyecto: string
  tipo: 'gasto' | 'despacho' | 'compartido'
  concepto: string
  referencia: string | null
  monto: number
}) {
  const monto = Math.round(c.monto * 100) / 100
  await db.cargos.create({
    id: `cg-${c.proyecto}-${c.referencia ?? c.tipo}-${Date.now()}`,
    fecha: dia(0),
    ...c,
    monto,
  })
  const p = db.proyectos.findFirst((q) => q.where({ codigo: c.proyecto }))
  if (p) {
    await db.proyectos.update(p, {
      data(x) {
        x.gastoEjecutado = Math.round((x.gastoEjecutado + monto) * 100) / 100
      },
    })
  }
}

/** Aviso en la campana de un usuario (L8: lleva al detalle). */
export async function avisar(
  usuarioId: string | null,
  aviso: {
    clave: string
    tipo: 'ok' | 'warn' | 'err' | 'info'
    titulo: string
    detalle?: string
    enlace: string
  },
) {
  if (!usuarioId) return
  await db.avisos.create({
    id: `av-${aviso.clave}-${usuarioId}-${Date.now()}`,
    usuarioId,
    tipo: aviso.tipo,
    titulo: aviso.titulo,
    detalle: aviso.detalle,
    enlace: aviso.enlace,
    fecha: new Date().toISOString(),
    leido: false,
  })
}

/** Siguiente código de la bitácora: DES-0319, DES-0320… (despachos y movimientos de corrección). */
export function siguienteDespacho() {
  const numeros = db.despachos.findMany().map((d) => Number(d.codigo.replace('DES-', '')) || 0)
  return `DES-${String(Math.max(0, ...numeros) + 1).padStart(4, '0')}`
}
