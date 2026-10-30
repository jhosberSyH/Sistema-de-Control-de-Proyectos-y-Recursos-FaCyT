"""Unit and integration tests for Module 1: Users, Locations and Parameters."""

import pytest
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from fastapi.testclient import TestClient

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.auditoria.models import AuditLog
from app.modulos.usuarios.models import User, Location, SystemParameter, Project, Batch
from app.modulos.usuarios import service
from app.modulos.usuarios.schemas import (
    UserCreate,
    UserUpdate,
    UserStatusToggle,
    LocationCreate,
    LocationUpdate,
    SystemParameterUpdate
)

# Test in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh database tables for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # Seed test admin
        admin = User(
            id="admin-uuid",
            full_name="Admin Test",
            email="admin@test.com",
            password_hash=hash_password("Demo2026*"),
            role="Administrador del Sistema",
            is_active=True
        )
        db.add(admin)
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


# -----------------------------------------------------------------------------
# F1.1: Tests for User Creation and Email Uniqueness
# -----------------------------------------------------------------------------

def test_f1_1_create_user_success(db_session):
    """User is created active and audit log is recorded transactionally."""
    data = UserCreate(
        full_name="Dr. Carlos Mendoza",
        email="carlos.mendoza@cpq.local",
        role="Coordinador de Proyecto"
    )
    user = service.create_user(
        db=db_session,
        data=data,
        actor_id="admin-uuid",
        ip_address="192.168.1.50"
    )

    assert user.id is not None
    assert user.full_name == "Dr. Carlos Mendoza"
    assert user.email == "carlos.mendoza@cpq.local"
    assert user.is_active is True

    # Verify audit log (F8.5)
    audit = db_session.query(AuditLog).filter(
        AuditLog.target_object == f"USER:{user.id}",
        AuditLog.action_type == "USER_CREATED"
    ).first()
    assert audit is not None
    assert audit.user_id == "admin-uuid"
    assert audit.ip_address == "192.168.1.50"
    assert audit.new_value["email"] == "carlos.mendoza@cpq.local"


def test_f1_1_create_user_duplicate_email_fails_with_existing_details(db_session):
    """Attempting duplicate email is rejected and returns existing account details."""
    data = UserCreate(
        full_name="Dr. Carlos Mendoza",
        email="carlos.mendoza@cpq.local",
        role="Coordinador de Proyecto"
    )
    service.create_user(db=db_session, data=data, actor_id="admin-uuid", ip_address="127.0.0.1")

    # Attempt second user with same email
    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        service.create_user(
            db=db_session,
            data=UserCreate(full_name="Otro Carlos", email="carlos.mendoza@cpq.local", role="Coordinador de Proyecto"),
            actor_id="admin-uuid",
            ip_address="127.0.0.1"
        )

    assert exc_info.value.status_code == 409
    detail = exc_info.value.detail
    assert "carlos.mendoza@cpq.local" in detail["message"]
    assert detail["existing_user"]["full_name"] == "Dr. Carlos Mendoza"


# -----------------------------------------------------------------------------
# F1.2: Tests for User Update & Coordinator Role Change Impact
# -----------------------------------------------------------------------------

def test_f1_2_coordinator_role_change_warns_assigned_projects(db_session):
    """Changing role from Coordinator requires confirmation if projects are assigned."""
    coord = service.create_user(
        db=db_session,
        data=UserCreate(full_name="Elena Torres", email="elena@cpq.local", role="Coordinador de Proyecto"),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )
    # Assign project to coordinator
    proj = Project(
        code="QUI-099",
        title="Estudio de Polímeros",
        status="En ejecución",
        coordinator_id=coord.id
    )
    db_session.add(proj)
    db_session.commit()

    from fastapi import HTTPException
    # Attempt to change role without confirmation
    with pytest.raises(HTTPException) as exc_info:
        service.update_user(
            db=db_session,
            user_id=coord.id,
            data=UserUpdate(role="Aprobador / Gestor de Inventario", confirm_reassignment=False),
            actor_id="admin-uuid",
            ip_address="127.0.0.1"
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "COORDINATOR_ROLE_CHANGE_IMPACT"
    assert exc_info.value.detail["requires_confirmation"] is True
    assert exc_info.value.detail["affected_projects"][0]["code"] == "QUI-099"


def test_f1_2_coordinator_role_change_confirmed_unassigns_projects(db_session):
    """When confirmed, projects are unassigned for admin reassignment and audit is written."""
    coord = service.create_user(
        db=db_session,
        data=UserCreate(full_name="Elena Torres", email="elena2@cpq.local", role="Coordinador de Proyecto"),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )
    proj = Project(code="BIO-055", title="Genética Floral", status="En ejecución", coordinator_id=coord.id)
    db_session.add(proj)
    db_session.commit()

    updated = service.update_user(
        db=db_session,
        user_id=coord.id,
        data=UserUpdate(role="Aprobador / Gestor de Inventario", confirm_reassignment=True),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )

    assert updated.role == "Aprobador / Gestor de Inventario"
    db_session.refresh(proj)
    assert proj.coordinator_id is None  # Marked for reassignment in F2.2


# -----------------------------------------------------------------------------
# F1.3: Tests for User Deactivation / Reactivation (Strict Logical Deletion)
# -----------------------------------------------------------------------------

def test_f1_3_deactivate_coordinator_warns_active_projects(db_session):
    """Deactivating coordinator with active projects warns before confirmation."""
    coord = service.create_user(
        db=db_session,
        data=UserCreate(full_name="Roberto Gómez", email="roberto@cpq.local", role="Coordinador de Proyecto"),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )
    proj = Project(code="FIS-020", title="Láseres Industriales", status="En ejecución", coordinator_id=coord.id)
    db_session.add(proj)
    db_session.commit()

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        service.toggle_user_status(
            db=db_session,
            user_id=coord.id,
            data=UserStatusToggle(is_active=False, confirm_deactivation=False),
            actor_id="admin-uuid",
            ip_address="127.0.0.1"
        )

    assert exc_info.value.status_code == 400
    assert exc_info.value.detail["code"] == "DEACTIVATION_IMPACT"


def test_f1_3_deactivate_and_reactivate_user(db_session):
    """User can be deactivated and reactivated, preserving all records."""
    user = service.create_user(
        db=db_session,
        data=UserCreate(full_name="Laura Ramos", email="laura@cpq.local", role="Aprobador / Gestor de Inventario"),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )

    # Deactivate
    deactivated = service.toggle_user_status(
        db=db_session,
        user_id=user.id,
        data=UserStatusToggle(is_active=False),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )
    assert deactivated.is_active is False

    # Reactivate
    reactivated = service.toggle_user_status(
        db=db_session,
        user_id=user.id,
        data=UserStatusToggle(is_active=True),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )
    assert reactivated.is_active is True


# -----------------------------------------------------------------------------
# F1.4: Tests for Storage Locations
# -----------------------------------------------------------------------------

def test_f1_4_create_location_rejects_duplicate_active_name(db_session):
    """Locations cannot have duplicate active names."""
    service.create_location(
        db=db_session,
        data=LocationCreate(name="Depósito Principal", description="Ala norte"),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )

    from fastapi import HTTPException
    with pytest.raises(HTTPException) as exc_info:
        service.create_location(
            db=db_session,
            data=LocationCreate(name="  depósito principal  "),
            actor_id="admin-uuid",
            ip_address="127.0.0.1"
        )

    assert exc_info.value.status_code == 409
    assert exc_info.value.detail["field"] == "name"


def test_f1_4_location_with_batches_cannot_be_deleted(db_session):
    """Location with batches cannot be hard deleted; is deactivated instead."""
    loc = service.create_location(
        db=db_session,
        data=LocationCreate(name="Sótano de Vidriería"),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )
    # Attach a batch
    batch = Batch(location_id=loc.id, batch_number="LOTE-001", initial_quantity=10, current_quantity=10)
    db_session.add(batch)
    db_session.commit()

    res = service.deactivate_or_delete_location(
        db=db_session,
        location_id=loc.id,
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )

    assert res["status"] == "deactivated"
    db_session.refresh(loc)
    assert loc.is_active is False


# -----------------------------------------------------------------------------
# F1.5: Tests for System Parameters
# -----------------------------------------------------------------------------

def test_f1_5_update_parameter_positive_integer_rule(db_session):
    """Parameter update requires strictly positive integer > 0."""
    param = SystemParameter(
        parameter_key="batch_expiration_alert_days",
        parameter_value=30,
        label="Alerta de vencimiento",
        unit="días"
    )
    db_session.add(param)
    db_session.commit()

    # Valid update
    updated = service.update_system_parameter(
        db=db_session,
        key="batch_expiration_alert_days",
        data=SystemParameterUpdate(parameter_value=45),
        actor_id="admin-uuid",
        ip_address="127.0.0.1"
    )
    assert updated.parameter_value == 45

    # Check audit log
    audit = db_session.query(AuditLog).filter(
        AuditLog.target_object == "SYSTEM_PARAMETER:batch_expiration_alert_days"
    ).first()
    assert audit.old_value["parameter_value"] == 30
    assert audit.new_value["parameter_value"] == 45

    # Negative value rejected by schema validation
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        SystemParameterUpdate(parameter_value=-5)

    with pytest.raises(ValidationError):
        SystemParameterUpdate(parameter_value=0)

