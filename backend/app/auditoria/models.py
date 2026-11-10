"""Audit log database model (F8.5, RN-06, RNF-12, RF-34)."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, JSON, Text
from app.core.database import Base, IdType


class AuditLog(Base):
    """
    Immutable audit log model (M8: F8.5, RN-06, RNF-12, RF-34).
    Stores complete traceability of create, edit, delete, and state changes.
    """
    __tablename__ = "audit_logs"

    id = Column(IdType, primary_key=True, default=lambda: str(uuid.uuid4()))
    timestamp = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
    user_id = Column(IdType, nullable=True, index=True)  # Nullable for system bootstrap or unauthenticated failures
    ip_address = Column(String(45), nullable=False)
    action_type = Column(String(50), nullable=False, index=True)
    target_object = Column(String(100), nullable=True)  # Maintained for M1 backward compatibility
    target_table = Column(String(60), nullable=True, index=True)
    target_id = Column(String(64), nullable=True)
    old_value = Column(JSON, nullable=True)
    new_value = Column(JSON, nullable=True)
    justification = Column(Text, nullable=True)
