"""FastAPI router for Module 2: Projects and Advancement (F2.1 to F2.7)."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_role, get_client_ip
from app.modulos.usuarios.models import User
from app.modulos.proyectos.schemas import (
    ProjectCreate, ProjectUpdate, ProjectStatusUpdate, ProjectCoordinatorUpdate,
    ProjectResponse, ProjectDetailResponse, ProjectMetricsResponse,
    MilestoneCreate, MilestoneUpdate, MilestoneProgressCreate,
    MilestoneResponse, MilestoneProgressLogResponse,
)
from app.modulos.proyectos import service

router = APIRouter(prefix="/proyectos", tags=["Módulo 2: Proyectos y Avance"])

ROLE_ADMIN = ["Administrador del Sistema"]
ROLE_ALL_AUTH = [
    "Administrador del Sistema",
    "Aprobador / Gestor de Inventario",
    "Coordinador de Proyecto",
]


@router.get(
    "",
    response_model=List[ProjectResponse],
    summary="List projects (filtered by role, F2.1, F2.6, F2.7)"
)
def list_projects(
    status_filter: Optional[str] = Query(None, alias="estatus", description="Filtrar por estatus operativo"),
    priority_filter: Optional[str] = Query(None, alias="prioridad", description="Filtrar por prioridad"),
    search: Optional[str] = Query(None, description="Buscar por código o título"),
    coordinator_id: Optional[str] = Query(None, description="Filtrar por coordinador (solo admin/aprobador)"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.list_projects(db, current_user, status_filter, priority_filter, search, coordinator_id)


@router.post(
    "",
    response_model=ProjectResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new project (F2.1 | HU-03)"
)
def create_project(
    payload: ProjectCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.create_project(db, payload, current_user, client_ip)


@router.get(
    "/{project_id}",
    response_model=ProjectDetailResponse,
    summary="Get project detail with metrics (F2.6, F2.7)"
)
def get_project_detail(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.get_project_detail(db, project_id, current_user)


@router.put(
    "/{project_id}",
    response_model=ProjectResponse,
    summary="Update project title or budget (F2.1)"
)
def update_project(
    project_id: str,
    payload: ProjectUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.update_project(db, project_id, payload, current_user, client_ip)


@router.patch(
    "/{project_id}/status",
    response_model=ProjectResponse,
    summary="Change project operational status (F2.3 | HU-04)"
)
def change_project_status(
    project_id: str,
    payload: ProjectStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.change_project_status(db, project_id, payload, current_user, client_ip)


@router.patch(
    "/{project_id}/coordinator",
    response_model=ProjectResponse,
    summary="Assign coordinator to project (F2.2)"
)
def assign_coordinator(
    project_id: str,
    payload: ProjectCoordinatorUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.assign_coordinator(db, project_id, payload, current_user, client_ip)


@router.get(
    "/{project_id}/metrics",
    response_model=ProjectMetricsResponse,
    summary="Get project metrics (physical progress and budget execution)"
)
def get_project_metrics(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.get_project_metrics(db, project_id, current_user)


@router.get(
    "/{project_id}/milestones",
    response_model=List[MilestoneResponse],
    summary="List project milestones"
)
def list_milestones(
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.list_milestones(db, project_id, current_user)


@router.post(
    "/{project_id}/milestones",
    response_model=MilestoneResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a milestone (F2.4 | HU-05)"
)
def create_milestone(
    project_id: str,
    payload: MilestoneCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    client_ip = get_client_ip(request)
    return service.create_milestone(db, project_id, payload, current_user, client_ip)


@router.put(
    "/{project_id}/milestones/{milestone_id}",
    response_model=MilestoneResponse,
    summary="Update a milestone (F2.4)"
)
def update_milestone(
    project_id: str,
    milestone_id: str,
    payload: MilestoneUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    client_ip = get_client_ip(request)
    return service.update_milestone(db, project_id, milestone_id, payload, current_user, client_ip)


@router.post(
    "/{project_id}/milestones/{milestone_id}/progress",
    response_model=MilestoneProgressLogResponse,
    summary="Log milestone progress (F2.5 | HU-05)"
)
def log_milestone_progress(
    project_id: str,
    milestone_id: str,
    payload: MilestoneProgressCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    client_ip = get_client_ip(request)
    return service.log_milestone_progress(db, project_id, milestone_id, payload, current_user, client_ip)


@router.get(
    "/{project_id}/milestones/{milestone_id}/progress",
    response_model=List[MilestoneProgressLogResponse],
    summary="Get milestone progress history (F2.5)"
)
def get_milestone_progress_history(
    project_id: str,
    milestone_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.get_milestone_progress_history(db, project_id, milestone_id, current_user)