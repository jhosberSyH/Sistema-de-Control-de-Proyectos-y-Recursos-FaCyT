"""Service layer for Module 2: Projects and Advancement (F2.1 to F2.7, RN-05, RN-07)."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, joinedload

from app.auditoria.service import record_audit_log
from app.modulos.usuarios.models import (
    User, Project, ProjectMilestone, MilestoneProgressLog,
    Request, Dispatch, OverheadAllocation
)
from app.modulos.proyectos.schemas import (
    ProjectCreate, ProjectUpdate, ProjectStatusUpdate, ProjectCoordinatorUpdate,
    ProjectResponse, ProjectDetailResponse, ProjectMetricsResponse,
    MilestoneCreate, MilestoneUpdate, MilestoneProgressCreate,
    MilestoneResponse, MilestoneProgressLogResponse, UserSummary,
)


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _get_project_or_404(db: Session, project_id: str) -> Project:
    project = (
        db.query(Project)
        .options(joinedload(Project.coordinator))
        .filter(Project.id == project_id)
        .first()
    )
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")
    return project


def _get_milestone_or_404(db: Session, project_id: str, milestone_id: str) -> ProjectMilestone:
    milestone = (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.id == milestone_id, ProjectMilestone.project_id == project_id)
        .first()
    )
    if not milestone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Hito no encontrado para este proyecto.")
    return milestone


def _assert_project_access(project: Project, current_user: User) -> None:
    if current_user.role in ("Administrador del Sistema", "Aprobador / Gestor de Inventario"):
        return
    if current_user.role == "Coordinador de Proyecto" and project.coordinator_id == current_user.id:
        return
    raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="No tiene acceso a este proyecto.")


def _assert_coordinator_owns_project(project: Project, current_user: User) -> None:
    if current_user.role != "Coordinador de Proyecto":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el coordinador asignado puede realizar esta acción.",
        )
    if project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No es el coordinador asignado a este proyecto.",
        )


def _assert_project_editable(project: Project) -> None:
    # D3: Suspendido y Finalizado dejan los hitos en solo lectura
    if project.operational_status in ("Suspendido", "Finalizado"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"El proyecto está en estado '{project.operational_status}' y sus hitos son de solo lectura.",
        )


def _validate_weight_sum(
    db: Session,
    project_id: str,
    new_weight: Decimal,
    exclude_milestone_id: Optional[str] = None,
) -> Decimal:
    query = db.query(func.coalesce(func.sum(ProjectMilestone.weight), 0)).filter(
        ProjectMilestone.project_id == project_id
    )
    if exclude_milestone_id:
        query = query.filter(ProjectMilestone.id != exclude_milestone_id)
    existing_sum = Decimal(str(query.scalar() or 0))
    total = existing_sum + new_weight
    if total > Decimal("100"):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=(
                f"La suma de pesos no puede superar 100. "
                f"Suma actual: {existing_sum}, nuevo total: {total}."
            ),
        )
    return total


def _calculate_project_metrics(db: Session, project: Project) -> Dict[str, Any]:
    """Calculate metrics without modifying the database."""
    milestones = (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.project_id == project.id)
        .all()
    )
    total_weight = sum((m.weight for m in milestones), Decimal("0"))
    milestones_count = len(milestones)
    physical_progress_available = (total_weight == Decimal("100") and milestones_count > 0)

    if physical_progress_available:
        weighted_sum = sum((m.current_progress_pct * m.weight for m in milestones), Decimal("0"))
        physical_progress_pct = _round2(weighted_sum / Decimal("100"))
    else:
        physical_progress_pct = None

    requests_sum = (
        db.query(func.coalesce(func.sum(Request.actual_amount), 0))
        .filter(
            Request.project_id == project.id,
            Request.status == "Ejecutado",
            Request.request_type.in_(["Gasto", "Reposición automática"]),
        )
        .scalar()
    )
    dispatches_sum = (
        db.query(func.coalesce(func.sum(Dispatch.dispatched_quantity * Dispatch.unit_cost_snapshot), 0))
        .filter(Dispatch.project_id == project.id)
        .scalar()
    )
    overhead_sum = (
        db.query(func.coalesce(func.sum(OverheadAllocation.allocated_amount), 0))
        .filter(OverheadAllocation.project_id == project.id)
        .scalar()
    )
    executed_budget = (
        Decimal(str(requests_sum or 0))
        + Decimal(str(dispatches_sum or 0))
        + Decimal(str(overhead_sum or 0))
    )
    executed_budget = _round2(executed_budget)

    assigned_budget = Decimal(str(project.assigned_budget)) if project.assigned_budget else Decimal("0")
    if assigned_budget > 0:
        execution_pct = _round2((executed_budget / assigned_budget) * Decimal("100"))
    else:
        execution_pct = Decimal("0")

    return {
        "physical_progress_pct": physical_progress_pct,
        "physical_progress_available": physical_progress_available,
        "total_milestones_weight": total_weight,
        "milestones_count": milestones_count,
        "executed_budget": executed_budget,
        "execution_pct": execution_pct,
    }


def recalculate_project_metrics(
    db: Session, project_id: str, commit: bool = True
) -> Tuple[Project, Dict[str, Any]]:
    """Recalculate and persist project.physical_progress_pct and project.executed_budget."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")

    metrics = _calculate_project_metrics(db, project)
    if metrics["physical_progress_available"]:
        project.physical_progress_pct = metrics["physical_progress_pct"]
    else:
        project.physical_progress_pct = Decimal("0.00")
    project.executed_budget = metrics["executed_budget"]
    db.flush()

    if commit:
        db.commit()
        db.refresh(project)

    return project, metrics


def _build_project_response(db: Session, project: Project) -> ProjectResponse:
    metrics = _calculate_project_metrics(db, project)
    coordinator_summary = None
    if project.coordinator:
        coordinator_summary = UserSummary(
            id=project.coordinator.id,
            full_name=project.coordinator.full_name,
            email=project.coordinator.email,
        )
    return ProjectResponse(
        id=project.id,
        code=project.code,
        title=project.title,
        status=project.operational_status,
        priority=project.priority_level,
        assigned_budget=project.assigned_budget,
        executed_budget=metrics["executed_budget"],
        execution_pct=metrics["execution_pct"],
        physical_progress_pct=metrics["physical_progress_pct"],
        physical_progress_available=metrics["physical_progress_available"],
        coordinator=coordinator_summary,
        created_at=project.created_at,
        updated_at=project.updated_at,
    )


def _build_project_detail_response(
    db: Session, project: Project, metrics: Optional[Dict[str, Any]] = None
) -> ProjectDetailResponse:
    if metrics is None:
        metrics = _calculate_project_metrics(db, project)

    coordinator_summary = None
    if project.coordinator:
        coordinator_summary = UserSummary(
            id=project.coordinator.id,
            full_name=project.coordinator.full_name,
            email=project.coordinator.email,
        )

    return ProjectDetailResponse(
        id=project.id,
        code=project.code,
        title=project.title,
        status=project.operational_status,
        priority=project.priority_level,
        assigned_budget=project.assigned_budget,
        executed_budget=metrics["executed_budget"],
        execution_pct=metrics["execution_pct"],
        physical_progress_pct=metrics["physical_progress_pct"],
        physical_progress_available=metrics["physical_progress_available"],
        coordinator=coordinator_summary,
        created_at=project.created_at,
        updated_at=project.updated_at,
        total_milestones_weight=metrics["total_milestones_weight"],
        milestones_count=metrics["milestones_count"],
    )


def _build_milestone_response(milestone: ProjectMilestone) -> MilestoneResponse:
    return MilestoneResponse(
        id=milestone.id,
        project_id=milestone.project_id,
        name=milestone.name,
        description=milestone.description,
        weight=milestone.weight,
        current_progress_pct=milestone.current_progress_pct,
        target_date=milestone.target_date,
        completed_at=milestone.completed_at,
        created_at=milestone.created_at,
        updated_at=milestone.updated_at,
    )


def _build_progress_log_response(log: MilestoneProgressLog) -> MilestoneProgressLogResponse:
    reported_by = UserSummary(
        id=log.reported_by.id,
        full_name=log.reported_by.full_name,
        email=log.reported_by.email,
    ) if log.reported_by else None
    return MilestoneProgressLogResponse(
        id=log.id,
        milestone_id=log.milestone_id,
        reported_by=reported_by,
        previous_progress_pct=log.previous_progress_pct,
        new_progress_pct=log.new_progress_pct,
        notes=log.notes,
        reported_at=log.reported_at,
    )


# =============================================================================
# Project CRUD
# =============================================================================

def list_projects(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None,
    priority_filter: Optional[str] = None,
    search: Optional[str] = None,
    coordinator_id: Optional[str] = None,
) -> List[ProjectResponse]:
    query = db.query(Project).options(joinedload(Project.coordinator))

    if current_user.role == "Coordinador de Proyecto":
        query = query.filter(Project.coordinator_id == current_user.id)
    else:
        if coordinator_id:
            query = query.filter(Project.coordinator_id == coordinator_id)

    if status_filter:
        query = query.filter(Project.operational_status == status_filter)
    if priority_filter:
        query = query.filter(Project.priority_level == priority_filter)
    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Project.code).like(s),
                func.lower(Project.title).like(s),
            )
        )

    projects = query.order_by(Project.code.asc()).all()
    return [_build_project_response(db, p) for p in projects]


def create_project(
    db: Session,
    payload: ProjectCreate,
    current_user: User,
    ip_address: str,
) -> ProjectResponse:
    existing = (
        db.query(Project)
        .filter(func.lower(Project.code) == payload.code.lower())
        .first()
    )
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Ya existe un proyecto con el código '{existing.code}'.",
        )

    project = Project(
        id=str(uuid.uuid4()),
        code=payload.code,
        title=payload.title,
        operational_status="Propuesta",
        priority_level=payload.priority,
        assigned_budget=payload.assigned_budget,
        executed_budget=Decimal("0.00"),
        physical_progress_pct=Decimal("0.00"),
        coordinator_id=None,
    )
    db.add(project)
    db.flush()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"PROJECT:{project.code}",
        action_type="CREATE",
        old_value=None,
        new_value={
            "id": project.id,
            "code": project.code,
            "title": project.title,
            "status": project.operational_status,
            "priority": project.priority_level,
            "assigned_budget": str(project.assigned_budget),
        },
        target_table="projects",
        target_id=project.id,
        justification="Registro de proyecto (F2.1)",
    )

    db.commit()
    db.refresh(project)
    return _build_project_response(db, project)


def update_project(
    db: Session,
    project_id: str,
    payload: ProjectUpdate,
    current_user: User,
    ip_address: str,
) -> ProjectResponse:
    project = _get_project_or_404(db, project_id)
    old_state = {"title": project.title, "assigned_budget": str(project.assigned_budget)}

    if payload.title is not None:
        project.title = payload.title
    if payload.assigned_budget is not None:
        project.assigned_budget = payload.assigned_budget

    project.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"PROJECT:{project.code}",
        action_type="UPDATE",
        old_value=old_state,
        new_value={"title": project.title, "assigned_budget": str(project.assigned_budget)},
        target_table="projects",
        target_id=project.id,
        justification="Actualización de datos del proyecto (F2.1)",
    )

    recalculate_project_metrics(db, project_id, commit=False)
    db.commit()
    db.refresh(project)
    return _build_project_response(db, project)


def change_project_status(
    db: Session,
    project_id: str,
    payload: ProjectStatusUpdate,
    current_user: User,
    ip_address: str,
) -> ProjectResponse:
    project = _get_project_or_404(db, project_id)
    old_status = project.operational_status
    project.operational_status = payload.status
    project.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"PROJECT:{project.code}",
        action_type="STATUS_CHANGE",
        old_value={"status": old_status},
        new_value={"status": project.operational_status},
        target_table="projects",
        target_id=project.id,
        justification=f"Cambio de estatus operativo (F2.3): {old_status} -> {project.operational_status}",
    )

    recalculate_project_metrics(db, project_id, commit=False)
    db.commit()
    db.refresh(project)
    return _build_project_response(db, project)


def assign_coordinator(
    db: Session,
    project_id: str,
    payload: ProjectCoordinatorUpdate,
    current_user: User,
    ip_address: str,
) -> ProjectResponse:
    project = _get_project_or_404(db, project_id)
    coordinator = db.query(User).filter(User.id == payload.coordinator_id).first()

    if not coordinator:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Usuario coordinador no encontrado.")
    if coordinator.role != "Coordinador de Proyecto":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El usuario debe tener el rol 'Coordinador de Proyecto'.",
        )
    if not coordinator.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El usuario coordinador está desactivado.",
        )

    old_coordinator_id = project.coordinator_id
    project.coordinator_id = coordinator.id
    project.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"PROJECT:{project.code}",
        action_type="COORDINATOR_ASSIGNED",
        old_value={"coordinator_id": old_coordinator_id},
        new_value={"coordinator_id": coordinator.id, "coordinator_name": coordinator.full_name},
        target_table="projects",
        target_id=project.id,
        justification="Asignación de coordinador de proyecto (F2.2)",
    )

    db.commit()
    db.refresh(project)
    return _build_project_response(db, project)


def get_project_detail(
    db: Session,
    project_id: str,
    current_user: User,
) -> ProjectDetailResponse:
    project = _get_project_or_404(db, project_id)
    _assert_project_access(project, current_user)

    project, metrics = recalculate_project_metrics(db, project_id, commit=True)
    db.refresh(project)
    return _build_project_detail_response(db, project, metrics)


def get_project_metrics(
    db: Session,
    project_id: str,
    current_user: User,
) -> ProjectMetricsResponse:
    project = _get_project_or_404(db, project_id)
    _assert_project_access(project, current_user)

    project, metrics = recalculate_project_metrics(db, project_id, commit=True)
    db.refresh(project)

    return ProjectMetricsResponse(
        assigned_budget=project.assigned_budget,
        executed_budget=metrics["executed_budget"],
        execution_pct=metrics["execution_pct"],
        physical_progress_pct=metrics["physical_progress_pct"],
        physical_progress_available=metrics["physical_progress_available"],
        total_milestones_weight=metrics["total_milestones_weight"],
        milestones_count=metrics["milestones_count"],
    )


# =============================================================================
# Milestones
# =============================================================================

def list_milestones(
    db: Session,
    project_id: str,
    current_user: User,
) -> List[MilestoneResponse]:
    project = _get_project_or_404(db, project_id)
    _assert_project_access(project, current_user)

    milestones = (
        db.query(ProjectMilestone)
        .filter(ProjectMilestone.project_id == project_id)
        .order_by(ProjectMilestone.created_at.asc())
        .all()
    )
    return [_build_milestone_response(m) for m in milestones]


def create_milestone(
    db: Session,
    project_id: str,
    payload: MilestoneCreate,
    current_user: User,
    ip_address: str,
) -> MilestoneResponse:
    project = _get_project_or_404(db, project_id)
    _assert_coordinator_owns_project(project, current_user)
    _assert_project_editable(project)

    _validate_weight_sum(db, project_id, payload.weight)

    milestone = ProjectMilestone(
        id=str(uuid.uuid4()),
        project_id=project_id,
        name=payload.name,
        description=payload.description,
        weight=payload.weight,
        current_progress_pct=Decimal("0.00"),
        target_date=payload.target_date,
        completed_at=None,
    )
    db.add(milestone)
    db.flush()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"MILESTONE:{milestone.name}",
        action_type="MILESTONE_CREATE",
        old_value=None,
        new_value={
            "id": milestone.id,
            "project_id": project_id,
            "name": milestone.name,
            "weight": str(milestone.weight),
            "target_date": str(milestone.target_date) if milestone.target_date else None,
        },
        target_table="project_milestones",
        target_id=milestone.id,
        justification="Registro de hito (F2.4)",
    )

    recalculate_project_metrics(db, project_id, commit=False)
    db.commit()
    db.refresh(milestone)
    return _build_milestone_response(milestone)


def update_milestone(
    db: Session,
    project_id: str,
    milestone_id: str,
    payload: MilestoneUpdate,
    current_user: User,
    ip_address: str,
) -> MilestoneResponse:
    project = _get_project_or_404(db, project_id)
    _assert_coordinator_owns_project(project, current_user)
    _assert_project_editable(project)

    milestone = _get_milestone_or_404(db, project_id, milestone_id)

    old_state = {
        "name": milestone.name,
        "description": milestone.description,
        "weight": str(milestone.weight),
        "target_date": str(milestone.target_date) if milestone.target_date else None,
    }

    if payload.weight is not None:
        _validate_weight_sum(db, project_id, payload.weight, exclude_milestone_id=milestone_id)
        milestone.weight = payload.weight
    if payload.name is not None:
        milestone.name = payload.name
    if payload.description is not None:
        milestone.description = payload.description
    if payload.target_date is not None:
        milestone.target_date = payload.target_date

    milestone.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"MILESTONE:{milestone.name}",
        action_type="MILESTONE_UPDATE",
        old_value=old_state,
        new_value={
            "name": milestone.name,
            "description": milestone.description,
            "weight": str(milestone.weight),
            "target_date": str(milestone.target_date) if milestone.target_date else None,
        },
        target_table="project_milestones",
        target_id=milestone.id,
        justification="Actualización de hito (F2.4)",
    )

    recalculate_project_metrics(db, project_id, commit=False)
    db.commit()
    db.refresh(milestone)
    return _build_milestone_response(milestone)


def log_milestone_progress(
    db: Session,
    project_id: str,
    milestone_id: str,
    payload: MilestoneProgressCreate,
    current_user: User,
    ip_address: str,
) -> MilestoneProgressLogResponse:
    project = _get_project_or_404(db, project_id)
    _assert_coordinator_owns_project(project, current_user)
    _assert_project_editable(project)

    milestone = _get_milestone_or_404(db, project_id, milestone_id)
    previous = milestone.current_progress_pct
    new_progress = payload.progress_pct

    milestone.current_progress_pct = new_progress
    if new_progress == Decimal("100"):
        milestone.completed_at = datetime.now(timezone.utc)
    else:
        milestone.completed_at = None
    milestone.updated_at = datetime.now(timezone.utc)

    log = MilestoneProgressLog(
        id=str(uuid.uuid4()),
        milestone_id=milestone_id,
        reported_by_user_id=current_user.id,
        previous_progress_pct=previous,
        new_progress_pct=new_progress,
        notes=payload.notes,
        reported_at=datetime.now(timezone.utc),
    )
    db.add(log)
    db.flush()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"MILESTONE:{milestone.name}",
        action_type="MILESTONE_PROGRESS",
        old_value={"progress_pct": str(previous)},
        new_value={"progress_pct": str(new_progress), "notes": payload.notes},
        target_table="milestone_progress_logs",
        target_id=log.id,
        justification="Carga de avance de hito (F2.5)",
    )

    recalculate_project_metrics(db, project_id, commit=False)
    db.commit()
    db.refresh(log)
    return _build_progress_log_response(log)


def get_milestone_progress_history(
    db: Session,
    project_id: str,
    milestone_id: str,
    current_user: User,
) -> List[MilestoneProgressLogResponse]:
    project = _get_project_or_404(db, project_id)
    _assert_project_access(project, current_user)
    _get_milestone_or_404(db, project_id, milestone_id)

    logs = (
        db.query(MilestoneProgressLog)
        .options(joinedload(MilestoneProgressLog.reported_by))
        .filter(MilestoneProgressLog.milestone_id == milestone_id)
        .order_by(MilestoneProgressLog.reported_at.desc())
        .all()
    )
    return [_build_progress_log_response(l) for l in logs]