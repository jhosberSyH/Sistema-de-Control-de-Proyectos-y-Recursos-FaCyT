import { Link } from 'react-router'
import { Icono } from '@/components/icono'
import { BotonEnlace } from '@/components/ui/boton'
import { ConCodigos } from '@/components/ui/con-codigos'
import { ChipPrioridad } from '@/components/ui/estado'
import { Contador, Lista, ListaPendientes } from '@/components/ui/listas'
import { Bloque } from '@/components/ui/tarjeta'
import { cuandoCorto, mayuscula, porcentaje, saludo } from '@/lib/formato'
import { itemPendiente } from './pendientes'
import { Codigo, Saludo } from './piezas'
import type { InicioAdministrador } from './tipos'

/** Inicio del Administrador del Sistema (mockup 02, rol adm). */
export function VistaAdministrador({ datos }: { datos: InicioAdministrador }) {
  const n = datos.pendientes.length
  const c = datos.contadores
  const resumen = `${n === 0 ? 'No tienes pendientes.' : `Tienes ${n} ${n === 1 ? 'pendiente' : 'pendientes'}.`} Hay ${c.proyectosActivos} ${c.proyectosActivos === 1 ? 'proyecto activo' : 'proyectos activos'}.`

  return (
    <>
      <Saludo
        titulo={`${saludo()}, ${datos.nombre}`}
        resumen={resumen}
        accion={
          <BotonEnlace variante="pri" to="/proyectos?registrar=1">
            <Icono nombre="mas" />
            Registrar proyecto
          </BotonEnlace>
        }
      />

      <div className="contadores">
        <Contador
          valor={c.proyectosActivos}
          etiqueta="proyectos activos"
          a="/proyectos?estatus=en-ejecucion"
        />
        <Contador
          valor={porcentaje(c.ejecucionGlobal)}
          etiqueta="presupuesto global ejecutado"
          a="/dashboard"
        />
        <Contador valor={c.alertasStock} etiqueta="alertas críticas de stock" a="/inventario?alerta=minimo" />
        <Contador
          valor={c.lotesPorVencer}
          etiqueta="lotes próximos a vencer"
          a="/inventario?alerta=vencimiento"
        />
      </div>

      <div className="rejilla">
        <div className="col">
          <Bloque titulo="Pendientes">
            {n === 0 ? (
              <p className="sec">
                Estás al día: todos los proyectos tienen coordinador y no hay cambios de estatus por hacer.
              </p>
            ) : (
              <ListaPendientes items={datos.pendientes.map(itemPendiente)} />
            )}
          </Bloque>
          <Bloque titulo="Actividad reciente" enlace={{ texto: 'Ver auditoría', a: '/auditoria' }}>
            <Lista
              items={datos.actividad.map((a) => ({
                id: a.id,
                principal: <ConCodigos texto={a.descripcion} />,
                secundario: [
                  a.justificacion ? `«${a.justificacion}»` : null,
                  a.detalle,
                  a.justificacion || a.detalle ? cuandoCorto(a.fecha) : mayuscula(cuandoCorto(a.fecha)),
                  a.ip,
                ]
                  .filter(Boolean)
                  .join(' · '),
              }))}
            />
          </Bloque>
        </div>
        <div className="col">
          <Bloque titulo="Proyectos por prioridad" enlace={{ texto: 'Ver priorización', a: '/priorizacion' }}>
            <Lista
              items={datos.prioridades.map((p) => ({
                id: p.id,
                principal: (
                  <>
                    <Codigo>{p.codigo}</Codigo> {p.nombre}
                  </>
                ),
                derecha: <ChipPrioridad prioridad={p.prioridad} />,
              }))}
            />
          </Bloque>
          <Bloque titulo="Accesos de administración">
            <Lista
              items={[
                {
                  id: 'usuarios',
                  principal: 'Usuarios',
                  secundario: `${datos.accesos.cuentasActivas} cuentas activas en los tres roles`,
                  derecha: (
                    <Link to="/usuarios" aria-label="Abrir Usuarios">
                      Abrir
                    </Link>
                  ),
                },
                {
                  id: 'parametros',
                  principal: 'Ubicaciones y parámetros',
                  secundario: `Anticipación de vencimiento: ${datos.accesos.anticipacionVencimiento} días`,
                  derecha: (
                    <Link to="/ubicaciones-parametros" aria-label="Abrir Ubicaciones y parámetros">
                      Abrir
                    </Link>
                  ),
                },
              ]}
            />
          </Bloque>
        </div>
      </div>
    </>
  )
}
