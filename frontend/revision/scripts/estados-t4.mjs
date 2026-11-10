// Tanda 4: 14 Solicitudes, 15 Bandeja, 16 Priorización, 17 Recepción y la entrada de Almacén.
export const ESTADOS = [
  { id: '14-Lista', rol: 'coo', ruta: '/solicitudes' },
  { id: '14-Retiro', rol: 'coo', ruta: '/solicitudes?nueva=retiro' },
  {
    id: '14-Gasto_con_datos_faltantes',
    rol: 'coo',
    ruta: '/solicitudes?nueva=gasto&proyecto=QUI-031',
    pasos: async (p) => {
      await p.getByLabel('Insumo o servicio').fill('Dióxido de titanio P25, 500 g')
      await p.getByRole('button', { name: 'Enviar a aprobación' }).click()
      await p.waitForTimeout(600)
    },
  },
  { id: '15-Solicitud', rol: 'apr', ruta: '/bandeja' },
  {
    id: '15-Rechazar_sin_motivo',
    rol: 'apr',
    ruta: '/bandeja',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Rechazar', exact: true }).click()
      await p.getByRole('button', { name: 'Rechazar solicitud' }).click()
      await p.waitForTimeout(500)
    },
  },
  { id: '15-Corrección', rol: 'apr', ruta: '/bandeja?tipo=correccion' },
  { id: '15-Reposición', rol: 'apr', ruta: '/bandeja?tipo=reposicion&pedido=REP-014' },
  {
    id: '15-Por_ejecutar',
    rol: 'apr',
    ruta: '/bandeja',
    pasos: async (p) => {
      await p.getByRole('button', { name: /^Por ejecutar/ }).click()
      await p.waitForTimeout(1200)
      await p.getByRole('button', { name: 'Marcar como ejecutada' }).first().click()
      await p.waitForTimeout(400)
    },
  },
  { id: '16-Lista', rol: 'apr', ruta: '/priorizacion' },
  {
    id: '16-Cambiar_prioridad',
    rol: 'apr',
    ruta: '/priorizacion',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Cambiar prioridad de QUI-031' }).click()
      await p.getByRole('dialog').getByRole('radio', { name: 'Alta' }).check()
      await p
        .getByRole('dialog')
        .getByLabel('Justificación')
        .fill(
          'La industria textil aliada adelantó la entrega de muestras al 20/11 y el proyecto necesita los reactivos antes.',
        )
    },
  },
  {
    id: '16-Sin_justificación',
    rol: 'apr',
    ruta: '/priorizacion',
    pasos: async (p) => {
      await p.getByRole('button', { name: 'Cambiar prioridad de QUI-031' }).click()
      await p.getByRole('dialog').getByRole('radio', { name: 'Alta' }).check()
      await p.getByRole('dialog').getByRole('button', { name: 'Cambiar a Alta' }).click()
      await p.waitForTimeout(400)
    },
  },
  {
    id: '16-Coordinador',
    rol: 'coo',
    ruta: '/priorizacion',
    modos: [
      [1280, 'light'],
      [390, 'light'],
    ],
  },
  {
    id: '17-Normal',
    rol: 'apr',
    ruta: '/almacen/recepcion?insumo=ins-acetona',
    pasos: async (p) => {
      await p.getByLabel('Número de lote del proveedor').fill('AC-26-1187')
      await p.getByLabel('Cantidad recibida').fill('10')
      await p.getByLabel('Costo unitario').fill('13,25')
      await p.getByLabel('Proveedor', { exact: true }).fill('Química Valencia, C.A.')
      await p.getByLabel('Fecha de vencimiento').fill('2027-09-30')
    },
  },
  {
    id: '17-Lote_vencido',
    rol: 'apr',
    ruta: '/almacen/recepcion?insumo=ins-acetona',
    pasos: async (p) => {
      await p.getByLabel('Número de lote del proveedor').fill('AC-26-1187')
      await p.getByLabel('Cantidad recibida').fill('10')
      await p.getByLabel('Costo unitario').fill('13,25')
      await p.getByLabel('Proveedor', { exact: true }).fill('Química Valencia, C.A.')
      await p.getByLabel('Fecha de vencimiento').fill('2020-10-15')
      await p.getByLabel('Fecha de vencimiento').blur()
    },
  },
  { id: '17-Almacen', rol: 'apr', ruta: '/almacen' },
]
