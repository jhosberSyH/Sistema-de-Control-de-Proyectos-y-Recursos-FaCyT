/**
 * Proyectos, con los mismos códigos, nombres, coordinadores, estatus, prioridades, avance y
 * ejecución del mockup 06 (docs/mockups/_fuente/06-proyectos.html L105-115).
 * Los presupuestos no aparecen en el mockup salvo QUI-024 y QUI-031; los demás son de ejemplo.
 */
import { dia } from './fechas'

type Estatus = 'Propuesta' | 'En ejecución' | 'Suspendido' | 'Finalizado'
type Prioridad = 'Crítica' | 'Alta' | 'Media' | 'Baja'
type Area = 'Física' | 'Química' | 'Biología'

export type ProyectoSemilla = {
  /** UUID, como en la base real; QUI-024, BIO-011 y FIS-008 tienen los mismos que database/seeders.sql. */
  id: string
  codigo: string
  nombre: string
  area: Area
  estatus: Estatus
  prioridad: Prioridad
  presupuesto: number
  gastoEjecutado: number
  coordinadorId: string | null
  /** Por qué quedó sin coordinador, para el aviso del administrador */
  sinCoordinador: { motivo: string; fecha: string } | null
  planConfirmado: boolean
  registradoEl: string
}

/**
 * UUID de cada proyecto de la semilla. Los tres primeros son los de la semilla de la base real
 * (database/seeders.sql); los demás siguen la misma forma.
 */
const IDS: Record<string, string> = Object.fromEntries(
  [
    'QUI-024',
    'BIO-011',
    'FIS-008',
    'BIO-015',
    'QUI-031',
    'FIS-012',
    'FIS-010',
    'QUI-027',
    'BIO-017',
    'QUI-035',
    'FIS-006',
    'QUI-019',
  ].map((codigo, i) => [codigo, `b0000000-0000-0000-0000-${String(i + 1).padStart(12, '0')}`]),
)

/** UUID de un proyecto de la semilla a partir de su código (para las pruebas y los enlaces de la semilla). */
export function idProyecto(codigo: string) {
  const id = IDS[codigo]
  if (!id) throw new Error(`El proyecto ${codigo} no está en la semilla.`)
  return id
}

const p = (
  codigo: string,
  nombre: string,
  coordinadorId: string | null,
  estatus: Estatus,
  prioridad: Prioridad,
  presupuesto: number,
  avance: number | null,
  ejecucion: number | null,
): ProyectoSemilla => ({
  id: idProyecto(codigo),
  codigo,
  nombre,
  area: codigo.startsWith('QUI') ? 'Química' : codigo.startsWith('FIS') ? 'Física' : 'Biología',
  estatus,
  prioridad,
  presupuesto,
  gastoEjecutado: Math.round(presupuesto * (ejecucion ?? 0)) / 100,
  coordinadorId,
  sinCoordinador: null,
  // El avance se calcula con los hitos (datos/hitos.ts); aquí solo dice si el plan está confirmado.
  planConfirmado: avance !== null,
  registradoEl: dia(-180),
})

export const PROYECTOS: ProyectoSemilla[] = [
  p(
    'BIO-011',
    'Resistencia antimicrobiana en aislados clínicos',
    'u-bio',
    'En ejecución',
    'Crítica',
    12000,
    71,
    93,
  ),
  {
    ...p('BIO-015', 'Biopelículas en sistemas de riego', null, 'En ejecución', 'Alta', 7500, 55, 109),
    sinCoordinador: { motivo: 'al cambiar el rol de Luis Mendoza', fecha: dia(-2) },
  },
  {
    ...p(
      'QUI-024',
      'Síntesis de catalizadores de óxido de cerio',
      'u-qui',
      'En ejecución',
      'Alta',
      10000,
      62,
      0,
    ),
    gastoEjecutado: 4812,
    registradoEl: dia(-150),
  },
  p('FIS-008', 'Caracterización de películas delgadas', 'u-fis', 'En ejecución', 'Media', 9000, 40, 38),
  {
    ...p(
      'QUI-031',
      'Degradación fotocatalítica de colorantes textiles',
      'u-qui',
      'En ejecución',
      'Media',
      8000,
      35,
      0,
    ),
    gastoEjecutado: 6640,
  },
  {
    ...p(
      'FIS-012',
      'Celdas solares sensibilizadas con colorantes naturales',
      'u-fis',
      'Propuesta',
      'Media',
      6500,
      null,
      null,
    ),
    planConfirmado: true,
  },
  p('FIS-010', 'Espectroscopía Raman de minerales', 'u-fis', 'En ejecución', 'Baja', 5000, 18, 26),
  p('QUI-027', 'Extracción de aceites esenciales', 'u-rli', 'En ejecución', 'Baja', 4000, 47, 68),
  p('BIO-017', 'Microalgas para tratamiento de aguas', 'u-bio', 'Propuesta', 'Baja', 5500, null, null),
  // Mockup 08: su coordinadora arma el plan de hitos y todavía no suma 100 (F2.4, HU-05)
  {
    ...p(
      'QUI-035',
      'Síntesis verde de nanopartículas de plata',
      'u-qui',
      'Propuesta',
      'Media',
      6000,
      null,
      null,
    ),
    registradoEl: dia(-6),
  },
  p('FIS-006', 'Sensores ópticos de humedad', 'u-fis', 'Suspendido', 'Baja', 6000, 30, 22),
  p(
    'QUI-019',
    'Determinación de metales pesados en sedimentos',
    'u-rli',
    'Finalizado',
    'Baja',
    7000,
    100,
    97,
  ),
]
