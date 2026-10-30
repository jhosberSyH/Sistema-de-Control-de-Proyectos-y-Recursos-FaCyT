"""Transactional audit log service."""

from typing import Any, Optional, Dict
from sqlalchemy.orm import Session
from app.auditoria.models import AuditLog


def record_audit_log(
    db: Session,
    user_id: Optional[str],
    ip_address: str,
    target_object: str,
    action_type: str,
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None
) -> AuditLog:
    """
    Record an entry in the transactional audit log.
    Must be called within the same database transaction as the business operation.
    """
    log_entry = AuditLog(
        user_id=user_id,
        ip_address=ip_address or "127.0.0.1",
        target_object=target_object,
        action_type=action_type,
        old_value=old_value,
        new_value=new_value
    )
    db.add(log_entry)
    # Flushed within the session so any schema/constraint failure raises immediately
    db.flush()
    return log_entry

