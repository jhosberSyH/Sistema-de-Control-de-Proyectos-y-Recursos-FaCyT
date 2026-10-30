"""Business logic service for Module 1: Users, Locations and Parameters."""

from typing import List, Optional, Tuple, Dict, Any
from sqlalchemy.orm import Session
from sqlalchemy import func
from fastapi import HTTPException, status

from app.core.security import hash_password
from app.auditoria.service import record_audit_log
from app.modulos.usuarios.models import User, SessionModel, Location, SystemParameter, Project, Batch
from app.modulos.usuarios.schemas import (
    UserCreate,
    UserUpdate,
    UserStatusToggle,
    LocationCreate,
    LocationUpdate,
    SystemParameterUpdate
)


# =============================================================================
# Users Service (F1.1, F1.2, F1.3)
# =============================================================================

def list_users(
    db: Session,
    search: Optional[str] = None,
    role: Optional[str] = None,
    is_active: Optional[bool] = None,
    skip: int = 0,
    limit: int = 50
) -> Tuple[List[User], int]:
    """List users with optional search and filters."""
    query = db.query(User)

    if search:
        search_filter = f"%{search.strip().lower()}%"
        query = query.filter(
            func.lower(User.full_name).like(search_filter) |
            func.lower(User.email).like(search_filter)
        )

    if role and role != "Todos":
        query = query.filter(User.role == role)

    if is_active is not None:
        query = query.filter(User.is_active == is_active)

    total = query.count()
    users = query.order_by(User.full_name.asc()).offset(skip).limit(limit).all()
    return users, total


def get_user_by_id(db: Session, user_id: str) -> Optional[User]:
    """Retrieve user by UUID."""
    return db.query(User).filter(User.id == user_id).first()


def get_user_by_email(db: Session, email: str) -> Optional[User]:
    """Retrieve user by email address (case-insensitive)."""
    return db.query(User).filter(func.lower(User.email) == email.strip().lower()).first()


def create_user(
    db: Session,
    data: UserCreate,
    actor_id: Optional[str],
    ip_address: str
) -> User:
    """
    F1.1: Create user account with active status.
    Strict validation: prevent duplicate email, displaying the existing account details.
    """
    existing = get_user_by_email(db, data.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "message": f"El correo '{data.email}' ya pertenece a una cuenta registrada.",
                "existing_user": {
                    "id": existing.id,
                    "full_name": existing.full_name,
                    "email": existing.email,
                    "role": existing.role,
                    "is_active": existing.is_active
                }
            }
        )

    new_user = User(
        full_name=data.full_name.strip(),
        email=data.email.strip().lower(),
        password_hash=hash_password(data.password or "Demo2026*"),
        role=data.role,
        is_active=True
    )

    db.add(new_user)
    db.flush()  # Generate ID

    # Transactional Audit Log
    record_audit_log(
        db=db,
        user_id=actor_id,
        ip_address=ip_address,
        target_object=f"USER:{new_user.id}",
        action_type="USER_CREATED",
        old_value=None,
        new_value={
            "id": new_user.id,
            "full_name": new_user.full_name,
            "email": new_user.email,
            "role": new_user.role,
            "is_active": new_user.is_active
        }
    )

    db.commit()
    db.refresh(new_user)
    return new_user


def update_user(
    db: Session,
    user_id: str,
    data: UserUpdate,
    actor_id: Optional[str],
    ip_address: str
) -> User:
    """
    F1.2: Edit user details or role.
    Checks uniqueness of email.
    If role changes from 'Coordinador de Proyecto' to another role:
    checks for assigned projects and requires confirmation before reassigning.
    Invalidates active sessions upon role change.
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La cuenta de usuario no existe."
        )

    old_state = {
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active
    }

    # Validate email uniqueness if changing
    if data.email and data.email.strip().lower() != user.email.lower():
        existing = get_user_by_email(db, data.email)
        if existing and existing.id != user.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "message": f"El correo '{data.email}' ya pertenece a otra cuenta.",
                    "existing_user": {
                        "id": existing.id,
                        "full_name": existing.full_name,
                        "email": existing.email,
                        "role": existing.role
                    }
                }
            )
        user.email = data.email.strip().lower()

    if data.full_name:
        user.full_name = data.full_name.strip()

    # Role change logic and project coordinator impact
    role_changed = False
    if data.role and data.role != user.role:
        if user.role == "Coordinador de Proyecto":
            # Check assigned projects
            assigned_projects = db.query(Project).filter(Project.coordinator_id == user.id).all()
            if assigned_projects and not data.confirm_reassignment:
                affected = [
                    {"id": p.id, "code": p.code, "title": p.title, "status": p.status}
                    for p in assigned_projects
                ]
                codes = ", ".join([p.code for p in assigned_projects])
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "COORDINATOR_ROLE_CHANGE_IMPACT",
                        "message": f"Si cambias el rol, los proyectos ({codes}) quedarán sin coordinador.",
                        "affected_projects": affected,
                        "requires_confirmation": True
                    }
                )

            # If confirmed, unassign projects so they show in Admin tray for F2.2
            if assigned_projects and data.confirm_reassignment:
                for proj in assigned_projects:
                    proj.coordinator_id = None
                    record_audit_log(
                        db=db,
                        user_id=actor_id,
                        ip_address=ip_address,
                        target_object=f"PROJECT:{proj.id}",
                        action_type="COORDINATOR_UNASSIGNED",
                        old_value={"coordinator_id": user.id},
                        new_value={"coordinator_id": None, "reason": "Coordinator role changed"}
                    )

        user.role = data.role
        role_changed = True

        # Invalidate all active sessions for security (role takes effect on next action)
        db.query(SessionModel).filter(SessionModel.user_id == user.id).delete()

    new_state = {
        "full_name": user.full_name,
        "email": user.email,
        "role": user.role,
        "is_active": user.is_active
    }

    # Record transactional audit log
    record_audit_log(
        db=db,
        user_id=actor_id,
        ip_address=ip_address,
        target_object=f"USER:{user.id}",
        action_type="USER_UPDATED",
        old_value=old_state,
        new_value=new_state
    )

    db.commit()
    db.refresh(user)
    return user


def toggle_user_status(
    db: Session,
    user_id: str,
    data: UserStatusToggle,
    actor_id: Optional[str],
    ip_address: str
) -> User:
    """
    F1.3: Deactivate / Reactivate user (Strict logical deletion).
    If deactivating a Coordinator with active projects ('En ejecución'),
    warns with impact list unless confirmed.
    Deactivation immediately terminates active sessions and blocks login.
    """
    user = get_user_by_id(db, user_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="La cuenta de usuario no existe."
        )

    # Deactivating account
    if not data.is_active and user.is_active:
        if user.role == "Coordinador de Proyecto":
            active_projects = db.query(Project).filter(
                Project.coordinator_id == user.id,
                Project.status == "En ejecución"
            ).all()

            if active_projects and not data.confirm_deactivation:
                affected = [
                    {"id": p.id, "code": p.code, "title": p.title, "status": p.status}
                    for p in active_projects
                ]
                codes = ", ".join([p.code for p in active_projects])
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail={
                        "code": "DEACTIVATION_IMPACT",
                        "message": f"El usuario coordina {len(active_projects)} proyecto(s) activo(s) ({codes}) que requerirán reasignación.",
                        "affected_projects": affected,
                        "requires_confirmation": True
                    }
                )

        user.is_active = False
        # Cut off active sessions immediately
        db.query(SessionModel).filter(SessionModel.user_id == user.id).delete()

        action = "USER_DEACTIVATED"

    # Reactivating account
    elif data.is_active and not user.is_active:
        user.is_active = True
        action = "USER_REACTIVATED"
    else:
        return user

    record_audit_log(
        db=db,
        user_id=actor_id,
        ip_address=ip_address,
        target_object=f"USER:{user.id}",
        action_type=action,
        old_value={"is_active": not user.is_active},
        new_value={"is_active": user.is_active}
    )

    db.commit()
    db.refresh(user)
    return user


# =============================================================================
# Locations Service (F1.4)
# =============================================================================

def list_locations(db: Session, only_active: bool = False) -> List[Location]:
    """List storage locations with active batch count."""
    query = db.query(Location)
    if only_active:
        query = query.filter(Location.is_active == True)
    return query.order_by(Location.name.asc()).all()


def get_location_by_name(db: Session, name: str, only_active: bool = True) -> Optional[Location]:
    """Case-insensitive location lookup by trimmed name."""
    query = db.query(Location).filter(func.lower(func.trim(Location.name)) == name.strip().lower())
    if only_active:
        query = query.filter(Location.is_active == True)
    return query.first()


def create_location(
    db: Session,
    data: LocationCreate,
    actor_id: Optional[str],
    ip_address: str
) -> Location:
    """
    F1.4: Register new location.
    Enforces name uniqueness among active locations.
    """
    existing = get_location_by_name(db, data.name, only_active=True)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "field": "name",
                "message": f"Ya existe una ubicación activa con el nombre '{data.name}'. Usa otro nombre o edita la existente."
            }
        )

    loc = Location(
        name=data.name.strip(),
        description=data.description.strip() if data.description else None,
        is_active=data.is_active
    )
    db.add(loc)
    db.flush()

    record_audit_log(
        db=db,
        user_id=actor_id,
        ip_address=ip_address,
        target_object=f"LOCATION:{loc.id}",
        action_type="LOCATION_CREATED",
        old_value=None,
        new_value={"id": loc.id, "name": loc.name, "description": loc.description, "is_active": loc.is_active}
    )

    db.commit()
    db.refresh(loc)
    return loc


def update_location(
    db: Session,
    location_id: str,
    data: LocationUpdate,
    actor_id: Optional[str],
    ip_address: str
) -> Location:
    """
    F1.4: Update storage location.
    Validates active name uniqueness.
    """
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La ubicación no existe.")

    old_state = {"name": loc.name, "description": loc.description, "is_active": loc.is_active}

    target_name = data.name.strip() if data.name else loc.name
    target_active = data.is_active if data.is_active is not None else loc.is_active

    # Check uniqueness if active name changes or if activating a duplicate
    if target_active and (target_name.lower() != loc.name.lower() or target_active != loc.is_active):
        existing = get_location_by_name(db, target_name, only_active=True)
        if existing and existing.id != loc.id:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail={
                    "field": "name",
                    "message": f"Ya existe una ubicación activa con el nombre '{target_name}'."
                }
            )

    if data.name:
        loc.name = data.name.strip()
    if data.description is not None:
        loc.description = data.description.strip() or None
    if data.is_active is not None:
        loc.is_active = data.is_active

    new_state = {"name": loc.name, "description": loc.description, "is_active": loc.is_active}

    record_audit_log(
        db=db,
        user_id=actor_id,
        ip_address=ip_address,
        target_object=f"LOCATION:{loc.id}",
        action_type="LOCATION_UPDATED",
        old_value=old_state,
        new_value=new_state
    )

    db.commit()
    db.refresh(loc)
    return loc


def deactivate_or_delete_location(
    db: Session,
    location_id: str,
    actor_id: Optional[str],
    ip_address: str
) -> Dict[str, Any]:
    """
    F1.4: Referential integrity rule:
    A location associated with batches cannot be physically deleted; it must be deactivated.
    """
    loc = db.query(Location).filter(Location.id == location_id).first()
    if not loc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="La ubicación no existe.")

    batches_count = db.query(Batch).filter(Batch.location_id == loc.id).count()
    if batches_count > 0:
        # Cannot hard delete; deactivate
        loc.is_active = False
        record_audit_log(
            db=db,
            user_id=actor_id,
            ip_address=ip_address,
            target_object=f"LOCATION:{loc.id}",
            action_type="LOCATION_DEACTIVATED",
            old_value={"is_active": True},
            new_value={"is_active": False, "reason": "Has associated batches; deactivated"}
        )
        db.commit()
        return {
            "status": "deactivated",
            "message": "La ubicación tiene lotes asociados. No puede eliminarse físicamente, por lo que fue desactivada."
        }

    # If no batches exist, deactivate or allow safe purge
    loc.is_active = False
    record_audit_log(
        db=db,
        user_id=actor_id,
        ip_address=ip_address,
        target_object=f"LOCATION:{loc.id}",
        action_type="LOCATION_DEACTIVATED",
        old_value={"is_active": True},
        new_value={"is_active": False}
    )
    db.commit()
    return {"status": "deactivated", "message": "Ubicación desactivada exitosamente."}


# =============================================================================
# System Parameters Service (F1.5)
# =============================================================================

def list_system_parameters(db: Session) -> List[SystemParameter]:
    """Retrieve all configurable system parameters."""
    return db.query(SystemParameter).order_by(SystemParameter.parameter_key.asc()).all()


def get_system_parameter(db: Session, key: str) -> Optional[SystemParameter]:
    """Retrieve parameter by key."""
    return db.query(SystemParameter).filter(SystemParameter.parameter_key == key).first()


def update_system_parameter(
    db: Session,
    key: str,
    data: SystemParameterUpdate,
    actor_id: Optional[str],
    ip_address: str
) -> SystemParameter:
    """
    F1.5: Configure system parameter.
    Validates strictly positive integer (> 0).
    Applies immediately and records old_value & new_value in audit_log.
    """
    param = get_system_parameter(db, key)
    if not param:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"El parámetro '{key}' no existe en el sistema."
        )

    if data.parameter_value <= 0:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"field": key, "message": "Escribe un número entero mayor que cero (> 0)."}
        )

    old_value = param.parameter_value
    param.parameter_value = data.parameter_value
    param.updated_by_user_id = actor_id

    record_audit_log(
        db=db,
        user_id=actor_id,
        ip_address=ip_address,
        target_object=f"SYSTEM_PARAMETER:{param.parameter_key}",
        action_type="PARAMETER_UPDATED",
        old_value={"parameter_value": old_value},
        new_value={"parameter_value": param.parameter_value}
    )

    db.commit()
    db.refresh(param)
    return param

