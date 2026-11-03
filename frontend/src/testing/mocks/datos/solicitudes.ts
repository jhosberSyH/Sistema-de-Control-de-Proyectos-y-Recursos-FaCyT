import { haceHoras, momento } from './fechas'

/**
 * Solicitudes de gasto y de retiro (RN-03), reposiciones automáticas (RF-37) y correcciones de
 * despacho (RF-35), con los códigos y textos de los mockups 02, 14 y 15.
 */

type Estado = 'Borrador' | 'Pendiente de Aprobación' | 'Aprobado' | 'Rechazado' | 'Ejecutado'

export type SolicitudSemilla = {
  id: string
  tipo: 'gasto' | 'retiro' | 'reposicion'
  /** null en las reposiciones automáticas, que son del inventario y no de un proyecto (RN-02) */
  proyecto: string | null
  estado: Estado
  descripcion: string
  /** Ítems de un retiro o de una reposición */
  items: string[]
  /** Insumo que repone una reposición automática */
  insumoId: string | null
  /** Cantidad a reponer (solo reposiciones) */
  cantidad: number | null
  monto: number | null
  /** null cuando la creó el sistema (reposición automática) */
  creadaPor: string | null
  /** Último cambio de estado (envío, decisión o ejecución) */
  fecha: string
  decididaPor: string | null
  motivoRechazo: string | null
  lineas: { insumoId: string; cantidad: number }[]
  proposito: string | null
  insumoServicio: string | null
  cantidadGasto: string | null
  justificacion: string | null
  cotizacion: string | null
  despacho: string | null
  montoReal: number | null
}

const s = (
  x: Partial<SolicitudSemilla> & Pick<SolicitudSemilla, 'id' | 'tipo' | 'estado' | 'descripcion' | 'fecha'>,
) =>
  ({
    proyecto: null,
    items: [],
    insumoId: null,
    cantidad: null,
    monto: null,
    creadaPor: null,
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
    ...x,
  }) as SolicitudSemilla

export const SOLICITUDES: SolicitudSemilla[] = [
  // Gastos aprobados que esperan la compra: "Por ejecutar" en la bandeja (F5.5)
  s({
    id: 'SOL-113',
    tipo: 'gasto',
    proyecto: 'FIS-008',
    estado: 'Aprobado',
    descripcion: 'Mantenimiento de la bomba de vacío',
    monto: 150,
    creadaPor: 'u-fis',
    fecha: momento(-4, '15:30'),
    decididaPor: 'u-apr',
    insumoServicio: 'Mantenimiento de la bomba de vacío',
    cantidadGasto: '1 servicio',
    justificacion: 'Cambio de aceite y sellos: la bomba ya no llega al vacío que piden las depositaciones.',
    cotizacion: 'cotizacion-servitec.pdf',
  }),
  s({
    id: 'SOL-114',
    tipo: 'gasto',
    proyecto: 'BIO-011',
    estado: 'Aprobado',
    descripcion: 'Kit de extracción de ADN genómico',
    monto: 420,
    creadaPor: 'u-bio',
    fecha: momento(-2, '10:15'),
    decididaPor: 'u-apr',
    insumoServicio: 'Kit de extracción de ADN genómico',
    cantidadGasto: '1 kit de 50 extracciones',
    justificacion: 'Extracción de ADN de los aislados resistentes para la secuenciación del hito 3.',
    cotizacion: 'cotizacion-biolab.pdf',
  }),
  s({
    id: 'SOL-116',
    tipo: 'retiro',
    proyecto: 'FIS-008',
    estado: 'Aprobado',
    descripcion: 'Pasta térmica y alcohol isopropílico',
    items: ['Pasta térmica', 'Alcohol isopropílico'],
    creadaPor: 'u-fis',
    fecha: momento(-1, '09:30'),
    decididaPor: 'u-apr',
    lineas: [
      { insumoId: 'ins-pasta', cantidad: 2 },
      { insumoId: 'ins-isopropilico', cantidad: 0.5 },
    ],
    proposito: 'Montaje de las películas en el criostato',
  }),
  s({
    id: 'SOL-117',
    tipo: 'retiro',
    proyecto: 'QUI-031',
    estado: 'Ejecutado',
    descripcion: 'Guantes de nitrilo M',
    items: ['Guantes de nitrilo M'],
    creadaPor: 'u-qui',
    fecha: momento(-6, '10:10'),
    decididaPor: 'u-apr',
    lineas: [{ insumoId: 'ins-guantes', cantidad: 2 }],
    despacho: 'DES-0307',
  }),
  s({
    id: 'SOL-118',
    tipo: 'gasto',
    proyecto: 'QUI-031',
    estado: 'Rechazado',
    descripcion: 'Filtros de jeringa 0,22 µm',
    monto: 210,
    creadaPor: 'u-qui',
    fecha: momento(-1, '16:42'),
    decididaPor: 'u-apr',
    motivoRechazo: 'Falta la cotización del proveedor',
    insumoServicio: 'Filtros de jeringa 0,22 µm',
    cantidadGasto: '2 cajas de 100',
    justificacion: 'Filtración de las muestras antes del análisis por HPLC.',
  }),
  s({
    id: 'SOL-119',
    tipo: 'gasto',
    proyecto: 'QUI-024',
    estado: 'Pendiente de Aprobación',
    descripcion: 'Nitrato de cerio hexahidratado',
    monto: 640,
    creadaPor: 'u-qui',
    fecha: momento(-1, '16:05'),
    insumoServicio: 'Nitrato de cerio hexahidratado',
    cantidadGasto: '500 g',
    justificacion: 'Precursor para las pruebas catalíticas del hito 4. Se agotó el lote anterior.',
    cotizacion: 'cotizacion-quimica-valencia.pdf',
  }),
  // Retiro ya despachado (DES-0318, el último movimiento de la acetona en el mockup 10)
  s({
    id: 'SOL-120',
    tipo: 'retiro',
    proyecto: 'QUI-024',
    estado: 'Ejecutado',
    descripcion: 'Acetona 1 L, etanol 96 % 2 L',
    items: ['Acetona grado analítico 1 L', 'Etanol 96 % 2 L'],
    lineas: [
      { insumoId: 'ins-acetona', cantidad: 1 },
      { insumoId: 'ins-etanol', cantidad: 2 },
    ],
    creadaPor: 'u-qui',
    fecha: momento(-5, '11:20'),
    decididaPor: 'u-apr',
    despacho: 'DES-0318',
  }),
  s({
    id: 'SOL-121',
    tipo: 'retiro',
    proyecto: 'QUI-024',
    estado: 'Aprobado',
    descripcion: 'Hexano y papel de filtro',
    items: ['Hexano 2 L', 'Papel de filtro cualitativo'],
    creadaPor: 'u-qui',
    fecha: momento(0, '07:50'),
    decididaPor: 'u-apr',
    lineas: [
      { insumoId: 'ins-hexano', cantidad: 2 },
      { insumoId: 'ins-filtro', cantidad: 1 },
    ],
    proposito: 'Lavado y filtración del precursor',
  }),
  s({
    id: 'SOL-122',
    tipo: 'gasto',
    proyecto: 'FIS-010',
    estado: 'Pendiente de Aprobación',
    descripcion: 'Lámpara de mercurio para calibración',
    monto: 380,
    creadaPor: 'u-fis',
    fecha: momento(-2, '11:15'),
    insumoServicio: 'Lámpara de mercurio para calibración',
    cantidadGasto: '1 unidad',
    justificacion: 'La lámpara actual ya no da las líneas de referencia del espectrómetro.',
  }),
  s({
    id: 'SOL-123',
    tipo: 'retiro',
    proyecto: 'QUI-027',
    estado: 'Pendiente de Aprobación',
    descripcion: 'Cloroformo y cloruro de sodio',
    items: ['Cloroformo 1 L', 'Cloruro de sodio 0,5 kg'],
    creadaPor: 'u-rli',
    fecha: momento(-1, '10:40'),
    lineas: [
      { insumoId: 'ins-cloroformo', cantidad: 1 },
      { insumoId: 'ins-nacl', cantidad: 0.5 },
    ],
  }),
  s({
    id: 'SOL-124',
    tipo: 'retiro',
    proyecto: 'BIO-011',
    estado: 'Pendiente de Aprobación',
    descripcion: 'Medio LB agar, placas de Petri y etanol',
    items: ['Medio LB agar 0,25 kg', 'Placas de Petri 90 mm 100 unidades', 'Etanol 96 % 1 L'],
    creadaPor: 'u-bio',
    fecha: haceHoras(3),
    lineas: [
      { insumoId: 'ins-lb', cantidad: 0.25 },
      { insumoId: 'ins-petri', cantidad: 100 },
      { insumoId: 'ins-etanol', cantidad: 1 },
    ],
  }),
  // Borrador del mockup 14: la acetona no alcanza (pide 4 L y hay 2,5 L)
  s({
    id: 'SOL-125',
    tipo: 'retiro',
    proyecto: 'QUI-024',
    estado: 'Borrador',
    descripcion: 'Etanol 96 %, acetona grado analítico',
    items: ['Etanol 96 % 2 L', 'Acetona grado analítico 4 L'],
    lineas: [
      { insumoId: 'ins-etanol', cantidad: 2 },
      { insumoId: 'ins-acetona', cantidad: 4 },
    ],
    proposito: 'Lavado de crisoles después de la calcinación',
    creadaPor: 'u-qui',
    fecha: haceHoras(0.5),
  }),
  s({
    id: 'REP-014',
    tipo: 'reposicion',
    insumoId: 'ins-acetona',
    cantidad: 10,
    estado: 'Borrador',
    descripcion: 'Reposición automática de acetona',
    items: ['Acetona grado analítico 10 L'],
    fecha: momento(0, '06:55'),
  }),
  s({
    id: 'REP-015',
    tipo: 'reposicion',
    insumoId: 'ins-guantes',
    cantidad: 20,
    estado: 'Borrador',
    descripcion: 'Reposición automática de guantes de nitrilo M',
    items: ['Guantes de nitrilo talla M 20 cajas'],
    fecha: momento(-1, '18:20'),
  }),
  // Reposiciones ya aprobadas, esperando la compra: siguen abiertas, así que el metanol y las puntas
  // no generan otra mientras sigan bajo el mínimo (F3.5).
  s({
    id: 'REP-012',
    tipo: 'reposicion',
    insumoId: 'ins-metanol',
    cantidad: 8,
    estado: 'Aprobado',
    descripcion: 'Reposición automática de metanol grado HPLC',
    items: ['Metanol grado HPLC 8 L'],
    fecha: momento(-4, '10:40'),
    decididaPor: 'u-apr',
  }),
  s({
    id: 'REP-013',
    tipo: 'reposicion',
    insumoId: 'ins-puntas',
    cantidad: 20,
    estado: 'Aprobado',
    descripcion: 'Reposición automática de puntas de micropipeta 200 µL',
    items: ['Puntas de micropipeta 200 µL 20 bolsas'],
    fecha: momento(-3, '15:05'),
    decididaPor: 'u-apr',
  }),
]

export type CorreccionSemilla = {
  id: string
  despacho: string
  proyecto: string
  campo: 'cantidad' | 'proyecto'
  insumoId: string
  lote: string
  valorOriginal: string
  valorNuevo: string
  cantidadNueva: number | null
  proyectoNuevo: string | null
  motivo: string
  estado: 'Pendiente' | 'Aprobado' | 'Denegado'
  pedidaPor: string
  fecha: string
}

/** COR-006 del mockup 15: en DES-0312 se registraron 500 g de medio LB agar y se retiraron 50 g. */
export const CORRECCIONES: CorreccionSemilla[] = [
  {
    id: 'COR-006',
    despacho: 'DES-0312',
    proyecto: 'BIO-011',
    campo: 'cantidad',
    insumoId: 'ins-lb',
    lote: 'L-0425',
    valorOriginal: '500 g',
    valorNuevo: '50 g',
    cantidadNueva: 0.05,
    proyectoNuevo: null,
    motivo: 'Se escribió un cero de más. Retiramos un frasco de 50 g',
    estado: 'Pendiente',
    pedidaPor: 'u-bio',
    fecha: haceHoras(2.5),
  },
]
