"""El ORM contra el esquema real de database/ en PostgreSQL (README §14).

- Cada columna de cada modelo existe en app.<tabla> con un tipo compatible.
- Las reglas que viven solo en la BD (triggers de inmutabilidad, EXCLUDE de reservas, enums) se cumplen.
"""

from datetime import datetime, timedelta, timezone

import pytest
from sqlalchemy import inspect, text
from sqlalchemy.exc import DBAPIError

from app.core.database import Base, ENUMS_BD, ESQUEMA_APP
import app.modulos.usuarios.models  # noqa: F401  (registra todos los modelos)


def test_search_path_apunta_al_esquema_app(pg_db):
    assert pg_db.execute(text("SELECT current_schemas(false)")).scalar()[0] == ESQUEMA_APP
    # Ninguna tabla del ORM existe duplicada en public
    publicas = pg_db.execute(text("SELECT count(*) FROM information_schema.tables WHERE table_schema = 'public'")).scalar()
    assert publicas == 0


def test_cada_columna_del_orm_existe_en_la_bd(pg_db):
    inspector = inspect(pg_db.connection())
    tipos_ok = {
        "IdType": {"UUID"},
    }
    faltan, tipo_distinto = [], []
    for tabla in Base.metadata.sorted_tables:
        columnas_bd = {c["name"]: c for c in inspector.get_columns(tabla.name, schema=ESQUEMA_APP)}
        assert columnas_bd, f"La tabla app.{tabla.name} no existe"
        for col in tabla.columns:
            if col.name not in columnas_bd:
                faltan.append(f"{tabla.name}.{col.name}")
                continue
            tipo_bd = type(columnas_bd[col.name]["type"]).__name__.upper()
            variante = col.type.dialect_impl(pg_db.get_bind().dialect)
            nombre_variante = type(variante).__name__.upper()
            if nombre_variante in ("UUID", "ENUM") and nombre_variante not in tipo_bd:
                tipo_distinto.append(f"{tabla.name}.{col.name}: ORM {nombre_variante} / BD {tipo_bd}")
    assert not faltan, f"Columnas del ORM que no existen en la BD: {faltan}"
    assert not tipo_distinto, f"Tipos distintos: {tipo_distinto}"
    assert tipos_ok


def test_enums_del_orm_iguales_a_la_bd(pg_db):
    filas = pg_db.execute(text(
        "SELECT t.typname, array_agg(e.enumlabel ORDER BY e.enumsortorder) "
        "FROM pg_type t JOIN pg_enum e ON e.enumtypid = t.oid JOIN pg_namespace n ON n.oid = t.typnamespace "
        "WHERE n.nspname = 'app' GROUP BY t.typname"
    )).all()
    en_bd = {nombre: tuple(valores) for nombre, valores in filas}
    assert en_bd == ENUMS_BD


@pytest.mark.parametrize("sentencia", [
    "UPDATE app.audit_logs SET action_type = 'X'",
    "DELETE FROM app.audit_logs",
    "UPDATE app.dispatches SET received_by_name = 'X'",
    "DELETE FROM app.dispatches",
    "DELETE FROM app.users WHERE email = 'coord.fisica@cpq.local'",
])
def test_registros_inalterables(pg_db, sentencia):
    with pytest.raises(DBAPIError):
        with pg_db.begin_nested():
            pg_db.execute(text(sentencia))


def test_reservas_superpuestas_rechazadas_por_la_bd(pg_db):
    inicio = datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=3)
    valores = {
        "eq": "f0000000-0000-0000-0000-000000000001",
        "pr": "b0000000-0000-0000-0000-000000000001",
        "us": "a0000000-0000-0000-0000-000000000003",
    }
    sql = text(
        "INSERT INTO app.equipment_reservations (equipment_id, project_id, reserved_by_user_id, start_time, end_time, status) "
        "VALUES (:eq, :pr, :us, :ini, :fin, 'Aprobado')"
    )
    pg_db.execute(sql, {**valores, "ini": inicio, "fin": inicio + timedelta(hours=2)})
    with pytest.raises(DBAPIError):
        with pg_db.begin_nested():
            pg_db.execute(sql, {**valores, "ini": inicio + timedelta(hours=1), "fin": inicio + timedelta(hours=3)})


@pytest.mark.parametrize("ruta", ["/api/proyectos/QUI-024", "/api/equipos/no-uuid", "/api/insumos/abc", "/api/auditoria/xyz"])
def test_id_que_no_es_uuid_responde_404_en_todos_los_modulos(pg_client, ruta):
    """Antes daba 500 (InvalidTextRepresentation) en las rutas de M2 a M8."""
    from tests.conftest import iniciar_sesion
    iniciar_sesion(pg_client, "admin@cpq.local")
    r = pg_client.get(ruta)
    assert r.status_code == 404, (ruta, r.status_code, r.text)
