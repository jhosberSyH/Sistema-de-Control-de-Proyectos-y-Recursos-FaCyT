"""Autenticación con el contrato del frontend (README §6, F1.1, F1.3).

POST /api/auth/iniciar-sesion   {correo, clave}  -> Sesion (crea la cookie HttpOnly)
GET  /api/auth/sesion                            -> Sesion (401 sin sesión; renueva la inactividad)
POST /api/auth/cambiar-clave    {clave}          -> Sesion (solo con contraseña temporal; rota la sesión)
POST /api/auth/cerrar-sesion                     -> 204
"""

from datetime import datetime, timezone, timedelta
from typing import Literal, Optional

from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import (
    SesionActual,
    _token_de,
    get_client_ip,
    obtener_sesion,
    sesion_con_csrf,
)
from app.core.api import ErrorValidacion, ModeloApi, iniciales, rol_api
from app.core.config import settings
from app.core.database import get_db
from app.core.security import (
    generate_session_credentials,
    hash_password,
    hash_session_token,
    verify_password,
)
from app.modulos.usuarios.models import SessionModel, User

router = APIRouter(prefix="/auth", tags=["Autenticación"])

CLAVE_MINIMO = 12  # NIST SP 800-63B: largo antes que reglas de composición
CLAVE_MAXIMO = 128


# --- Esquemas del contrato -----------------------------------------------------------------------

Rol = Literal["administrador", "coordinador", "aprobador"]


class UsuarioSesion(ModeloApi):
    id: str
    nombre: str
    correo: str
    rol: Rol
    iniciales: str


class Sesion(ModeloApi):
    usuario: UsuarioSesion
    csrf: str
    inactividad_minutos: int
    debe_cambiar_clave: bool


class IniciarSesion(ModeloApi):
    correo: str = ""
    clave: str = ""


class CambiarClave(ModeloApi):
    clave: str = ""


# --- Utilidades ----------------------------------------------------------------------------------

def _sesion(user: User, csrf: str) -> Sesion:
    return Sesion(
        usuario=UsuarioSesion(
            id=str(user.id),
            nombre=user.full_name,
            correo=user.email,
            rol=rol_api(user.role),
            iniciales=iniciales(user.full_name),
        ),
        csrf=csrf,
        inactividad_minutos=settings.SESSION_IDLE_MINUTES,
        debe_cambiar_clave=bool(user.must_change_password),
    )


def _abrir_sesion(db: Session, user: User, request: Request, response: Response) -> str:
    """Crea la sesión en BD y la cookie. Devuelve el token CSRF."""
    raw_token, token_hash, csrf_token = generate_session_credentials()
    now = datetime.now(timezone.utc)
    db.add(SessionModel(
        user_id=user.id,
        token_hash=token_hash,
        csrf_token=csrf_token,
        ip_address=get_client_ip(request),
        user_agent=request.headers.get("User-Agent"),
        created_at=now,
        last_activity_at=now,
        expires_at=now + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS),
    ))
    # El prefijo __Host- exige Secure, Path=/ y sin Domain. Los navegadores aceptan cookies Secure
    # en http://localhost, así que vale también en desarrollo.
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=True,
        samesite="lax" if settings.APP_ENV == "development" else "strict",
        path="/",
    )
    return csrf_token


# --- Rutas ---------------------------------------------------------------------------------------

@router.post("/iniciar-sesion", response_model=Sesion)
def iniciar_sesion(payload: IniciarSesion, request: Request, response: Response, db: Session = Depends(get_db)):
    correo = payload.correo.strip().lower()
    errores = {}
    if not correo:
        errores["correo"] = "Escribe tu correo."
    if not payload.clave:
        errores["clave"] = "Escribe tu contraseña."
    if errores:
        raise ErrorValidacion(errores)

    ip = get_client_ip(request)
    user = db.query(User).filter(User.email == correo).first()
    # El mismo mensaje para correo inexistente y contraseña errada: no revela qué cuentas existen (OWASP)
    if not user or not verify_password(payload.clave, user.password_hash):
        record_audit_log(
            db=db, user_id=user.id if user else None, ip_address=ip, target_object="AUTH",
            action_type="LOGIN_FAILED", new_value={"attempted_email": correo},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="El correo o la contraseña no coinciden. Revisa que el correo esté bien escrito e inténtalo de nuevo.",
        )
    # F1.3: se informa solo después de validar la contraseña
    if not user.is_active:
        record_audit_log(
            db=db, user_id=user.id, ip_address=ip, target_object=f"USER:{user.id}",
            action_type="LOGIN_BLOCKED_DEACTIVATED", new_value={"email": user.email},
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Tu cuenta está desactivada. Si necesitas entrar de nuevo, pídele al administrador del sistema que la reactive.",
        )

    csrf = _abrir_sesion(db, user, request, response)
    user.last_login_at = datetime.now(timezone.utc)
    record_audit_log(
        db=db, user_id=user.id, ip_address=ip, target_object=f"USER:{user.id}",
        target_table="users", target_id=str(user.id), action_type="LOGIN_SUCCESS",
        new_value={"email": user.email, "descripcion": f"{user.full_name} inició sesión"},
    )
    db.commit()
    return _sesion(user, csrf)


@router.get("/sesion", response_model=Sesion)
def sesion(actual: SesionActual = Depends(obtener_sesion)):
    return _sesion(actual.usuario, actual.sesion.csrf_token)


@router.post("/cambiar-clave", response_model=Sesion)
def cambiar_clave(
    payload: CambiarClave,
    request: Request,
    response: Response,
    actual: SesionActual = Depends(sesion_con_csrf),
    db: Session = Depends(get_db),
):
    user = actual.usuario
    if not user.must_change_password:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Tu contraseña ya está creada.")

    clave = payload.clave
    nombre_correo = user.email.split("@")[0].lower()
    if len(clave) < CLAVE_MINIMO:
        raise ErrorValidacion({"clave": f"Usa al menos {CLAVE_MINIMO} caracteres."})
    if len(clave) > CLAVE_MAXIMO:
        raise ErrorValidacion({"clave": f"Usa como máximo {CLAVE_MAXIMO} caracteres."})
    if verify_password(clave, user.password_hash):
        raise ErrorValidacion({"clave": "Elige una distinta de la contraseña temporal."})
    if len(nombre_correo) >= 4 and nombre_correo in clave.lower():
        raise ErrorValidacion({"clave": "No uses tu correo dentro de la contraseña: es lo primero que se prueba."})

    user.password_hash = hash_password(clave)
    user.must_change_password = False
    # Contraseña nueva, sesión nueva: se cierran todas las sesiones de la cuenta (README §6, Invalidación)
    db.query(SessionModel).filter(SessionModel.user_id == user.id).delete()
    csrf = _abrir_sesion(db, user, request, response)
    record_audit_log(
        db=db, user_id=user.id, ip_address=get_client_ip(request), target_object=f"USER:{user.id}",
        target_table="users", target_id=str(user.id), action_type="PASSWORD_CREATED",
        new_value={"descripcion": f"{user.full_name} creó su contraseña"},
    )
    db.commit()
    return _sesion(user, csrf)


@router.post("/cerrar-sesion", status_code=status.HTTP_204_NO_CONTENT, response_class=Response)
def cerrar_sesion(request: Request, db: Session = Depends(get_db)):
    """Cierra la sesión si existe. Siempre responde 204 y borra la cookie (también tras inactividad)."""
    raw_token, _ = _token_de(request)
    if raw_token:
        sesion_bd: Optional[SessionModel] = (
            db.query(SessionModel).filter(SessionModel.token_hash == hash_session_token(raw_token)).first()
        )
        if sesion_bd:
            user = sesion_bd.user
            db.delete(sesion_bd)
            record_audit_log(
                db=db, user_id=user.id, ip_address=get_client_ip(request), target_object=f"USER:{user.id}",
                target_table="users", target_id=str(user.id), action_type="LOGOUT",
                new_value={"email": user.email, "descripcion": f"{user.full_name} cerró sesión"},
            )
            db.commit()
    response = Response(status_code=status.HTTP_204_NO_CONTENT)
    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/", secure=True, httponly=True)
    return response
