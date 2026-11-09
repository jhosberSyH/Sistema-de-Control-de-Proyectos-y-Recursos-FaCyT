"""FastAPI router for Module 8: Audit log consultation (F8.6)."""

from datetime import date, datetime, time, timezone
from typing import List, Optional

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_admin
from app.modulos.usuarios.models import User
from app.auditoria.models import AuditLog
from app.auditoria.schemas import AuditLogItem, AuditLogListResponse

router = APIRouter(prefix="/auditoria", tags=["Módulo 8: Auditoría"])


def _build_item(log: AuditLog, user: Optional[User]) -> AuditLogItem:
    return AuditLogItem(
        id=log.id,
        timestamp=log.timestamp,
        user_id=log.user_id,
        user_name=user.full_name if user else None,
        ip_address=log.ip_address,
        action_type=log.action_type,
        target_object=log.target_object,
        target_table=log.target_table,
        target_id=log.target_id,
        old_value=log.old_value,
        new_value=log.new_value,
        justification=log.justification,
    )


@router.get(
    "",
    response_model=AuditLogListResponse,
    summary="Consult global audit log with filters (F8.6 | HU-26)",
)
def list_audit_logs(
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio (inclusive)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin (inclusive)"),
    user_id: Optional[str] = Query(None, description="ID del usuario"),
    action_type: Optional[str] = Query(None, description="Tipo de acción exacto"),
    target_table: Optional[str] = Query(None, description="Tabla afectada"),
    target_id: Optional[str] = Query(None, description="ID del objeto afectado"),
    target_object: Optional[str] = Query(None, description="Objeto afectado (legacy)"),
    limit: int = Query(50, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    query = db.query(AuditLog)

    if fecha_inicio:
        start_dt = datetime.combine(fecha_inicio, time.min).replace(tzinfo=timezone.utc)
        query = query.filter(AuditLog.timestamp >= start_dt)
    if fecha_fin:
        end_dt = datetime.combine(fecha_fin, time.max).replace(tzinfo=timezone.utc)
        query = query.filter(AuditLog.timestamp <= end_dt)
    if user_id:
        query = query.filter(AuditLog.user_id == user_id)
    if action_type:
        query = query.filter(AuditLog.action_type == action_type)
    if target_table:
        query = query.filter(AuditLog.target_table == target_table)
    if target_id:
        query = query.filter(AuditLog.target_id == target_id)
    if target_object:
        query = query.filter(AuditLog.target_object == target_object)

    total = query.count()
    logs = (
        query.order_by(AuditLog.timestamp.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    user_ids = {log.user_id for log in logs if log.user_id}
    users = db.query(User).filter(User.id.in_(user_ids)).all() if user_ids else []
    user_map = {u.id: u for u in users}

    items = [_build_item(log, user_map.get(log.user_id)) for log in logs]

    return AuditLogListResponse(
        total=total,
        limit=limit,
        offset=offset,
        items=items,
    )


@router.get(
    "/{log_id}",
    response_model=AuditLogItem,
    summary="Get a single audit log entry (F8.6)",
)
def get_audit_log(
    log_id: str,
    db: Session = Depends(get_db),
    current_admin: User = Depends(require_admin),
):
    log = db.query(AuditLog).filter(AuditLog.id == log_id).first()
    if not log:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Registro de auditoría no encontrado.",
        )
    user = db.query(User).filter(User.id == log.user_id).first() if log.user_id else None
    return _build_item(log, user)