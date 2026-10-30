"""Authentication and authorization dependencies (RFC 10017, OWASP)."""

from datetime import datetime, timezone, timedelta
from typing import List, Optional
from fastapi import Request, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import hash_session_token
from app.modulos.usuarios.models import User, SessionModel


def get_client_ip(request: Request) -> str:
    """Extract client IP address considering proxy headers."""
    forwarded = request.headers.get("X-Forwarded-For")
    if forwarded:
        return forwarded.split(",")[0].strip()
    return request.client.host if request.client else "127.0.0.1"


def get_current_user(
    request: Request,
    db: Session = Depends(get_db)
) -> User:
    """
    Validate session from cookie or Authorization header.
    Enforces active account check and session idle/absolute timeouts.
    """
    raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if not raw_token:
        # Fallback to Authorization: Bearer <token>
        auth_header = request.headers.get("Authorization")
        if auth_header and auth_header.startswith("Bearer "):
            raw_token = auth_header.replace("Bearer ", "").strip()

    if not raw_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="No se encontró una sesión activa. Inicie sesión para continuar."
        )

    token_hash = hash_session_token(raw_token)
    session = db.query(SessionModel).filter(SessionModel.token_hash == token_hash).first()

    now = datetime.now(timezone.utc)

    def _to_utc(dt: Optional[datetime]) -> datetime:
        if dt is None:
            return now
        if dt.tzinfo is None:
            return dt.replace(tzinfo=timezone.utc)
        return dt

    if not session or _to_utc(session.expires_at) < now:
        if session:
            db.delete(session)
            db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión ha expirado o es inválida."
        )

    # Idle timeout check
    idle_limit = timedelta(minutes=settings.SESSION_IDLE_MINUTES)
    if (now - _to_utc(session.last_activity_at)) > idle_limit:
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="La sesión se cerró por inactividad."
        )

    # Active user check (F1.3)
    user = session.user
    if not user or not user.is_active:
        db.delete(session)
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta se encuentra desactivada. Comuníquese con el administrador."
        )

    # Refresh activity timestamp
    session.last_activity_at = now
    db.commit()

    return user


def require_role(allowed_roles: List[str]):
    """Role-based access control dependency factory."""
    def role_checker(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in allowed_roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"Acceso denegado: Esta función requiere el rol {', '.join(allowed_roles)}."
            )
        return current_user
    return role_checker


# Convenient shorthand for Module 1 (Exclusive for Administrador del Sistema)
require_admin = require_role(["Administrador del Sistema"])

