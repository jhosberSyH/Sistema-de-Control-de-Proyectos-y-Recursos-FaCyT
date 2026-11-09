"""FastAPI router for Module 8: Reports (F8.1 to F8.4)."""

from datetime import date
from typing import List, Literal, Optional

from fastapi import APIRouter, Depends, Query, Response
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_admin, require_role
from app.modulos.usuarios.models import User
from app.modulos.reportes.schemas import DashboardResponse
from app.modulos.reportes import service

router = APIRouter(prefix="/reportes", tags=["Módulo 8: Reportes"])

ROLE_ADMIN = ["Administrador del Sistema"]
ROLE_ADMIN_OR_APPROVER = ["Administrador del Sistema", "Aprobador / Gestor de Inventario"]
ROLE_ALL_AUTH = [
    "Administrador del Sistema",
    "Aprobador / Gestor de Inventario",
    "Coordinador de Proyecto",
]


@router.get(
    "/dashboard",
    response_model=DashboardResponse,
    summary="Executive dashboard (F8.1 | HU-24)",
)
def get_dashboard(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_admin),
):
    return service.get_dashboard(db)


@router.get(
    "/gastos",
    summary="Export expense analysis to PDF or Excel (F8.2 | HU-25)",
)
def get_expenses_report(
    formato: Literal["pdf", "excel"] = Query(..., description="Formato de exportación"),
    periodo_id: Optional[str] = Query(None, description="ID de período contable (opcional)"),
    fecha_inicio: Optional[date] = Query(None, description="Fecha de inicio (si no se usa periodo_id)"),
    fecha_fin: Optional[date] = Query(None, description="Fecha de fin (si no se usa periodo_id)"),
    proyecto_ids: Optional[List[str]] = Query(None, description="IDs de proyectos a incluir"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    content, filename, media_type = service.build_expenses_report(
        db, current_user, periodo_id, fecha_inicio, fecha_fin, proyecto_ids, formato
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/prorrateo",
    summary="Export proration summary to PDF or Excel (F8.3 | HU-25)",
)
def get_proration_report(
    formato: Literal["pdf", "excel"] = Query(..., description="Formato de exportación"),
    periodo_id: str = Query(..., description="ID de período contable prorrateado"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    content, filename, media_type = service.build_proration_report(
        db, current_user, periodo_id, formato
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get(
    "/equipos/{equipo_id}",
    summary="Export equipment history and usage to PDF or Excel (F8.4 | HU-25)",
)
def get_equipment_report(
    equipo_id: str,
    formato: Literal["pdf", "excel"] = Query(..., description="Formato de exportación"),
    fecha_inicio: date = Query(..., description="Fecha de inicio del rango"),
    fecha_fin: date = Query(..., description="Fecha de fin del rango"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    content, filename, media_type = service.build_equipment_report(
        db, current_user, equipo_id, fecha_inicio, fecha_fin, formato
    )
    return Response(
        content=content,
        media_type=media_type,
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )