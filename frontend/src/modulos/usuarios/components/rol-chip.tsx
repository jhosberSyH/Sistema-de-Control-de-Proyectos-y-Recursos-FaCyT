import { NOMBRE_ROL, type Rol } from '@/types/roles'

const CLASE: Record<Rol, string> = { administrador: '', aprobador: 'apr', coordinador: 'coo' }

/** Rol con su punto de color (.rol-chip del mockup 04); el nombre siempre va escrito (WCAG 1.4.1). */
export function RolChip({ rol }: { rol: Rol }) {
  return (
    <span className={`rol-chip ${CLASE[rol]}`.trim()}>
      <i aria-hidden="true" />
      {NOMBRE_ROL[rol]}
    </span>
  )
}
