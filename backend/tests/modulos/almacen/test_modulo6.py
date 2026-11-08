"""Unit and integration tests for Module 6: Warehouse and Immutable Outbound Log (F6.1 to F6.6 | HU-18 to HU-21)."""

import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.core.database import Base, get_db
from app.core.security import hash_password, hash_session_token
from app.main import app
from app.auditoria.models import AuditLog
from app.modulos.usuarios.models import (
    User,
    SessionModel,
    Location,
    SystemParameter,
    Project,
    Item,
    Batch,
    Dispatch,
    RawMaterialUsage,
    DispatchCorrection,
    Request,
    RequestItem,
)
from app.modulos.almacen import service
from app.modulos.almacen.schemas import (
    BatchCreateRequest,
    DispatchCreateRequest,
    DispatchAllocationItem,
    RawMaterialUsageCreateRequest,
    DispatchCorrectionCreateRequest,
    DispatchCorrectionReviewRequest,
)

# Test in-memory SQLite database
SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def db_session():
    """Create fresh database tables for each test."""
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        # 1. Admin
        admin = User(
            id="admin-uuid",
            full_name="Admin Principal",
            email="admin@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Administrador del Sistema",
            is_active=True
        )
        # 2. Approver / Warehouse Manager
        approver = User(
            id="approver-uuid",
            full_name="Carmen Pérez",
            email="aprobador@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Aprobador / Gestor de Inventario",
            is_active=True
        )
        # 3. Coordinator Bio
        coord_bio = User(
            id="coord-bio-uuid",
            full_name="María Fernanda Ochoa",
            email="coord.bio@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Coordinador de Proyecto",
            is_active=True
        )
        # 4. Coordinator Fis
        coord_fis = User(
            id="coord-fis-uuid",
            full_name="Andrés Salazar",
            email="coord.fis@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Coordinador de Proyecto",
            is_active=True
        )
        db.add_all([admin, approver, coord_bio, coord_fis])
        db.flush()

        # 5. Locations
        loc1 = Location(id="loc-dep-a", name="Depósito de reactivos A", description="Piso 1", is_active=True)
        loc2 = Location(id="loc-dep-b", name="Depósito de reactivos B", description="Sótano", is_active=True)
        loc_inactive = Location(id="loc-inact", name="Estante clausurado", description="Inactivo", is_active=False)
        db.add_all([loc1, loc2, loc_inactive])

        # 6. System parameters
        p_exp = SystemParameter(
            parameter_key="batch_expiration_alert_days",
            parameter_value=30,
            label="Días alerta vencimiento",
            description="30 días",
            unit="días"
        )
        db.add(p_exp)

        # 7. Projects
        p_bio = Project(
            id="proj-bio-id",
            code="BIO-011",
            title="Bioensayos microbiológicos",
            status="En ejecución",
            priority="Crítica",
            assigned_budget=Decimal("10000.00"),
            executed_budget=Decimal("2000.00"),
            coordinator_id=coord_bio.id
        )
        p_fis = Project(
            id="proj-fis-id",
            code="FIS-008",
            title="Películas delgadas",
            status="En ejecución",
            priority="Media",
            assigned_budget=Decimal("5000.00"),
            executed_budget=Decimal("1000.00"),
            coordinator_id=coord_fis.id
        )
        db.add_all([p_bio, p_fis])

        # 8. Items
        item_ethanol = Item(
            id="item-ethanol-id",
            name="Etanol 96 %",
            unit_of_measure="L",
            item_type="Materia prima",
            current_stock=Decimal("0.000"),
            min_stock=Decimal("10.000"),
            is_active=True
        )
        item_general = Item(
            id="item-general-id",
            name="Papel secante institucional",
            unit_of_measure="rollos",
            item_type="Consumible de uso general",
            current_stock=Decimal("0.000"),
            min_stock=Decimal("5.000"),
            is_active=True
        )
        db.add_all([item_ethanol, item_general])

        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient wired to testing database session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_test_session(db: TestingSessionLocal, user: User) -> str:
    """Helper to generate a valid test session token."""
    raw_token = f"test-token-{user.id}-{uuid.uuid4().hex}"
    session = SessionModel(
        user_id=user.id,
        token_hash=hash_session_token(raw_token),
        csrf_token=f"csrf-{uuid.uuid4().hex[:8]}",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=2),
        last_activity_at=datetime.now(timezone.utc),
        ip_address="127.0.0.1",
        user_agent="Pytest-TestClient"
    )
    db.add(session)
    db.commit()
    return raw_token


# =============================================================================
# 1. F6.1: Batch Reception Tests (HU-18)
# =============================================================================

def test_batch_reception_success(db_session):
    """
    HU-18: Given a batch of 100 units at unit_cost 3, when saved,
    stock increases by 100 and audit log is recorded atomically.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()

    assert item.current_stock == Decimal("0.000")

    payload = BatchCreateRequest(
        item_id=item.id,
        location_id=loc.id,
        batch_number="ET-2026-001",
        quantity=Decimal("100.000"),
        unit_cost=Decimal("3.00"),
        supplier="Química del Centro C.A.",
        received_date=date.today(),
        expiration_date=date.today() + timedelta(days=180),
    )

    resp = service.receive_batch(
        db=db_session,
        payload=payload,
        current_user=approver,
        ip_address="192.168.1.50"
    )

    db_session.commit()

    assert resp.batch_number == "ET-2026-001"
    assert resp.available_quantity == Decimal("100.000")
    assert resp.expiration_status == "Vigente"
    assert resp.is_blocked_for_dispatch is False

    # Check stock incremented
    db_session.refresh(item)
    assert item.current_stock == Decimal("100.000")

    # Check audit log
    audit = db_session.query(AuditLog).filter(
        AuditLog.action_type == "BATCH_RECEIVED",
        AuditLog.target_table == "batches"
    ).first()
    assert audit is not None
    assert audit.user_id == approver.id


def test_batch_reception_expired_validation(db_session):
    """
    HU-18: When expiration date is prior to received_date or today,
    system raises warning error unless explicitly confirmed.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()

    past_date = date.today() - timedelta(days=5)

    payload_unconfirmed = BatchCreateRequest(
        item_id=item.id,
        location_id=loc.id,
        batch_number="ET-EXPIRED",
        quantity=Decimal("20.000"),
        unit_cost=Decimal("3.00"),
        received_date=date.today(),
        expiration_date=past_date,
        force_expired_acceptance=False
    )

    with pytest.raises(HTTPException) as exc:
        service.receive_batch(
            db=db_session,
            payload=payload_unconfirmed,
            current_user=approver,
            ip_address="127.0.0.1"
        )
    assert exc.value.status_code == 400
    assert "ya pasó" in exc.value.detail

    # With explicit confirmation, it is received but marked as 'Vencido'
    payload_confirmed = BatchCreateRequest(
        item_id=item.id,
        location_id=loc.id,
        batch_number="ET-EXPIRED-ACCEPTED",
        quantity=Decimal("20.000"),
        unit_cost=Decimal("3.00"),
        received_date=date.today(),
        expiration_date=past_date,
        force_expired_acceptance=True
    )
    resp = service.receive_batch(
        db=db_session,
        payload=payload_confirmed,
        current_user=approver,
        ip_address="127.0.0.1"
    )
    db_session.commit()
    assert resp.expiration_status == "Vencido"
    assert resp.is_blocked_for_dispatch is True


# =============================================================================
# 2. F6.2: Dispatch Preparation & FEFO Suggestion Tests (HU-19)
# =============================================================================

def test_dispatch_preparation_fefo_suggestion(db_session):
    """
    HU-19: Suggests available batches ordered by FEFO (earliest expiry first).
    Expired batches are strictly blocked.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()
    proj = db_session.query(Project).filter(Project.id == "proj-bio-id").first()

    today = date.today()

    # Create 3 batches:
    # 1. Expired batch (blocked)
    b_expired = Batch(
        id="b-exp",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-EXPIRED",
        initial_quantity=Decimal("10.000"),
        available_quantity=Decimal("10.000"),
        unit_cost=Decimal("5.00"),
        expiration_date=today - timedelta(days=2),
        expiration_status="Vencido"
    )
    # 2. Earlier expiry (should be suggested first by FEFO)
    b_earlier = Batch(
        id="b-earlier",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-EARLIER",
        initial_quantity=Decimal("15.000"),
        available_quantity=Decimal("15.000"),
        unit_cost=Decimal("6.00"),
        expiration_date=today + timedelta(days=10),
        expiration_status="Próximo a vencer"
    )
    # 3. Later expiry
    b_later = Batch(
        id="b-later",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-LATER",
        initial_quantity=Decimal("30.000"),
        available_quantity=Decimal("30.000"),
        unit_cost=Decimal("7.00"),
        expiration_date=today + timedelta(days=90),
        expiration_status="Vigente"
    )
    db_session.add_all([b_expired, b_earlier, b_later])

    # Create approved withdrawal request
    req = Request(
        id="req-ret-001",
        request_number="SOL-121",
        request_type="Retiro",
        project_id=proj.id,
        requester_user_id=coord_bio.id,
        status="Aprobado",
    )
    db_session.add(req)
    db_session.flush()

    r_item = RequestItem(
        id="req-item-001",
        request_id=req.id,
        item_id=item.id,
        requested_quantity=Decimal("5.000"),
        approved_quantity=Decimal("5.000"),
    )
    db_session.add(r_item)
    db_session.commit()

    prep = service.get_withdrawal_dispatch_preparation(
        db=db_session,
        request_id=req.id,
        current_user=approver
    )

    assert prep.request_number == "SOL-121"
    assert len(prep.items) == 1
    avail_batches = prep.items[0].available_batches

    # Find the batches in the returned list
    earlier_sug = next(b for b in avail_batches if b.batch_id == "b-earlier")
    later_sug = next(b for b in avail_batches if b.batch_id == "b-later")
    expired_sug = next(b for b in avail_batches if b.batch_id == "b-exp")

    assert earlier_sug.is_suggested is True
    assert earlier_sug.is_blocked is False

    assert later_sug.is_suggested is False
    assert later_sug.is_blocked is False

    assert expired_sug.is_blocked is True
    assert expired_sug.is_suggested is False


# =============================================================================
# 3. F6.2 & F6.3: Dispatch Execution Tests (HU-19, RNF-10, RNF-11)
# =============================================================================

def test_dispatch_execution_success(db_session):
    """
    HU-19: Executing dispatch decrements stock atomically, transitions request to 'Ejecutado',
    creates immutable dispatches records, updates project executed_budget, and audits.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()
    proj = db_session.query(Project).filter(Project.id == "proj-bio-id").first()

    # Initial batch with 50 L at $4.00
    batch = Batch(
        id="b-valid-50",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-VALID-50",
        initial_quantity=Decimal("50.000"),
        available_quantity=Decimal("50.000"),
        unit_cost=Decimal("4.00"),
        expiration_date=date.today() + timedelta(days=60),
        expiration_status="Vigente"
    )
    db_session.add(batch)
    item.current_stock = Decimal("50.000")

    # Approved withdrawal request for 10 L
    req = Request(
        id="req-ret-002",
        request_number="SOL-122",
        request_type="Retiro",
        project_id=proj.id,
        requester_user_id=coord_bio.id,
        status="Aprobado",
    )
    db_session.add(req)
    db_session.commit()

    initial_proj_executed = proj.executed_budget  # 2000.00

    payload = DispatchCreateRequest(
        request_id=req.id,
        received_by_name="Daniela Rivas (Tesista)",
        allocations=[
            DispatchAllocationItem(batch_id=batch.id, quantity=Decimal("10.000"))
        ]
    )

    dispatches = service.execute_dispatch(
        db=db_session,
        payload=payload,
        current_user=approver,
        ip_address="10.0.0.5"
    )
    db_session.commit()

    assert len(dispatches) == 1
    d = dispatches[0]
    assert d.dispatched_quantity == Decimal("10.000")
    assert d.total_cost == Decimal("40.00")  # 10 * 4.00
    assert d.received_by_name == "Daniela Rivas (Tesista)"
    assert d.is_compensatory is False

    # Check batch and item stock
    db_session.refresh(batch)
    db_session.refresh(item)
    assert batch.available_quantity == Decimal("40.000")
    assert item.current_stock == Decimal("40.000")

    # Check request status
    db_session.refresh(req)
    assert req.status == "Ejecutado"
    assert req.actual_amount == Decimal("40.00")

    # Check project executed budget updated (F2.7)
    db_session.refresh(proj)
    assert proj.executed_budget == initial_proj_executed + Decimal("40.00")


def test_dispatch_execution_expired_batch_blocked(db_session):
    """
    HU-19 / F3.6: Reject attempt to dispatch from an expired batch.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()
    proj = db_session.query(Project).filter(Project.id == "proj-bio-id").first()

    batch_exp = Batch(
        id="b-exp-block",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-BLOCKED",
        initial_quantity=Decimal("20.000"),
        available_quantity=Decimal("20.000"),
        unit_cost=Decimal("4.00"),
        expiration_date=date.today() - timedelta(days=1),
        expiration_status="Vencido"
    )
    db_session.add(batch_exp)

    req = Request(
        id="req-ret-003",
        request_number="SOL-123",
        request_type="Retiro",
        project_id=proj.id,
        requester_user_id=coord_bio.id,
        status="Aprobado",
    )
    db_session.add(req)
    db_session.commit()

    payload = DispatchCreateRequest(
        request_id=req.id,
        received_by_name="Daniela Rivas",
        allocations=[
            DispatchAllocationItem(batch_id=batch_exp.id, quantity=Decimal("5.000"))
        ]
    )

    with pytest.raises(HTTPException) as exc:
        service.execute_dispatch(
            db=db_session,
            payload=payload,
            current_user=approver,
            ip_address="127.0.0.1"
        )
    assert exc.value.status_code == 400
    assert "está vencido y no puede despacharse" in exc.value.detail


# =============================================================================
# 4. F6.3: List Dispatches & Role Scoping (RN-07)
# =============================================================================

def test_list_dispatches_role_scoping(db_session):
    """
    RN-07: Coordinator only views dispatches belonging to their coordinated projects.
    Admins and Approvers view all dispatches.
    """
    admin = db_session.query(User).filter(User.role == "Administrador del Sistema").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    coord_fis = db_session.query(User).filter(User.id == "coord-fis-uuid").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()
    p_bio = db_session.query(Project).filter(Project.id == "proj-bio-id").first()
    p_fis = db_session.query(Project).filter(Project.id == "proj-fis-id").first()

    b = Batch(
        id="b-test-disp",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-T",
        initial_quantity=Decimal("100.000"),
        available_quantity=Decimal("100.000"),
        unit_cost=Decimal("5.00")
    )
    db_session.add(b)

    d_bio = Dispatch(
        id="d-bio-1",
        dispatch_number="DES-0010",
        batch_id=b.id,
        project_id=p_bio.id,
        dispatched_quantity=Decimal("5.000"),
        unit_cost_snapshot=Decimal("5.00"),
        dispatched_by=admin.id,
        received_by_name="Tesista Bio",
        is_compensatory=False
    )
    d_fis = Dispatch(
        id="d-fis-1",
        dispatch_number="DES-0011",
        batch_id=b.id,
        project_id=p_fis.id,
        dispatched_quantity=Decimal("8.000"),
        unit_cost_snapshot=Decimal("5.00"),
        dispatched_by=admin.id,
        received_by_name="Tesista Fis",
        is_compensatory=False
    )
    db_session.add_all([d_bio, d_fis])
    db_session.commit()

    # Admin sees both
    admin_list = service.list_dispatches(db=db_session, current_user=admin)
    assert len(admin_list) == 2

    # Bio coordinator only sees d_bio
    bio_list = service.list_dispatches(db=db_session, current_user=coord_bio)
    assert len(bio_list) == 1
    assert bio_list[0].dispatch_number == "DES-0010"

    # Fis coordinator only sees d_fis
    fis_list = service.list_dispatches(db=db_session, current_user=coord_fis)
    assert len(fis_list) == 1
    assert fis_list[0].dispatch_number == "DES-0011"


# =============================================================================
# 5. F6.4: Raw Material Usage Reporting & Excess Check (HU-20)
# =============================================================================

def test_raw_material_usage_normal_and_excess(db_session):
    """
    HU-20: Given 10 units dispatched, when coordinator reports usage of 4,
    shows 10 dispatched and 4 used. When reporting excess, system records it
    and flags excess difference.
    """
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()
    p_bio = db_session.query(Project).filter(Project.id == "proj-bio-id").first()

    b = Batch(
        id="b-raw-test",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-RAW",
        initial_quantity=Decimal("10.000"),
        available_quantity=Decimal("0.000"),
        unit_cost=Decimal("5.00")
    )
    db_session.add(b)

    dispatch = Dispatch(
        id="d-raw-1",
        dispatch_number="DES-0020",
        batch_id=b.id,
        project_id=p_bio.id,
        dispatched_quantity=Decimal("10.000"),
        unit_cost_snapshot=Decimal("5.00"),
        dispatched_by="admin-uuid",
        received_by_name="Tesista",
        is_compensatory=False
    )
    db_session.add(dispatch)
    db_session.commit()

    # Report 4 units (normal)
    p1 = RawMaterialUsageCreateRequest(
        project_id=p_bio.id,
        dispatch_id=dispatch.id,
        quantity_used=Decimal("4.000"),
        waste_quantity=Decimal("0.200"),
        usage_date=date.today(),
        notes="Primer lote de crisoles"
    )
    res1 = service.report_raw_material_usage(
        db=db_session,
        payload=p1,
        current_user=coord_bio,
        ip_address="127.0.0.1"
    )
    db_session.commit()

    assert res1.quantity_used == Decimal("4.000")
    assert res1.is_excess_over_dispatched is False
    assert res1.excess_quantity == Decimal("0.000")

    # Report 7 more units (total 4 + 7 = 11 > 10, excess of 1 L)
    p2 = RawMaterialUsageCreateRequest(
        project_id=p_bio.id,
        dispatch_id=dispatch.id,
        quantity_used=Decimal("7.000"),
        waste_quantity=Decimal("0.000"),
        usage_date=date.today(),
        notes="Lavado adicional no previsto"
    )
    res2 = service.report_raw_material_usage(
        db=db_session,
        payload=p2,
        current_user=coord_bio,
        ip_address="127.0.0.1"
    )
    db_session.commit()

    assert res2.quantity_used == Decimal("7.000")
    assert res2.is_excess_over_dispatched is True
    assert res2.excess_quantity == Decimal("1.000")


# =============================================================================
# 6. F6.5 & F6.6: Compensatory Dispatch Corrections (RF-35, HU-21)
# =============================================================================

def test_dispatch_correction_flow(db_session):
    """
    HU-21 / RF-35: Coordinator requests correction with justification.
    Approver reviews:
      1. Denial preserves original dispatch intact.
      2. Approval creates linked compensatory dispatch, adjusting stock and project executed_budget.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()
    p_bio = db_session.query(Project).filter(Project.id == "proj-bio-id").first()

    b = Batch(
        id="b-corr-test",
        item_id=item.id,
        location_id=loc.id,
        batch_number="L-CORR",
        initial_quantity=Decimal("100.000"),
        available_quantity=Decimal("70.000"),
        unit_cost=Decimal("10.00")
    )
    db_session.add(b)
    item.current_stock = Decimal("70.000")

    # Original dispatch was 30 L ($300.00)
    orig_disp = Dispatch(
        id="d-corr-orig",
        dispatch_number="DES-0318",
        batch_id=b.id,
        project_id=p_bio.id,
        dispatched_quantity=Decimal("30.000"),
        unit_cost_snapshot=Decimal("10.00"),
        dispatched_by=approver.id,
        received_by_name="Daniela Rivas",
        is_compensatory=False
    )
    db_session.add(orig_disp)
    initial_executed = p_bio.executed_budget  # 2000.00
    db_session.commit()

    # 1. Attempt without reason / justification (< 5 chars) -> rejects
    with pytest.raises(Exception) as exc:
        DispatchCorrectionCreateRequest(
            original_dispatch_id=orig_disp.id,
            correct_quantity=Decimal("20.000"),
            justification="   "
        )
    assert "at least 5 characters" in str(exc.value).lower() or "motivo" in str(exc.value).lower()

    # 2. Valid request: actually 20 L were kept (10 L returned)
    corr_req = service.request_dispatch_correction(
        db=db_session,
        payload=DispatchCorrectionCreateRequest(
            original_dispatch_id=orig_disp.id,
            correct_quantity=Decimal("20.000"),
            justification="Se devolvió un frasco de 10 L sin abrir el mismo día"
        ),
        current_user=coord_bio,
        ip_address="127.0.0.1"
    )
    db_session.commit()
    assert corr_req.status == "Pendiente"
    assert corr_req.quantity_difference == Decimal("-10.000")

    # 3. Approver denies first request test
    denial_resp = service.review_dispatch_correction(
        db=db_session,
        correction_id=corr_req.id,
        payload=DispatchCorrectionReviewRequest(approved=False, review_notes="No consta ingreso en almacén"),
        current_user=approver,
        ip_address="127.0.0.1"
    )
    db_session.commit()
    assert denial_resp.status == "Denegado"

    # Original dispatch remains completely intact
    db_session.refresh(orig_disp)
    assert orig_disp.dispatched_quantity == Decimal("30.000")
    db_session.refresh(b)
    assert b.available_quantity == Decimal("70.000")

    # 4. Create new correction and Approve it
    corr_req2 = service.request_dispatch_correction(
        db=db_session,
        payload=DispatchCorrectionCreateRequest(
            original_dispatch_id=orig_disp.id,
            correct_quantity=Decimal("20.000"),
            justification="Corrección verificada por almacén físico"
        ),
        current_user=coord_bio,
        ip_address="127.0.0.1"
    )
    db_session.commit()

    approval_resp = service.review_dispatch_correction(
        db=db_session,
        correction_id=corr_req2.id,
        payload=DispatchCorrectionReviewRequest(approved=True, review_notes="Confirmado en estante"),
        current_user=approver,
        ip_address="127.0.0.1"
    )
    db_session.commit()

    assert approval_resp.status == "Aprobado"
    assert approval_resp.compensatory_dispatch_number is not None

    # Verify stock restored by 10 L
    db_session.refresh(b)
    db_session.refresh(item)
    assert b.available_quantity == Decimal("80.000")  # 70 + 10 returned
    assert item.current_stock == Decimal("80.000")

    # Verify project executed budget credited by -$100 (-10 * $10.00)
    db_session.refresh(p_bio)
    assert p_bio.executed_budget == initial_executed - Decimal("100.00")

    # Verify compensatory dispatch in bitácora
    comp_d = db_session.query(Dispatch).filter(Dispatch.id == approval_resp.compensatory_dispatch_id).first()
    assert comp_d is not None
    assert comp_d.is_compensatory is True
    assert comp_d.dispatched_quantity == Decimal("-10.000")
    assert comp_d.original_dispatch_id == orig_disp.id


# =============================================================================
# 7. RBAC API Endpoints Tests
# =============================================================================

def test_api_rbac_almacen(client, db_session):
    """Verify role permissions over /api/almacen endpoints."""
    admin = db_session.query(User).filter(User.role == "Administrador del Sistema").first()
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    item = db_session.query(Item).filter(Item.name == "Etanol 96 %").first()
    loc = db_session.query(Location).filter(Location.id == "loc-dep-a").first()

    token_coord = create_test_session(db_session, coord_bio)
    token_approver = create_test_session(db_session, approver)

    batch_payload = {
        "item_id": item.id,
        "location_id": loc.id,
        "batch_number": "RBAC-BATCH",
        "quantity": 10.0,
        "unit_cost": 2.5,
        "received_date": str(date.today()),
    }

    # 1. Unauthenticated request -> 401
    res_unauth = client.post("/api/almacen/lotes", json=batch_payload)
    assert res_unauth.status_code == 401

    # 2. Coordinator cannot receive batches -> 403 Forbidden
    res_coord_forbidden = client.post(
        "/api/almacen/lotes",
        json=batch_payload,
        headers={"Authorization": f"Bearer {token_coord}"}
    )
    assert res_coord_forbidden.status_code == 403

    # 3. Approver can receive batches -> 201 Created
    res_approver_ok = client.post(
        "/api/almacen/lotes",
        json=batch_payload,
        headers={"Authorization": f"Bearer {token_approver}"}
    )
    assert res_approver_ok.status_code == 201
    assert res_approver_ok.json()["batch_number"] == "RBAC-BATCH"
