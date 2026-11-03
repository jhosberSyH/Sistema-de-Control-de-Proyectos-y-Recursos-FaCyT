import { useEffect, useRef } from 'react'
import { Navigate, Outlet, useLocation, useMatches, useNavigate } from 'react-router'
import { AppShell } from '@/components/layout/app-shell'
import { AvisoSesion } from '@/components/layout/aviso-sesion'
import { Cargando } from '@/components/ui/estados-vista'
import { useAvisos, useContadores, useMarcarAvisoLeido, useMarcarTodosLeidos } from '@/hooks/use-avisos'
import { useInactividad } from '@/hooks/use-inactividad'
import { useTituloDeLaVista } from '@/hooks/use-titulo-pagina'
import { elDia, fechaIso, fechaLarga, nombreMes } from '@/lib/formato'
import { NOMBRE_ROL, useRenovarSesion, useSesion } from '@/modulos/autenticacion'
import { usePeriodoActual } from '@/modulos/prorrateo'
import { itemActivo, NAVEGACION } from '../navegacion'
import { seccionDe, type DatosRuta } from '../rutas'
import { useSalir } from '../use-salir'
import { SinPermiso } from './sin-permiso'

/** Datos de la ruta más profunda que los tenga (título y roles). */
function useDatosRuta(): DatosRuta | undefined {
  const coincidencias = useMatches()
  for (let i = coincidencias.length - 1; i >= 0; i--) {
    const datos = coincidencias[i].handle as DatosRuta | undefined
    if (datos?.titulo) return datos
  }
  return undefined
}

/**
 * Rutas internas: exige sesión, aplica la guarda de roles (el backend vuelve a validar; RN-07)
 * y arma el marco con los datos de los módulos.
 */
export function AppLayout() {
  const sesion = useSesion()
  const ubicacion = useLocation()
  const navegar = useNavigate()
  const datos = useDatosRuta()
  // La vista puede dar un título más preciso que la ruta, como el código del proyecto en su ficha.
  const tituloVista = useTituloDeLaVista()
  const titulo = tituloVista ?? datos?.titulo
  // Con contraseña temporal no se pide nada más hasta que la persona cree la suya (F1.1).
  const conSesion = Boolean(sesion.data) && !sesion.data?.debeCambiarClave

  const periodo = usePeriodoActual(conSesion)
  const avisos = useAvisos(conSesion)
  const contadores = useContadores(conSesion)
  const marcarLeido = useMarcarAvisoLeido()
  const marcarTodos = useMarcarTodosLeidos()
  const renovar = useRenovarSesion()
  const salir = useSalir()

  const inactividad = useInactividad({
    minutos: sesion.data?.inactividadMinutos ?? 30,
    alRenovar: () => renovar.mutate(),
    alExpirar: () => salir('inactividad'),
    activo: conSesion,
  })

  // Al cambiar de página, el foco va al contenido para que el lector de pantalla empiece por ahí.
  const primeraVez = useRef(true)
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false
      return
    }
    document.getElementById('contenido')?.focus()
  }, [ubicacion.pathname])

  useEffect(() => {
    if (titulo) document.title = `${titulo} · Control de Proyectos FaCyT`
  }, [titulo])

  if (sesion.isPending) return <Cargando etiqueta="Abriendo tu sesión…" />
  if (!sesion.data)
    return <Navigate to="/iniciar-sesion" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />
  if (sesion.data.debeCambiarClave)
    return <Navigate to="/crear-clave" replace state={{ desde: ubicacion.pathname + ubicacion.search }} />

  const { usuario } = sesion.data
  const navegacion = NAVEGACION[usuario.rol].map((n) => ({
    ...n,
    contador: contadores.data?.[n.clave],
    detalleContador: detalleContador(n.clave, contadores.data),
  }))
  const permitido = !datos?.roles || datos.roles.includes(usuario.rol)

  const p = periodo.data
  const cierre = p && (p.estado === 'abierto' || p.estado === 'en_revision')
  const fecha = cierre
    ? p.fin < fechaIso()
      ? `${fechaLarga(new Date())} · El cierre de ${nombreMes(p.inicio)} está en revisión`
      : `${fechaLarga(new Date())} · El período de ${nombreMes(p.inicio)} cierra ${elDia(p.fin)}`
    : fechaLarga(new Date())

  return (
    <>
      <AppShell
        navegacion={navegacion}
        activo={itemActivo(usuario.rol, ubicacion.pathname)}
        titulo={titulo ?? 'Control de Proyectos'}
        seccion={datos ? seccionDe(datos) : undefined}
        fecha={fecha}
        persona={{ nombre: usuario.nombre, iniciales: usuario.iniciales, rol: NOMBRE_ROL[usuario.rol] }}
        avisos={{
          lista: avisos.data,
          cargando: avisos.isPending,
          alAbrir: (a) => {
            if (!a.leido) marcarLeido.mutate(a.id)
          },
          alMarcarTodos: () => marcarTodos.mutate(),
        }}
        alBuscar={(texto) => navegar(`/buscar?q=${encodeURIComponent(texto)}`)}
      >
        {permitido ? <Outlet /> : <SinPermiso roles={datos?.roles ?? []} />}
      </AppShell>
      <AvisoSesion restante={inactividad.restante} alSeguir={inactividad.seguir} alSalir={() => salir()} />
    </>
  )
}

/** La bandeja suma lo que hay por decidir y los gastos aprobados por ejecutar: el nombre accesible lo separa (plan §7.2). */
function detalleContador(clave: string, c: Record<string, number> | undefined) {
  const porEjecutar = c?.bandejaPorEjecutar ?? 0
  if (clave !== 'bandeja' || !c || porEjecutar === 0) return undefined
  return `${c.bandeja - porEjecutar} por decidir y ${porEjecutar} por ejecutar`
}
