import { Aviso } from '@/components/ui/aviso'
import { ListaClaveValor } from '@/components/ui/listas'
import { Bloque } from '@/components/ui/tarjeta'
import { NOMBRE_ROL, type UsuarioSesion } from '../types'

/**
 * Datos de la cuenta en "Mi perfil". Son de solo lectura: las cuentas las administra el
 * Administrador del Sistema (F1.1 a F1.3), igual que la contraseña (vista 01).
 */
export function DatosCuenta({ usuario }: { usuario: UsuarioSesion }) {
  return (
    <Bloque titulo="Cuenta">
      <div className="perfil-cab">
        <span className="avatar" aria-hidden="true">
          {usuario.iniciales}
        </span>
        <div>
          <strong>{usuario.nombre}</strong>
          <span className="sec">{NOMBRE_ROL[usuario.rol]}</span>
        </div>
      </div>
      <ListaClaveValor
        datos={[{ clave: 'Correo de acceso', valor: <span className="mono">{usuario.correo}</span> }]}
      />
      <Aviso tipo="info" rol="none">
        <p>
          Tus datos los gestiona el administrador del sistema: si algo está mal, pídele que lo corrija. Si
          olvidas tu contraseña, te dará una temporal y al entrar crearás la tuya.
        </p>
      </Aviso>
    </Bloque>
  )
}
