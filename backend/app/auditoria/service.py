"""Transactional audit log service (M8: F8.5, RN-06, RNF-12, RF-34)."""

from typing import Any, Optional, Dict
from sqlalchemy.orm import Session
from app.auditoria.models import AuditLog


def record_audit_log(
    db: Session,
    user_id: Optional[str],
    ip_address: str,
    target_object: Optional[str] = None,
    action_type: str = "UNKNOWN",
    old_value: Optional[Dict[str, Any]] = None,
    new_value: Optional[Dict[str, Any]] = None,
    target_table: Optional[str] = None,
    target_id: Optional[str] = None,
    justification: Optional[str] = None,
) -> AuditLog:
    """
    Record an entry in the transactional audit log.
    Must be called within the same database transaction as the business operation.
    Supports both legacy signature (target_object, action_type) and full M8 schema
    (target_table, target_id, justification).
    """
    resolved_target_table = target_table or (target_object if target_object and target_object.lower() in ("users", "locations", "system_parameters", "projects", "items", "equipments", "requests", "batches", "dispatches") else None)
    resolved_target_object = target_object or target_table or "SYSTEM"

    log_entry = AuditLog(
        user_id=user_id,
        ip_address=ip_address or "127.0.0.1",
        target_object=resolved_target_object,
        target_table=resolved_target_table,
        target_id=target_id,
        action_type=action_type,
        old_value=old_value,
        new_value=new_value,
        justification=justification,
    )
    db.add(log_entry)
    # Flushed within the session so any schema/constraint failure raises immediately
    db.flush()
    return log_entry
