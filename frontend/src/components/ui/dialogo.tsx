import { useRef, type CSSProperties, type FormEventHandler, type ReactNode, type RefObject } from 'react'
import { AlertDialog, Dialog } from 'radix-ui'
import { Icono } from '@/components/icono'

type PropsBase = {
  abierto: boolean
  alCambiar: (abierto: boolean) => void
  titulo: ReactNode
  /** Línea secundaria bajo el título (.sec). */
  descripcion?: ReactNode
  children?: ReactNode
  /** Ancho máximo, cuando el mockup usa uno distinto de 560 px (por ejemplo 640 en el registro de proyectos). */
  ancho?: number
  /** Si el diálogo es un formulario, se envía con Enter y con el botón de tipo submit. */
  alEnviar?: FormEventHandler<HTMLFormElement>
  /**
   * Adónde va el foco al cerrar si el control que abrió el diálogo ya no existe (por ejemplo, la fila
   * de una cuenta que se desactivó y salió de la lista). Suele ser el aviso con el resultado.
   */
  focoAlCerrar?: RefObject<HTMLElement | null>
}

type PropsDialogo = PropsBase & {
  /** Control que recibe el foco al abrir, cuando no es el primer campo (por ejemplo, "Copiar"). */
  focoInicial?: RefObject<HTMLElement | null>
}

function estiloAncho(ancho?: number): CSSProperties | undefined {
  return ancho ? { maxWidth: ancho } : undefined
}

/**
 * Devuelve el foco al control que abrió el diálogo (WCAG 2.4.3). Radix solo lo hace con su propio
 * Trigger, y aquí los diálogos se abren desde botones de tablas y avisos: se recuerda el elemento
 * enfocado justo antes de abrir y se vuelve a él al cerrar, o a focoAlCerrar si ya no está.
 */
function useRegresoFoco(focoAlCerrar?: RefObject<HTMLElement | null>) {
  const origen = useRef<HTMLElement | null>(null)
  return {
    alAbrir() {
      const activo = document.activeElement
      // Si se abre justo después de cerrar otro diálogo, el foco está en <body>: no sirve de regreso.
      origen.current = activo instanceof HTMLElement && activo !== document.body ? activo : null
    },
    alCerrar(e: Event) {
      const destino = origen.current?.isConnected ? origen.current : focoAlCerrar?.current
      if (destino?.isConnected) {
        e.preventDefault()
        destino.focus()
      }
    },
  }
}

/**
 * Diálogo modal del mockup (.capa + .dialogo): velo, filete superior primario y botón de cerrar.
 * Radix atrapa el foco y cierra con Escape; useRegresoFoco devuelve el foco al control que lo abrió.
 */
export function Dialogo({
  abierto,
  alCambiar,
  titulo,
  descripcion,
  children,
  ancho,
  alEnviar,
  focoAlCerrar,
  focoInicial,
}: PropsDialogo) {
  const foco = useRegresoFoco(focoAlCerrar)
  const cuerpo = (
    <>
      <div className="dialogo-cab">
        <div>
          <Dialog.Title asChild>
            <h2>{titulo}</h2>
          </Dialog.Title>
          {descripcion ? (
            <Dialog.Description asChild>
              <p className="sec">{descripcion}</p>
            </Dialog.Description>
          ) : null}
        </div>
        <Dialog.Close asChild>
          <button className="icono-btn" type="button" aria-label="Cerrar">
            <Icono nombre="error" />
          </button>
        </Dialog.Close>
      </div>
      {children}
    </>
  )
  return (
    <Dialog.Root open={abierto} onOpenChange={alCambiar}>
      <Dialog.Portal>
        <Dialog.Overlay className="capa">
          {/* Sin descripción, aria-describedby={undefined} le indica a Radix que es intencional. */}
          <Dialog.Content
            asChild
            {...(descripcion ? {} : { 'aria-describedby': undefined })}
            onOpenAutoFocus={(e) => {
              foco.alAbrir()
              // En un formulario el foco empieza en el primer campo, no en el botón de cerrar.
              const campo =
                focoInicial?.current ??
                (alEnviar
                  ? (e.target as HTMLElement).querySelector<HTMLElement>('input, select, textarea')
                  : null)
              if (!campo) return
              e.preventDefault()
              campo.focus()
            }}
            onCloseAutoFocus={foco.alCerrar}
          >
            {alEnviar ? (
              <form className="dialogo" style={estiloAncho(ancho)} noValidate onSubmit={alEnviar}>
                {cuerpo}
              </form>
            ) : (
              <div className="dialogo" style={estiloAncho(ancho)}>
                {cuerpo}
              </div>
            )}
          </Dialog.Content>
        </Dialog.Overlay>
      </Dialog.Portal>
    </Dialog.Root>
  )
}

type PropsAlerta = PropsBase & {
  /** Texto del botón que confirma. */
  confirmar: string
  alConfirmar: () => void
  /** Botón de peligro (desactivar, pasar a mantenimiento) o primario. */
  peligro?: boolean
  cancelar?: string
  /** Acción propia del botón secundario; sin ella, el botón solo cierra el diálogo. */
  alCancelar?: () => void
  /** Pone el foco inicial en el botón de confirmar cuando esa es la opción segura (aviso de sesión). */
  focoEnConfirmar?: boolean
  ocupado?: boolean
}

/**
 * Confirmación de una acción con consecuencias (role="alertdialog"), como desactivar una cuenta.
 * El foco empieza en "Cancelar" para que Enter no confirme por accidente (H5).
 */
export function DialogoAlerta({
  abierto,
  alCambiar,
  titulo,
  descripcion,
  children,
  ancho,
  confirmar,
  alConfirmar,
  peligro,
  cancelar = 'Cancelar',
  alCancelar,
  focoEnConfirmar,
  ocupado,
  focoAlCerrar,
}: PropsAlerta) {
  const refConfirmar = useRef<HTMLButtonElement>(null)
  const foco = useRegresoFoco(focoAlCerrar)
  return (
    <AlertDialog.Root open={abierto} onOpenChange={alCambiar}>
      <AlertDialog.Portal>
        <AlertDialog.Overlay className="capa">
          <AlertDialog.Content
            className="dialogo"
            style={estiloAncho(ancho)}
            onOpenAutoFocus={(e) => {
              foco.alAbrir()
              if (!focoEnConfirmar) return
              e.preventDefault()
              refConfirmar.current?.focus()
            }}
            onCloseAutoFocus={foco.alCerrar}
          >
            <div className="dialogo-cab">
              <AlertDialog.Title asChild>
                <h2>{titulo}</h2>
              </AlertDialog.Title>
            </div>
            {descripcion ? (
              <AlertDialog.Description asChild>
                <p>{descripcion}</p>
              </AlertDialog.Description>
            ) : null}
            {children}
            <div className="acc-form">
              {alCancelar ? (
                <button className="btn btn-sec" type="button" onClick={alCancelar}>
                  {cancelar}
                </button>
              ) : (
                <AlertDialog.Cancel asChild>
                  <button className="btn btn-sec" type="button">
                    {cancelar}
                  </button>
                </AlertDialog.Cancel>
              )}
              <button
                ref={refConfirmar}
                className={peligro ? 'btn btn-peligro' : 'btn btn-pri'}
                type="button"
                aria-disabled={ocupado || undefined}
                onClick={() => {
                  if (!ocupado) alConfirmar()
                }}
              >
                {confirmar}
              </button>
            </div>
          </AlertDialog.Content>
        </AlertDialog.Overlay>
      </AlertDialog.Portal>
    </AlertDialog.Root>
  )
}
