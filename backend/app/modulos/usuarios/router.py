"""REST Router for Module 1: Users, Locations and System Parameters."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_admin, get_client_ip
from app.modulos.usuarios.models import User
from app.modulos.usuarios.schemas import (
    UserCreate,
    UserUpdate,
    UserResponse,
    UserStatusToggle,
    LocationCreate,
    LocationUpdate,
    LocationResponse,
    SystemParameterUpdate,
    SystemParameterResponse
)
from app.modulos.usuarios import service

router = APIRouter(prefix="", tags=["Módulo 1: Usuarios, Catálogos y Parámetros"])


# =============================================================================
# Users Endpoints (F1.1, F1.2, F1.3 - Role: Administrador del Sistema)
# =============================================================================

@router.get("/users", response_model=List[UserResponse])
def get_users(
    search: Optional[str] = Query(None, description="Búsqueda por nombre o correo"),
    role: Optional[str] = Query(None, description="Filtrar por rol"),
    is_active: Optional[bool] = Query(None, description="Filtrar por estado activo/desactivado"),
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=500),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.1 / F1.2: List user accounts with filters."""
    users, _ = service.list_users(
        db=db,
        search=search,
        role=role,
        is_active=is_active,
        skip=skip,
        limit=limit
    )

    result = []
    for u in users:
        proj_count = len(u.coordinated_projects) if u.coordinated_projects else 0
        resp = UserResponse(
            id=u.id,
            full_name=u.full_name,
            email=u.email,
            role=u.role,
            is_active=u.is_active,
            last_login_at=u.last_login_at,
            coordinated_projects_count=proj_count,
            created_at=u.created_at,
            updated_at=u.updated_at
        )
        result.append(resp)
    return result


@router.post("/users", response_model=UserResponse)
def create_new_user(
    payload: UserCreate,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.1: Create user account."""
    user = service.create_user(
        db=db,
        data=payload,
        actor_id=current_admin.id,
        ip_address=get_client_ip(request)
    )
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        coordinated_projects_count=0,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.get("/users/{user_id}", response_model=UserResponse)
def get_user_detail(
    user_id: str,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """Retrieve user details by ID."""
    user = service.get_user_by_id(db, user_id)
    if not user:
        from fastapi import HTTPException, status
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario no encontrado.")

    proj_count = len(user.coordinated_projects) if user.coordinated_projects else 0
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        coordinated_projects_count=proj_count,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.put("/users/{user_id}", response_model=UserResponse)
def update_user_account(
    user_id: str,
    payload: UserUpdate,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.2: Edit user details or role (with coordinator impact validation)."""
    user = service.update_user(
        db=db,
        user_id=user_id,
        data=payload,
        actor_id=current_admin.id,
        ip_address=get_client_ip(request)
    )
    proj_count = len(user.coordinated_projects) if user.coordinated_projects else 0
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        coordinated_projects_count=proj_count,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


@router.patch("/users/{user_id}/status", response_model=UserResponse)
def toggle_user_account_status(
    user_id: str,
    payload: UserStatusToggle,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.3: Deactivate / Reactivate user account (Strict logical deletion)."""
    user = service.toggle_user_status(
        db=db,
        user_id=user_id,
        data=payload,
        actor_id=current_admin.id,
        ip_address=get_client_ip(request)
    )
    proj_count = len(user.coordinated_projects) if user.coordinated_projects else 0
    return UserResponse(
        id=user.id,
        full_name=user.full_name,
        email=user.email,
        role=user.role,
        is_active=user.is_active,
        last_login_at=user.last_login_at,
        coordinated_projects_count=proj_count,
        created_at=user.created_at,
        updated_at=user.updated_at
    )


# =============================================================================
# Locations Endpoints (F1.4 - Role: Administrador del Sistema)
# =============================================================================

@router.get("/locations", response_model=List[LocationResponse])
def get_locations(
    only_active: bool = Query(False, description="Solo ubicaciones activas"),
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.4: List storage locations."""
    locations = service.list_locations(db, only_active=only_active)
    result = []
    for loc in locations:
        b_count = len(loc.batches) if loc.batches else 0
        result.append(
            LocationResponse(
                id=loc.id,
                name=loc.name,
                description=loc.description,
                is_active=loc.is_active,
                batches_count=b_count,
                created_at=loc.created_at,
                updated_at=loc.updated_at
            )
        )
    return result


@router.post("/locations", response_model=LocationResponse)
def create_new_location(
    payload: LocationCreate,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.4: Register storage location."""
    loc = service.create_location(
        db=db,
        data=payload,
        actor_id=current_admin.id,
        ip_address=get_client_ip(request)
    )
    return LocationResponse(
        id=loc.id,
        name=loc.name,
        description=loc.description,
        is_active=loc.is_active,
        batches_count=0,
        created_at=loc.created_at,
        updated_at=loc.updated_at
    )


@router.put("/locations/{location_id}", response_model=LocationResponse)
def update_existing_location(
    location_id: str,
    payload: LocationUpdate,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.4: Update storage location."""
    loc = service.update_location(
        db=db,
        location_id=location_id,
        data=payload,
        actor_id=current_admin.id,
        ip_address=get_client_ip(request)
    )
    b_count = len(loc.batches) if loc.batches else 0
    return LocationResponse(
        id=loc.id,
        name=loc.name,
        description=loc.description,
        is_active=loc.is_active,
        batches_count=b_count,
        created_at=loc.created_at,
        updated_at=loc.updated_at
    )


@router.delete("/locations/{location_id}")
def delete_location(
    location_id: str,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.4: Deactivate location (blocking physical delete if batches exist)."""
    return service.deactivate_or_delete_location(
        db=db,
        location_id=location_id,
        actor_id=current_admin.id,
        ip_address=get_client_ip(request)
    )


# =============================================================================
# System Parameters Endpoints (F1.5 - Role: Administrador del Sistema)
# =============================================================================

@router.get("/system-parameters", response_model=List[SystemParameterResponse])
def get_system_parameters(
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.5: List all configurable system parameters."""
    parameters = service.list_system_parameters(db)
    result = []
    for p in parameters:
        updater_name = p.updated_by.full_name if p.updated_by else None
        result.append(
            SystemParameterResponse(
                id=p.id,
                parameter_key=p.parameter_key,
                parameter_value=p.parameter_value,
                label=p.label,
                description=p.description,
                unit=p.unit,
                updated_by_user_id=p.updated_by_user_id,
                updated_by_name=updater_name,
                updated_at=p.updated_at
            )
        )
    return result


@router.put("/system-parameters/{key}", response_model=SystemParameterResponse)
def update_parameter(
    key: str,
    payload: SystemParameterUpdate,
    request: Request,
    current_admin: User = Depends(require_admin),
    db: Session = Depends(get_db)
):
    """F1.5: Configure system parameter (> 0 positive integer)."""
    p = service.update_system_parameter(
        db=db,
        key=key,
        data=payload,
        actor_id=current_admin.id,
        ip_address=get_client_ip(request)
    )
    updater_name = p.updated_by.full_name if p.updated_by else None
    return SystemParameterResponse(
        id=p.id,
        parameter_key=p.parameter_key,
        parameter_value=p.parameter_value,
        label=p.label,
        description=p.description,
        unit=p.unit,
        updated_by_user_id=p.updated_by_user_id,
        updated_by_name=updater_name,
        updated_at=p.updated_at
    )

