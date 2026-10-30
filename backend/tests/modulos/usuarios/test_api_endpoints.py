"""Integration tests for Module 1 HTTP API endpoints."""

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.core.database import Base, get_db
from app.core.security import hash_password
from app.main import app
from app.modulos.usuarios.models import User, Location, SystemParameter, Project

# Test database with StaticPool so in-memory DB is shared across connections
from sqlalchemy.pool import StaticPool

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


@pytest.fixture(scope="function")
def client_and_db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()

    # Seed Admin, Coordinator and Approver
    admin = User(
        id="admin-id",
        full_name="José Rodríguez",
        email="admin@cpq.local",
        password_hash=hash_password("Demo2026*"),
        role="Administrador del Sistema",
        is_active=True
    )
    coord = User(
        id="coord-id",
        full_name="Daniela Rivas",
        email="coord.quimica@cpq.local",
        password_hash=hash_password("Demo2026*"),
        role="Coordinador de Proyecto",
        is_active=True
    )
    db.add_all([admin, coord])
    db.commit()

    def override_get_db():
        try:
            yield db
        finally:
            pass

    app.dependency_overrides[get_db] = override_get_db
    client = TestClient(app)

    yield client, db

    db.close()
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def test_api_login_and_admin_protection(client_and_db):
    """Admin can login and access /api/users, non-admin gets 403."""
    client, db = client_and_db

    # 1. Login as Admin
    res_admin = client.post("/api/auth/login", json={"email": "admin@cpq.local", "password": "Demo2026*"})
    assert res_admin.status_code == 200
    assert res_admin.json()["role"] == "Administrador del Sistema"

    # Access /api/users with admin session
    res_users = client.get("/api/users")
    assert res_users.status_code == 200
    assert len(res_users.json()) >= 2

    # 2. Login as Coordinator
    res_coord = client.post("/api/auth/login", json={"email": "coord.quimica@cpq.local", "password": "Demo2026*"})
    assert res_coord.status_code == 200

    # Coordinator attempting to access admin-only /api/users gets 403 Forbidden
    res_forbidden = client.get("/api/users")
    assert res_forbidden.status_code == 403
    assert "Acceso denegado" in res_forbidden.json()["detail"]


def test_api_create_user_and_prevent_duplicate(client_and_db):
    """API creates user and prevents duplicate email."""
    client, db = client_and_db
    client.post("/api/auth/login", json={"email": "admin@cpq.local", "password": "Demo2026*"})

    # Create new
    payload = {
        "full_name": "Nuevo Coordinador",
        "email": "nuevo.coord@cpq.local",
        "role": "Coordinador de Proyecto",
        "password": "Password123*"
    }
    res = client.post("/api/users", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert data["email"] == "nuevo.coord@cpq.local"
    assert data["is_active"] is True

    # Duplicate
    res_dup = client.post("/api/users", json=payload)
    assert res_dup.status_code == 409
    assert res_dup.json()["detail"]["existing_user"]["full_name"] == "Nuevo Coordinador"


def test_api_locations_and_parameters_flow(client_and_db):
    """API manages storage locations and system parameters."""
    client, db = client_and_db
    client.post("/api/auth/login", json={"email": "admin@cpq.local", "password": "Demo2026*"})

    # 1. Create location
    res_loc = client.post("/api/locations", json={
        "name": "Depósito de Reactivos A",
        "description": "Planta baja"
    })
    assert res_loc.status_code == 200
    loc_id = res_loc.json()["id"]

    # 2. Duplicate active location rejected
    res_loc_dup = client.post("/api/locations", json={"name": "depósito de reactivos a"})
    assert res_loc_dup.status_code == 409

    # 3. Seed and update parameter
    param = SystemParameter(
        parameter_key="batch_expiration_alert_days",
        parameter_value=30,
        label="Alerta de vencimiento",
        unit="días"
    )
    db.add(param)
    db.commit()

    # Reject non-positive integer
    res_p_neg = client.put("/api/system-parameters/batch_expiration_alert_days", json={"parameter_value": -10})
    assert res_p_neg.status_code == 422

    # Reject zero
    res_p_zero = client.put("/api/system-parameters/batch_expiration_alert_days", json={"parameter_value": 0})
    assert res_p_zero.status_code == 422

    # Accept positive integer
    res_p_ok = client.put("/api/system-parameters/batch_expiration_alert_days", json={"parameter_value": 45})
    assert res_p_ok.status_code == 200
    assert res_p_ok.json()["parameter_value"] == 45
