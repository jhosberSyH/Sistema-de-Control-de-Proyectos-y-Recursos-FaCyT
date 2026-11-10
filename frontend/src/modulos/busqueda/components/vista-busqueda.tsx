import { Link, useSearchParams } from 'react-router'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { Cargando, Esqueleto, ErrorCarga, EstadoVacio } from '@/components/ui/estados-vista'
import { Lista } from '@/components/ui/listas'
import { Bloque } from '@/components/ui/tarjeta'
import { useTituloPagina } from '@/hooks/use-titulo-pagina'
import { useBusqueda } from '../api/busqueda'

const MINIMO = 2

/** Búsqueda global: proyectos, insumos, equipos y solicitudes que el rol puede abrir (RN-07). */
export function VistaBusqueda() {
  const [params] = useSearchParams()
  const q = (params.get('q') ?? '').trim()
  const largo = q.length >= MINIMO
  const datos = useBusqueda(largo ? q : '')
  useTituloPagina(q ? `Búsqueda: ${q}` : 'Búsqueda')

  const cab = (
    <EncabezadoPagina
      migas={[{ texto: 'Inicio', a: '/inicio' }, { texto: 'Búsqueda' }]}
      titulo={q ? <>Resultados para «{q}»</> : 'Búsqueda'}
      subtitulo="Proyectos, insumos, equipos y solicitudes a los que tienes acceso."
    />
  )

  if (!largo) {
    return (
      <>
        {cab}
        <EstadoVacio icono="buscar" titulo={q ? 'Escribe al menos 2 letras' : 'Escribe qué quieres buscar'}>
          Usa el campo de la barra superior: puedes buscar por código, nombre o descripción.
        </EstadoVacio>
      </>
    )
  }
  if (datos.isPending) {
    return (
      <>
        {cab}
        <Cargando etiqueta="Buscando…">
          <Esqueleto alto={160} />
        </Cargando>
      </>
    )
  }
  if (datos.isError) return <ErrorCarga mensaje={datos.error.message} alReintentar={() => datos.refetch()} />

  const grupos = datos.data.grupos.filter((g) => g.total > 0)
  if (grupos.length === 0) {
    return (
      <>
        {cab}
        <EstadoVacio icono="buscar" titulo={`No encontramos nada para «${q}»`}>
          Revisa la ortografía o prueba con el código o con una parte del nombre.
        </EstadoVacio>
      </>
    )
  }
  return (
    <>
      {cab}
      <div style={{ display: 'grid', gap: 16 }}>
        {grupos.map((g) => (
          <Bloque
            key={g.clave}
            titulo={g.titulo}
            extra={
              <span className="conteo">
                {g.total === 1 ? '1 resultado' : `${g.total} resultados`}
                {g.total > g.resultados.length ? ` · se muestran ${g.resultados.length}` : ''}
              </span>
            }
          >
            <Lista
              items={g.resultados.map((r) => ({
                id: r.id,
                principal: <Link to={r.enlace}>{r.titulo}</Link>,
                secundario: r.detalle,
              }))}
            />
          </Bloque>
        ))}
      </div>
    </>
  )
}
