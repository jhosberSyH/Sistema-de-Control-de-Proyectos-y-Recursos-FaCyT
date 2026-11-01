"""SQLAlchemy models for all modules (M1 to M8)."""

import uuid
from datetime import datetime, timezone
from sqlalchemy import (
    Column,
    String,
    Boolean,
    DateTime,
    Date,
    Integer,
    Numeric,
    ForeignKey,
    Text,
    JSON,
    CheckConstraint,
    UniqueConstraint,
)
from sqlalchemy.orm import relationship, synonym
from app.core.database import Base


# =============================================================================
# MODULE 1: USERS, LOCATIONS, PARAMETERS, SESSIONS
# =============================================================================

class User(Base):
    """User account model (F1.1, F1.2, F1.3 - RN-01)."""
    __tablename__ = "users"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    full_name = Column(String(150), nullable=False)
    email = Column(String(255), nullable=False, unique=True, index=True)
    password_hash = Column(String(255), nullable=False)
    role = Column(String(50), nullable=False, index=True)
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
    equipments = relationship("Equipment", back_populates="location")


class SystemParameter(Base):
    """Configurable system parameter model (F1.5)."""
    __tablename__ = "system_parameters"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    parameter_key = Column(String(80), nullable=False, unique=True, index=True)
    parameter_value = Column(Integer, nullable=False)
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


# =============================================================================
# MODULE 2: PROJECTS AND ADVANCEMENT
# =============================================================================

class Project(Base):
    """Project model (M2: F2.1 to F2.7)."""
    __tablename__ = "projects"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    code = Column(String(30), nullable=False, unique=True, index=True)
    title = Column(String(255), nullable=False)
    operational_status = Column(String(50), nullable=False, default="Propuesta")
    priority_level = Column(String(50), nullable=False, default="Media")
    assigned_budget = Column(Numeric(15, 2), nullable=False, default=0.00)
    executed_budget = Column(Numeric(15, 2), nullable=False, default=0.00)
    physical_progress_pct = Column(Numeric(5, 2), nullable=False, default=0.00)
    coordinator_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
        onupdate=lambda: datetime.now(timezone.utc)
    )

    # Aliases/Synonyms for backward compatibility with M1
    status = synonym("operational_status")
    priority = synonym("priority_level")
    allocated_budget = synonym("assigned_budget")

    coordinator = relationship("User", back_populates="coordinated_projects")
    milestones = relationship("ProjectMilestone", back_populates="project", cascade="all, delete-orphan")
    reservations = relationship("EquipmentReservation", back_populates="project")
    usages = relationship("EquipmentUsage", back_populates="project")
    requests = relationship("Request", back_populates="project")
    dispatches = relationship("Dispatch", back_populates="project")


class ProjectMilestone(Base):
    """Milestones model (M2: F2.4, F2.5)."""
    __tablename__ = "project_milestones"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(150), nullable=False)
    description = Column(Text, nullable=True)
    weight = Column(Numeric(5, 2), nullable=False)
    current_progress_pct = Column(Numeric(5, 2), nullable=False, default=0.00)
    target_date = Column(Date, nullable=True)
    completed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="milestones")
    progress_logs = relationship("MilestoneProgressLog", back_populates="milestone", cascade="all, delete-orphan")


class MilestoneProgressLog(Base):
    """Historical milestone progress report (M2: F2.5)."""
    __tablename__ = "milestone_progress_logs"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    milestone_id = Column(String(36), ForeignKey("project_milestones.id", ondelete="CASCADE"), nullable=False, index=True)
    reported_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    previous_progress_pct = Column(Numeric(5, 2), nullable=False)
    new_progress_pct = Column(Numeric(5, 2), nullable=False)
    notes = Column(Text, nullable=True)
    reported_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    milestone = relationship("ProjectMilestone", back_populates="progress_logs")
    reported_by = relationship("User")


# =============================================================================
# MODULE 3: INVENTORY (ITEMS)
# =============================================================================

class Item(Base):
    """Unified items catalog (M3: F3.1 to F3.7)."""
    __tablename__ = "items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(150), nullable=False)
    unit_of_measure = Column(String(30), nullable=False)
    item_type = Column(String(50), nullable=False)  # Materia prima, Consumible de proyecto, Consumible de uso general
    current_stock = Column(Numeric(12, 3), nullable=False, default=0.000)
    min_stock = Column(Numeric(12, 3), nullable=False, default=0.000)
    forecasted_consumption = Column(Numeric(12, 3), nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    __table_args__ = (
        UniqueConstraint("name", "unit_of_measure", name="uq_items_name_unit"),
    )

    batches = relationship("Batch", back_populates="item")


# =============================================================================
# MODULE 4: EQUIPMENTS, RESERVATIONS, USAGES
# =============================================================================

class Equipment(Base):
    """Equipment asset model (M4: F4.1)."""
    __tablename__ = "equipments"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    asset_code = Column(String(50), nullable=False, unique=True, index=True)
    name = Column(String(150), nullable=False)
    location_id = Column(String(36), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=True)
    operational_status = Column(String(50), nullable=False, default="Disponible")  # Disponible, En uso, En mantenimiento
    description = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    location = relationship("Location", back_populates="equipments")
    reservations = relationship("EquipmentReservation", back_populates="equipment")
    usages = relationship("EquipmentUsage", back_populates="equipment")


class EquipmentReservation(Base):
    """Equipment reservation model (M4: F4.3, F4.4 - RF-22)."""
    __tablename__ = "equipment_reservations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    equipment_id = Column(String(36), ForeignKey("equipments.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    reserved_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    approved_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    status = Column(String(50), nullable=False, default="Borrador")  # RN-03
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    equipment = relationship("Equipment", back_populates="reservations")
    project = relationship("Project", back_populates="reservations")
    reserved_by = relationship("User", foreign_keys=[reserved_by_user_id])
    approved_by = relationship("User", foreign_keys=[approved_by_user_id])


class EquipmentUsage(Base):
    """Actual equipment usage hours (M4: F4.6)."""
    __tablename__ = "equipment_usages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    equipment_id = Column(String(36), ForeignKey("equipments.id", ondelete="RESTRICT"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False, index=True)
    reservation_id = Column(String(36), ForeignKey("equipment_reservations.id", ondelete="SET NULL"), nullable=True)
    registered_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    start_time = Column(DateTime(timezone=True), nullable=False)
    end_time = Column(DateTime(timezone=True), nullable=False)
    used_hours = Column(Numeric(6, 2), nullable=False)
    observations = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    equipment = relationship("Equipment", back_populates="usages")
    project = relationship("Project", back_populates="usages")
    registered_by = relationship("User")


# =============================================================================
# MODULE 5: REQUESTS AND WORKFLOW
# =============================================================================

class Request(Base):
    """Expense & withdrawal requests (M5: F5.1 to F5.7 - RN-03)."""
    __tablename__ = "requests"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_number = Column(String(40), nullable=False, unique=True, index=True)
    request_type = Column(String(50), nullable=False)  # Gasto, Retiro, Reposición automática
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False, index=True)
    requester_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    status = Column(String(50), nullable=False, default="Borrador")
    estimated_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    actual_amount = Column(Numeric(15, 2), nullable=False, default=0.00)
    decided_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    decision_reason = Column(Text, nullable=True)
    decided_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    project = relationship("Project", back_populates="requests")
    requester = relationship("User", foreign_keys=[requester_user_id])
    decided_by = relationship("User", foreign_keys=[decided_by_user_id])
    items = relationship("RequestItem", back_populates="request", cascade="all, delete-orphan")


class RequestItem(Base):
    """Items requested per request (M5)."""
    __tablename__ = "request_items"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    request_id = Column(String(36), ForeignKey("requests.id", ondelete="CASCADE"), nullable=False, index=True)
    item_id = Column(String(36), ForeignKey("items.id", ondelete="RESTRICT"), nullable=False)
    requested_quantity = Column(Numeric(12, 3), nullable=False)
    approved_quantity = Column(Numeric(12, 3), nullable=True)
    unit_cost_estimate = Column(Numeric(15, 2), nullable=False, default=0.00)

    request = relationship("Request", back_populates="items")
    item = relationship("Item")


# =============================================================================
# MODULE 6: WAREHOUSE, BATCHES, INMUTABLE DISPATCHES
# =============================================================================

class Batch(Base):
    """Purchase batches (M6: F6.1 - RF-20)."""
    __tablename__ = "batches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    item_id = Column(String(36), ForeignKey("items.id", ondelete="RESTRICT"), nullable=True, index=True)
    location_id = Column(String(36), ForeignKey("locations.id", ondelete="RESTRICT"), nullable=False, index=True)
    batch_number = Column(String(60), nullable=False)
    initial_quantity = Column(Numeric(12, 3), nullable=False, default=0.000)
    available_quantity = Column(Numeric(12, 3), nullable=False, default=0.000)
    unit_cost = Column(Numeric(15, 2), nullable=False, default=0.00)
    supplier = Column(String(150), nullable=True)
    received_date = Column(Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    expiration_date = Column(Date, nullable=True)
    expiration_status = Column(String(30), nullable=False, default="Vigente")
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))

    # Synonyms for backward compatibility
    current_quantity = synonym("available_quantity")

    item = relationship("Item", back_populates="batches")
    location = relationship("Location", back_populates="batches")
    dispatches = relationship("Dispatch", back_populates="batch")


class Dispatch(Base):
    """Immutable dispatch log (M6: F6.3 - RNF-11, RF-23)."""
    __tablename__ = "dispatches"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dispatch_number = Column(String(40), nullable=False, unique=True, index=True)
    batch_id = Column(String(36), ForeignKey("batches.id", ondelete="RESTRICT"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False, index=True)
    dispatched_quantity = Column(Numeric(12, 3), nullable=False)
    unit_cost_snapshot = Column(Numeric(15, 2), nullable=False)
    dispatched_by = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    received_by_name = Column(String(150), nullable=False)
    request_id = Column(String(36), ForeignKey("requests.id", ondelete="SET NULL"), nullable=True)
    is_compensatory = Column(Boolean, nullable=False, default=False)
    original_dispatch_id = Column(String(36), ForeignKey("dispatches.id", ondelete="RESTRICT"), nullable=True)
    dispatched_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)

    batch = relationship("Batch", back_populates="dispatches")
    project = relationship("Project", back_populates="dispatches")
    dispatcher = relationship("User")


class RawMaterialUsage(Base):
    """Raw material usage tracking against dispatches (M6: F6.4)."""
    __tablename__ = "raw_material_usages"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    dispatch_id = Column(String(36), ForeignKey("dispatches.id", ondelete="RESTRICT"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False, index=True)
    reported_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    quantity_used = Column(Numeric(12, 3), nullable=False)
    waste_quantity = Column(Numeric(12, 3), nullable=False, default=0.000)
    usage_date = Column(Date, nullable=False, default=lambda: datetime.now(timezone.utc).date())
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class DispatchCorrection(Base):
    """Correction request for past dispatches (M6: RF-35, F6.5)."""
    __tablename__ = "dispatch_corrections"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    original_dispatch_id = Column(String(36), ForeignKey("dispatches.id", ondelete="RESTRICT"), nullable=False, index=True)
    requested_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    reviewed_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(50), nullable=False, default="Pendiente")
    justification = Column(Text, nullable=False)
    correct_quantity = Column(Numeric(12, 3), nullable=False)
    reviewed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


# =============================================================================
# MODULE 7: ACCOUNTING PERIODS AND OVERHEAD PRORATION
# =============================================================================

class AccountingPeriod(Base):
    """Accounting period for proration (M7: F7.1 to F7.4 - RF-24)."""
    __tablename__ = "accounting_periods"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_name = Column(String(100), nullable=False)
    period_type = Column(String(30), nullable=False)  # Mensual, Trimestral
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    status = Column(String(50), nullable=False, default="Abierto")  # Abierto, En revisión, Cerrado, Prorrateado
    proration_criterion = Column(String(30), nullable=True)  # Proporcional, Equitativo
    total_overhead_cost = Column(Numeric(15, 2), nullable=False, default=0.00)
    closed_by_user_id = Column(String(36), ForeignKey("users.id", ondelete="SET NULL"), nullable=True)
    closed_at = Column(DateTime(timezone=True), nullable=True)
    created_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


class PeriodProjectConfirmation(Base):
    """Project charges confirmation prior to closing period (M7: F7.1, RF-38)."""
    __tablename__ = "period_project_confirmations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_id = Column(String(36), ForeignKey("accounting_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False, index=True)
    coordinator_user_id = Column(String(36), ForeignKey("users.id", ondelete="RESTRICT"), nullable=False)
    confirmed = Column(Boolean, nullable=False, default=False)
    confirmed_at = Column(DateTime(timezone=True), nullable=True)
    comments = Column(Text, nullable=True)


class OverheadAllocation(Base):
    """Proration result allocated per active project (M7: F7.3, F7.4)."""
    __tablename__ = "overhead_allocations"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    period_id = Column(String(36), ForeignKey("accounting_periods.id", ondelete="CASCADE"), nullable=False, index=True)
    project_id = Column(String(36), ForeignKey("projects.id", ondelete="RESTRICT"), nullable=False, index=True)
    registered_consumption = Column(Numeric(15, 2), nullable=False, default=0.00)
    consumption_pct = Column(Numeric(6, 4), nullable=False, default=0.0000)
    allocated_amount = Column(Numeric(15, 2), nullable=False)
    applied_at = Column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))


# =============================================================================
# MODULE 8: IMMUTABLE AUDIT LOGS
# =============================================================================

from app.auditoria.models import AuditLog  # Re-export for convenience
