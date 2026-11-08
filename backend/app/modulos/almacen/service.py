"""Service layer for Module 6: Warehouse and Immutable Outbound Log (F6.1 to F6.6)."""

import uuid
from datetime import datetime, date, timezone
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.modulos.usuarios.models import (
    Item,
    Batch,
    Dispatch,
    RawMaterialUsage,
    DispatchCorrection,
    Request,
    RequestItem,
    Project,
    User,
    Location,
    SystemParameter,
    AccountingPeriod,
)
from app.modulos.inventario.service import (
    get_system_param_int,
    evaluate_batch_expirations,
    check_and_create_replenishment,
)
from app.modulos.almacen.schemas import (
    BatchCreateRequest,
    BatchResponse,
    DispatchCreateRequest,
    DispatchResponse,
    WithdrawalRequestDispatchPreparation,
    WithdrawalItemDispatchSuggestion,
    SuggestedBatchForDispatch,
    RawMaterialUsageCreateRequest,
    RawMaterialUsageResponse,
    ProjectMaterialBalanceSummary,
    DispatchCorrectionCreateRequest,
    DispatchCorrectionReviewRequest,
    DispatchCorrectionResponse,
)


def _generate_sequential_number(db: Session, prefix: str, model_cls, column_attr) -> str:
    """Generate a clean human-readable sequential code like DES-0321 or L-0412."""
    count = db.query(func.count(column_attr)).scalar() or 0
    next_idx = count + 1
    return f"{prefix}-{next_idx:04d}"


# =============================================================================
# 1. F6.1: Batch Reception (HU-18)
# =============================================================================

def receive_batch(
    db: Session,
    payload: BatchCreateRequest,
    current_user: User,
    ip_address: str
) -> BatchResponse:
    """
    Register physical warehouse entry of a purchased batch (F6.1 | HU-18).
    - Validates active item and location.
    - Enforces RN-02: General consumables enter institutional stock without project assignment.
    - Warns and blocks on expired batch unless explicitly confirmed (HU-18).
    - Increases item current_stock atomically and resolves low-stock alert if applicable.
    - Records in transactional audit_log.
    """
    item = db.query(Item).filter(Item.id == payload.item_id).first()
    if not item or not item.is_active:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Insumo no encontrado o inactivo en el catálogo unificado."
        )

    location = db.query(Location).filter(Location.id == payload.location_id).first()
    if not location or not location.is_active:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="La ubicación seleccionada no existe o se encuentra inactiva."
        )

    # Expiration validation (HU-18)
    today = date.today()
    is_expired = False
    if payload.expiration_date:
        if payload.expiration_date < payload.received_date or payload.expiration_date < today:
            is_expired = True
            if not payload.force_expired_acceptance:
                raise HTTPException(
                    status_code=status.HTTP_400_BAD_REQUEST,
                    detail=(
                        f"La fecha de vencimiento ({payload.expiration_date.strftime('%d/%m/%Y')}) ya pasó. "
                        f"Un lote vencido no se registra: devuélvalo al proveedor o confirme explícitamente "
                        f"si se trata de un ingreso excepcional justificado."
                    )
                )

    alert_days = get_system_param_int(db, "batch_expiration_alert_days", default_val=30)
    exp_status = "Vigente"
    days_left = None
    if payload.expiration_date:
        days_left = (payload.expiration_date - today).days
        if payload.expiration_date < today:
            exp_status = "Vencido"
        elif days_left <= alert_days:
            exp_status = "Próximo a vencer"

    batch = Batch(
        id=str(uuid.uuid4()),
        item_id=item.id,
        location_id=location.id,
        batch_number=payload.batch_number.strip(),
        initial_quantity=payload.quantity,
        available_quantity=payload.quantity,
        unit_cost=payload.unit_cost,
        supplier=payload.supplier.strip() if payload.supplier else None,
        received_date=payload.received_date,
        expiration_date=payload.expiration_date,
        expiration_status=exp_status,
        created_at=datetime.now(timezone.utc),
    )
    db.add(batch)

    # Atomic stock increase (F3.3)
    old_stock = Decimal(str(item.current_stock))
    new_stock = old_stock + payload.quantity
    item.current_stock = new_stock
    item.updated_at = datetime.now(timezone.utc)

    # Optional association with expense request
    if payload.expense_request_id:
        req = db.query(Request).filter(Request.id == payload.expense_request_id).first()
        if req and req.request_type == "Gasto" and req.status == "Aprobado":
            # If matches, we can update actual_amount
            req.actual_amount = payload.quantity * payload.unit_cost
            req.updated_at = datetime.now(timezone.utc)

    # Audit log entry within same transaction
    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"LOTE:{batch.batch_number}:INSUMO:{item.name}",
        target_table="batches",
        target_id=batch.id,
        action_type="BATCH_RECEIVED",
        old_value={"item_current_stock": str(old_stock)},
        new_value={
            "batch_number": batch.batch_number,
            "quantity": str(payload.quantity),
            "unit_cost": str(payload.unit_cost),
            "supplier": batch.supplier,
            "expiration_date": str(batch.expiration_date) if batch.expiration_date else None,
            "item_current_stock": str(new_stock),
            "expense_request_id": payload.expense_request_id,
        },
        justification=f"Recepción física de lote de compra (F6.1 - HU-18)"
    )

    db.flush()

    return BatchResponse(
        id=batch.id,
        item_id=item.id,
        item_name=item.name,
        item_unit=item.unit_of_measure,
        location_id=location.id,
        location_name=location.name,
        batch_number=batch.batch_number,
        initial_quantity=batch.initial_quantity,
        available_quantity=batch.available_quantity,
        unit_cost=batch.unit_cost,
        supplier=batch.supplier,
        received_date=batch.received_date,
        expiration_date=batch.expiration_date,
        expiration_status=batch.expiration_status,
        days_until_expiration=days_left,
        is_blocked_for_dispatch=bool(batch.expiration_status == "Vencido"),
        created_at=batch.created_at,
    )


# =============================================================================
# 2. F6.2: Dispatch Preparation & Suggestions (FEFO)
# =============================================================================

def get_withdrawal_dispatch_preparation(
    db: Session,
    request_id: str,
    current_user: User
) -> WithdrawalRequestDispatchPreparation:
    """
    Prepare dispatch screen for an approved withdrawal request (F6.2 | HU-19).
    Suggests batches using FEFO (First-Expired, First-Out).
    Strictly flags expired batches as blocked.
    """
    evaluate_batch_expirations(db)

    req = db.query(Request).filter(Request.id == request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    if req.request_type != "Retiro":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La solicitud es de tipo '{req.request_type}', solo las solicitudes de 'Retiro' se despachan."
        )

    if req.status != "Aprobado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Solo se pueden despachar solicitudes en estado 'Aprobado' (estado actual: '{req.status}')."
        )

    # Scoping check for coordinators (RN-07)
    if current_user.role == "Coordinador de Proyecto" and req.project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Solo puede consultar solicitudes de sus proyectos asignados."
        )

    today = date.today()
    item_suggestions: List[WithdrawalItemDispatchSuggestion] = []

    for r_item in req.items:
        it = r_item.item
        # Query active batches with available stock > 0
        batches = db.query(Batch).filter(
            Batch.item_id == it.id,
            Batch.available_quantity > Decimal("0.000")
        ).all()

        # Sort FEFO:
        # Batches with expiration_date sorted ascending (earliest expiry first)
        # Batches without expiration sorted by received_date ascending
        sorted_batches = sorted(
            batches,
            key=lambda b: (
                0 if b.expiration_date else 1,
                b.expiration_date or date.max,
                b.received_date
            )
        )

        batch_list: List[SuggestedBatchForDispatch] = []
        first_valid_selected = False

        for b in sorted_batches:
            is_blocked = bool(b.expiration_status == "Vencido" or (b.expiration_date and b.expiration_date < today))
            days_left = (b.expiration_date - today).days if b.expiration_date else None

            # First non-blocked batch with stock is suggested
            is_sug = False
            if not is_blocked and not first_valid_selected:
                is_sug = True
                first_valid_selected = True

            batch_list.append(
                SuggestedBatchForDispatch(
                    batch_id=b.id,
                    batch_number=b.batch_number,
                    location_name=b.location.name if b.location else "Sin ubicación",
                    available_quantity=b.available_quantity,
                    unit_cost=b.unit_cost,
                    expiration_date=b.expiration_date,
                    expiration_status=b.expiration_status,
                    days_until_expiration=days_left,
                    is_suggested=is_sug,
                    is_blocked=is_blocked,
                )
            )

        item_suggestions.append(
            WithdrawalItemDispatchSuggestion(
                item_id=it.id,
                item_name=it.name,
                unit_of_measure=it.unit_of_measure,
                requested_quantity=r_item.requested_quantity,
                approved_quantity=r_item.approved_quantity or r_item.requested_quantity,
                available_batches=batch_list,
            )
        )

    return WithdrawalRequestDispatchPreparation(
        request_id=req.id,
        request_number=req.request_number,
        project_id=req.project.id,
        project_code=req.project.code,
        project_title=req.project.title,
        requester_name=req.requester.full_name if req.requester else "Usuario",
        status=req.status,
        items=item_suggestions,
    )


# =============================================================================
# 3. F6.2 & F6.3: Atomic Dispatch Execution (HU-19, RNF-10, RNF-11)
# =============================================================================

def execute_dispatch(
    db: Session,
    payload: DispatchCreateRequest,
    current_user: User,
    ip_address: str
) -> List[DispatchResponse]:
    """
    Execute physical warehouse exit of supplies for an approved withdrawal (F6.2, F6.3).
    - Re-validates batch expiration (strict blocking of expired batches).
    - Deducts available_quantity and current_stock atomically (RNF-10).
    - Inserts immutable Dispatch records (RNF-11).
    - Updates Project executed_budget (F2.7).
    - Transitions Request status from 'Aprobado' to 'Ejecutado' (RN-03).
    - Evaluates min_stock and creates auto-replenishment draft if needed (F3.4, F3.5).
    - Records in audit_log.
    """
    evaluate_batch_expirations(db)

    req = db.query(Request).filter(Request.id == payload.request_id).first()
    if not req:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud no encontrada.")

    if req.status != "Aprobado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La solicitud debe estar en estado 'Aprobado' para poder despacharse (estado: '{req.status}')."
        )

    project = req.project
    today = date.today()

    # Bloqueo de movimientos en períodos cerrados (F7.2)
    closed_period = db.query(AccountingPeriod).filter(
        AccountingPeriod.status.in_(["Cerrado", "Prorrateado"]),
        AccountingPeriod.start_date <= today,
        AccountingPeriod.end_date >= today,
    ).first()
    if closed_period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No se pueden registrar despachos con fecha {today.strftime('%d/%m/%Y')}: "
                f"el período contable '{closed_period.period_name}' "
                f"({closed_period.start_date.strftime('%d/%m/%Y')} al {closed_period.end_date.strftime('%d/%m/%Y')}) "
                f"ya se encuentra cerrado (F7.2)."
            )
        )

    dispatches_created: List[Dispatch] = []
    total_dispatched_cost = Decimal("0.00")

    for alloc in payload.allocations:
        batch = db.query(Batch).filter(Batch.id == alloc.batch_id).first()
        if not batch:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Lote con ID '{alloc.batch_id}' no encontrado."
            )

        # Strict block on expired batches (F3.6, HU-19)
        if batch.expiration_status == "Vencido" or (batch.expiration_date and batch.expiration_date < today):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Operación bloqueada: El lote '{batch.batch_number}' está vencido "
                    f"y no puede despacharse (F3.6 / HU-19)."
                )
            )

        # Quantity check
        if alloc.quantity > batch.available_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=(
                    f"Cantidad insuficiente en lote '{batch.batch_number}': "
                    f"disponible {batch.available_quantity}, solicitado {alloc.quantity}."
                )
            )

        item = batch.item
        old_batch_avail = Decimal(str(batch.available_quantity))
        old_item_stock = Decimal(str(item.current_stock))

        new_batch_avail = old_batch_avail - alloc.quantity
        new_item_stock = old_item_stock - alloc.quantity

        batch.available_quantity = new_batch_avail
        item.current_stock = new_item_stock
        item.updated_at = datetime.now(timezone.utc)

        # Cost calculation
        line_cost = alloc.quantity * batch.unit_cost
        total_dispatched_cost += line_cost

        # Generate unique dispatch number
        disp_num = _generate_sequential_number(db, "DES", Dispatch, Dispatch.id)

        dispatch_record = Dispatch(
            id=str(uuid.uuid4()),
            dispatch_number=disp_num,
            batch_id=batch.id,
            project_id=project.id,
            dispatched_quantity=alloc.quantity,
            unit_cost_snapshot=batch.unit_cost,
            dispatched_by=current_user.id,
            received_by_name=payload.received_by_name.strip(),
            request_id=req.id,
            is_compensatory=False,
            original_dispatch_id=None,
            dispatched_at=datetime.now(timezone.utc),
        )
        db.add(dispatch_record)
        dispatches_created.append(dispatch_record)

        # Immediate min_stock evaluation on depletion (F3.4, F3.5)
        if item.min_stock and item.min_stock > Decimal("0.000"):
            if new_item_stock < item.min_stock:
                check_and_create_replenishment(db, item, current_user.id, ip_address)

        # Record audit log per dispatch line
        record_audit_log(
            db=db,
            user_id=current_user.id,
            ip_address=ip_address,
            target_object=f"DESPACHO:{disp_num}:PROYECTO:{project.code}",
            target_table="dispatches",
            target_id=dispatch_record.id,
            action_type="DISPATCH_EXECUTED",
            old_value={"item_stock": str(old_item_stock), "batch_stock": str(old_batch_avail)},
            new_value={
                "dispatch_number": disp_num,
                "dispatched_quantity": str(alloc.quantity),
                "unit_cost": str(batch.unit_cost),
                "received_by": payload.received_by_name.strip(),
                "project_code": project.code,
                "item_stock": str(new_item_stock),
                "batch_stock": str(new_batch_avail),
            },
            justification=f"Despacho físico desde solicitud de retiro {req.request_number} (F6.2 - HU-19)"
        )

    # Project executed budget update (F2.7)
    old_proj_budget = Decimal(str(project.executed_budget or "0.00"))
    project.executed_budget = old_proj_budget + total_dispatched_cost
    project.updated_at = datetime.now(timezone.utc)

    # Request status update (Aprobado -> Ejecutado) (RN-03)
    req.status = "Ejecutado"
    req.actual_amount = total_dispatched_cost
    req.updated_at = datetime.now(timezone.utc)

    db.flush()

    # Build response list
    results = []
    for d in dispatches_created:
        b = d.batch
        it = b.item
        results.append(
            DispatchResponse(
                id=d.id,
                dispatch_number=d.dispatch_number,
                batch_id=d.batch_id,
                batch_number=b.batch_number,
                item_id=it.id,
                item_name=it.name,
                item_unit=it.unit_of_measure,
                project_id=project.id,
                project_code=project.code,
                project_title=project.title,
                dispatched_quantity=d.dispatched_quantity,
                unit_cost_snapshot=d.unit_cost_snapshot,
                total_cost=d.dispatched_quantity * d.unit_cost_snapshot,
                dispatched_by=current_user.id,
                dispatched_by_name=current_user.full_name,
                received_by_name=d.received_by_name,
                request_id=d.request_id,
                is_compensatory=d.is_compensatory,
                original_dispatch_id=d.original_dispatch_id,
                dispatched_at=d.dispatched_at,
            )
        )

    return results


# =============================================================================
# 4. F6.3: Immutable Outbound Log Query (RN-07)
# =============================================================================

def list_dispatches(
    db: Session,
    current_user: User,
    project_id: Optional[str] = None,
    from_date: Optional[date] = None,
    to_date: Optional[date] = None,
    search: Optional[str] = None,
) -> List[DispatchResponse]:
    """
    List immutable dispatches log with role scoping (RN-07, F6.3).
    - Admins and Approvers view all dispatches.
    - Project Coordinators only view dispatches belonging to their coordinated projects.
    """
    query = db.query(Dispatch).join(Project).join(Batch).join(Item)

    # Role scoping (RN-07)
    if current_user.role == "Coordinador de Proyecto":
        query = query.filter(Project.coordinator_id == current_user.id)

    if project_id and project_id != "Todos":
        query = query.filter(Dispatch.project_id == project_id)

    if from_date:
        query = query.filter(func.date(Dispatch.dispatched_at) >= from_date)

    if to_date:
        query = query.filter(func.date(Dispatch.dispatched_at) <= to_date)

    if search:
        s = f"%{search.strip().lower()}%"
        query = query.filter(
            or_(
                func.lower(Item.name).like(s),
                func.lower(Dispatch.dispatch_number).like(s),
                func.lower(Batch.batch_number).like(s),
                func.lower(Dispatch.received_by_name).like(s),
            )
        )

    dispatches = query.order_by(Dispatch.dispatched_at.desc()).all()
    results = []

    for d in dispatches:
        b = d.batch
        it = b.item
        proj = d.project
        dispatcher = d.dispatcher
        results.append(
            DispatchResponse(
                id=d.id,
                dispatch_number=d.dispatch_number,
                batch_id=d.batch_id,
                batch_number=b.batch_number,
                item_id=it.id if it else None,
                item_name=it.name if it else "Insumo",
                item_unit=it.unit_of_measure if it else "",
                project_id=proj.id,
                project_code=proj.code,
                project_title=proj.title,
                dispatched_quantity=d.dispatched_quantity,
                unit_cost_snapshot=d.unit_cost_snapshot,
                total_cost=d.dispatched_quantity * d.unit_cost_snapshot,
                dispatched_by=d.dispatched_by,
                dispatched_by_name=dispatcher.full_name if dispatcher else "Usuario",
                received_by_name=d.received_by_name,
                request_id=d.request_id,
                is_compensatory=d.is_compensatory,
                original_dispatch_id=d.original_dispatch_id,
                dispatched_at=d.dispatched_at,
            )
        )

    return results


# =============================================================================
# 5. F6.4: Raw Material Usage Reporting (HU-20)
# =============================================================================

def report_raw_material_usage(
    db: Session,
    payload: RawMaterialUsageCreateRequest,
    current_user: User,
    ip_address: str
) -> RawMaterialUsageResponse:
    """
    Record actual raw material consumed by project researchers (F6.4 | HU-20).
    - Compares usage against total dispatched to this project.
    - Warns/flags when usage exceeds dispatched quantities.
    - Records in audit_log.
    """
    dispatch = db.query(Dispatch).filter(Dispatch.id == payload.dispatch_id).first()
    if not dispatch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despacho no encontrado.")

    project = db.query(Project).filter(Project.id == payload.project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")

    if dispatch.project_id != project.id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El despacho seleccionado no corresponde al proyecto indicado."
        )

    # Scoping check for coordinators (RN-07)
    if current_user.role == "Coordinador de Proyecto" and project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Solo puede registrar uso para sus proyectos asignados."
        )

    # Calculate historical reported usage against this dispatch
    prior_usage_sum = db.query(
        func.coalesce(func.sum(RawMaterialUsage.quantity_used), 0)
    ).filter(
        RawMaterialUsage.dispatch_id == dispatch.id
    ).scalar() or Decimal("0.000")

    total_with_new = prior_usage_sum + payload.quantity_used
    dispatched_qty = dispatch.dispatched_quantity
    is_excess = total_with_new > dispatched_qty
    excess_qty = (total_with_new - dispatched_qty) if is_excess else Decimal("0.000")

    usage_record = RawMaterialUsage(
        id=str(uuid.uuid4()),
        dispatch_id=dispatch.id,
        project_id=project.id,
        reported_by_user_id=current_user.id,
        quantity_used=payload.quantity_used,
        waste_quantity=payload.waste_quantity,
        usage_date=payload.usage_date,
        notes=payload.notes.strip() if payload.notes else None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(usage_record)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"USO_MATERIA_PRIMA:PROYECTO:{project.code}:DESPACHO:{dispatch.dispatch_number}",
        target_table="raw_material_usages",
        target_id=usage_record.id,
        action_type="RAW_MATERIAL_USAGE_REPORTED",
        old_value={"prior_reported_used": str(prior_usage_sum)},
        new_value={
            "quantity_used": str(payload.quantity_used),
            "waste_quantity": str(payload.waste_quantity),
            "is_excess": is_excess,
            "excess_quantity": str(excess_qty),
            "usage_date": str(payload.usage_date),
            "notes": payload.notes,
        },
        justification="Registro de uso real de materia prima (F6.4 - HU-20)"
    )

    db.flush()

    item = dispatch.batch.item if dispatch.batch else None
    return RawMaterialUsageResponse(
        id=usage_record.id,
        dispatch_id=dispatch.id,
        dispatch_number=dispatch.dispatch_number,
        project_id=project.id,
        project_code=project.code,
        reported_by_user_id=current_user.id,
        reported_by_name=current_user.full_name,
        item_name=item.name if item else "Insumo",
        unit_of_measure=item.unit_of_measure if item else "",
        dispatched_quantity=dispatched_qty,
        quantity_used=payload.quantity_used,
        waste_quantity=payload.waste_quantity,
        usage_date=usage_record.usage_date,
        notes=usage_record.notes,
        is_excess_over_dispatched=is_excess,
        excess_quantity=excess_qty,
        created_at=usage_record.created_at,
    )


def get_project_material_balance(
    db: Session,
    project_id: str,
    current_user: User
) -> List[ProjectMaterialBalanceSummary]:
    """Summary balance of dispatched vs used raw material per item for a project (F6.4)."""
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")

    if current_user.role == "Coordinador de Proyecto" and project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Solo puede consultar balance de sus proyectos asignados."
        )

    # Dispatches for this project
    dispatches = db.query(Dispatch).filter(Dispatch.project_id == project.id).all()
    # Group by item
    items_map: Dict[str, Dict[str, Any]] = {}

    for d in dispatches:
        b = d.batch
        if not b or not b.item:
            continue
        it = b.item
        if it.id not in items_map:
            items_map[it.id] = {
                "item": it,
                "dispatched": Decimal("0.000"),
                "used": Decimal("0.000"),
                "waste": Decimal("0.000"),
            }
        items_map[it.id]["dispatched"] += d.dispatched_quantity

    # Usages for this project
    usages = db.query(RawMaterialUsage).filter(RawMaterialUsage.project_id == project.id).all()
    for u in usages:
        disp = u.dispatch if hasattr(u, "dispatch") else db.query(Dispatch).filter(Dispatch.id == u.dispatch_id).first()
        if disp and disp.batch and disp.batch.item:
            it_id = disp.batch.item.id
            if it_id in items_map:
                items_map[it_id]["used"] += u.quantity_used
                items_map[it_id]["waste"] += u.waste_quantity

    results = []
    for it_id, data in items_map.items():
        it = data["item"]
        disp_tot = data["dispatched"]
        used_tot = data["used"]
        waste_tot = data["waste"]
        diff = disp_tot - used_tot
        is_exc = used_tot > disp_tot
        exc_qty = (used_tot - disp_tot) if is_exc else Decimal("0.000")

        results.append(
            ProjectMaterialBalanceSummary(
                project_id=project.id,
                project_code=project.code,
                item_id=it.id,
                item_name=it.name,
                unit_of_measure=it.unit_of_measure,
                total_dispatched=disp_tot,
                total_used=used_tot,
                total_waste=waste_tot,
                remaining_unreported=diff if not is_exc else Decimal("0.000"),
                is_usage_exceeded=is_exc,
                excess_quantity=exc_qty,
            )
        )

    return results


# =============================================================================
# 6. F6.5 & F6.6: Compensatory Dispatch Corrections (RF-35, HU-21)
# =============================================================================

def request_dispatch_correction(
    db: Session,
    payload: DispatchCorrectionCreateRequest,
    current_user: User,
    ip_address: str
) -> DispatchCorrectionResponse:
    """
    Request a formal correction for a recorded dispatch (F6.5 | HU-21 | RF-35).
    - Justification is strictly mandatory.
    - Scoped to project coordinator (or system admin).
    - Prevents duplicates if a correction is already 'Pendiente'.
    """
    clean_justification = payload.justification.strip()
    if not clean_justification or len(clean_justification) < 5:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Debe indicar un motivo o justificación clara para la solicitud de corrección (mínimo 5 caracteres)."
        )

    orig_dispatch = db.query(Dispatch).filter(Dispatch.id == payload.original_dispatch_id).first()
    if not orig_dispatch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despacho original no encontrado.")

    # Scoping check for coordinators (RN-07)
    if current_user.role == "Coordinador de Proyecto" and orig_dispatch.project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Solo puede solicitar corrección de despachos asignados a sus proyectos."
        )

    # Check for existing pending correction
    existing = db.query(DispatchCorrection).filter(
        DispatchCorrection.original_dispatch_id == orig_dispatch.id,
        DispatchCorrection.status == "Pendiente"
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Ya existe una solicitud de corrección pendiente de revisión para este despacho."
        )

    correction = DispatchCorrection(
        id=str(uuid.uuid4()),
        original_dispatch_id=orig_dispatch.id,
        requested_by_user_id=current_user.id,
        reviewed_by_user_id=None,
        status="Pendiente",
        justification=clean_justification,
        correct_quantity=payload.correct_quantity,
        reviewed_at=None,
        created_at=datetime.now(timezone.utc),
    )
    db.add(correction)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"CORRECCION_DESPACHO:{orig_dispatch.dispatch_number}",
        target_table="dispatch_corrections",
        target_id=correction.id,
        action_type="DISPATCH_CORRECTION_REQUESTED",
        old_value={"original_quantity": str(orig_dispatch.dispatched_quantity)},
        new_value={
            "correct_quantity": str(payload.correct_quantity),
            "justification": clean_justification,
            "status": "Pendiente",
        },
        justification=f"Solicitud de corrección de despacho (F6.5 - HU-21)"
    )

    db.flush()

    diff = payload.correct_quantity - orig_dispatch.dispatched_quantity
    b = orig_dispatch.batch
    it = b.item if b else None

    return DispatchCorrectionResponse(
        id=correction.id,
        original_dispatch_id=orig_dispatch.id,
        original_dispatch_number=orig_dispatch.dispatch_number,
        project_id=orig_dispatch.project_id,
        project_code=orig_dispatch.project.code,
        item_name=it.name if it else "Insumo",
        unit_of_measure=it.unit_of_measure if it else "",
        original_quantity=orig_dispatch.dispatched_quantity,
        correct_quantity=correction.correct_quantity,
        quantity_difference=diff,
        requested_by_user_id=current_user.id,
        requested_by_name=current_user.full_name,
        reviewed_by_user_id=None,
        reviewed_by_name=None,
        status=correction.status,
        justification=correction.justification,
        compensatory_dispatch_id=None,
        compensatory_dispatch_number=None,
        reviewed_at=None,
        created_at=correction.created_at,
    )


def review_dispatch_correction(
    db: Session,
    correction_id: str,
    payload: DispatchCorrectionReviewRequest,
    current_user: User,
    ip_address: str
) -> DispatchCorrectionResponse:
    """
    Approve or deny a dispatch correction request (F6.6 | HU-21 | RF-35).
    - If denied: marks 'Denegado'; original dispatch remains intact.
    - If approved: creates linked compensatory dispatch with the adjustment quantity,
      adjusts batch and item stocks atomically, updates project budget execution, and marks 'Aprobado'.
    """
    correction = db.query(DispatchCorrection).filter(DispatchCorrection.id == correction_id).first()
    if not correction:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Solicitud de corrección no encontrada.")

    if correction.status != "Pendiente":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La corrección ya fue resuelta anteriormente (estado actual: '{correction.status}')."
        )

    orig_dispatch = db.query(Dispatch).filter(Dispatch.id == correction.original_dispatch_id).first()
    if not orig_dispatch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Despacho original asociado no encontrado.")

    now = datetime.now(timezone.utc)
    correction.reviewed_by_user_id = current_user.id
    correction.reviewed_at = now

    compensatory_dispatch = None
    diff = correction.correct_quantity - orig_dispatch.dispatched_quantity

    if not payload.approved:
        correction.status = "Denegado"
        record_audit_log(
            db=db,
            user_id=current_user.id,
            ip_address=ip_address,
            target_object=f"CORRECCION_DESPACHO:{orig_dispatch.dispatch_number}",
            target_table="dispatch_corrections",
            target_id=correction.id,
            action_type="DISPATCH_CORRECTION_DENIED",
            old_value={"status": "Pendiente"},
            new_value={"status": "Denegado", "review_notes": payload.review_notes},
            justification=f"Corrección rechazada por {current_user.role} (F6.6)"
        )
    else:
        # Approved: create compensatory movement
        correction.status = "Aprobado"
        batch = orig_dispatch.batch
        item = batch.item
        project = orig_dispatch.project

        # Adjustment to stock:
        # diff > 0 means original was understated -> more is deducted from batch/item
        # diff < 0 means original was overstated -> surplus is returned to batch/item
        if diff > 0 and diff > batch.available_quantity:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"No hay stock suficiente en el lote para aumentar el despacho en {diff} unidades."
            )

        batch.available_quantity = batch.available_quantity - diff
        item.current_stock = item.current_stock - diff
        item.updated_at = now

        # Project executed budget update
        cost_diff = diff * orig_dispatch.unit_cost_snapshot
        project.executed_budget = (project.executed_budget or Decimal("0.00")) + cost_diff
        project.updated_at = now

        # Create compensatory dispatch record (RNF-11 / RF-35)
        comp_disp_num = _generate_sequential_number(db, "DES", Dispatch, Dispatch.id)
        compensatory_dispatch = Dispatch(
            id=str(uuid.uuid4()),
            dispatch_number=comp_disp_num,
            batch_id=batch.id,
            project_id=project.id,
            dispatched_quantity=diff,  # Can be negative in compensatory context
            unit_cost_snapshot=orig_dispatch.unit_cost_snapshot,
            dispatched_by=current_user.id,
            received_by_name=orig_dispatch.received_by_name,
            request_id=orig_dispatch.request_id,
            is_compensatory=True,
            original_dispatch_id=orig_dispatch.id,
            dispatched_at=now,
        )
        db.add(compensatory_dispatch)

        record_audit_log(
            db=db,
            user_id=current_user.id,
            ip_address=ip_address,
            target_object=f"CORRECCION_DESPACHO:{comp_disp_num}:ORIGEN:{orig_dispatch.dispatch_number}",
            target_table="dispatches",
            target_id=compensatory_dispatch.id,
            action_type="DISPATCH_CORRECTION_APPROVED",
            old_value={
                "original_dispatch_id": orig_dispatch.id,
                "original_quantity": str(orig_dispatch.dispatched_quantity),
            },
            new_value={
                "compensatory_dispatch_id": compensatory_dispatch.id,
                "compensatory_dispatch_number": comp_disp_num,
                "quantity_adjustment": str(diff),
                "cost_adjustment": str(cost_diff),
                "review_notes": payload.review_notes,
            },
            justification=f"Aprobación de movimiento compensatorio de despacho (F6.6 - RF-35)"
        )

    db.flush()

    b = orig_dispatch.batch
    it = b.item if b else None
    requester = correction.requested_by if hasattr(correction, "requested_by") else db.query(User).filter(User.id == correction.requested_by_user_id).first()

    return DispatchCorrectionResponse(
        id=correction.id,
        original_dispatch_id=orig_dispatch.id,
        original_dispatch_number=orig_dispatch.dispatch_number,
        project_id=orig_dispatch.project_id,
        project_code=orig_dispatch.project.code,
        item_name=it.name if it else "Insumo",
        unit_of_measure=it.unit_of_measure if it else "",
        original_quantity=orig_dispatch.dispatched_quantity,
        correct_quantity=correction.correct_quantity,
        quantity_difference=diff,
        requested_by_user_id=correction.requested_by_user_id,
        requested_by_name=requester.full_name if requester else "Usuario",
        reviewed_by_user_id=current_user.id,
        reviewed_by_name=current_user.full_name,
        status=correction.status,
        justification=correction.justification,
        compensatory_dispatch_id=compensatory_dispatch.id if compensatory_dispatch else None,
        compensatory_dispatch_number=compensatory_dispatch.dispatch_number if compensatory_dispatch else None,
        reviewed_at=correction.reviewed_at,
        created_at=correction.created_at,
    )


def list_dispatch_corrections(
    db: Session,
    current_user: User,
    status_filter: Optional[str] = None
) -> List[DispatchCorrectionResponse]:
    """List dispatch corrections with role scoping (F6.5, F6.6)."""
    query = db.query(DispatchCorrection).join(Dispatch, DispatchCorrection.original_dispatch_id == Dispatch.id).join(Project)

    if current_user.role == "Coordinador de Proyecto":
        query = query.filter(Project.coordinator_id == current_user.id)

    if status_filter and status_filter != "Todos":
        query = query.filter(DispatchCorrection.status == status_filter)

    corrections = query.order_by(DispatchCorrection.created_at.desc()).all()
    results = []

    for c in corrections:
        disp = c.original_dispatch if hasattr(c, "original_dispatch") else db.query(Dispatch).filter(Dispatch.id == c.original_dispatch_id).first()
        proj = disp.project if disp else None
        b = disp.batch if disp else None
        it = b.item if b else None
        requester = db.query(User).filter(User.id == c.requested_by_user_id).first()
        reviewer = db.query(User).filter(User.id == c.reviewed_by_user_id).first() if c.reviewed_by_user_id else None

        # Find compensatory dispatch if exists
        comp_disp = db.query(Dispatch).filter(
            Dispatch.original_dispatch_id == disp.id,
            Dispatch.is_compensatory == True
        ).first() if disp else None

        diff = c.correct_quantity - (disp.dispatched_quantity if disp else Decimal("0"))

        results.append(
            DispatchCorrectionResponse(
                id=c.id,
                original_dispatch_id=c.original_dispatch_id,
                original_dispatch_number=disp.dispatch_number if disp else None,
                project_id=proj.id if proj else None,
                project_code=proj.code if proj else None,
                item_name=it.name if it else "Insumo",
                unit_of_measure=it.unit_of_measure if it else "",
                original_quantity=disp.dispatched_quantity if disp else Decimal("0"),
                correct_quantity=c.correct_quantity,
                quantity_difference=diff,
                requested_by_user_id=c.requested_by_user_id,
                requested_by_name=requester.full_name if requester else "Usuario",
                reviewed_by_user_id=c.reviewed_by_user_id,
                reviewed_by_name=reviewer.full_name if reviewer else None,
                status=c.status,
                justification=c.justification,
                compensatory_dispatch_id=comp_disp.id if comp_disp else None,
                compensatory_dispatch_number=comp_disp.dispatch_number if comp_disp else None,
                reviewed_at=c.reviewed_at,
                created_at=c.created_at,
            )
        )

    return results
