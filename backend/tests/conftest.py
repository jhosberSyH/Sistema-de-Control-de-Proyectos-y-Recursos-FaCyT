"""Fixtures compartidas.

Dos tipos de pruebas conviven:

1. Las de cada módulo con SQLite en memoria (cada archivo arma su motor). Rápidas, pero no ven
   enums, CHECK, triggers ni UUID de PostgreSQL.
2. Las marcadas con las fixtures ``pg_*``: corren contra PostgreSQL con el esquema REAL de
   database/ (schema.sql + 02_constraints_triggers.sql + seeders.sql). Necesitan la variable
   TEST_DATABASE_URL, por ejemplo:

       TEST_DATABASE_URL=postgresql+psycopg://cpq:clave@localhost:5432/cpq_test

   La base indicada se BORRA y se vuelve a crear al inicio de la sesión de pruebas. Cada prueba
   corre dentro de una transacción que se deshace al final (los commit del código son savepoints).
   Sin la variable, esas pruebas se saltan.
"""

import os
from pathlib import Path

# Antes de importar la app: el arranque (lifespan) usa SQLite en memoria y no deja local_dev.db
os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")

import psycopg  # noqa: E402
import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from sqlalchemy import create_engine, event, text  # noqa: E402
from sqlalchemy.engine import make_url  # noqa: E402
from sqlalchemy.orm import Session  # noqa: E402

from app.core.database import ESQUEMA_APP, get_db  # noqa: E402
from app.main import app  # noqa: E402

RAIZ = Path(__file__).resolve().parents[2]
SCRIPTS_BD = [RAIZ / "database" / n for n in ("schema.sql", "02_constraints_triggers.sql", "seeders.sql")]
TEST_DATABASE_URL = os.environ.get("TEST_DATABASE_URL")


@pytest.fixture(scope="session")
def pg_engine():
    if not TEST_DATABASE_URL:
        pytest.skip("TEST_DATABASE_URL no está definida: se saltan las pruebas contra PostgreSQL")
    url = make_url(TEST_DATABASE_URL)
    nombre = url.database
    admin = create_engine(url.set(database="postgres"), isolation_level="AUTOCOMMIT")
    with admin.connect() as c:
        c.execute(text(f'DROP DATABASE IF EXISTS "{nombre}" WITH (FORCE)'))
        c.execute(text(f'CREATE DATABASE "{nombre}"'))
    admin.dispose()

    dsn = url.set(drivername="postgresql").render_as_string(hide_password=False)
    with psycopg.connect(dsn) as conn:
        for script in SCRIPTS_BD:
            # Sin parámetros, psycopg admite varias sentencias (y bloques DO) en una sola llamada
            conn.execute(script.read_text(encoding="utf-8"))
        conn.commit()

    engine = create_engine(url)

    @event.listens_for(engine, "connect")
    def _search_path(dbapi_connection, _):
        autocommit = dbapi_connection.autocommit
        dbapi_connection.autocommit = True
        cur = dbapi_connection.cursor()
        cur.execute(f"SET search_path TO {ESQUEMA_APP}, public")
        cur.close()
        dbapi_connection.autocommit = autocommit

    yield engine
    engine.dispose()


@pytest.fixture
def pg_db(pg_engine):
    """Sesión dentro de una transacción que se deshace al terminar la prueba."""
    conexion = pg_engine.connect()
    transaccion = conexion.begin()
    sesion = Session(bind=conexion, join_transaction_mode="create_savepoint", autoflush=False)
    try:
        yield sesion
    finally:
        sesion.close()
        transaccion.rollback()
        conexion.close()


@pytest.fixture
def pg_client(pg_db):
    """Cliente HTTP contra la app usando la sesión de pg_db. HTTPS para que viaje la cookie Secure."""
    def _get_db():
        yield pg_db

    app.dependency_overrides[get_db] = _get_db
    try:
        with TestClient(app, base_url="https://testserver") as cliente:
            yield cliente
    finally:
        app.dependency_overrides.pop(get_db, None)


def iniciar_sesion(cliente: TestClient, correo: str, clave: str = "Demo2026*") -> dict:
    """Inicia sesión por el contrato y deja el token CSRF en los encabezados del cliente."""
    cliente.cookies.clear()
    r = cliente.post("/api/auth/iniciar-sesion", json={"correo": correo, "clave": clave})
    assert r.status_code == 200, r.text
    cliente.headers["X-CSRF-Token"] = r.json()["csrf"]
    return r.json()
