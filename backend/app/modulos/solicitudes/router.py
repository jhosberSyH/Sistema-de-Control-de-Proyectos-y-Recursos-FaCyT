"""FastAPI router for Module 5: Requests and Prioritization (F5.1 to F5.7)."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_role, get_client_ip
from app.modulos.usuarios.models import User
from app.modulos.solicitudes.schemas import (
    RequestCreate,
    RequestUpdate,
    DecisionRequest,
    ExecuteRequest,
    RequestResponse,
    RequestDetailResponse,
    PriorityChangeRequest,
    PrioritizedProjectResponse,
)
from app.modulos.solicitudes import service

router = APIRouter(tags=["Módulo 5: Solicitudes y Priorización"])

ROLE_ADMIN = ["Administrador del Sistema"]
ROLE_APPROVER = ["Aprobador / Gestor de Inventario"]
ROLE_ADMIN_OR_APPROVER = ["Administrador del Sistema", "Aprobador / Gestor de Inventario"]
ROLE_COORDINATOR = ["Coordinador de Proyecto"]
ROLE_ALL_AUTH = [
    "Administrador del Sistema",
    "Aprobador / Gestor de Inventario",
    "Coordinador de Proyecto",
]


# =============================================================================
# Requests (F5.1, F5.2, F5.3)
# =============================================================================

@router.get(
    "/solicitudes",
    response_model=List[RequestResponse],
    summary="List requests (filtered by role, F5.1)"
)
def list_requests(
    status_filter: Optional[str] = Query(None, alias="estado", description="Filtrar por estado"),
    request_type_filter: Optional[str] = Query(None, alias="tipo", description="Filtrar por tipo"),
    project_id: Optional[str] = Query(None, description="Filtrar por proyecto"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.list_requests(db, current_user, status_filter, request_type_filter, project_id)


@router.post(
    "/solicitudes",
    response_model=RequestResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a request in Borrador (F5.1, F5.2)"
)
def create_request(
    payload: RequestCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_COORDINATOR)),
):
    client_ip = get_client_ip(request)
    return service.create_request(db, payload, current_user, client_ip)


# NOTA: este endpoint debe declararse ANTES de /solicitudes/{request_id}
@router.get(
    "/solicitudes/bandeja-aprobador",
    response_model=List[RequestResponse],
    summary="Approver inbox ordered by priority and age (F5.4)"
)
def get_approver_inbox(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN_OR_APPROVER)),
):
    return service.get_approver_inbox(db, current_user)


@router.get(
    "/solicitudes/{request_id}",
    response_model=RequestDetailResponse,
    summary="Get request detail with project metrics (F5.4, D45)"
)
def get_request_detail(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.get_request_detail(db, request_id, current_user)


@router.put(
    "/solicitudes/{request_id}",
    response_model=RequestResponse,
    summary="Edit a draft request (F5.3)"
)
def update_request(
    request_id: str,
    payload: RequestUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_COORDINATOR)),
):
    client_ip = get_client_ip(request)
    return service.update_request(db, request_id, payload, current_user, client_ip)


@router.post(
    "/solicitudes/{request_id}/enviar",
    response_model=RequestResponse,
    summary="Submit a draft request to approval (F5.3)"
)
def submit_request(
    request_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_COORDINATOR)),
):
    client_ip = get_client_ip(request)
    return service.submit_request(db, request_id, current_user, client_ip)


@router.post(
    "/solicitudes/{request_id}/aprobar",
    response_model=RequestResponse,
    summary="Approve a pending request (F5.4)"
)
def approve_request(
    request_id: str,
    payload: DecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_APPROVER)),
):
    client_ip = get_client_ip(request)
    return service.approve_request(db, request_id, payload, current_user, client_ip)


@router.post(
    "/solicitudes/{request_id}/rechazar",
    response_model=RequestResponse,
    summary="Reject a pending request (F5.4)"
)
def reject_request(
    request_id: str,
    payload: DecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_APPROVER)),
):
    client_ip = get_client_ip(request)
    return service.reject_request(db, request_id, payload, current_user, client_ip)


@router.post(
    "/solicitudes/{request_id}/ejecutar",
    response_model=RequestResponse,
    summary="Mark an approved expense request as executed (F5.5)"
)
def execute_request(
    request_id: str,
    payload: ExecuteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_APPROVER)),
):
    client_ip = get_client_ip(request)
    return service.execute_request(db, request_id, payload, current_user, client_ip)


# =============================================================================
# Prioritization (F5.6, F5.7)
# =============================================================================

@router.get(
    "/priorizacion/proyectos",
    response_model=List[PrioritizedProjectResponse],
    summary="List projects ordered by priority (F5.6)"
)
def list_prioritized_projects(
    status_filter: Optional[str] = Query(None, alias="estatus", description="Filtrar por estatus"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.list_prioritized_projects(db, current_user, status_filter)


@router.patch(
    "/priorizacion/proyectos/{project_id}",
    response_model=PrioritizedProjectResponse,
    summary="Change project priority with mandatory justification (F5.7)"
)
def change_project_priority(
    project_id: str,
    payload: PriorityChangeRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_APPROVER)),
):
    client_ip = get_client_ip(request)
    return service.change_project_priority(db, project_id, payload, current_user, client_ip)