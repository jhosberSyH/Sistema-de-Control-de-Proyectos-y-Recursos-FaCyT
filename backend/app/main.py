"""FastAPI main application entrypoint."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.database import engine, Base, SessionLocal
from app.core.security import hash_password
from app.autenticacion.router import router as auth_router
from app.modulos.usuarios.router import router as usuarios_router
from app.modulos.usuarios.models import User, Location, SystemParameter, Project
from app.auditoria.service import record_audit_log


def init_default_data(db: Session):
    """Seed initial data if database is empty (local dev convenience)."""
    # 1. Admin user
    admin = db.query(User).filter(User.email == "admin@cpq.local").first()
    if not admin:
        admin = User(
            id="a0000000-0000-0000-0000-000000000001",
            full_name="José Rodríguez",
            email="admin@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Administrador del Sistema",
            is_active=True
        )
        db.add(admin)

        # Seed other roles for testing
        coord_bio = User(
            id="a0000000-0000-0000-0000-000000000004",
            full_name="María Fernanda Ochoa",
            email="coord.biologia@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Coordinador de Proyecto",
            is_active=True
        )
        coord_fis = User(
            id="a0000000-0000-0000-0000-000000000005",
            full_name="Andrés Salazar",
            email="coord.fisica@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Coordinador de Proyecto",
            is_active=True
        )
        approver = User(
            id="a0000000-0000-0000-0000-000000000002",
            full_name="Carmen Pérez",
            email="aprobador@cpq.local",
            password_hash=hash_password("Demo2026*"),
            role="Aprobador / Gestor de Inventario",
            is_active=True
        )
        db.add_all([coord_bio, coord_fis, approver])
        db.flush()

        # Seed sample projects attached to coordinators
        p1 = Project(
            id="b0000000-0000-0000-0000-000000000003",
            code="BIO-011",
            title="Bioensayos microbiológicos en aguas residuales",
            status="En ejecución",
            priority="Crítica",
            assigned_budget=12000.00,
            executed_budget=6800.00,
            coordinator_id=coord_bio.id
        )
        p2 = Project(
            id="b0000000-0000-0000-0000-000000000004",
            code="FIS-008",
            title="Caracterización óptica de películas delgadas",
            status="En ejecución",
            priority="Media",
            assigned_budget=6200.00,
            executed_budget=2900.00,
            coordinator_id=coord_fis.id
        )
        p3 = Project(
            id="b0000000-0000-0000-0000-000000000005",
            code="FIS-010",
            title="Modelado numérico de cavidades resonantes",
            status="En ejecución",
            priority="Baja",
            assigned_budget=3100.00,
            executed_budget=450.00,
            coordinator_id=coord_fis.id
        )
        db.add_all([p1, p2, p3])

    # 2. Locations
    if db.query(Location).count() == 0:
        locs = [
            Location(name="Depósito de reactivos A", description="Planta baja, ala de Química", is_active=True),
            Location(name="Depósito de reactivos B", description="Sótano, cuarto ventilado", is_active=True),
            Location(name="Cuarto frío de Biología", description="Refrigeración controlada entre 2 y 8 °C", is_active=True),
            Location(name="Congelador −20 °C", description="Laboratorio de Microbiología", is_active=True),
            Location(name="Gabinete de solventes inflamables", description="Pasillo de Química, gabinete certificado NFPA", is_active=True),
            Location(name="Almacén de consumibles generales", description="Planta baja, junto a recepción", is_active=True),
            Location(name="Estante temporal 3", description="Ubicación histórica usada durante la mudanza de 2025", is_active=False)
        ]
        db.add_all(locs)

    # 3. System Parameters (F1.5)
    p_exp = db.query(SystemParameter).filter(SystemParameter.parameter_key == "batch_expiration_alert_days").first()
    if not p_exp:
        p_exp = SystemParameter(
            parameter_key="batch_expiration_alert_days",
            parameter_value=30,
            label="Anticipación de la alerta de vencimiento",
            description="Un lote aparece como 'Próximo a vencer' cuando le quedan estos días o menos.",
            unit="días"
        )
        db.add(p_exp)

    p_disp = db.query(SystemParameter).filter(SystemParameter.parameter_key == "min_dispatch_history_months").first()
    if not p_disp:
        p_disp = SystemParameter(
            parameter_key="min_dispatch_history_months",
            parameter_value=3,
            label="Historial mínimo para mostrar el pronóstico",
            description="Con menos meses de despachos, la ficha del insumo indica 'Sin historial suficiente para pronosticar'.",
            unit="meses"
        )
        db.add(p_disp)

    record_audit_log(
        db=db,
        user_id=None,
        ip_address="127.0.0.1",
        target_object="SYSTEM",
        action_type="INITIAL_BOOTSTRAP",
        old_value=None,
        new_value={"status": "Initialized local development database"}
    )
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize database tables
    Base.metadata.create_all(bind=engine)
    db = SessionLocal()
    try:
        init_default_data(db)
    finally:
        db.close()
    yield


app = FastAPI(
    title=settings.APP_NAME,
    version="1.0.0",
    docs_url=f"{settings.API_PREFIX}/docs",
    openapi_url=f"{settings.API_PREFIX}/openapi.json",
    lifespan=lifespan
)

# CORS Middleware (supports local development with Vite)
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS + ["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount module routers under /api
app.include_router(auth_router, prefix=settings.API_PREFIX)
app.include_router(usuarios_router, prefix=settings.API_PREFIX)


@app.get("/api/health")
def health_check():
    """Health check endpoint."""
    return {"status": "ok", "environment": settings.APP_ENV}

