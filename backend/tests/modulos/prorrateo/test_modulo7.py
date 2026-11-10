"""Unit and integration tests for Module 7: Accounting Period Closing & Overhead Proration (F7.1 to F7.4 | HU-22, HU-23)."""

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
    Request,
    RequestItem,
    AccountingPeriod,
    PeriodProjectConfirmation,
    OverheadAllocation,
)
from app.modulos.prorrateo import service
from app.modulos.prorrateo.schemas import (
    AccountingPeriodCreateRequest,
    AccountingPeriodCloseRequest,
    ProjectChargesConfirmRequest,
    ProrationExecuteRequest,
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
    """Create fresh database tables and seeders for each test."""
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
        # 2. Approver
        approver = User(
            id="approver-uuid",
            full_name="Carmen Pérez",
            email="aprobador@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Aprobador / Gestor de Inventario",
            is_active=True
        )
        # 3. Coordinators
        coord_bio = User(
            id="coord-bio-uuid",
            full_name="María Fernanda Ochoa",
            email="coord.bio@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Coordinador de Proyecto",
            is_active=True
        )
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

        # 4. Locations & System Parameters
        loc = Location(id="loc-dep-a", name="Depósito Central", is_active=True)
        db.add(loc)
        p_param = SystemParameter(
            parameter_key="min_dispatch_history_months",
            parameter_value=3,
            label="Historial mínimo",
            unit="meses"
        )
        db.add(p_param)

        # 5. Projects
        # Active project 1
        p_bio = Project(
            id="proj-bio-id",
            code="BIO-011",
            title="Bioensayos de aguas residuales",
            status="En ejecución",
            assigned_budget=Decimal("10000.00"),
            coordinator_id=coord_bio.id
        )
        # Active project 2
        p_fis = Project(
            id="proj-fis-id",
            code="FIS-008",
            title="Películas delgadas",
            status="En ejecución",
            assigned_budget=Decimal("8000.00"),
            coordinator_id=coord_fis.id
        )
        # Active project 3
        p_qui = Project(
            id="proj-qui-id",
            code="QUI-024",
            title="Óxidos catalíticos",
            status="En ejecución",
            assigned_budget=Decimal("6000.00"),
            coordinator_id=coord_bio.id
        )
        # Suspended project (excluded from proration - RN-05)
        p_susp = Project(
            id="proj-susp-id",
            code="FIS-006",
            title="Resonancia acústica",
            status="Suspendido",
            assigned_budget=Decimal("4000.00"),
            coordinator_id=coord_fis.id
        )
        db.add_all([p_bio, p_fis, p_qui, p_susp])

        # 6. Items & Batches
        item_gen = Item(
            id="item-gen-id",
            name="Guantes de nitrilo",
            unit_of_measure="cajas",
            item_type="Consumible de uso general",
            current_stock=Decimal("20.000"),
            is_active=True
        )
        db.add(item_gen)

        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """TestClient wired to in-memory session."""
    def override_get_db():
        try:
            yield db_session
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as test_client:
        yield test_client
    app.dependency_overrides.clear()


def create_auth_session(db: TestingSessionLocal, user_id: str) -> str:
    """Helper to establish test user session and return bearer token."""
    raw_token = f"test-token-{user_id}-{uuid.uuid4().hex[:8]}"
    token_hash = hash_session_token(raw_token)
    session = SessionModel(
        user_id=user_id,
        token_hash=token_hash,
        csrf_token="csrf-1234",
        ip_address="127.0.0.1",
        expires_at=datetime.now(timezone.utc) + timedelta(hours=8)
    )
    db.add(session)
    db.commit()
    return raw_token


# =============================================================================
# 1. F7.1: Period Opening, Coordinator Charges Review & Confirmation (HU-22)
# =============================================================================

def test_f7_1_open_period_and_coordinator_charges_confirmation(db_session):
    """
    HU-22: Approver opens period review.
    Coordinators see direct charges for their assigned projects only (RN-07).
    Coordinators can confirm charges.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    coord_fis = db_session.query(User).filter(User.id == "coord-fis-uuid").first()
    p_bio = db_session.query(Project).filter(Project.id == "proj-bio-id").first()
    p_fis = db_session.query(Project).filter(Project.id == "proj-fis-id").first()

    # Create general overhead batch in October 2026
    batch_gen = Batch(
        id="batch-gen-oct",
        item_id="item-gen-id",
        location_id="loc-dep-a",
        batch_number="BG-OCT-01",
        initial_quantity=Decimal("10.000"),
        available_quantity=Decimal("10.000"),
        unit_cost=Decimal("100.00"),  # 10 * 100 = 1000.00 overhead
        received_date=date(2026, 10, 5),
    )
    db_session.add(batch_gen)

    # Dispatches to BIO-011 and FIS-008
    d_bio = Dispatch(
        id="d-bio-oct",
        dispatch_number="DES-0288",
        batch_id=batch_gen.id,
        project_id=p_bio.id,
        dispatched_quantity=Decimal("2.000"),
        unit_cost_snapshot=Decimal("50.00"),  # 100.00
        dispatched_by=approver.id,
        received_by_name="Tesista Bio",
        dispatched_at=datetime(2026, 10, 10, 10, 0, tzinfo=timezone.utc),
    )
    db_session.add(d_bio)
    db_session.commit()

    # 1. Approver opens period
    open_req = AccountingPeriodCreateRequest(
        period_name="Octubre 2026",
        period_type="Mensual",
        start_date=date(2026, 10, 1),
        end_date=date(2026, 10, 31),
    )
    period_resp = service.open_accounting_period_review(
        db=db_session,
        payload=open_req,
        current_user=approver,
        ip_address="127.0.0.1"
    )
    db_session.commit()

    assert period_resp.period_name == "Octubre 2026"
    assert period_resp.status == "En revisión"
    assert period_resp.total_overhead_cost == Decimal("1000.00")

    # 2. Coordinators view confirmation dashboard
    dash = service.get_period_confirmation_dashboard(db_session, period_resp.id, approver)
    assert dash.total_active_projects == 3  # BIO-011, FIS-008, QUI-024 (excluding FIS-006 suspended)
    assert dash.confirmed_projects_count == 0

    # 3. Scoping check: Coordinator bio can view BIO-011
    charges_bio = service.get_project_charges_for_coordinator(
        db=db_session,
        period_id=period_resp.id,
        project_id=p_bio.id,
        current_user=coord_bio
    )
    assert charges_bio.project_code == "BIO-011"
    assert len(charges_bio.charges) == 1
    assert charges_bio.charges[0].reference_code == "DES-0288"
    assert charges_bio.is_confirmed is False

    # RN-07: Coordinator bio CANNOT view charges for FIS-008 (coordinated by coord_fis)
    with pytest.raises(HTTPException) as exc:
        service.get_project_charges_for_coordinator(
            db=db_session,
            period_id=period_resp.id,
            project_id=p_fis.id,
            current_user=coord_bio
        )
    assert exc.value.status_code == 403

    # 4. Coordinator confirms charges for BIO-011
    confirm_res = service.confirm_project_charges(
        db=db_session,
        period_id=period_resp.id,
        project_id=p_bio.id,
        payload=ProjectChargesConfirmRequest(comments="Cargos verificados y correctos"),
        current_user=coord_bio,
        ip_address="127.0.0.1"
    )
    db_session.commit()
    assert confirm_res.is_confirmed is True

    # Check dashboard updated
    dash_after = service.get_period_confirmation_dashboard(db_session, period_resp.id, approver)
    assert dash_after.confirmed_projects_count == 1


# =============================================================================
# 2. F7.2: Reject Overlap With Closed Period (HU-23)
# =============================================================================

def test_f7_2_reject_overlap_with_closed_period(db_session):
    """
    HU-23: Period cannot overlap with another period in 'Cerrado' or 'Prorrateado'.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()

    # Pre-existing closed period Q3 (01/07/2026 to 30/09/2026)
    closed_p = AccountingPeriod(
        id="q3-closed",
        period_name="Tercer Trimestre 2026",
        period_type="Trimestral",
        start_date=date(2026, 7, 1),
        end_date=date(2026, 9, 30),
        status="Cerrado",
        total_overhead_cost=Decimal("500.00"),
    )
    db_session.add(closed_p)
    db_session.commit()

    # Attempt to open a period that overlaps: 15/09/2026 to 15/10/2026
    req_overlap = AccountingPeriodCreateRequest(
        period_name="Período Inválido",
        period_type="Mensual",
        start_date=date(2026, 9, 15),
        end_date=date(2026, 10, 15),
    )

    with pytest.raises(HTTPException) as exc:
        service.open_accounting_period_review(
            db=db_session,
            payload=req_overlap,
            current_user=approver,
            ip_address="127.0.0.1"
        )
    assert exc.value.status_code == 400
    assert "se cruza con el período cerrado" in exc.value.detail
    assert "Tercer Trimestre 2026" in exc.value.detail


# =============================================================================
# 3. F7.2: Block Dispatches in Closed Period Range (F7.2)
# =============================================================================

def test_f7_2_block_dispatches_in_closed_period(db_session):
    """
    F7.2: Once period is closed, dispatches with date in its range are rejected.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()
    p_bio = db_session.query(Project).filter(Project.id == "proj-bio-id").first()

    # Create closed period covering today
    today = date.today()
    closed_p = AccountingPeriod(
        id="today-closed",
        period_name="Mes Actual Cerrado",
        period_type="Mensual",
        start_date=today - timedelta(days=10),
        end_date=today + timedelta(days=10),
        status="Cerrado",
        total_overhead_cost=Decimal("500.00"),
    )
    db_session.add(closed_p)

    # Item and batch
    it = Item(
        id="it-blk",
        name="Reactivo X",
        unit_of_measure="L",
        item_type="Materia prima",
        current_stock=Decimal("10.000"),
        is_active=True
    )
    loc = db_session.query(Location).first()
    b = Batch(
        id="b-blk", item_id=it.id, location_id=loc.id, batch_number="L-B",
        initial_quantity=Decimal("10.000"), available_quantity=Decimal("10.000"), unit_cost=Decimal("5.00")
    )
    # Approved withdrawal request
    req = Request(
        id="req-ret-blk", request_number="SOL-BLK", request_type="Retiro",
        project_id=p_bio.id, requester_user_id=coord_bio.id, status="Aprobado"
    )
    db_session.add_all([it, b, req])
    db_session.commit()

    from app.modulos.almacen.service import execute_dispatch
    from app.modulos.almacen.schemas import DispatchCreateRequest, DispatchAllocationItem

    with pytest.raises(HTTPException) as exc:
        execute_dispatch(
            db=db_session,
            payload=DispatchCreateRequest(
                request_id=req.id,
                received_by_name="Tesista",
                allocations=[DispatchAllocationItem(batch_id=b.id, quantity=Decimal("2.000"))]
            ),
            current_user=approver,
            ip_address="127.0.0.1"
        )
    assert exc.value.status_code == 400
    assert "ya se encuentra cerrado (F7.2)" in exc.value.detail


# =============================================================================
# 4. F7.4: Equitative Proration and Residual Handling (HU-23)
# =============================================================================

def test_f7_4_proration_equitative_and_residual(db_session):
    """
    HU-23: With overhead 900 and 3 active projects, each receives exactly 300.
    With rounding residue (e.g. 1000 / 3 = 333.33 with 0.01 cent residual),
    residual goes strictly to active project with lowest code ASC.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    p_bio = db_session.query(Project).filter(Project.code == "BIO-011").first()
    p_fis = db_session.query(Project).filter(Project.code == "FIS-008").first()
    p_qui = db_session.query(Project).filter(Project.code == "QUI-024").first()

    # 1. Exact division: 900 overhead across 3 active projects
    period_900 = AccountingPeriod(
        id="p-900",
        period_name="Período 900",
        period_type="Mensual",
        start_date=date(2026, 1, 1),
        end_date=date(2026, 1, 31),
        status="Cerrado",
        total_overhead_cost=Decimal("900.00"),
    )
    db_session.add(period_900)
    db_session.commit()

    prev_900 = service.calculate_proration(db_session, period_900, "Equitativo")
    assert prev_900.active_projects_count == 3
    assert prev_900.rounding_residual == Decimal("0.00")

    alloc_map = {a.project_code: a.allocated_overhead for a in prev_900.allocations if a.is_active_for_proration}
    assert alloc_map["BIO-011"] == Decimal("300.00")
    assert alloc_map["FIS-008"] == Decimal("300.00")
    assert alloc_map["QUI-024"] == Decimal("300.00")

    # 2. Residual division: 1000 overhead across 3 projects (333.33 each + 0.01 residual)
    period_1000 = AccountingPeriod(
        id="p-1000",
        period_name="Período 1000",
        period_type="Mensual",
        start_date=date(2026, 2, 1),
        end_date=date(2026, 2, 28),
        status="Cerrado",
        total_overhead_cost=Decimal("1000.00"),
    )
    db_session.add(period_1000)
    db_session.commit()

    prev_1000 = service.calculate_proration(db_session, period_1000, "Equitativo")
    assert prev_1000.rounding_residual == Decimal("0.01")
    # Residual must go to project with lowest code: BIO-011
    assert prev_1000.residual_assigned_to_project_code == "BIO-011"

    alloc_map_1000 = {a.project_code: a.allocated_overhead for a in prev_1000.allocations if a.is_active_for_proration}
    assert alloc_map_1000["BIO-011"] == Decimal("333.34")  # 333.33 + 0.01
    assert alloc_map_1000["FIS-008"] == Decimal("333.33")
    assert alloc_map_1000["QUI-024"] == Decimal("333.33")
    assert sum(alloc_map_1000.values()) == Decimal("1000.00")


# =============================================================================
# 5. F7.3: Proportional Proration and Suspended Project Exclusion (HU-23)
# =============================================================================

def test_f7_3_proration_proportional_and_exclusion(db_session):
    """
    HU-23: Two active projects with consumptions of 300 and 100 (total 400: 75% and 25%)
    and overhead of 800 receive exactly 600 and 200.
    A suspended project receives 0.00.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    p_bio = db_session.query(Project).filter(Project.code == "BIO-011").first()
    p_fis = db_session.query(Project).filter(Project.code == "FIS-008").first()
    p_qui = db_session.query(Project).filter(Project.code == "QUI-024").first()
    p_susp = db_session.query(Project).filter(Project.code == "FIS-006").first()

    # For this test, set QUI-024 to 'Finalizado' to have exactly 2 active projects
    p_qui.operational_status = "Finalizado"

    period = AccountingPeriod(
        id="p-prop-800",
        period_name="Período Proporcional 800",
        period_type="Mensual",
        start_date=date(2026, 3, 1),
        end_date=date(2026, 3, 31),
        status="Cerrado",
        total_overhead_cost=Decimal("800.00"),
    )
    db_session.add(period)

    # Dispatches in period: BIO-011 = 300, FIS-008 = 100
    it = db_session.query(Item).first()
    loc = db_session.query(Location).first()
    b = Batch(id="b-prop", item_id=it.id, location_id=loc.id, batch_number="L-P", initial_quantity=100, available_quantity=100, unit_cost=1)
    db_session.add(b)

    d1 = Dispatch(
        id="d-p-1", dispatch_number="DES-P1", batch_id=b.id, project_id=p_bio.id,
        dispatched_quantity=Decimal("300.000"), unit_cost_snapshot=Decimal("1.00"),
        dispatched_by=approver.id, received_by_name="T1",
        dispatched_at=datetime(2026, 3, 10, tzinfo=timezone.utc)
    )
    d2 = Dispatch(
        id="d-p-2", dispatch_number="DES-P2", batch_id=b.id, project_id=p_fis.id,
        dispatched_quantity=Decimal("100.000"), unit_cost_snapshot=Decimal("1.00"),
        dispatched_by=approver.id, received_by_name="T2",
        dispatched_at=datetime(2026, 3, 15, tzinfo=timezone.utc)
    )
    db_session.add_all([d1, d2])
    db_session.commit()

    prev = service.calculate_proration(db_session, period, "Proporcional")
    assert prev.active_projects_count == 2
    assert prev.total_active_projects_consumption == Decimal("400.00")

    alloc_map = {a.project_code: a.allocated_overhead for a in prev.allocations}
    assert alloc_map["BIO-011"] == Decimal("600.00")  # 75% of 800
    assert alloc_map["FIS-008"] == Decimal("200.00")  # 25% of 800
    assert alloc_map["FIS-006"] == Decimal("0.00")    # Suspended: 0.00
    assert alloc_map["QUI-024"] == Decimal("0.00")    # Finalized: 0.00

    # Gasto ejecutado antes del reparto: se calcula desde los movimientos (decisión 5)
    db_session.refresh(p_bio)
    db_session.refresh(p_fis)
    bio_antes, fis_antes = p_bio.executed_budget, p_fis.executed_budget

    # Execute proration
    exec_res = service.execute_proration(
        db=db_session,
        period_id=period.id,
        payload=ProrationExecuteRequest(proration_criterion="Proporcional"),
        current_user=approver,
        ip_address="127.0.0.1"
    )
    db_session.commit()

    assert len(exec_res) == 2
    db_session.refresh(period)
    assert period.status == "Prorrateado"

    # Verify project executed budgets incremented
    db_session.refresh(p_bio)
    db_session.refresh(p_fis)
    # El reparto suma lo asignado a cada proyecto activo
    assert p_bio.executed_budget == bio_antes + Decimal("600.00")
    assert p_fis.executed_budget == fis_antes + Decimal("200.00")


# =============================================================================
# 6. F7.3: Immutable Proration Rejects Re-proration (HU-23)
# =============================================================================

def test_f7_3_immutable_proration_rejects_second_attempt(db_session):
    """
    HU-23: Attempting to calculate or execute proration on an already 'Prorrateado' period is rejected.
    """
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()

    period = AccountingPeriod(
        id="p-already-prorated",
        period_name="Período Ya Prorrateado",
        period_type="Mensual",
        start_date=date(2026, 4, 1),
        end_date=date(2026, 4, 30),
        status="Prorrateado",
        total_overhead_cost=Decimal("500.00"),
    )
    db_session.add(period)
    db_session.commit()

    # Calculate preview rejects
    with pytest.raises(HTTPException) as exc1:
        service.calculate_proration(db_session, period, "Proporcional")
    assert exc1.value.status_code == 400
    assert "ya fue prorrateado anteriormente" in exc1.value.detail

    # Execution rejects
    with pytest.raises(HTTPException) as exc2:
        service.execute_proration(
            db=db_session,
            period_id=period.id,
            payload=ProrationExecuteRequest(proration_criterion="Equitativo"),
            current_user=approver,
            ip_address="127.0.0.1"
        )
    assert exc2.value.status_code == 400
    assert "ya fue prorrateado anteriormente" in exc2.value.detail


# =============================================================================
# 7. RBAC API Endpoints Tests
# =============================================================================

def test_api_rbac_prorrateo(client, db_session):
    """Permisos de POST /api/periodos (contrato del frontend): solo el aprobador abre la revisión."""
    approver = db_session.query(User).filter(User.role == "Aprobador / Gestor de Inventario").first()
    coord_bio = db_session.query(User).filter(User.id == "coord-bio-uuid").first()

    token_approver = create_auth_session(db_session, approver.id)
    token_coord = create_auth_session(db_session, coord_bio.id)

    period_payload = {"tipo": "mensual", "inicio": "2026-11-01", "fin": "2026-11-30"}

    # 1. Unauthenticated -> 401
    res_unauth = client.post("/api/periodos", json=period_payload)
    assert res_unauth.status_code == 401

    # 2. Coordinator cannot open period -> 403 Forbidden
    res_coord_forbidden = client.post(
        "/api/periodos",
        json=period_payload,
        headers={"Authorization": f"Bearer {token_coord}"}
    )
    assert res_coord_forbidden.status_code == 403

    # 3. Approver can open period -> 201 Created
    res_approver_ok = client.post(
        "/api/periodos",
        json=period_payload,
        headers={"Authorization": f"Bearer {token_approver}"}
    )
    assert res_approver_ok.status_code == 201, res_approver_ok.text
    assert res_approver_ok.json()["estado"] == "en_revision"
    assert res_approver_ok.json()["abiertoPor"] == "Carmen Pérez"
