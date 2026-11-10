import { dia } from './fechas'

/**
 * Plan de hitos de cada proyecto (F2.4) y las cargas de avance (F2.5). Los pesos y avances están
 * elegidos para que el avance físico calculado (F2.6) dé lo que muestran los mockups 06 y 07:
 * QUI-024 = 10·100 + 25·100 + 30·70 + 25·24 + 10·0, entre 100, = 62 %.
 */
export type HitoSemilla = {
  id: string
  proyecto: string
  numero: number
  nombre: string
  peso: number
  fechaPrevista: string
  /** Último avance cargado (0 a 100). */
  avance: number
}

export type AvanceSemilla = {
  id: string
  hitoId: string
  proyecto: string
  porcentaje: number
  fecha: string
  comentario: string | null
  usuarioId: string
}

type Plan = [nombre: string, peso: number, avance: number, previstaEnDias: number][]

const PLANES: Record<string, { coordinador: string; hitos: Plan }> = {
  'QUI-024': {
    coordinador: 'u-qui',
    hitos: [
      ['Revisión bibliográfica y diseño experimental', 10, 100, -123],
      ['Síntesis de precursores', 25, 100, -61],
      ['Calcinación y caracterización por DRX', 30, 70, 15],
      ['Pruebas catalíticas', 25, 24, 92],
      ['Informe final', 10, 0, 151],
    ],
  },
  'BIO-011': {
    coordinador: 'u-bio',
    hitos: [
      ['Recolección de aislados clínicos', 20, 100, -90],
      ['Pruebas de susceptibilidad', 30, 100, -30],
      ['Secuenciación de genes de resistencia', 30, 70, 10],
      ['Informe al consejo de facultad', 20, 0, 15],
    ],
  },
  'BIO-015': {
    // Lo coordinaba Luis Mendoza hasta que cambió de rol: sus cargas de avance quedan con su nombre
    coordinador: 'u-lme',
    hitos: [
      ['Muestreo en sistemas de riego', 30, 100, -60],
      ['Cultivo y caracterización de biopelículas', 30, 50, 30],
      ['Ensayos de remoción', 40, 25, 90],
    ],
  },
  'FIS-008': {
    coordinador: 'u-fis',
    hitos: [
      ['Depósito de películas', 20, 100, -45],
      ['Caracterización óptica', 40, 50, 40],
      ['Caracterización eléctrica', 40, 0, 110],
    ],
  },
  'QUI-031': {
    coordinador: 'u-qui',
    hitos: [
      ['Síntesis del fotocatalizador', 25, 100, -50],
      ['Ensayos de degradación', 25, 40, 25],
      ['Análisis de subproductos', 50, 0, 120],
    ],
  },
  'FIS-012': {
    coordinador: 'u-fis',
    hitos: [
      ['Extracción de colorantes naturales', 30, 0, 45],
      ['Ensamble de celdas', 40, 0, 120],
      ['Medición de eficiencia', 30, 0, 200],
    ],
  },
  'FIS-010': {
    coordinador: 'u-fis',
    hitos: [
      ['Recolección de minerales', 30, 60, 10],
      ['Espectros Raman', 40, 0, 90],
      ['Base de datos de referencia', 30, 0, 160],
    ],
  },
  'QUI-027': {
    coordinador: 'u-rli',
    hitos: [
      ['Selección de especies', 20, 100, -70],
      ['Extracción por arrastre de vapor', 30, 90, 5],
      ['Análisis por cromatografía', 50, 0, 100],
    ],
  },
  'FIS-006': {
    coordinador: 'u-fis',
    hitos: [
      ['Diseño del sensor', 50, 60, -20],
      ['Calibración en cámara de humedad', 50, 0, 80],
    ],
  },
  'QUI-019': {
    coordinador: 'u-rli',
    hitos: [
      ['Muestreo de sedimentos', 50, 100, -200],
      ['Análisis por absorción atómica', 50, 100, -100],
    ],
  },
  // Borradores sin confirmar (F2.4, HU-05). QUI-035 es el del mockup 08: los pesos suman 90.
  'QUI-035': {
    coordinador: 'u-qui',
    hitos: [
      ['Revisión bibliográfica', 15, 0, 30],
      ['Síntesis con extracto de hojas de mango', 30, 0, 92],
      ['Caracterización por UV-Vis y DRX', 30, 0, 151],
      ['Informe final', 15, 0, 212],
    ],
  },
  // Los pesos suman 70
  'BIO-017': {
    coordinador: 'u-bio',
    hitos: [
      ['Aislamiento de cepas de microalgas', 40, 0, 60],
      ['Ensayos en fotobiorreactor', 30, 0, 150],
    ],
  },
}

export const HITOS: HitoSemilla[] = Object.entries(PLANES).flatMap(([proyecto, plan]) =>
  plan.hitos.map(([nombre, peso, avance, prevista], i) => ({
    id: `${proyecto}-h${i + 1}`,
    proyecto,
    numero: i + 1,
    nombre,
    peso,
    fechaPrevista: dia(prevista),
    avance,
  })),
)

const carga = (
  hito: number,
  porcentaje: number,
  enDias: number,
  comentario: string | null = null,
): AvanceSemilla => ({
  id: `av-QUI-024-${hito}-${porcentaje}`,
  hitoId: `QUI-024-h${hito}`,
  proyecto: 'QUI-024',
  porcentaje,
  fecha: dia(enDias),
  comentario,
  usuarioId: 'u-qui',
})

/**
 * Cada carga de avance queda como un registro nuevo (F2.5). QUI-024 trae las fechas y comentarios de
 * los mockups 07 y 08; los demás proyectos, una carga por hito con su avance actual.
 */
export const AVANCES: AvanceSemilla[] = [
  ...Object.entries(PLANES).flatMap(([proyecto, plan]) =>
    proyecto === 'QUI-024'
      ? []
      : plan.hitos.flatMap(([, , avance], i) =>
          avance > 0
            ? [
                {
                  id: `av-${proyecto}-${i + 1}`,
                  hitoId: `${proyecto}-h${i + 1}`,
                  proyecto,
                  porcentaje: avance,
                  fecha: dia(-15 - (plan.hitos.length - i) * 20),
                  comentario: null,
                  usuarioId: plan.coordinador,
                },
              ]
            : [],
        ),
  ),
  // Después de confirmar el plan (auditoria.ts, hace 113 días)
  carga(1, 100, -105, 'Diseño experimental aprobado por el consejo de departamento'),
  carga(2, 100, -63, 'Precursores listos para calcinar'),
  carga(3, 10, -60, 'Horno calibrado'),
  carga(3, 40, -46, 'Primeras muestras calcinadas a 500 °C'),
  carga(3, 70, -25, 'DRX de 4 de 6 muestras'),
  carga(4, 24, -11, 'Montaje del reactor de lecho fijo'),
]
