"""Integration tests for Module 1 HTTP API endpoints (contrato del frontend, en SQLite)."""

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
    # HTTPS: la cookie __Host-sesion es Secure y el cliente solo la reenvía por HTTPS
    client = TestClient(app, base_url="https://testserver")

    yield client, db

    db.close()
    Base.metadata.drop_all(bind=engine)
    app.dependency_overrides.clear()


def _entrar(client, correo):
    client.cookies.clear()
    r = client.post("/api/auth/iniciar-sesion", json={"correo": correo, "clave": "Demo2026*"})
    assert r.status_code == 200, r.text
    client.headers["X-CSRF-Token"] = r.json()["csrf"]
    return r.json()


def test_api_login_and_admin_protection(client_and_db):
    """Admin can login and access /api/usuarios, non-admin gets 403."""
    client, db = client_and_db

    sesion = _entrar(client, "admin@cpq.local")
    assert sesion["usuario"]["rol"] == "administrador"

    res_users = client.get("/api/usuarios")
    assert res_users.status_code == 200
    assert res_users.json()["total"] >= 2

    _entrar(client, "coord.quimica@cpq.local")
    res_forbidden = client.get("/api/usuarios")
    assert res_forbidden.status_code == 403
    assert "permiso" in res_forbidden.json()["detail"]


def test_api_create_user_and_prevent_duplicate(client_and_db):
    """API creates user with a temporary password and prevents duplicate email."""
    client, db = client_and_db
    _entrar(client, "admin@cpq.local")

    payload = {"nombre": "Nuevo Coordinador", "correo": "nuevo.coord@cpq.local", "rol": "coordinador"}
    res = client.post("/api/usuarios", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["cuenta"]["correo"] == "nuevo.coord@cpq.local"
    assert data["cuenta"]["activo"] is True and data["cuenta"]["debeCambiarClave"] is True
    assert data["claveTemporal"]

    res_dup = client.post("/api/usuarios", json=payload)
    assert res_dup.status_code == 409
    assert res_dup.json()["detail"]["cuenta"]["nombre"] == "Nuevo Coordinador"


def test_api_locations_and_parameters_flow(client_and_db):
    """API manages storage locations and system parameters."""
    client, db = client_and_db
    _entrar(client, "admin@cpq.local")

    res_loc = client.post("/api/ubicaciones", json={"nombre": "Depósito de Reactivos A", "descripcion": "Planta baja"})
    assert res_loc.status_code == 201

    res_loc_dup = client.post("/api/ubicaciones", json={"nombre": "depósito de reactivos a"})
    assert res_loc_dup.status_code == 409

    db.add(SystemParameter(
        parameter_key="batch_expiration_alert_days", parameter_value=30,
        label="Alerta de vencimiento", unit="días",
    ))
    db.commit()

    for invalido in (-10, 0):
        res = client.put("/api/parametros", json={"valores": {"anticipacion_vencimiento_dias": invalido}})
        assert res.status_code == 422

    res_ok = client.put("/api/parametros", json={"valores": {"anticipacion_vencimiento_dias": 45}})
    assert res_ok.status_code == 200
    assert res_ok.json()["items"][0]["valor"] == 45
