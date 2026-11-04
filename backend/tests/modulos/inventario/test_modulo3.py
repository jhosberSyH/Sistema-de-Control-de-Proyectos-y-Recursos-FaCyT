"""Unit and integration tests for Module 3: Inventory (F3.1 to F3.7 | HU-07 to HU-11)."""

import uuid
from datetime import date, datetime, timezone, timedelta
from decimal import Decimal
import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

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
)
from app.modulos.inventario import service
from app.modulos.inventario.schemas import (
    ItemCreate,
    ItemUpdate,
    ItemMinStockUpdate,
    ReplenishmentDecisionRequest,
)

from sqlalchemy.pool import StaticPool

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
        # Seed test admin
        admin = User(
            id="admin-uuid",
            full_name="Admin Principal",
            email="admin@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Administrador del Sistema",
            is_active=True
        )
        approver = User(
            id="approver-uuid",
            full_name="Gestor Inventario",
            email="gestor@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Aprobador / Gestor de Inventario",
            is_active=True
        )
        coord = User(
            id="coord-uuid",
            full_name="Coordinador Quimica",
            email="coord@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Coordinador de Proyecto",
            is_active=True
        )
        # Default system parameters (F1.5)
        p1 = SystemParameter(
            parameter_key="batch_expiration_alert_days",
            parameter_value=30,
            label="Alerta anticipada de vencimiento",
            description="Días de anticipación",
            unit="días"
        )
        p2 = SystemParameter(
            parameter_key="min_dispatch_history_months",
            parameter_value=3,
            label="Historial mínimo para pronóstico",
            description="Meses mínimos",
            unit="meses"
        )
        # Default location & project
        loc = Location(
            id="loc-001",
            name="Depósito de reactivos A",
            description="Planta baja",
            is_active=True
        )
        proj = Project(
            id="proj-001",
            code="QUI-024",
            title="Catálisis Heterogénea",
            operational_status="En ejecución",
            priority_level="Alta",
            assigned_budget=Decimal("10000.00"),
            executed_budget=Decimal("0.00"),
            physical_progress_pct=Decimal("0.00"),
            coordinator_id=coord.id
        )
        db.add_all([admin, approver, coord, p1, p2, loc, proj])
        db.commit()
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(db_session):
    """FastAPI test client overriding database session dependency."""
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
# 1. F3.1 / HU-07: Catalog Creation & Composite Uniqueness
# =============================================================================

def test_f3_1_create_item_success(db_session):
    """Item starts strictly with current_stock = 0 and is audited."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    payload = ItemCreate(
        name="Acetona analítica",
        unit_of_measure="L",
        item_type="Materia prima",
        min_stock=Decimal("10.000")
    )
    item = service.create_item(db_session, payload, admin, "127.0.0.1")

    assert item.id is not None
    assert item.name == "Acetona analítica"
    assert item.unit_of_measure == "L"
    assert item.item_type == "Materia prima"
    assert item.current_stock == Decimal("0.000")
    assert item.min_stock == Decimal("10.000")

    # Audit log verification (F8.5)
    log = db_session.query(AuditLog).filter(AuditLog.target_table == "items", AuditLog.target_id == item.id).first()
    assert log is not None
    assert log.action_type == "CREATE"


def test_f3_1_duplicate_name_and_unit_rejected(db_session):
    """Attempting to create another item with same name and unit is blocked with 409 (HU-07)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    payload = ItemCreate(name="Nitrato de Plata", unit_of_measure="g", item_type="Materia prima")
    service.create_item(db_session, payload, admin, "127.0.0.1")

    # Attempt duplicate with identical (case-insensitive) name and unit
    dup = ItemCreate(name="  nitrato de plata  ", unit_of_measure="G", item_type="Materia prima")
    with pytest.raises(HTTPException) as exc_info:
        service.create_item(db_session, dup, admin, "127.0.0.1")

    assert exc_info.value.status_code == 409
    assert "Ya existe un insumo registrado" in exc_info.value.detail


def test_f3_1_same_name_different_unit_allowed(db_session):
    """Items with same name but different unit of measure are allowed (e.g. Alcohol in L vs mL)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    i1 = service.create_item(db_session, ItemCreate(name="Etanol", unit_of_measure="L", item_type="Materia prima"), admin, "127.0.0.1")
    i2 = service.create_item(db_session, ItemCreate(name="Etanol", unit_of_measure="mL", item_type="Materia prima"), admin, "127.0.0.1")
    assert i1.id != i2.id


# =============================================================================
# 2. F3.2 & F3.5 / HU-07 & HU-09: Min Stock & Automatic Replenishment
# =============================================================================

def test_f3_2_update_min_stock_triggers_immediate_alert_and_draft_request(db_session):
    """Setting min_stock > current_stock generates immediate low stock and 1 draft replenishment (HU-07, HU-09)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    item = service.create_item(
        db_session,
        ItemCreate(name="Agar Nutritivo", unit_of_measure="g", item_type="Materia prima"),
        admin,
        "127.0.0.1"
    )
    assert item.current_stock == Decimal("0.000")

    # Configure min_stock to 500
    service.update_min_stock(db_session, item.id, ItemMinStockUpdate(min_stock=Decimal("500.000")), admin, "127.0.0.1")

    # Item detail check
    detail = service.get_item_detail(db_session, item.id)
    assert detail.is_low_stock is True
    assert detail.active_replenishment is not None
    assert detail.active_replenishment.status == "Borrador"
    assert detail.active_replenishment.suggested_quantity >= Decimal("500.000")

    # Updating min_stock again should NOT create a duplicate replenishment request (RN-03)
    service.update_min_stock(db_session, item.id, ItemMinStockUpdate(min_stock=Decimal("600.000")), admin, "127.0.0.1")
    requests_count = db_session.query(Request).join(RequestItem).filter(
        RequestItem.item_id == item.id,
        Request.request_type == "Reposición automática"
    ).count()
    assert requests_count == 1


def test_f3_5_discard_replenishment_draft_preserves_low_stock_alert(db_session):
    """Discarding a replenishment draft marks request as 'Rechazado' but low stock alert remains active (HU-09)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    item = service.create_item(
        db_session,
        ItemCreate(name="Papel Filtro", unit_of_measure="unidad", item_type="Consumible de proyecto", min_stock=Decimal("50")),
        admin,
        "127.0.0.1"
    )

    detail = service.get_item_detail(db_session, item.id)
    req_id = detail.active_replenishment.request_id

    # Discard draft
    service.decide_replenishment_request(db_session, req_id, "discard", None, admin, "127.0.0.1")

    req = db_session.query(Request).filter(Request.id == req_id).first()
    assert req.status == "Rechazado"

    # Detail check: low stock alert is still active
    detail_after = service.get_item_detail(db_session, item.id)
    assert detail_after.is_low_stock is True
    # Discarded request is no longer active
    assert detail_after.active_replenishment is None


def test_f3_5_submit_replenishment_draft(db_session):
    """Approving/submitting replenishment draft advances status to 'Pendiente de Aprobación' (RN-03)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    item = service.create_item(
        db_session,
        ItemCreate(name="Pipetas Pasteur", unit_of_measure="caja", item_type="Consumible de uso general", min_stock=Decimal("10")),
        admin,
        "127.0.0.1"
    )

    detail = service.get_item_detail(db_session, item.id)
    req_id = detail.active_replenishment.request_id

    # Submit to approval with adjusted quantity of 15
    service.decide_replenishment_request(db_session, req_id, "submit", Decimal("15.000"), admin, "127.0.0.1")

    req = db_session.query(Request).filter(Request.id == req_id).first()
    assert req.status == "Pendiente de Aprobación"
    req_item = db_session.query(RequestItem).filter(RequestItem.request_id == req_id).first()
    assert req_item.requested_quantity == Decimal("15.000")


# =============================================================================
# 3. F3.3 / HU-08 / RNF-10: Atomic Stock Update
# =============================================================================

def test_f3_3_atomic_stock_movement_receipt_and_dispatch(db_session):
    """Atomic stock updates both item and batch, rolls back on constraint violation (RNF-10)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    item = service.create_item(
        db_session,
        ItemCreate(name="Sulfato de Cobre", unit_of_measure="kg", item_type="Materia prima", min_stock=Decimal("5.000")),
        admin,
        "127.0.0.1"
    )
    # Create batch with 10 kg
    batch = Batch(
        id="batch-001",
        item_id=item.id,
        location_id="loc-001",
        batch_number="LOT-CU-01",
        initial_quantity=Decimal("10.000"),
        available_quantity=Decimal("10.000"),
        unit_cost=Decimal("15.50"),
        received_date=date.today(),
        expiration_date=date.today() + timedelta(days=200),
        expiration_status="Vigente"
    )
    db_session.add(batch)
    item.current_stock = Decimal("10.000")
    db_session.commit()

    # Dispatch 4 kg
    service.update_stock_atomic(db_session, item.id, batch.id, Decimal("4.000"), "DISPATCH", admin.id, "127.0.0.1")
    db_session.commit()

    db_session.refresh(item)
    db_session.refresh(batch)
    assert item.current_stock == Decimal("6.000")
    assert batch.available_quantity == Decimal("6.000")

    # Attempting to dispatch more than available fails and rolls back
    with pytest.raises(HTTPException) as exc_info:
        service.update_stock_atomic(db_session, item.id, batch.id, Decimal("10.000"), "DISPATCH", admin.id, "127.0.0.1")
    assert exc_info.value.status_code == 400
    assert "Cantidad insuficiente" in exc_info.value.detail


# =============================================================================
# 4. F3.6 / HU-10: Batch Expiration Evaluation & Dispatch Blocking
# =============================================================================

def test_f3_6_batch_expiration_classification_and_dispatch_block(db_session):
    """Batches nearing expiration show remaining days; expired batches are blocked from dispatch (HU-10)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    item = service.create_item(
        db_session,
        ItemCreate(name="Glucosa Anhidra", unit_of_measure="g", item_type="Materia prima"),
        admin,
        "127.0.0.1"
    )

    today = date.today()
    # Batch 1: Expiring in 15 days (within default 30-day threshold -> Próximo a vencer)
    b_near = Batch(
        id="batch-near",
        item_id=item.id,
        location_id="loc-001",
        batch_number="LOT-GLU-NEAR",
        initial_quantity=Decimal("100"),
        available_quantity=Decimal("100"),
        unit_cost=Decimal("2.00"),
        received_date=today - timedelta(days=10),
        expiration_date=today + timedelta(days=15),
        expiration_status="Vigente"
    )
    # Batch 2: Expired 5 days ago (-> Vencido)
    b_expired = Batch(
        id="batch-expired",
        item_id=item.id,
        location_id="loc-001",
        batch_number="LOT-GLU-EXP",
        initial_quantity=Decimal("50"),
        available_quantity=Decimal("50"),
        unit_cost=Decimal("2.00"),
        received_date=today - timedelta(days=60),
        expiration_date=today - timedelta(days=5),
        expiration_status="Vigente"
    )
    db_session.add_all([b_near, b_expired])
    db_session.commit()

    # Trigger evaluation
    service.evaluate_batch_expirations(db_session)
    db_session.refresh(b_near)
    db_session.refresh(b_expired)

    assert b_near.expiration_status == "Próximo a vencer"
    assert b_expired.expiration_status == "Vencido"

    # Detail check
    detail = service.get_item_detail(db_session, item.id)
    summaries = {b.id: b for b in detail.batches}
    assert summaries["batch-near"].days_until_expiration == 15
    assert summaries["batch-expired"].is_blocked is True

    # Dispatching expired batch MUST be blocked
    with pytest.raises(HTTPException) as exc_info:
        service.update_stock_atomic(db_session, item.id, b_expired.id, Decimal("5"), "DISPATCH", admin.id, "127.0.0.1")
    assert exc_info.value.status_code == 400
    assert "El lote está vencido y no puede despacharse" in exc_info.value.detail


# =============================================================================
# 5. F3.7 / HU-11: Consumption Forecast
# =============================================================================

def test_f3_7_forecast_without_sufficient_history_shows_message(db_session):
    """With less than min_dispatch_history_months (3 months), forecast is null with informational message (HU-11)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    item = service.create_item(
        db_session,
        ItemCreate(name="Metanol", unit_of_measure="L", item_type="Consumible de uso general"),
        admin,
        "127.0.0.1"
    )

    batch = Batch(
        id="batch-metanol",
        item_id=item.id,
        location_id="loc-001",
        batch_number="LOT-MET-01",
        initial_quantity=Decimal("50"),
        available_quantity=Decimal("50"),
        unit_cost=Decimal("5.00"),
        received_date=date.today(),
        expiration_date=date.today() + timedelta(days=365)
    )
    db_session.add(batch)
    db_session.commit()

    # Create dispatch only 10 days old (< 3 months)
    d = Dispatch(
        id="disp-001",
        dispatch_number="DSP-001",
        batch_id=batch.id,
        project_id="proj-001",
        dispatched_quantity=Decimal("5.000"),
        unit_cost_snapshot=Decimal("5.00"),
        dispatched_by=admin.id,
        received_by_name="Investigador",
        dispatched_at=datetime.now(timezone.utc) - timedelta(days=10)
    )
    db_session.add(d)
    db_session.commit()

    service.recalculate_consumption_forecasts(db_session, item_id=item.id)
    detail = service.get_item_detail(db_session, item.id)

    assert detail.forecasted_consumption is None
    assert detail.forecast_message == "Sin historial suficiente para pronosticar"


def test_f3_7_forecast_with_sufficient_history_calculates_numerical_forecast(db_session):
    """With >= 3 months of dispatches, calculates moving average consumption (HU-11)."""
    admin = db_session.query(User).filter(User.id == "admin-uuid").first()
    item = service.create_item(
        db_session,
        ItemCreate(name="Ácido Clorhídrico", unit_of_measure="L", item_type="Materia prima"),
        admin,
        "127.0.0.1"
    )

    batch = Batch(
        id="batch-hcl",
        item_id=item.id,
        location_id="loc-001",
        batch_number="LOT-HCL-01",
        initial_quantity=Decimal("100"),
        available_quantity=Decimal("100"),
        unit_cost=Decimal("8.00"),
        received_date=date.today() - timedelta(days=120)
    )
    db_session.add(batch)
    db_session.commit()

    # Create dispatches spanning 4 months (~120 days)
    # Month 1: 10 L
    # Month 2: 20 L
    # Month 3: 30 L
    now = datetime.now(timezone.utc)
    d1 = Dispatch(id="d1", dispatch_number="DSP-HCL-1", batch_id=batch.id, project_id="proj-001", dispatched_quantity=Decimal("10.000"), unit_cost_snapshot=Decimal("8.00"), dispatched_by=admin.id, received_by_name="Químico", dispatched_at=now - timedelta(days=110))
    d2 = Dispatch(id="d2", dispatch_number="DSP-HCL-2", batch_id=batch.id, project_id="proj-001", dispatched_quantity=Decimal("20.000"), unit_cost_snapshot=Decimal("8.00"), dispatched_by=admin.id, received_by_name="Químico", dispatched_at=now - timedelta(days=70))
    d3 = Dispatch(id="d3", dispatch_number="DSP-HCL-3", batch_id=batch.id, project_id="proj-001", dispatched_quantity=Decimal("30.000"), unit_cost_snapshot=Decimal("8.00"), dispatched_by=admin.id, received_by_name="Químico", dispatched_at=now - timedelta(days=20))
    db_session.add_all([d1, d2, d3])
    db_session.commit()

    service.recalculate_consumption_forecasts(db_session, item_id=item.id)
    detail = service.get_item_detail(db_session, item.id)

    assert detail.forecasted_consumption is not None
    assert detail.forecasted_consumption > Decimal("0")
    assert "Sin historial suficiente" not in detail.forecast_message


# =============================================================================
# 6. RBAC Integration Tests via API Client
# =============================================================================

def test_api_rbac_inventory(client, db_session):
    """Test RBAC policies: Coordinator can read; only Admin can create/update items."""
    admin_token = create_auth_session(db_session, "admin-uuid")
    coord_token = create_auth_session(db_session, "coord-uuid")

    # 1. Admin creates item -> 201
    res = client.post(
        "/api/inventario/items",
        json={"name": "Hidróxido de Sodio", "unit_of_measure": "kg", "item_type": "Materia prima", "min_stock": 15},
        headers={"Authorization": f"Bearer {admin_token}"}
    )
    assert res.status_code == 201
    item_id = res.json()["id"]

    # 2. Coordinator attempts to create item -> 403 Forbidden
    res_coord_create = client.post(
        "/api/inventario/items",
        json={"name": "Otro Insumo", "unit_of_measure": "g", "item_type": "Materia prima"},
        headers={"Authorization": f"Bearer {coord_token}"}
    )
    assert res_coord_create.status_code == 403

    # 3. Coordinator reads item list -> 200 OK
    res_list = client.get(
        "/api/inventario/items",
        headers={"Authorization": f"Bearer {coord_token}"}
    )
    assert res_list.status_code == 200
    assert len(res_list.json()) >= 1

    # 4. Coordinator reads item detail -> 200 OK
    res_detail = client.get(
        f"/api/inventario/items/{item_id}",
        headers={"Authorization": f"Bearer {coord_token}"}
    )
    assert res_detail.status_code == 200
    assert res_detail.json()["name"] == "Hidróxido de Sodio"

    # 5. Coordinator attempts to update min_stock -> 403 Forbidden
    res_update_min = client.patch(
        f"/api/inventario/items/{item_id}/min-stock",
        json={"min_stock": 25},
        headers={"Authorization": f"Bearer {coord_token}"}
    )
    assert res_update_min.status_code == 403
