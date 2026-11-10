"""Authentication and authorization dependencies (RFC 10017, OWASP)."""

import secrets
from dataclasses import dataclass
from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_session_token
from app.modulos.usuarios.models import User, SessionModel

METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}
CSRF_HEADER = "X-CSRF-Token"


def get_client_ip(request: Request) -> str:
    """Extract client IP address considering proxy headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


@dataclass
class SesionActual:
    usuario: User
    sesion: SessionModel
    por_cookie: bool


def _token_de(request: Request) -> tuple[Optional[str], bool]:
    """Token crudo de la cookie de sesión.

    El encabezado Authorization: Bearer solo se acepta fuera de producción (pruebas automatizadas);
    en producción la sesión viaja únicamente en la cookie HttpOnly (README §6).
    """
    raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if raw_token:
        return raw_token, True
    if settings.APP_ENV != "production":
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            return auth_header.removeprefix("Bearer ").strip(), False
    return None, False


def _to_utc(dt: Optional[datetime], now: datetime) -> datetime:
    if dt is None:
        return now
    return dt.replace(tzinfo=timezone.utc) if dt.tzinfo is None else dt


def obtener_sesion(request: Request, db: Session = Depends(get_db)) -> SesionActual:
    """Valida la sesión: existencia, vencimiento absoluto, inactividad y cuenta activa.

    Cada petición válida renueva la marca de actividad (el botón "Seguir trabajando" del frontend
    llama a GET /auth/sesion justamente para eso).
    """
    raw_token, por_cookie = _token_de(request)
    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesión se cerró. Vuelve a iniciar sesión para continuar."
        )

    session = db.query(SessionModel).filter(SessionModel.token_hash == hash_session_token(raw_token)).first()
    now = datetime.now(timezone.utc)

    if not session or _to_utc(session.expires_at, now) < now:
        if session:
            db.delete(session)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesión se cerró. Vuelve a iniciar sesión para continuar."
        )

    if (now - _to_utc(session.last_activity_at, now)) > timedelta(minutes=settings.SESSION_IDLE_MINUTES):
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu sesión se cerró por inactividad. Vuelve a iniciar sesión para continuar."
        )

    # F1.3: la cuenta desactivada pierde el acceso de inmediato
    user = session.user
    if not user or not user.is_active:
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Tu cuenta está desactivada. Si necesitas entrar de nuevo, pídele al administrador que la reactive."
        )

    session.last_activity_at = now
    db.commit()
    return SesionActual(usuario=user, sesion=session, por_cookie=por_cookie)


def verificar_csrf(request: Request, actual: SesionActual) -> None:
    """Patrón synchronizer token: las escrituras con cookie deben traer el token de la sesión.

    Con Bearer (solo pruebas) no aplica: ese encabezado no lo adjunta el navegador por su cuenta.
    """
    if request.method in METODOS_SEGUROS or not actual.por_cookie:
        return
    enviado = request.headers.get(CSRF_HEADER, "")
    if not enviado or not secrets.compare_digest(enviado, actual.sesion.csrf_token):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La página quedó desactualizada. Recárgala e inténtalo de nuevo."
        )


def sesion_con_csrf(request: Request, actual: SesionActual = Depends(obtener_sesion)) -> SesionActual:
    """Sesión válida y, si es una escritura, con token CSRF. No exige haber cambiado la clave temporal."""
    verificar_csrf(request, actual)
    return actual


def get_current_user(actual: SesionActual = Depends(sesion_con_csrf)) -> User:
    """Usuario de la sesión para todas las rutas de negocio.

    Con contraseña temporal (F1.1) solo se permite crear la propia: el resto responde 403.
    """
    if actual.usuario.must_change_password:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Primero crea tu contraseña: entraste con una temporal."
        )
    return actual.usuario


def require_role(allowed_roles: List[str]):
    """Role-based access control dependency factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Tu cuenta no tiene permiso para hacer esto."
            )
        return current_user
    return role_checker


# Convenient shorthand for Module 1 (Exclusive for Administrador del Sistema)
require_admin = require_role(["Administrador del Sistema"])
