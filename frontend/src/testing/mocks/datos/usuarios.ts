import { momento } from './fechas'

/**
 * Cuentas de prueba: las del seed del README §13, las que muestra el mockup 04 y algunas más para
 * llegar a sus 14 cuentas activas en dos páginas. Todas usan la contraseña Demo2026*.
 * - Pedro Gil está desactivado (F1.3: no puede entrar).
 * - Valentina Ruiz tiene una contraseña temporal sin cambiar: al entrar se le pide crear la suya.
 */
export const CLAVE_DEMO = 'Demo2026*'

type Rol = 'administrador' | 'coordinador' | 'aprobador'

const u = (
  id: string,
  nombre: string,
  correo: string,
  rol: Rol,
  ultimoAcceso: string | null,
  extra: { activo?: boolean; debeCambiarClave?: boolean } = {},
) => ({
  id,
  nombre,
  correo,
  rol,
  activo: extra.activo ?? true,
  debeCambiarClave: extra.debeCambiarClave ?? false,
  clave: CLAVE_DEMO,
  ultimoAcceso,
})

export const USUARIOS = [
  u('u-adm', 'José Rodríguez', 'admin@cpq.local', 'administrador', momento(0, '08:10')),
  u('u-apr', 'Carmen Pérez', 'aprobador@cpq.local', 'aprobador', momento(0, '07:52')),
  u('u-qui', 'Daniela Rivas', 'coord.quimica@cpq.local', 'coordinador', momento(0, '08:31')),
  u('u-bio', 'María Fernanda Ochoa', 'coord.biologia@cpq.local', 'coordinador', momento(-1, '17:40')),
  u('u-fis', 'Andrés Salazar', 'coord.fisica@cpq.local', 'coordinador', momento(-1, '10:05')),
  u('u-rli', 'Rosa Linares', 'r.linares@cpq.local', 'coordinador', momento(-8, '14:20')),
  u('u-lme', 'Luis Mendoza', 'l.mendoza@cpq.local', 'aprobador', momento(-5, '09:30')),
  u('u-pgi', 'Pedro Gil', 'p.gil@cpq.local', 'coordinador', momento(-121, '11:00'), { activo: false }),
  u('u-amo', 'Ana Lucía Mora', 'a.mora@cpq.local', 'administrador', momento(-3, '15:12')),
  u('u-gto', 'Gabriela Torres', 'g.torres@cpq.local', 'coordinador', momento(-2, '11:48')),
  u('u-hma', 'Héctor Márquez', 'h.marquez@cpq.local', 'coordinador', momento(-12, '08:05')),
  u('u-icm', 'Isabel Campos', 'i.campos@cpq.local', 'coordinador', momento(-4, '16:30')),
  u('u-sor', 'Samuel Ortega', 's.ortega@cpq.local', 'coordinador', momento(-20, '10:00')),
  u('u-vru', 'Valentina Ruiz', 'v.ruiz@cpq.local', 'coordinador', null, { debeCambiarClave: true }),
  u('u-eba', 'Eduardo Bastidas', 'e.bastidas@cpq.local', 'aprobador', momento(-6, '13:15')),
]
