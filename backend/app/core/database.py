"""Database connection and session management."""

from typing import Generator
from sqlalchemy import create_engine, event, String
from sqlalchemy.dialects import postgresql
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from app.core.config import settings

ES_SQLITE = settings.DATABASE_URL.startswith("sqlite")
ES_POSTGRES = settings.DATABASE_URL.startswith("postgresql")

# Esquema donde viven las tablas en PostgreSQL (database/schema.sql)
ESQUEMA_APP = "app"

# Identificadores: UUID nativo en PostgreSQL (como en database/schema.sql),
# texto de 36 caracteres en SQLite (pruebas locales). En ambos casos Python ve str.
IdType = String(36).with_variant(postgresql.UUID(as_uuid=False), "postgresql")


# Valores de los tipos ENUM de database/schema.sql (única fuente: si cambian allá, cambian aquí)
ENUMS_BD = {
    "user_role": ("Administrador del Sistema", "Coordinador de Proyecto", "Aprobador / Gestor de Inventario"),
    "project_status": ("Propuesta", "En ejecución", "Suspendido", "Finalizado"),
    "project_priority": ("Crítica", "Alta", "Media", "Baja"),
    "item_type": ("Materia prima", "Consumible de proyecto", "Consumible de uso general"),
    "equipment_status": ("Disponible", "En uso", "En mantenimiento"),
    "workflow_status": ("Borrador", "Pendiente de Aprobación", "Aprobado", "Rechazado", "Ejecutado", "Cancelado"),
    "request_type": ("Gasto", "Retiro", "Reposición automática"),
    "cost_center": ("proyecto", "general"),
    "dispatch_direction": ("salida", "devolucion"),
    "batch_expiration_status": ("Vigente", "Próximo a vencer", "Vencido"),
    "correction_status": ("Pendiente", "Aprobado", "Denegado"),
    "period_type": ("Mensual", "Trimestral"),
    "period_status": ("Abierto", "En revisión", "Cerrado", "Prorrateado"),
    "proration_criterion": ("Proporcional", "Equitativo"),
}


def EnumBD(nombre: str, largo: int = 50):
    """Columna de texto en SQLite y tipo ENUM app.<nombre> en PostgreSQL.

    Sin esto, el dialecto psycopg envía los parámetros como ::VARCHAR y PostgreSQL
    rechaza la comparación "enum = character varying".
    """
    return String(largo).with_variant(
        postgresql.ENUM(*ENUMS_BD[nombre], name=nombre, schema=ESQUEMA_APP, create_type=False),
        "postgresql",
    )

# Engine configuration
connect_args = {}
if ES_SQLITE:
    connect_args["check_same_thread"] = False

engine = create_engine(
    settings.DATABASE_URL,
    connect_args=connect_args,
    pool_pre_ping=True
)

# Enable foreign keys for SQLite
if ES_SQLITE:
    @event.listens_for(engine, "connect")
    def set_sqlite_pragma(dbapi_connection, connection_record):
        cursor = dbapi_connection.cursor()
        cursor.execute("PRAGMA foreign_keys=ON")
        cursor.close()

# En PostgreSQL las tablas están en el esquema "app"; se fija el search_path en
# cada conexión nueva (compatible con el session pooler de Supabase).
if ES_POSTGRES:
    @event.listens_for(engine, "connect")
    def set_search_path(dbapi_connection, connection_record):
        autocommit = dbapi_connection.autocommit
        dbapi_connection.autocommit = True
        cursor = dbapi_connection.cursor()
        cursor.execute(f"SET search_path TO {ESQUEMA_APP}, public")
        cursor.close()
        dbapi_connection.autocommit = autocommit

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


def get_db() -> Generator[Session, None, None]:
    """Dependency that yields a database session and guarantees closure."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
