"""Audit log database model (F8.5, RN-06, RNF-12)."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON
from app.core.database import Base


class AuditLog(Base):
    """
    Immutable audit log model.
    Stores complete traceability of create, edit, delete, and state changes.
    """
    __tablename__ = "audit_log"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    user_id = Column(String(36), nullable=True)  # Nullable for system bootstrap or unauthenticated failures
    ip_address = Column(String(45), nullable=False)
    target_object = Column(String(100), nullable=False)
    action_type = Column(String(50), nullable=False)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)

