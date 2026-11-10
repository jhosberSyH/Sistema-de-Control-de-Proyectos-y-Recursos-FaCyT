import { Icono } from '@/components/icono'
import { Boton } from '@/components/ui/boton'
import { EncabezadoPagina } from '@/components/ui/encabezado-pagina'
import { SelectorTema } from '@/components/ui/selector-tema'
import { Bloque } from '@/components/ui/tarjeta'
import { DatosCuenta, useSesion } from '@/modulos/autenticacion'
import { useSalir } from '../use-salir'

/**
 * Mi perfil (/perfil). No tiene mockup: se armó con el lenguaje visual aprobado (plan §7.1).
 * Reúne lo que antes estaba en el pie del riel: la cuenta, el tema y el cierre de sesión.
 */
export function Perfil() {
  const sesion = useSesion()
  const salir = useSalir()
  if (!sesion.data) return null
  const { usuario, inactividadMinutos } = sesion.data

  return (
    <>
      <EncabezadoPagina
        migas={[{ texto: 'Inicio', a: '/inicio' }, { texto: 'Mi perfil' }]}
        titulo="Mi perfil"
        subtitulo="Tu cuenta, cómo se ve el sistema en este navegador y el cierre de sesión."
      />
      <div className="rejilla">
        <div className="col">
          <DatosCuenta usuario={usuario} />
        </div>
        <div className="col">
          <Bloque titulo="Apariencia">
            <p className="sec" id="tema-titulo">
              Tema de colores. "Sistema" sigue la configuración de tu equipo. Se recuerda en este navegador.
            </p>
            <SelectorTema etiquetadoPor="tema-titulo" />
          </Bloque>
          <Bloque titulo="Sesión">
            <p className="sec">
              La sesión se cierra sola tras {inactividadMinutos} minutos sin actividad. Te avisamos 2 minutos
              antes.
            </p>
            <div className="perfil-acc">
              <Boton variante="sec" onClick={() => salir()}>
                <Icono nombre="salir" />
                Cerrar sesión
              </Boton>
            </div>
          </Bloque>
        </div>
      </div>
    </>
  )
}
