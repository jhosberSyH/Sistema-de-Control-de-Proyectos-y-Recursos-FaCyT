import { dia, diaEnRevision } from './fechas'

/**
 * Insumos y lotes (F3.1 a F3.6). Varios quedan bajo el mínimo, uno próximo a vencer y uno vencido,
 * para que se vean las alertas, como pide el seed del README §13.
 */
export type InsumoSemilla = {
  id: string
  nombre: string
  unidad: string
  tipo: 'Materia prima' | 'Consumible de proyecto' | 'Consumible de uso general'
  stockMinimo: number
  stock: number
}

type Tipo = InsumoSemilla['tipo']
const MP: Tipo = 'Materia prima'
const PROY: Tipo = 'Consumible de proyecto'
const GRAL: Tipo = 'Consumible de uso general'

const i = (id: string, nombre: string, unidad: string, tipo: Tipo, stockMinimo: number, stock: number) => ({
  id: `ins-${id}`,
  nombre,
  unidad,
  tipo,
  stockMinimo,
  stock,
})

/**
 * Catálogo de los mockups 02, 03, 09 y 10: cuatro insumos bajo su mínimo (acetona, guantes, metanol y
 * puntas), el resto al día. Acetona y guantes van primero porque son los que muestra el inicio del
 * aprobador. El stock de cada uno es la suma de sus lotes (abajo).
 */
export const INSUMOS: InsumoSemilla[] = [
  i('acetona', 'Acetona grado analítico', 'L', MP, 5, 2.5),
  i('guantes', 'Guantes de nitrilo talla M', 'cajas', GRAL, 10, 3),
  i('metanol', 'Metanol grado HPLC', 'L', MP, 4, 1),
  i('puntas', 'Puntas de micropipeta 200 µL', 'bolsas', PROY, 8, 2),
  i('lb', 'Medio LB agar', 'kg', MP, 0.5, 1.2),
  i('etanol', 'Etanol 96 %', 'L', MP, 10, 28),
  i('tripsina', 'Tripsina 0,25 %', 'L', MP, 0.2, 0.4),
  i('cerio', 'Nitrato de cerio hexahidratado', 'g', MP, 100, 480),
  i('papel', 'Papel absorbente', 'rollos', GRAL, 10, 24),
  i('hexano', 'Hexano grado reactivo', 'L', MP, 4, 9.5),
  i('nitrico', 'Ácido nítrico 65 %', 'L', MP, 2, 3.5),
  i('amonio', 'Hidróxido de amonio 28 %', 'L', MP, 1, 2.5),
  i('cloroformo', 'Cloroformo', 'L', MP, 2, 4),
  i('nacl', 'Cloruro de sodio', 'kg', MP, 1, 4),
  i('peptona', 'Peptona de caseína', 'kg', MP, 0.5, 1.5),
  i('glicerol', 'Glicerol', 'L', MP, 1, 3),
  i('agua', 'Agua desionizada', 'L', MP, 20, 60),
  i('petri', 'Placas de Petri 90 mm', 'unidades', PROY, 100, 340),
  i('filtro', 'Papel de filtro cualitativo', 'cajas', PROY, 3, 7),
  i('crisoles', 'Crisoles de alúmina', 'unidades', PROY, 10, 18),
  i('pasta', 'Pasta térmica', 'unidades', PROY, 2, 5),
  i('isopropilico', 'Alcohol isopropílico', 'L', GRAL, 5, 12),
  i('jabon', 'Jabón líquido de laboratorio', 'L', GRAL, 4, 9),
  i('etiquetas', 'Etiquetas adhesivas', 'rollos', GRAL, 2, 6),
]

export type LoteSemilla = {
  codigo: string
  insumoId: string
  cantidad: number
  vence: string | null
  /** Ubicación de almacenamiento (F1.4, F6.1) */
  ubicacionId: string
  /** Datos de la recepción (F6.1), que muestra la ficha del insumo (vista 10) */
  ingreso: string
  costoUnitario: number
  proveedor: string
  /** Cantidad que entró con la recepción; con el costo unitario da el costo del lote (F7.3). */
  recibido: number
  /** Número de lote que trae el proveedor (AC-26-1187); el sistema le da además su código L-0432. */
  loteProveedor: string | null
  /** Reposición que se cerró con esta recepción (F3.5, F6.1). */
  solicitud: string | null
}

const PROVEEDORES = [
  'Química Valencia, C.A.',
  'Suministros Científicos del Centro',
  'Distribuidora Lab Carabobo',
]

/** Costo unitario de referencia de cada insumo, en US$ por su unidad. */
const PRECIO: Record<string, number> = {
  acetona: 12.8,
  guantes: 18.5,
  metanol: 21.4,
  puntas: 9.6,
  lb: 64,
  etanol: 7.9,
  tripsina: 180,
  cerio: 0.42,
  papel: 2.75,
  hexano: 14.2,
  nitrico: 26.5,
  amonio: 11.3,
  cloroformo: 19.9,
  nacl: 6.4,
  peptona: 88,
  glicerol: 15.6,
  agua: 0.9,
  petri: 0.35,
  filtro: 12.5,
  crisoles: 7.8,
  pasta: 6.9,
  isopropilico: 8.4,
  jabon: 5.2,
  etiquetas: 4.1,
}

let orden = 0
/** Un lote: código, insumo, cantidad que queda, vence en n días (null si no vence), ubicación e ingreso. */
const l = (
  codigo: string,
  id: string,
  cantidad: number,
  vence: number | null,
  ubicacionId: string,
  ingreso = -60,
  costoUnitario = PRECIO[id],
  proveedor = PROVEEDORES[orden++ % PROVEEDORES.length],
): LoteSemilla => ({
  codigo,
  insumoId: `ins-${id}`,
  cantidad,
  vence: vence === null ? null : dia(vence),
  ubicacionId,
  ingreso: dia(ingreso),
  costoUnitario,
  proveedor,
  recibido: cantidad,
  loteProveedor: null,
  solicitud: null,
})

/**
 * Lote de consumible de uso general recibido el día n del mes en revisión: su costo (recibido × costo
 * unitario) forma los gastos compartidos del período (F7.3). Los cuatro de abajo suman US$ 1.000,00,
 * como el mockup 23.
 */
const general = (lote: LoteSemilla, n: number, recibido: number): LoteSemilla => ({
  ...lote,
  ingreso: dia(diaEnRevision(n)),
  recibido,
})

/**
 * Lotes: la suma de cada insumo es su stock. Con la anticipación de 30 días, L-0425 (medio LB agar) y
 * L-0408 (etanol) están por vencer y L-0311 (tripsina) está vencido, como en los mockups 03 y 09. Los
 * de acetona son los de la ficha del mockup 10. Los que no vencen llevan null.
 */
export const LOTES: LoteSemilla[] = [
  l('L-0402', 'acetona', 1.5, 142, 'ub-solv', -81, 12.8, PROVEEDORES[0]),
  l('L-0417', 'acetona', 1, 246, 'ub-solv', -30, 13.1, PROVEEDORES[1]),
  general(l('L-0380', 'guantes', 3, null, 'ub-cons'), 2, 20),
  l('L-0409', 'metanol', 1, 98, 'ub-solv'),
  l('L-0386', 'puntas', 2, null, 'ub-cons'),
  // US$ 58/kg: la corrección COR-006 devuelve 450 g y descuenta US$ 26,10 (mockup 15)
  l('L-0425', 'lb', 0.5, 9, 'ub-dep-b', -170, 58),
  l('L-0390', 'lb', 0.7, 210, 'ub-dep-b'),
  // Recibido ayer (auditoría: "Carmen Pérez registró la recepción del lote L-0431")
  l('L-0431', 'etanol', 20, 400, 'ub-solv', -1),
  l('L-0408', 'etanol', 4, 20, 'ub-dep-a', -340),
  l('L-0405', 'etanol', 4, 320, 'ub-dep-a'),
  l('L-0311', 'tripsina', 0.1, -8, 'ub-cong', -190),
  l('L-0412', 'tripsina', 0.3, 120, 'ub-frio'),
  l('L-0420', 'cerio', 480, 685, 'ub-dep-a'),
  l('L-0385', 'papel', 10, null, 'ub-cons'),
  general(l('L-0428', 'papel', 14, null, 'ub-cons'), 3, 40),
  l('L-0389', 'hexano', 6, 260, 'ub-solv'),
  // Segundo lote: el despacho (mockup 18) deja elegir entre los dos y sugiere el que vence primero
  l('L-0430', 'hexano', 3.5, 640, 'ub-solv', -20),
  l('L-0377', 'nitrico', 3.5, 500, 'ub-dep-a'),
  l('L-0371', 'amonio', 2.5, 180, 'ub-dep-a'),
  l('L-0393', 'cloroformo', 4, 365, 'ub-solv'),
  l('L-0360', 'nacl', 4, null, 'ub-dep-a'),
  l('L-0414', 'peptona', 1.5, 400, 'ub-dep-b'),
  l('L-0403', 'glicerol', 3, 500, 'ub-frio'),
  l('L-0422', 'agua', 60, null, 'ub-dep-b'),
  l('L-0366', 'petri', 340, null, 'ub-cons'),
  l('L-0374', 'filtro', 7, null, 'ub-cons'),
  l('L-0349', 'crisoles', 18, null, 'ub-cons'),
  l('L-0381', 'pasta', 5, null, 'ub-cons'),
  general(l('L-0396', 'isopropilico', 12, 300, 'ub-solv'), 9, 40),
  general(l('L-0368', 'jabon', 9, null, 'ub-cons', -60, 4.6), 14, 40),
  l('L-0359', 'etiquetas', 6, null, 'ub-cons'),
  // Ya despachados por completo: siguen en la bitácora (L-0398, mockup 19) y cuentan como uso de su
  // ubicación, que por eso no se puede eliminar, solo desactivar (F1.4).
  l('L-0398', 'acetona', 0, 60, 'ub-solv', -150, 12.4, PROVEEDORES[0]),
  l('L-0297', 'etanol', 0, -40, 'ub-dep-a', -400),
]
