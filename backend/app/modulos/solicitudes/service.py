"""Service layer for Module 5: Requests and Prioritization (F5.1 to F5.7, RN-03, RN-07)."""

import uuid
from datetime import datetime, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple, Dict, Any

from fastapi import HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session, joinedload

from app.auditoria.service import record_audit_log
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.modulos.usuarios.models import (
    User,
    Project,
    Item,
    Batch,
    Request,
    RequestItem,
)
from app.modulos.proyectos.service import recalculate_project_metrics, get_project_metrics_snapshot
from app.modulos.solicitudes.schemas import (
    RequestCreate,
    RequestUpdate,
    DecisionRequest,
    ExecuteRequest,
    PriorityChangeRequest,
    RequestResponse,
    RequestDetailResponse,
    RequestItemResponse,
    ProjectMetricsResponse,
    PrioritizedProjectResponse,
    UserSummary,
)

TAG_DESCRIPCION = "[DESCRIPCION]"
TAG_RECHAZO = "[RECHAZO]"
TAG_APROBACION = "[APROBACION]"
TAG_EJECUCION = "[EJECUCION]"

PRIORITY_ORDER = {"Crítica": 0, "Alta": 1, "Media": 2, "Baja": 3}


# =============================================================================
# Helpers
# =============================================================================

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _round2(value: Decimal) -> Decimal:
    return value.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def _priority_case():
    return case(
        (Project.priority_level == "Crítica", 0),
        (Project.priority_level == "Alta", 1),
        (Project.priority_level == "Media", 2),
        (Project.priority_level == "Baja", 3),
        else_=4,
    )


def _append_section(decision_reason: Optional[str], tag: str, value: Optional[str]) -> Optional[str]:
    if not value:
        return decision_reason
    new_line = f"{tag} {value.strip()}"
    if decision_reason:
        return f"{decision_reason}\n{new_line}"
    return new_line


def _extract_description(decision_reason: Optional[str]) -> Optional[str]:
    if not decision_reason:
        return None
    for line in decision_reason.split("\n"):
        if line.startswith(TAG_DESCRIPCION):
            return line[len(TAG_DESCRIPCION):].strip()
    return None


def _replace_description(decision_reason: Optional[str], new_description: str) -> str:
    new_line = f"{TAG_DESCRIPCION} {new_description.strip()}"
    if not decision_reason:
        return new_line
    lines = decision_reason.split("\n")
    result: List[str] = []
    found = False
    for line in lines:
        if line.startswith(TAG_DESCRIPCION):
            result.append(new_line)
            found = True
        else:
            result.append(line)
    if not found:
        result.insert(0, new_line)
    return "\n".join(result)


def _get_latest_batch_unit_cost(db: Session, item_id: str) -> Decimal:
    batch = (
        db.query(Batch)
        .filter(Batch.item_id == item_id)
        .order_by(Batch.received_date.desc(), Batch.created_at.desc())
        .first()
    )
    if batch and batch.unit_cost is not None:
        return Decimal(str(batch.unit_cost))
    return Decimal("0.00")


def _validate_project_owned(project: Project, current_user: User) -> None:
    if project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No es el coordinador asignado a este proyecto.",
        )
    if project.operational_status == "Finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El proyecto está finalizado y no admite solicitudes nuevas.",
        )


def _validate_item_active(db: Session, item_id: str) -> Item:
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Insumo no encontrado: {item_id}.",
        )
    if not item.is_active:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail=f"El insumo '{item.name}' está desactivado y no puede solicitarse.",
        )
    return item


def _build_request_number(db: Session, request_type: str) -> str:
    prefix = "GAS" if request_type == "Gasto" else "RET"
    count = db.query(Request).filter(Request.request_type == request_type).count() + 1
    year = datetime.now(timezone.utc).year
    return f"{prefix}-{year}-{count:04d}"


def _get_request_or_404(db: Session, request_id: str) -> Request:
    request = (
        db.query(Request)
        .options(
            joinedload(Request.project),
            joinedload(Request.requester),
            joinedload(Request.decided_by),
            joinedload(Request.items).joinedload(RequestItem.item),
        )
        .filter(Request.id == request_id)
        .first()
    )
    if not request:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud no encontrada.",
        )
    return request


def _assert_request_visible(request: Request, current_user: User) -> None:
    if current_user.role in ("Administrador del Sistema", "Aprobador / Gestor de Inventario"):
        return
    if current_user.role == "Coordinador de Proyecto":
        if request.project and request.project.coordinator_id == current_user.id:
            return
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="No tiene acceso a esta solicitud.",
        )
    raise HTTPException(
        status_code=status.HTTP_403_FORBIDDEN,
        detail="No tiene acceso a esta solicitud.",
    )


def _build_item_response(req_item: RequestItem) -> RequestItemResponse:
    return RequestItemResponse(
        id=req_item.id,
        item_id=req_item.item_id,
        item_name=req_item.item.name if req_item.item else "—",
        unit_of_measure=req_item.item.unit_of_measure if req_item.item else "—",
        requested_quantity=req_item.requested_quantity,
        approved_quantity=req_item.approved_quantity,
        unit_cost_estimate=req_item.unit_cost_estimate,
    )


def _build_request_response(request: Request) -> RequestResponse:
    return RequestResponse(
        id=request.id,
        request_number=request.request_number,
        request_type=request.request_type,
        status=request.status,
        project_id=request.project_id,
        project_code=request.project.code if request.project else "",
        project_title=request.project.title if request.project else "",
        description=_extract_description(request.decision_reason),
        estimated_amount=request.estimated_amount,
        actual_amount=request.actual_amount,
        requester=UserSummary(
            id=request.requester.id,
            full_name=request.requester.full_name,
            email=request.requester.email,
        ),
        decided_by=UserSummary(
            id=request.decided_by.id,
            full_name=request.decided_by.full_name,
            email=request.decided_by.email,
        ) if request.decided_by else None,
        decided_at=request.decided_at,
        created_at=request.created_at,
        updated_at=request.updated_at,
    )


def _build_project_metrics(db: Session, project: Project) -> ProjectMetricsResponse:
    # Delega en M2 (solo lectura: el gasto sale de los movimientos, decisión 5).
    _, metrics = get_project_metrics_snapshot(db, project.id)
    return ProjectMetricsResponse(
        assigned_budget=project.assigned_budget,
        executed_budget=metrics["executed_budget"],
        execution_pct=metrics["execution_pct"],
        physical_progress_pct=metrics["physical_progress_pct"],
        physical_progress_available=metrics["physical_progress_available"],
    )


def _compute_estimated_amount(items_data) -> Decimal:
    total = Decimal("0.00")
    for it in items_data:
        qty = Decimal(str(it.requested_quantity))
        cost = Decimal(str(it.unit_cost_estimate or 0))
        total += qty * cost
    return _round2(total)


def _build_request_items(
    db: Session,
    items_data,
    request_type: str,
) -> List[RequestItem]:
    """Build RequestItem rows. For Retiro, auto-calculate unit_cost from latest batch."""
    rows: List[RequestItem] = []
    for it in items_data:
        _validate_item_active(db, it.item_id)
        if request_type == "Retiro":
            unit_cost = _get_latest_batch_unit_cost(db, it.item_id)
        else:
            unit_cost = Decimal(str(it.unit_cost_estimate or 0))
        rows.append(
            RequestItem(
                id=str(uuid.uuid4()),
                item_id=it.item_id,
                requested_quantity=it.requested_quantity,
                approved_quantity=None,
                unit_cost_estimate=unit_cost,
            )
        )
    return rows


# =============================================================================
# Requests CRUD (F5.1 to F5.3)
# =============================================================================

def list_requests(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None,
    request_type_filter: Optional[str] = None,
    project_id: Optional[str] = None,
) -> List[RequestResponse]:
    query = (
        db.query(Request)
        .options(
            joinedload(Request.project),
            joinedload(Request.requester),
            joinedload(Request.decided_by),
        )
    )

    if current_user.role == "Coordinador de Proyecto":
        query = query.join(Project).filter(
            Project.coordinator_id == current_user.id,
            Request.request_type.in_(["Gasto", "Retiro"]),
        )
    else:
        # Admin y Aprobador ven todos los tipos, incluidas reposiciones automáticas.
        pass

    if status_filter and status_filter != "Todos":
        query = query.filter(Request.status == status_filter)
    if request_type_filter and request_type_filter != "Todos":
        query = query.filter(Request.request_type == request_type_filter)
    if project_id:
        query = query.filter(Request.project_id == project_id)

    requests = query.order_by(Request.created_at.desc()).all()
    return [_build_request_response(r) for r in requests]


def create_request(
    db: Session,
    payload: RequestCreate,
    current_user: User,
    ip_address: str,
) -> RequestResponse:
    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proyecto no encontrado.",
        )
    _validate_project_owned(project, current_user)

    items = _build_request_items(db, payload.items, payload.request_type)
    estimated_amount = _compute_estimated_amount(items)

    request = Request(
        id=str(uuid.uuid4()),
        request_number=_build_request_number(db, payload.request_type),
        request_type=payload.request_type,
        project_id=project.id,
        requester_user_id=current_user.id,
        status="Borrador",
        estimated_amount=estimated_amount,
        actual_amount=Decimal("0.00"),
        decision_reason=_replace_description(None, payload.description),
    )
    db.add(request)
    db.flush()

    for row in items:
        row.request_id = request.id
        db.add(row)
    db.flush()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"REQUEST:{request.request_number}",
        action_type="REQUEST_CREATE",
        old_value=None,
        new_value={
            "id": request.id,
            "request_number": request.request_number,
            "request_type": request.request_type,
            "project_id": project.id,
            "status": request.status,
            "estimated_amount": str(estimated_amount),
            "items_count": len(items),
        },
        target_table="requests",
        target_id=request.id,
        justification=f"Creación de solicitud de {payload.request_type} (F5.1/F5.2)",
    )

    db.commit()
    db.refresh(request)
    return _build_request_response(request)


def get_request_detail(
    db: Session,
    request_id: str,
    current_user: User,
) -> RequestDetailResponse:
    request = _get_request_or_404(db, request_id)
    _assert_request_visible(request, current_user)

    metrics = _build_project_metrics(db, request.project)
    base = _build_request_response(request)

    return RequestDetailResponse(
        **base.model_dump(),
        items=[_build_item_response(i) for i in request.items],
        project_metrics=metrics,
    )


def update_request(
    db: Session,
    request_id: str,
    payload: RequestUpdate,
    current_user: User,
    ip_address: str,
) -> RequestResponse:
    request = _get_request_or_404(db, request_id)
    _assert_request_visible(request, current_user)

    if request.requester_user_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Solo el autor puede editar esta solicitud.",
        )
    if request.status != "Borrador":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se pueden editar solicitudes en Borrador. Estado actual: '{request.status}'.",
        )
    if request.request_type not in ("Gasto", "Retiro"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Las reposiciones automáticas no se editan desde M5.",
        )

    old_state = {
        "description": _extract_description(request.decision_reason),
        "estimated_amount": str(request.estimated_amount),
        "items_count": len(request.items),
    }

    if payload.description is not None:
        request.decision_reason = _replace_description(request.decision_reason, payload.description)

    if payload.items is not None:
        # Replace all items atomically.
        db.query(RequestItem).filter(RequestItem.request_id == request.id).delete()
        db.flush()
        new_rows = _build_request_items(db, payload.items, request.request_type)
        for row in new_rows:
            row.request_id = request.id
            db.add(row)
        db.flush()
        request.estimated_amount = _compute_estimated_amount(new_rows)

    request.updated_at = _now()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"REQUEST:{request.request_number}",
        action_type="REQUEST_UPDATE",
        old_value=old_state,
        new_value={
            "description": _extract_description(request.decision_reason),
            "estimated_amount": str(request.estimated_amount),
            "items_count": len(request.items),
        },
        target_table="requests",
        target_id=request.id,
        justification="Edición de solicitud en Borrador (F5.3)",
    )

    db.commit()
    db.refresh(request)
    return _build_request_response(request)


def submit_request(
    db: Session,
    request_id: str,
    current_user: User,
    ip_address: str,
) -> RequestResponse:
    request = _get_request_or_404(db, request_id)
    _assert_request_visible(request, current_user)

    if request.status != "Borrador":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se pueden enviar solicitudes en Borrador. Estado actual: '{request.status}'.",
        )
    if request.request_type not in ("Gasto", "Retiro"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Las reposiciones automáticas no se envían desde M5.",
        )
    if not request.items:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="La solicitud no tiene ítems y no puede enviarse.",
        )
    if request.project.operational_status == "Finalizado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="El proyecto está finalizado y no admite solicitudes nuevas.",
        )

    old_status = request.status
    request.status = "Pendiente de Aprobación"
    request.updated_at = _now()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"REQUEST:{request.request_number}",
        action_type="REQUEST_SUBMIT",
        old_value={"status": old_status},
        new_value={"status": request.status},
        target_table="requests",
        target_id=request.id,
        justification="Envío de solicitud a aprobación (F5.3, RN-03)",
    )

    db.commit()
    db.refresh(request)
    return _build_request_response(request)


# =============================================================================
# Decisions (F5.4, F5.5)
# =============================================================================

def approve_request(
    db: Session,
    request_id: str,
    payload: DecisionRequest,
    current_user: User,
    ip_address: str,
) -> RequestResponse:
    request = _get_request_or_404(db, request_id)

    if request.status != "Pendiente de Aprobación":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se pueden aprobar solicitudes Pendientes. Estado actual: '{request.status}'.",
        )

    # Apply optional downward adjustments
    if payload.adjustments:
        items_by_id = {i.id: i for i in request.items}
        for adj in payload.adjustments:
            item = items_by_id.get(adj.request_item_id)
            if not item:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=f"Ítem de solicitud no encontrado: {adj.request_item_id}.",
                )
            if adj.approved_quantity > item.requested_quantity:
                raise HTTPException(
                    status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                    detail=(
                        f"La cantidad aprobada no puede superar la solicitada "
                        f"(ítem {item.item.name}: solicitado {item.requested_quantity}, "
                        f"aprobado {adj.approved_quantity})."
                    ),
                )
            item.approved_quantity = adj.approved_quantity

    # Default: approved_quantity = requested_quantity for untouched items
    for item in request.items:
        if item.approved_quantity is None:
            item.approved_quantity = item.requested_quantity

    old_status = request.status
    request.status = "Aprobado"
    request.decided_by_user_id = current_user.id
    request.decided_at = _now()
    request.updated_at = _now()
    request.decision_reason = _append_section(request.decision_reason, TAG_APROBACION, payload.reason)
    avisar(db, request.requester_user_id, "ok", f"Aprobaron tu solicitud {request.request_number}",
           "/solicitudes", detalle=payload.reason)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"REQUEST:{request.request_number}",
        action_type="REQUEST_APPROVE",
        old_value={"status": old_status},
        new_value={"status": request.status, "reason": payload.reason},
        target_table="requests",
        target_id=request.id,
        justification="Aprobación de solicitud (F5.4)",
    )

    db.commit()
    db.refresh(request)
    return _build_request_response(request)


def reject_request(
    db: Session,
    request_id: str,
    payload: DecisionRequest,
    current_user: User,
    ip_address: str,
) -> RequestResponse:
    request = _get_request_or_404(db, request_id)

    if request.status != "Pendiente de Aprobación":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se pueden rechazar solicitudes Pendientes. Estado actual: '{request.status}'.",
        )

    if not payload.reason or not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="El motivo del rechazo es obligatorio.",
        )

    old_status = request.status
    request.status = "Rechazado"
    request.decided_by_user_id = current_user.id
    request.decided_at = _now()
    request.updated_at = _now()
    request.decision_reason = _append_section(request.decision_reason, TAG_RECHAZO, payload.reason)
    avisar(db, request.requester_user_id, "err", f"Rechazaron tu solicitud {request.request_number}",
           "/solicitudes", detalle=payload.reason)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"REQUEST:{request.request_number}",
        action_type="REQUEST_REJECT",
        old_value={"status": old_status},
        new_value={"status": request.status, "reason": payload.reason},
        target_table="requests",
        target_id=request.id,
        justification="Rechazo de solicitud (F5.4)",
    )

    db.commit()
    db.refresh(request)
    return _build_request_response(request)


def execute_request(
    db: Session,
    request_id: str,
    payload: ExecuteRequest,
    current_user: User,
    ip_address: str,
) -> RequestResponse:
    request = _get_request_or_404(db, request_id)

    if request.status != "Aprobado":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Solo se pueden ejecutar solicitudes Aprobadas. Estado actual: '{request.status}'.",
        )

    if request.request_type == "Retiro":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                "Las solicitudes de Retiro pasan a 'Ejecutado' con su despacho en el Módulo 6 "
                "(F5.5). No se ejecutan desde el Módulo 5."
            ),
        )

    old_status = request.status
    request.status = "Ejecutado"
    request.actual_amount = payload.actual_amount
    request.decided_by_user_id = request.decided_by_user_id or current_user.id
    if request.decided_at is None:
        request.decided_at = _now()
    request.updated_at = _now()
    execution_note = f"Monto real registrado: {payload.actual_amount}"
    if payload.notes:
        execution_note += f". {payload.notes}"
    request.decision_reason = _append_section(request.decision_reason, TAG_EJECUCION, execution_note)
    avisar(db, request.requester_user_id, "info", f"Se ejecutó el gasto {request.request_number}",
           "/solicitudes", detalle=execution_note)

    # Recalculate project metrics (D10): M2 expone recalculate_project_metrics.
    recalculate_project_metrics(db, request.project_id, commit=False)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"REQUEST:{request.request_number}",
        action_type="REQUEST_EXECUTE",
        old_value={"status": old_status, "actual_amount": str(request.actual_amount)},
        new_value={"status": request.status, "actual_amount": str(payload.actual_amount)},
        target_table="requests",
        target_id=request.id,
        justification="Ejecución de solicitud de gasto/reposición (F5.5)",
    )

    db.commit()
    db.refresh(request)
    return _build_request_response(request)


# =============================================================================
# Approver inbox (F5.4, D44)
# =============================================================================

def get_approver_inbox(
    db: Session,
    current_user: User,
) -> List[RequestResponse]:
    priority_case = _priority_case()
    requests = (
        db.query(Request)
        # outerjoin: las solicitudes de centro de costo general (reposición) no tienen proyecto (decisión 4)
        .outerjoin(Project, Request.project_id == Project.id)
        .options(
            joinedload(Request.project),
            joinedload(Request.requester),
            joinedload(Request.decided_by),
        )
        .filter(Request.status == "Pendiente de Aprobación")
        .order_by(priority_case.asc(), Request.created_at.asc())
        .all()
    )
    return [_build_request_response(r) for r in requests]


# =============================================================================
# Prioritization (F5.6, F5.7)
# =============================================================================

def list_prioritized_projects(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None,
) -> List[PrioritizedProjectResponse]:
    priority_case = _priority_case()
    query = db.query(Project).options(joinedload(Project.coordinator))

    if current_user.role == "Coordinador de Proyecto":
        query = query.filter(Project.coordinator_id == current_user.id)

    if status_filter:
        query = query.filter(Project.operational_status == status_filter)

    projects = query.order_by(priority_case.asc(), Project.code.asc()).all()

    result: List[PrioritizedProjectResponse] = []
    for p in projects:
        _, metrics = get_project_metrics_snapshot(db, p.id)
        result.append(
            PrioritizedProjectResponse(
                id=p.id,
                code=p.code,
                title=p.title,
                priority=p.priority_level,
                status=p.operational_status,
                coordinator=UserSummary(
                    id=p.coordinator.id,
                    full_name=p.coordinator.full_name,
                    email=p.coordinator.email,
                ) if p.coordinator else None,
                execution_pct=metrics["execution_pct"],
            )
        )
    return result


def change_project_priority(
    db: Session,
    project_id: str,
    payload: PriorityChangeRequest,
    current_user: User,
    ip_address: str,
) -> PrioritizedProjectResponse:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Proyecto no encontrado.",
        )

    old_priority = project.priority_level
    project.priority_level = payload.priority
    project.updated_at = _now()

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"PROJECT:{project.code}",
        action_type="PROJECT_PRIORITY_CHANGE",
        old_value={"priority": old_priority},
        new_value={"priority": project.priority_level},
        target_table="projects",
        target_id=project.id,
        justification=payload.justification,
    )

    db.commit()
    db.refresh(project)

    _, metrics = get_project_metrics_snapshot(db, project.id)
    return PrioritizedProjectResponse(
        id=project.id,
        code=project.code,
        title=project.title,
        priority=project.priority_level,
        status=project.operational_status,
        coordinator=UserSummary(
            id=project.coordinator.id,
            full_name=project.coordinator.full_name,
            email=project.coordinator.email,
        ) if project.coordinator else None,
        execution_pct=metrics["execution_pct"],
    )