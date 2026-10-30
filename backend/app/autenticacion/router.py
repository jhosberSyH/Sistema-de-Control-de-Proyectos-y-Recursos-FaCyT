"""Authentication routes (Login, Logout, Current User)."""

from datetime import datetime, timezone, timedelta
from fastapi import APIRouter, Depends, HTTPException, Request, Response, status
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, generate_session_credentials, hash_session_token
from app.auditoria.service import record_audit_log
from app.autenticacion.dependencies import get_current_user, get_client_ip
from app.modulos.usuarios.models import User, SessionModel
from app.modulos.usuarios.schemas import LoginRequest, SessionInfo

router = APIRouter(prefix="/auth", tags=["Autenticación"])


@router.post("/login", response_model=SessionInfo)
def login(
    payload: LoginRequest,
    request: Request,
    response: Response,
    db: Session = Depends(get_db)
):
    """Authenticate user with email and password, establishing server-side session."""
    user = db.query(User).filter(User.email == payload.email.strip().lower()).first()
    client_ip = get_client_ip(request)

    if not user or not verify_password(payload.password, user.password_hash):
        record_audit_log(
            db=db,
            user_id=user.id if user else None,
            ip_address=client_ip,
            target_object="AUTH",
            action_type="LOGIN_FAILED",
            old_value=None,
            new_value={"attempted_email": payload.email}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Correo o contraseña incorrectos."
        )

    # Strictly block deactivated accounts (F1.3)
    if not user.is_active:
        record_audit_log(
            db=db,
            user_id=user.id,
            ip_address=client_ip,
            target_object=f"USER:{user.id}",
            action_type="LOGIN_BLOCKED_DEACTIVATED",
            old_value=None,
            new_value={"email": user.email}
        )
        db.commit()
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="La cuenta se encuentra desactivada. No tiene acceso al sistema."
        )

    # Create server session (OWASP / RFC 10017)
    raw_token, token_hash, csrf_token = generate_session_credentials()
    now = datetime.now(timezone.utc)
    expires_at = now + timedelta(hours=settings.SESSION_ABSOLUTE_HOURS)

    session_record = SessionModel(
        user_id=user.id,
        token_hash=token_hash,
        csrf_token=csrf_token,
        ip_address=client_ip,
        user_agent=request.headers.get("User-Agent"),
        created_at=now,
        last_activity_at=now,
        expires_at=expires_at
    )
    db.add(session_record)

    user.last_login_at = now

    record_audit_log(
        db=db,
        user_id=user.id,
        ip_address=client_ip,
        target_object=f"SESSION:{session_record.id}",
        action_type="LOGIN_SUCCESS",
        old_value=None,
        new_value={"email": user.email, "role": user.role}
    )

    db.commit()

    # Set secure cookie
    response.set_cookie(
        key=settings.SESSION_COOKIE_NAME,
        value=raw_token,
        httponly=True,
        secure=False if settings.APP_ENV == "development" else True,
        samesite="lax" if settings.APP_ENV == "development" else "strict",
        path="/"
    )

    return SessionInfo(
        user_id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        csrf_token=csrf_token
    )


@router.post("/logout")
def logout(
    request: Request,
    response: Response,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Terminate current user session."""
    raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    if raw_token:
        token_hash = hash_session_token(raw_token)
        db.query(SessionModel).filter(SessionModel.token_hash == token_hash).delete()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=get_client_ip(request),
        target_object=f"USER:{current_user.id}",
        action_type="LOGOUT",
        old_value=None,
        new_value={"email": current_user.email}
    )
    db.commit()

    response.delete_cookie(key=settings.SESSION_COOKIE_NAME, path="/")
    return {"message": "Sesión cerrada exitosamente."}


@router.get("/me", response_model=SessionInfo)
def get_current_session_info(
    request: Request,
    current_user: User = Depends(get_current_user),
    db: Session = Depends(get_db)
):
    """Return identity and role of currently authenticated user."""
    raw_token = request.cookies.get(settings.SESSION_COOKIE_NAME)
    csrf = ""
    if raw_token:
        token_hash = hash_session_token(raw_token)
        s = db.query(SessionModel).filter(SessionModel.token_hash == token_hash).first()
        if s:
            csrf = s.csrf_token

    return SessionInfo(
        user_id=current_user.id,
        full_name=current_user.full_name,
        email=current_user.email,
        role=current_user.role,
        csrf_token=csrf
    )

