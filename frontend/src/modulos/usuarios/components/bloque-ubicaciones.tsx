import { zodResolver } from '@hookform/resolvers/zod'
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react'
import { useForm } from 'react-hook-form'
import { Aviso } from '@/components/ui/aviso'
import { Campo, Entrada } from '@/components/ui/campo'
import { ChipEstado } from '@/components/ui/estado'
import { Cargando, Esqueleto, ErrorCarga } from '@/components/ui/estados-vista'
import { TablaDatos } from '@/components/ui/tabla'
import { Bloque } from '@/components/ui/tarjeta'
import { esApiError } from '@/lib/api-client'
import { useCrearUbicacion, useUbicaciones } from '../api/catalogos'
import { esquemaUbicacion, type DatosUbicacion } from '../schemas/catalogos'
import type { Ubicacion } from '../types'
import {
  DialogoDesactivarUbicacion,
  DialogoEditarUbicacion,
  DialogoEliminarUbicacion,
  DialogoReactivarUbicacion,
} from './dialogos-ubicacion'

type Dialogo = { tipo: 'editar' | 'desactivar' | 'eliminar' | 'reactivar'; ubicacion: Ubicacion } | null

/** Ubicaciones de almacenamiento (mockup 05, columna izquierda; F1.4). */
export function BloqueUbicaciones() {
  const ubicaciones = useUbicaciones()
  const [dialogo, setDialogo] = useState<Dialogo>(null)
  const [resultado, setResultado] = useState<ReactNode>(null)
  const refFoco = useRef<HTMLElement | null>(null)
  const refResultado = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    if (resultado) refFoco.current = refResultado.current
  }, [resultado])

  const abrir = (siguiente: Dialogo, origen?: HTMLElement) => {
    if (origen) refFoco.current = origen
    setResultado(null)
    setDialogo(siguiente)
  }
  const terminar = (texto: ReactNode) => {
    setDialogo(null)
    setResultado(texto)
  }
  const comun = { alCerrar: () => setDialogo(null), focoAlCerrar: refFoco }
  const activas = ubicaciones.data?.filter((u) => u.activa).length

  return (
    <Bloque
      titulo="Ubicaciones de almacenamiento"
      extra={
        activas !== undefined && (
          <span className="conteo">{activas === 1 ? '1 activa' : `${activas} activas`}</span>
        )
      }
    >
      <FormularioAlta alAgregar={(u) => setResultado(<p>Agregaste la ubicación {u.nombre}.</p>)} />

      {resultado && (
        <div ref={refResultado} tabIndex={-1} style={{ outline: 'none' }}>
          <Aviso tipo="ok">{resultado}</Aviso>
        </div>
      )}

      {ubicaciones.isPending ? (
        <Cargando etiqueta="Cargando las ubicaciones…">
          {Array.from({ length: 5 }, (_, i) => (
            <Esqueleto key={i} alto={40} />
          ))}
        </Cargando>
      ) : ubicaciones.isError ? (
        <ErrorCarga mensaje={ubicaciones.error.message} alReintentar={() => ubicaciones.refetch()} />
      ) : (
        <TablaDatos apilable titulo="Ubicaciones de almacenamiento">
          <thead>
            <tr>
              <th scope="col">Nombre</th>
              <th scope="col">Descripción</th>
              <th scope="col" className="n">
                Lotes
              </th>
              <th scope="col">Estado</th>
              <th scope="col">
                <span className="vh">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {ubicaciones.data.map((u) => (
              <tr key={u.id}>
                <td>
                  <b>{u.nombre}</b>
                </td>
                <td data-e="">{u.descripcion || <span className="sec">Sin descripción</span>}</td>
                <td className="n" data-e="Lotes:">
                  {u.lotes}
                </td>
                <td>
                  {u.activa ? (
                    <ChipEstado tipo="ok">Activa</ChipEstado>
                  ) : (
                    <ChipEstado tipo="neutro">Desactivada</ChipEstado>
                  )}
                </td>
                <td className="acc-fila">
                  <button
                    className="btn btn-sec btn-chico"
                    type="button"
                    onClick={(e) =>
                      abrir({ tipo: u.activa ? 'editar' : 'reactivar', ubicacion: u }, e.currentTarget)
                    }
                  >
                    {u.activa ? 'Editar' : 'Reactivar'} <span className="vh">{u.nombre}</span>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </TablaDatos>
      )}
      <p className="sec" style={{ fontSize: 14 }}>
        Una ubicación con lotes o equipos no se elimina: se desactiva y deja de aparecer al registrar
        recepciones y equipos.
      </p>

      {dialogo?.tipo === 'editar' && (
        <DialogoEditarUbicacion
          ubicacion={dialogo.ubicacion}
          {...comun}
          alListo={(u) => terminar(<p>Guardaste los cambios de {u.nombre}.</p>)}
          alDesactivar={(ubicacion) => abrir({ tipo: 'desactivar', ubicacion })}
          alEliminar={(ubicacion) => abrir({ tipo: 'eliminar', ubicacion })}
        />
      )}
      {dialogo?.tipo === 'desactivar' && (
        <DialogoDesactivarUbicacion
          ubicacion={dialogo.ubicacion}
          {...comun}
          alListo={(u) =>
            terminar(<p>Desactivaste {u.nombre}. Ya no aparece al registrar la recepción de un lote.</p>)
          }
        />
      )}
      {dialogo?.tipo === 'eliminar' && (
        <DialogoEliminarUbicacion
          ubicacion={dialogo.ubicacion}
          {...comun}
          alListo={() => terminar(<p>Eliminaste {dialogo.ubicacion.nombre} del catálogo.</p>)}
        />
      )}
      {dialogo?.tipo === 'reactivar' && (
        <DialogoReactivarUbicacion
          ubicacion={dialogo.ubicacion}
          {...comun}
          alListo={(u) => terminar(<p>Reactivaste {u.nombre}.</p>)}
        />
      )}
    </Bloque>
  )
}

/** Alta en línea (.alta del mockup). Tras agregar, el foco vuelve al nombre para cargar la siguiente. */
function FormularioAlta({ alAgregar }: { alAgregar: (u: Ubicacion) => void }) {
  const crear = useCrearUbicacion()
  const {
    register,
    handleSubmit,
    setError,
    setFocus,
    reset,
    formState: { errors },
  } = useForm<DatosUbicacion>({
    resolver: zodResolver(esquemaUbicacion),
    defaultValues: { nombre: '', descripcion: '' },
  })
  const registroNombre = register('nombre')
  const registroDescripcion = register('descripcion')

  useEffect(() => {
    const e = crear.error
    if (!esApiError(e)) return
    if (e.status === 409) setError('nombre', { message: e.message }, { shouldFocus: true })
    for (const [campo, mensaje] of Object.entries(e.errores)) {
      if (campo === 'nombre' || campo === 'descripcion')
        setError(campo, { message: mensaje }, { shouldFocus: true })
    }
  }, [crear.error, setError])
  const errorGeneral =
    crear.error && !(esApiError(crear.error) && (crear.error.status === 409 || crear.error.status === 422))
      ? crear.error.message
      : null

  const enviar = handleSubmit((datos) => {
    if (crear.isPending) return
    crear.mutate(datos, {
      onSuccess: (u) => {
        reset()
        // Tras reset, React Hook Form vuelve a enlazar los campos: el foco se pide en el siguiente ciclo.
        window.setTimeout(() => setFocus('nombre'))
        alAgregar(u)
      },
    })
  })

  return (
    <>
      <form className="alta" noValidate aria-label="Agregar ubicación" onSubmit={enviar}>
        <Campo etiqueta="Nombre" id="u-nombre" error={errors.nombre?.message}>
          {(c) => <Entrada {...c} autoComplete="off" {...registroNombre} />}
        </Campo>
        <Campo etiqueta="Descripción" opcional id="u-desc" error={errors.descripcion?.message}>
          {(c) => <Entrada {...c} autoComplete="off" {...registroDescripcion} />}
        </Campo>
        <button className="btn btn-pri" type="submit" aria-disabled={crear.isPending || undefined}>
          {crear.isPending ? 'Agregando…' : 'Agregar'}
        </button>
      </form>
      {errorGeneral && (
        <Aviso tipo="err">
          <p>{errorGeneral}</p>
        </Aviso>
      )}
    </>
  )
}
