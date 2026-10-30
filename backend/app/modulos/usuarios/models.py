"""SQLAlchemy models for Module 1: Users, Locations and Parameters."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Integer,
    Numeric,
    ForeignKey,
    Text,
)
from sqlalchemy.orm import relationship
from app.core.database import Base


class User(Base):
    """User account model (F1.1, F1.2, F1.3)."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)  # Administrador del Sistema, Coordinador de Proyecto, Aprobador / Gestor de Inventario
    is_active = Column(Boolean, nullable=False, default=True, index=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Relationships
    sessions = relationship("SessionModel", back_populates="user", cascade="all, delete-orphan")
    coordinated_projects = relationship("Project", back_populates="coordinator")


class SessionModel(Base):
    """Server-side active user session (RFC 10017)."""
    __tablename__ = "sessions"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id = Column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    csrf_token = Column(String(64), nullable=False)
    ip_address = Column(String(45), nullable=False)
    user_agent = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    last_activity_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    expires_at = Column(DateTime(timezone=True), nullable=False, index=True)

    user = relationship("User", back_populates="sessions")


class Location(Base):
    """Storage location catalog model (F1.4)."""
    __tablename__ = "locations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(120), nullable=False)
    description = Column(Text, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    batches = relationship("Batch", back_populates="location")


class Batch(Base):
    """Material/consumable batch stub for referential checks in F1.4."""
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    location_id = Column(String(36), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    batch_number = Column(String(60), nullable=False)
    initial_quantity = Column(Numeric(12, 3), nullable=False, default=0)
    current_quantity = Column(Numeric(12, 3), nullable=False, default=0)
    unit_cost = Column(Numeric(15, 2), nullable=False, default=0)
    expiration_date = Column(DateTime, nullable=True)
    received_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    location = relationship("Location", back_populates="batches")


class SystemParameter(Base):
    """Configurable system parameter model (F1.5)."""
    __tablename__ = "system_parameters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parameter_key = Column(String(80), nullable=False, unique=True, index=True)
    parameter_value = Column(Integer, nullable=False)  # Must be > 0
    label = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    unit = Column(String(30), nullable=False)
    updated_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    updated_by = relationship("User", foreign_keys=[updated_by_user_id])


class Project(Base):
    """Project model stub (F2.1, used for coordinator reassignment impact checks in F1.2 & F1.3)."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(30), nullable=False, unique=True)
    title = Column(String(255), nullable=False)
    status = Column(String(50), nullable=False, default="Propuesta")  # Propuesta, En ejecución, Suspendido, Finalizado
    priority = Column(String(50), nullable=False, default="Media")  # Crítica, Alta, Media, Baja
    assigned_budget = Column(Numeric(15, 2), nullable=False, default=0.00)
    executed_budget = Column(Numeric(15, 2), nullable=False, default=0.00)
    coordinator_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    coordinator = relationship("User", back_populates="coordinated_projects")

