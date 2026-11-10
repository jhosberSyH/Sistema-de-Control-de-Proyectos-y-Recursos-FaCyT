import { useCallback, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router'
import { Aviso } from '@/components/ui/aviso'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { Paginacion } from '@/components/ui/tabla'
import { NOMBRE_ROL, ROLES, type Rol } from '@/types/roles'
import { useCuentas } from '../api/cuentas'
import type {
  Cuenta,
  CuentaConClave,
  EstadoCuentas,
  FiltrosCuentas,
  PaginaCuentas,
  ProyectoLiberado,
} from '../types'
import { DialogoClaveTemporal } from './dialogo-clave-temporal'
import { DialogoCuenta, type ResultadoEdicion } from './dialogo-cuenta'
import { DialogoDesactivar, DialogoReactivar, DialogoRestablecer } from './dialogos-acceso'
import { FiltrosDeCuentas } from './filtros-cuentas'
import { ProyectosEnMono } from './proyectos-en-mono'
import { TablaCuentas } from './tabla-cuentas'
import './usuarios.css'

type DialogoAbierto =
  | { tipo: 'crear' }
  | { tipo: 'editar' | 'desactivar' | 'reactivar' | 'restablecer'; cuenta: Cuenta }
  | { tipo: 'clave'; resultado: CuentaConClave; motivo: 'creada' | 'restablecida' }
  | null

const ESTADOS: EstadoCuentas[] = ['activas', 'desactivadas', 'todas']

/** Los filtros viven en la URL: se pueden compartir y el botón Atrás los respeta. */
function useFiltros() {
  const [params, setParams] = useSearchParams()
  const rol = params.get('rol') as Rol | null
  const estado = params.get('estado') as EstadoCuentas | null
  const filtros: FiltrosCuentas = {
    q: params.get('q') ?? '',
    rol: rol && ROLES.includes(rol) ? rol : '',
    estado: estado && ESTADOS.includes(estado) ? estado : 'activas',
    pagina: Math.max(1, Number(params.get('pagina')) || 1),
  }
  const cambiar = useCallback(
    (cambios: Partial<FiltrosCuentas>) =>
      setParams(
        (actuales) => {
          const nuevos = new URLSearchParams(actuales)
          for (const [clave, valor] of Object.entries(cambios)) {
            const porDefecto =
              (clave === 'estado' && valor === 'activas') || (clave === 'pagina' && valor === 1)
            if (valor === '' || porDefecto) nuevos.delete(clave)
            else nuevos.set(clave, String(valor))
          }
          return nuevos
        },
        { replace: true },
      ),
    [setParams],
  )
  return [filtros, cambiar] as const
}

/** "8 de 14 cuentas activas", como el mockup; en la página 2, "9 a 14 de 14 cuentas activas". */
function resumen(datos: PaginaCuentas, estado: EstadoCuentas) {
  const uno = datos.total === 1
  const etiqueta = {
    activas: uno ? 'cuenta activa' : 'cuentas activas',
    desactivadas: uno ? 'cuenta desactivada' : 'cuentas desactivadas',
    todas: uno ? 'cuenta' : 'cuentas',
  }[estado]
  const inicio = (datos.pagina - 1) * datos.porPagina + 1
  const fin = inicio + datos.items.length - 1
  if (datos.items.length === datos.total) return `${datos.total} ${etiqueta}`
  return datos.pagina === 1
    ? `${fin} de ${datos.total} ${etiqueta}`
    : `${inicio} a ${fin} de ${datos.total} ${etiqueta}`
}

/** Proyectos que quedaron sin coordinador, con el camino para reasignarlos (F1.2, F2.2). */
function SinCoordinador({ proyectos }: { proyectos: ProyectoLiberado[] }) {
  if (proyectos.length === 0) return null
  return (
    <p>
      <ProyectosEnMono codigos={proyectos.map((p) => p.codigo)} />{' '}
      {proyectos.length === 1 ? 'quedó' : 'quedaron'} sin coordinador.{' '}
      {proyectos.length === 1 ? (
        <Link to={`/proyectos/${proyectos[0].id}`}>Asignarle otro coordinador</Link>
      ) : (
        <Link to="/inicio">Verlos en tu inicio para asignarles coordinador</Link>
      )}
    </p>
  )
}

/** Vista 04: cuentas de los tres roles (F1.1 a F1.3). Solo el Administrador del Sistema. */
export function VistaUsuarios() {
  const [filtros, cambiarFiltros] = useFiltros()
  const cuentas = useCuentas(filtros)
  const [dialogo, setDialogo] = useState<DialogoAbierto>(null)
  const [resultado, setResultado] = useState<ReactNode>(null)

  // Adónde vuelve el foco si el control que abrió el diálogo ya no está (WCAG 2.4.3).
  const refFoco = useRef<HTMLElement | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (resultado) refFoco.current = refResultado.current
  }, [resultado])

  const abrir = (siguiente: DialogoAbierto, origen?: HTMLElement) => {
    if (origen) refFoco.current = origen
    setResultado(null)
    setDialogo(siguiente)
  }
  const cerrar = () => setDialogo(null)
  const comun = { alCerrar: cerrar, focoAlCerrar: refFoco }

  function alEditar({ cuenta, rolAnterior, sinCoordinador }: ResultadoEdicion) {
    cerrar()
    setResultado(
      <>
        <p>
          Guardaste los cambios de la cuenta de {cuenta.nombre}.
          {cuenta.rol !== rolAnterior &&
            ` Ahora es ${NOMBRE_ROL[cuenta.rol]}: aplica desde su siguiente acción.`}
        </p>
        <SinCoordinador proyectos={sinCoordinador} />
      </>,
    )
  }

  const datos = cuentas.data
  const conFiltros = Boolean(filtros.q.trim() || filtros.rol)
  // Sin resultados por el rol o el estado elegidos: se ofrece buscar en todas las cuentas.
  const ampliable = Boolean(filtros.rol) || filtros.estado !== 'todas'

  return (
    <>
      <EncabezadoPagina
        migas={[{ texto: 'Inicio', a: '/inicio' }, { texto: 'Usuarios' }]}
        titulo="Usuarios"
        subtitulo="Cuentas de los tres roles. Una cuenta no se borra: se desactiva y conserva su historial."
        acciones={
          <button
            className="btn btn-pri"
            type="button"
            onClick={(e) => abrir({ tipo: 'crear' }, e.currentTarget)}
          >
            Crear cuenta
          </button>
        }
      />

      <section className="tarjeta lista-usu" aria-label="Cuentas">
        {resultado && (
          <div className="resultado" ref={refResultado} tabIndex={-1}>
            <Aviso tipo="ok">{resultado}</Aviso>
          </div>
        )}

        <FiltrosDeCuentas filtros={filtros} alCambiar={cambiarFiltros} />

        <div aria-busy={cuentas.isFetching || undefined}>
          {cuentas.isPending ? (
            <div style={{ padding: 20 }}>
              <Cargando etiqueta="Cargando las cuentas…">
                {Array.from({ length: 6 }, (_, i) => (
                  <Esqueleto key={i} alto={44} />
                ))}
              </Cargando>
            </div>
          ) : cuentas.isError ? (
            <div style={{ padding: 20 }}>
              <ErrorCarga mensaje={cuentas.error.message} alReintentar={() => cuentas.refetch()} />
            </div>
          ) : datos && datos.items.length === 0 ? (
            conFiltros ? (
              <EstadoVacio
                icono="buscar"
                titulo="Ninguna cuenta coincide con la búsqueda"
                accion={
                  ampliable ? (
                    <button
                      className="btn btn-sec btn-chico"
                      type="button"
                      onClick={() => cambiarFiltros({ rol: '', estado: 'todas', pagina: 1 })}
                    >
                      Buscar en todas las cuentas
                    </button>
                  ) : (
                    <button
                      className="btn btn-sec btn-chico"
                      type="button"
                      onClick={() => cambiarFiltros({ q: '', pagina: 1 })}
                    >
                      Quitar la búsqueda
                    </button>
                  )
                }
              >
                {ampliable
                  ? `La búsqueda solo mira ${filtros.rol ? `el rol ${NOMBRE_ROL[filtros.rol]}` : ''}${filtros.rol && filtros.estado !== 'todas' ? ' y ' : ''}${filtros.estado !== 'todas' ? `las cuentas ${filtros.estado}` : ''}. Revisa cómo está escrito o busca en todas las cuentas.`
                  : 'Revisa cómo está escrito el nombre o el correo.'}
              </EstadoVacio>
            ) : (
              <EstadoVacio
                icono="usuarios"
                titulo={`No hay cuentas ${filtros.estado === 'desactivadas' ? 'desactivadas' : 'activas'}`}
              >
                {filtros.estado === 'desactivadas'
                  ? 'Cuando desactives una cuenta, aparecerá aquí para reactivarla.'
                  : 'Crea la primera con "Crear cuenta".'}
              </EstadoVacio>
            )
          ) : datos ? (
            <TablaCuentas
              cuentas={datos.items}
              alEditar={(cuenta, e) => abrir({ tipo: 'editar', cuenta }, e.currentTarget)}
              alReactivar={(cuenta, e) => abrir({ tipo: 'reactivar', cuenta }, e.currentTarget)}
            />
          ) : null}
        </div>

        {datos && datos.total > 0 && (
          <Paginacion
            pagina={datos.pagina}
            paginas={datos.paginas}
            alCambiar={(pagina) => cambiarFiltros({ pagina })}
            resumen={resumen(datos, filtros.estado)}
          />
        )}
      </section>

      {(dialogo?.tipo === 'crear' || dialogo?.tipo === 'editar') && (
        <DialogoCuenta
          key={dialogo.tipo === 'editar' ? dialogo.cuenta.id : 'nueva'}
          cuenta={dialogo.tipo === 'editar' ? dialogo.cuenta : null}
          {...comun}
          alCrear={(r) => {
            setDialogo({ tipo: 'clave', resultado: r, motivo: 'creada' })
            setResultado(
              <p>
                Creaste la cuenta de {r.cuenta.nombre} como {NOMBRE_ROL[r.cuenta.rol]}. Al entrar con la
                contraseña temporal, creará la suya.
              </p>,
            )
          }}
          alEditar={alEditar}
          alVerCuenta={(correo) => {
            cerrar()
            cambiarFiltros({ q: correo, rol: '', estado: 'todas', pagina: 1 })
          }}
          alRestablecer={(cuenta) => abrir({ tipo: 'restablecer', cuenta })}
          alDesactivar={(cuenta) => abrir({ tipo: 'desactivar', cuenta })}
        />
      )}
      {dialogo?.tipo === 'desactivar' && (
        <DialogoDesactivar
          cuenta={dialogo.cuenta}
          {...comun}
          alListo={(cuenta, sinCoordinador) => {
            cerrar()
            setResultado(
              <>
                <p>
                  Desactivaste la cuenta de {cuenta.nombre}. Ya no puede entrar y su historial se conserva.
                </p>
                <SinCoordinador proyectos={sinCoordinador} />
              </>,
            )
          }}
        />
      )}
      {dialogo?.tipo === 'reactivar' && (
        <DialogoReactivar
          cuenta={dialogo.cuenta}
          {...comun}
          alListo={(cuenta) => {
            cerrar()
            setResultado(
              <p>Reactivaste la cuenta de {cuenta.nombre}. Ya puede entrar con su contraseña de antes.</p>,
            )
          }}
        />
      )}
      {dialogo?.tipo === 'restablecer' && (
        <DialogoRestablecer
          cuenta={dialogo.cuenta}
          {...comun}
          alListo={(r) => {
            setDialogo({ tipo: 'clave', resultado: r, motivo: 'restablecida' })
            setResultado(<p>Restableciste la contraseña de {r.cuenta.nombre}.</p>)
          }}
        />
      )}
      {dialogo?.tipo === 'clave' && (
        <DialogoClaveTemporal resultado={dialogo.resultado} motivo={dialogo.motivo} {...comun} />
      )}
    </>
  )
}
