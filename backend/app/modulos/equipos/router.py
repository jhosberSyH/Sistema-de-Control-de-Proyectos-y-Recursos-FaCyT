"""FastAPI router for Module 4: Equipment and Reservations (F4.1 to F4.6)."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_role, get_client_ip
from app.modulos.usuarios.models import User
from app.modulos.equipos.schemas import (
    EquipmentCreate,
    EquipmentUpdate,
    EquipmentStatusUpdate,
    EquipmentResponse,
    EquipmentDetailResponse,
    EquipmentStatusChangeResponse,
    ReservationCreate,
    ReservationResponse,
    ReservationDecisionRequest,
    CalendarResponse,
    UsageCreate,
    UsageResponse,
)
from app.modulos.equipos import service

router = APIRouter(prefix="/equipos", tags=["Módulo 4: Equipos y Reservas"])

ROLE_ADMIN = ["Administrador del Sistema"]
ROLE_APPROVER = ["Aprobador / Gestor de Inventario"]
ROLE_COORDINATOR = ["Coordinador de Proyecto"]
ROLE_ALL_AUTH = [
    "Administrador del Sistema",
    "Aprobador / Gestor de Inventario",
    "Coordinador de Proyecto",
]


# =============================================================================
# Equipment catalog (F4.1, F4.2)
# =============================================================================

@router.get(
    "",
    response_model=List[EquipmentResponse],
    summary="List equipment catalog (F4.1)"
)
def list_equipments(
    search: Optional[str] = Query(None, description="Buscar por código o nombre"),
    status_filter: Optional[str] = Query(None, alias="estado", description="Filtrar por estado operacional"),
    location_id: Optional[str] = Query(None, description="Filtrar por ubicación"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.list_equipments(db, search, status_filter, location_id)


@router.post(
    "",
    response_model=EquipmentResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new equipment (F4.1)"
)
def create_equipment(
    payload: EquipmentCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.create_equipment(db, payload, current_user, client_ip)


@router.get(
    "/{equipment_id}",
    response_model=EquipmentDetailResponse,
    summary="Get equipment detail"
)
def get_equipment_detail(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.get_equipment_detail(db, equipment_id)


@router.put(
    "/{equipment_id}",
    response_model=EquipmentResponse,
    summary="Update equipment data (F4.1)"
)
def update_equipment(
    equipment_id: str,
    payload: EquipmentUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.update_equipment(db, equipment_id, payload, current_user, client_ip)


@router.patch(
    "/{equipment_id}/status",
    response_model=EquipmentStatusChangeResponse,
    summary="Change equipment operational status (F4.2)"
)
def change_equipment_status(
    equipment_id: str,
    payload: EquipmentStatusUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.change_equipment_status(db, equipment_id, payload, current_user, client_ip)


# =============================================================================
# Calendar and reservations (F4.3, F4.4, F4.5)
# =============================================================================

@router.get(
    "/{equipment_id}/calendario",
    response_model=CalendarResponse,
    summary="Get occupied ranges for an equipment (F4.4)"
)
def get_equipment_calendar(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.get_equipment_calendar(db, equipment_id)


@router.get(
    "/{equipment_id}/reservas",
    response_model=List[ReservationResponse],
    summary="List reservations for an equipment (F4.3)"
)
def list_equipment_reservations(
    equipment_id: str,
    status_filter: Optional[str] = Query(None, alias="estado", description="Filtrar por estado"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.list_equipment_reservations(db, equipment_id, current_user, status_filter)


@router.post(
    "/{equipment_id}/reservas",
    response_model=ReservationResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Create a reservation draft (F4.3)"
)
def create_reservation(
    equipment_id: str,
    payload: ReservationCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_COORDINATOR)),
):
    client_ip = get_client_ip(request)
    return service.create_reservation(db, equipment_id, payload, current_user, client_ip)


@router.post(
    "/reservas/{reservation_id}/enviar",
    response_model=ReservationResponse,
    summary="Submit a reservation draft to approval (F4.3)"
)
def submit_reservation(
    reservation_id: str,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_COORDINATOR + ROLE_ADMIN)),
):
    client_ip = get_client_ip(request)
    return service.submit_reservation(db, reservation_id, current_user, client_ip)


@router.post(
    "/reservas/{reservation_id}/aprobar",
    response_model=ReservationResponse,
    summary="Approve a pending reservation (F4.5)"
)
def approve_reservation(
    reservation_id: str,
    payload: ReservationDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_APPROVER)),
):
    client_ip = get_client_ip(request)
    return service.approve_reservation(db, reservation_id, payload, current_user, client_ip)


@router.post(
    "/reservas/{reservation_id}/rechazar",
    response_model=ReservationResponse,
    summary="Reject a pending reservation (F4.5)"
)
def reject_reservation(
    reservation_id: str,
    payload: ReservationDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_APPROVER)),
):
    client_ip = get_client_ip(request)
    return service.reject_reservation(db, reservation_id, payload, current_user, client_ip)


# =============================================================================
# Equipment usage (F4.6)
# =============================================================================

@router.get(
    "/{equipment_id}/usos",
    response_model=List[UsageResponse],
    summary="List equipment usages (F4.6)"
)
def list_equipment_usages(
    equipment_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH)),
):
    return service.list_equipment_usages(db, equipment_id, current_user)


@router.post(
    "/{equipment_id}/usos",
    response_model=UsageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register an equipment usage (F4.6)"
)
def register_usage(
    equipment_id: str,
    payload: UsageCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_COORDINATOR)),
):
    client_ip = get_client_ip(request)
    return service.register_usage(db, equipment_id, payload, current_user, client_ip)