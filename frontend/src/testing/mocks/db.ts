import { Collection } from '@msw/data'
import { z } from 'zod'
import { AUDITORIA } from './datos/auditoria'
import { AVISOS } from './datos/avisos'
import { CARGOS } from './datos/cargos'
import { CONFIRMACIONES, PERIODOS } from './datos/cierre'
import { REPARTOS } from './datos/repartos'
import { EQUIPOS, RESERVAS, USOS } from './datos/equipos'
import { AVANCES, HITOS } from './datos/hitos'
import { DESPACHOS } from './datos/despachos'
import { USOS_MATERIA } from './datos/usos-materia'
import { INSUMOS, LOTES } from './datos/inventario'
import { PARAMETROS } from './datos/parametros'
import { PROYECTOS } from './datos/proyectos'
import { CORRECCIONES, SOLICITUDES } from './datos/solicitudes'
import { UBICACIONES } from './datos/ubicaciones'
import { USUARIOS } from './datos/usuarios'

/*
 * Base de datos en memoria de los mocks (@msw/data). Las colecciones imitan las tablas que tendrá
 * PostgreSQL; los handlers las leen y las modifican como lo haría el backend.
 * Recargar la página vuelve a la semilla de datos/ (plan_frontend.md §2).
 */

const rol = z.enum(['administrador', 'coordinador', 'aprobador'])
const prioridad = z.enum(['Crítica', 'Alta', 'Media', 'Baja'])

export const db = {
  usuarios: new Collection({
    schema: z.object({
      id: z.string(),
      nombre: z.string(),
      correo: z.string(),
      /** Solo en los mocks: el backend guarda el hash Argon2id, nunca la contraseña. */
      clave: z.string(),
      rol,
      activo: z.boolean(),
      /** Entró o va a entrar con una contraseña temporal: debe crear la suya (F1.1). */
      debeCambiarClave: z.boolean(),
      ultimoAcceso: z.string().nullable(),
    }),
  }),
  avisos: new Collection({
    schema: z.object({
      id: z.string(),
      usuarioId: z.string(),
      tipo: z.enum(['ok', 'warn', 'err', 'info']),
      titulo: z.string(),
      detalle: z.string().optional(),
      enlace: z.string(),
      fecha: z.string(),
      leido: z.boolean(),
    }),
  }),
  parametros: new Collection({ schema: z.object({ clave: z.string(), valor: z.number() }) }),
  ubicaciones: new Collection({
    schema: z.object({ id: z.string(), nombre: z.string(), descripcion: z.string(), activa: z.boolean() }),
  }),
  proyectos: new Collection({
    schema: z.object({
      /** UUID, como projects.id en PostgreSQL: la API identifica al proyecto por él (decisión 8). */
      id: z.string(),
      /** Código institucional (QUI-024): único, pero solo para mostrarlo. */
      codigo: z.string(),
      nombre: z.string(),
      area: z.enum(['Física', 'Química', 'Biología']),
      estatus: z.enum(['Propuesta', 'En ejecución', 'Suspendido', 'Finalizado']),
      prioridad,
      presupuesto: z.number(),
      /** Suma de sus cargos (F2.7); se actualiza al registrar cada cargo. */
      gastoEjecutado: z.number(),
      coordinadorId: z.string().nullable(),
      sinCoordinador: z.object({ motivo: z.string(), fecha: z.string() }).nullable(),
      planConfirmado: z.boolean(),
      registradoEl: z.string(),
    }),
  }),
  /** Plan de hitos (F2.4). El avance físico del proyecto se calcula con ellos (F2.6, consultas.avanceDe). */
  hitos: new Collection({
    schema: z.object({
      id: z.string(),
      proyecto: z.string(),
      numero: z.number(),
      nombre: z.string(),
      peso: z.number(),
      fechaPrevista: z.string(),
      avance: z.number(),
    }),
  }),
  /** Cargas de avance de cada hito: cada una es un registro nuevo (F2.5). */
  avances: new Collection({
    schema: z.object({
      id: z.string(),
      hitoId: z.string(),
      proyecto: z.string(),
      porcentaje: z.number(),
      fecha: z.string(),
      comentario: z.string().nullable(),
      usuarioId: z.string(),
    }),
  }),
  /** Cargos que forman el gasto ejecutado (F2.7): gastos, despachos y gastos compartidos. */
  cargos: new Collection({
    schema: z.object({
      id: z.string(),
      proyecto: z.string(),
      fecha: z.string(),
      tipo: z.enum(['gasto', 'despacho', 'compartido']),
      concepto: z.string(),
      referencia: z.string().nullable(),
      monto: z.number(),
    }),
  }),
  solicitudes: new Collection({
    schema: z.object({
      /** UUID: la API identifica la solicitud por él (rutas /api/solicitudes/:id, ?pedido=, ?solicitud=). */
      id: z.string(),
      /** Correlativo humano (SOL-2026-0001, REP-2026-0003): lo que se muestra; nunca el UUID. */
      numero: z.string(),
      tipo: z.enum(['gasto', 'retiro', 'reposicion']),
      proyecto: z.string().nullable(),
      estado: z.enum(['Borrador', 'Pendiente de Aprobación', 'Aprobado', 'Rechazado', 'Ejecutado']),
      descripcion: z.string(),
      items: z.array(z.string()),
      insumoId: z.string().nullable(),
      /** Cantidad a reponer, en la unidad del insumo (solo reposiciones, F3.5). */
      cantidad: z.number().nullable(),
      monto: z.number().nullable(),
      creadaPor: z.string().nullable(),
      fecha: z.string(),
      decididaPor: z.string().nullable(),
      motivoRechazo: z.string().nullable(),
      /** Retiro (F5.2): insumos y cantidades, y para qué se usarán. */
      lineas: z.array(z.object({ insumoId: z.string(), cantidad: z.number() })),
      proposito: z.string().nullable(),
      /** Gasto (F5.1): insumo o servicio, cantidad (texto libre: "1 frasco"), descripción y cotización. */
      insumoServicio: z.string().nullable(),
      cantidadGasto: z.string().nullable(),
      justificacion: z.string().nullable(),
      /** Nombre del PDF de la cotización (F5.1): lo pone el servidor al subirlo (POST …/cotizacion). */
      cotizacion: z.string().nullable(),
      /** El PDF subido: tamaño en bytes y contenido en base64. Sin ellos, la descarga arma uno de muestra. */
      cotizacionTamano: z.number().nullable().optional(),
      cotizacionContenido: z.string().nullable().optional(),
      /** Despacho que la ejecutó (retiros ejecutados, F6.2). */
      despacho: z.string().nullable(),
      /** Monto real pagado al ejecutar un gasto (F5.5); se carga al proyecto. */
      montoReal: z.number().nullable(),
    }),
  }),
  correcciones: new Collection({
    schema: z.object({
      id: z.string(),
      despacho: z.string(),
      proyecto: z.string(),
      campo: z.enum(['cantidad', 'proyecto']),
      /** Línea de la bitácora que corrige: insumo y lote del despacho. */
      insumoId: z.string(),
      lote: z.string(),
      /** Lo registrado y lo pedido, como se leen ("500 g", "BIO-011"). */
      valorOriginal: z.string(),
      valorNuevo: z.string(),
      /** El valor pedido, para aplicarlo: cantidad en la unidad del insumo o código del proyecto. */
      cantidadNueva: z.number().nullable(),
      proyectoNuevo: z.string().nullable(),
      motivo: z.string(),
      estado: z.enum(['Pendiente', 'Aprobado', 'Denegado']),
      pedidaPor: z.string(),
      fecha: z.string(),
    }),
  }),
  /** Catálogo de equipos (F4.1) con su estado operacional (F4.2). */
  equipos: new Collection({
    schema: z.object({
      id: z.string(),
      nombre: z.string(),
      /** Código de activo, único (F4.1). */
      codigo: z.string(),
      ubicacionId: z.string(),
      estado: z.enum(['Disponible', 'En uso', 'En mantenimiento']),
      mantenimiento: z.object({ motivo: z.string(), desde: z.string() }).nullable(),
    }),
  }),
  /** Usos de equipos (F4.6): mientras uno está abierto (fin null), el equipo está En uso. */
  usos: new Collection({
    schema: z.object({
      id: z.string(),
      equipoId: z.string(),
      proyecto: z.string(),
      usuarioId: z.string(),
      inicio: z.string(),
      fin: z.string().nullable(),
      observaciones: z.string().nullable(),
      /** Reserva aprobada a la que corresponde, si la hay (también se registra sin reserva). */
      reservaId: z.string().nullable(),
    }),
  }),
  reservas: new Collection({
    schema: z.object({
      id: z.string(),
      equipoId: z.string(),
      proyecto: z.string(),
      inicio: z.string(),
      fin: z.string(),
      /** cancelada: el equipo pasó a mantenimiento (F4.2); como la rechazada, ya no ocupa el horario. */
      estado: z.enum(['pendiente', 'aprobada', 'rechazada', 'cancelada']),
      pedidaPor: z.string(),
      /** Cuándo la pidió el coordinador: la bandeja ordena por antigüedad (F4.5). */
      pedidaEl: z.string(),
      decididaEl: z.string().nullable(),
      /** Por qué la rechazó el aprobador (HU-13: el coordinador lo ve en sus reservas). */
      motivoRechazo: z.string().nullable(),
    }),
  }),
  insumos: new Collection({
    schema: z.object({
      id: z.string(),
      nombre: z.string(),
      unidad: z.string(),
      tipo: z.enum(['Materia prima', 'Consumible de proyecto', 'Consumible de uso general']),
      stockMinimo: z.number(),
      stock: z.number(),
    }),
  }),
  lotes: new Collection({
    schema: z.object({
      codigo: z.string(),
      insumoId: z.string(),
      cantidad: z.number(),
      vence: z.string().nullable(),
      ubicacionId: z.string(),
      ingreso: z.string(),
      costoUnitario: z.number(),
      proveedor: z.string(),
      /** Cantidad recibida; con el costo unitario da el costo del lote (gastos compartidos, F7.3). */
      recibido: z.number(),
      /** Número de lote del proveedor (F6.1). */
      loteProveedor: z.string().nullable(),
      /** UUID de la reposición que cerró esta recepción, si la hubo. */
      solicitud: z.string().nullable(),
    }),
  }),
  /** Bitácora de despachos (F6.2, F6.3): una línea por insumo y lote. Alimenta el pronóstico (F3.7). */
  despachos: new Collection({
    schema: z.object({
      id: z.string(),
      /** Código del despacho (DES-0318); un despacho con dos insumos tiene dos líneas. */
      codigo: z.string(),
      fecha: z.string(),
      /** null en los consumibles de uso general, que no se cargan a un proyecto (RN-02). */
      proyecto: z.string().nullable(),
      insumoId: z.string(),
      lote: z.string(),
      /** Negativa en un movimiento de corrección (F6.6). */
      cantidad: z.number(),
      /** Quién retiró: un nombre, porque el personal de laboratorio no tiene cuenta (F6.3). */
      retiro: z.string().nullable(),
      /** Aprobador que registró el despacho. */
      registradoPor: z.string().nullable(),
      /** En un movimiento de corrección, el despacho que corrige (RN-06). */
      corrige: z.string().nullable(),
      observacion: z.string().nullable(),
    }),
  }),
  /** Uso de materia prima del proyecto (F6.4). Solo documenta; el stock ya bajó con el despacho. */
  usosMateria: new Collection({
    schema: z.object({
      id: z.string(),
      proyecto: z.string(),
      insumoId: z.string(),
      cantidad: z.number(),
      fecha: z.string(),
      observaciones: z.string().nullable(),
      usuarioId: z.string(),
    }),
  }),
  periodos: new Collection({
    schema: z.object({
      id: z.string(),
      tipo: z.enum(['mensual', 'trimestral']),
      inicio: z.string(),
      fin: z.string(),
      estado: z.enum(['abierto', 'en_revision', 'cerrado', 'prorrateado']),
      /** Quién abrió la revisión y cuándo (F7.1); quién lo cerró y cuándo (F7.2). */
      abiertoEl: z.string().nullable(),
      abiertoPor: z.string().nullable(),
      cerradoEl: z.string().nullable(),
      cerradoPor: z.string().nullable(),
    }),
  }),
  confirmaciones: new Collection({
    schema: z.object({
      periodoId: z.string(),
      proyecto: z.string(),
      confirmado: z.boolean(),
      /** Cuándo y quién confirmó los cargos (F7.1). Los cargos y el monto salen de la tabla de cargos. */
      confirmadoEl: z.string().nullable(),
      confirmadoPor: z.string().nullable(),
    }),
  }),
  /** Reparto aplicado de los gastos compartidos de un período (F7.3, F7.4): no se repite. */
  repartos: new Collection({
    schema: z.object({
      periodoId: z.string(),
      criterio: z.enum(['consumo', 'iguales']),
      total: z.number(),
      aplicadoEl: z.string(),
      aplicadoPor: z.string(),
      filas: z.array(
        z.object({ proyecto: z.string(), consumo: z.number(), porcentaje: z.number(), monto: z.number() }),
      ),
    }),
  }),
  auditoria: new Collection({
    schema: z.object({
      id: z.string(),
      fecha: z.string(),
      usuarioId: z.string(),
      ip: z.string(),
      accion: z.enum(['creacion', 'edicion', 'cambio-estado', 'sesion']),
      /** Registro afectado, para filtrar la auditoría (F8.6): "usuario:u-qui", "proyecto:BIO-011"... */
      entidad: z.string().nullable(),
      /** Valores antes y después del cambio (HU-02: el audit log guarda ambos). */
      valorAnterior: z.string().nullable(),
      valorNuevo: z.string().nullable(),
      descripcion: z.string(),
      detalle: z.string().nullable(),
      justificacion: z.string().nullable(),
    }),
  }),
}

const SEMILLA: { [K in keyof typeof db]: unknown[] } = {
  usuarios: USUARIOS,
  avisos: AVISOS,
  parametros: PARAMETROS,
  ubicaciones: UBICACIONES,
  proyectos: PROYECTOS,
  hitos: HITOS,
  avances: AVANCES,
  cargos: CARGOS,
  solicitudes: SOLICITUDES,
  correcciones: CORRECCIONES,
  equipos: EQUIPOS,
  reservas: RESERVAS.map((r) => ({ motivoRechazo: null, ...r })),
  usos: USOS,
  insumos: INSUMOS,
  lotes: LOTES,
  despachos: DESPACHOS,
  usosMateria: USOS_MATERIA,
  periodos: PERIODOS,
  confirmaciones: CONFIRMACIONES,
  repartos: REPARTOS,
  auditoria: AUDITORIA,
}

/** Vacía la base y carga la semilla. Lo llaman el arranque del navegador y cada prueba. */
export async function sembrar() {
  for (const clave of Object.keys(db) as (keyof typeof db)[]) {
    const coleccion = db[clave] as unknown as Collection<z.ZodType>
    const filas = SEMILLA[clave]
    coleccion.clear()
    // structuredClone: cada prueba arranca con una copia limpia, sin cambios de la anterior.
    await coleccion.createMany(filas.length, (i) => structuredClone(filas[i]) as never)
  }
}
