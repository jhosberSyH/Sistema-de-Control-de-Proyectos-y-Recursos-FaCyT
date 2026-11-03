import { useMutation } from '@tanstack/react-query'
import { Icono } from '@/components/icono'
import { api } from '@/lib/api-client'
import { guardarArchivo } from '@/lib/descargas'

/** GET /api/solicitudes/:id/cotizacion: baja el archivo adjunto a un gasto. */
function useDescargarCotizacion(id: string) {
  return useMutation({
    mutationFn: async () => {
      const { archivo, nombre } = await api.descargar(`/solicitudes/${id}/cotizacion`)
      guardarArchivo(archivo, nombre)
    },
  })
}

/** Nombre del archivo adjunto como enlace de descarga; sin cotización, el texto "Sin cotización". */
export function EnlaceCotizacion({ solicitud, archivo }: { solicitud: string; archivo: string | null }) {
  const descargar = useDescargarCotizacion(solicitud)
  if (!archivo) return <>Sin cotización</>
  return (
    <>
      <button
        type="button"
        className="btn btn-txt"
        style={{ paddingInline: 0, minHeight: 32, height: 'auto', textAlign: 'left' }}
        aria-disabled={descargar.isPending || undefined}
        onClick={() => !descargar.isPending && descargar.mutate()}
      >
        <Icono nombre="descarga" />
        {descargar.isPending ? 'Preparando el archivo…' : archivo}
      </button>
      {descargar.isError && (
        <span role="alert" className="sec" style={{ display: 'block', color: 'var(--err)' }}>
          {descargar.error.message}
        </span>
      )}
    </>
  )
}
