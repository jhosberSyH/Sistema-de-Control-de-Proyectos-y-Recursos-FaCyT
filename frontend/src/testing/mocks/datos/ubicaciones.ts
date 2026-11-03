/**
 * Ubicaciones (F1.4): las de almacenamiento del mockup 05 y los laboratorios donde están los equipos del
 * mockup 11 (F4.1 elige la ubicación de este mismo catálogo). "Estante temporal 3" está desactivada.
 */
export const UBICACIONES = [
  {
    id: 'ub-dep-a',
    nombre: 'Depósito de reactivos A',
    descripcion: 'Planta baja, ala de Química',
    activa: true,
  },
  {
    id: 'ub-dep-b',
    nombre: 'Depósito de reactivos B',
    descripcion: 'Sótano, cuarto ventilado',
    activa: true,
  },
  {
    id: 'ub-frio',
    nombre: 'Cuarto frío de Biología',
    descripcion: 'Refrigeración entre 2 y 8 °C',
    activa: true,
  },
  { id: 'ub-cong', nombre: 'Congelador −20 °C', descripcion: 'Laboratorio de Microbiología', activa: true },
  {
    id: 'ub-solv',
    nombre: 'Gabinete de solventes inflamables',
    descripcion: 'Pasillo de Química, gabinete certificado',
    activa: true,
  },
  {
    id: 'ub-cons',
    nombre: 'Almacén de consumibles generales',
    descripcion: 'Planta baja, junto a la recepción',
    activa: true,
  },
  {
    id: 'ub-lab-qa',
    nombre: 'Laboratorio de Química Analítica',
    descripcion: 'Edificio de Química, planta alta',
    activa: true,
  },
  {
    id: 'ub-lab-qo',
    nombre: 'Laboratorio de Química Orgánica',
    descripcion: 'Edificio de Química, planta baja',
    activa: true,
  },
  {
    id: 'ub-lab-mic',
    nombre: 'Laboratorio de Microbiología',
    descripcion: 'Edificio de Biología, ala norte',
    activa: true,
  },
  {
    id: 'ub-lab-fes',
    nombre: 'Laboratorio de Física del Estado Sólido',
    descripcion: 'Edificio de Física, sótano',
    activa: true,
  },
  {
    id: 'ub-lab-elq',
    nombre: 'Laboratorio de Electroquímica',
    descripcion: 'Edificio de Química, anexo',
    activa: true,
  },
  {
    id: 'ub-temp3',
    nombre: 'Estante temporal 3',
    descripcion: 'Usado durante la mudanza de 2025',
    activa: false,
  },
]
