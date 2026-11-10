"""Service layer for Module 7: Accounting Period Closing & Overhead Proration (F7.1 to F7.4)."""

import uuid
from datetime import datetime, date, timezone
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Optional, Tuple, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import func, or_, and_
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.modulos.usuarios.models import (
    AccountingPeriod,
    PeriodProjectConfirmation,
    OverheadAllocation,
    Project,
    User,
    Batch,
    Item,
    Dispatch,
    Request,
)
from app.modulos.inventario.service import recalculate_consumption_forecasts
from app.modulos.prorrateo.schemas import (
    AccountingPeriodCreateRequest,
    AccountingPeriodResponse,
    AccountingPeriodCloseRequest,
    ProjectChargesReviewResponse,
    ProjectChargeDetail,
    PeriodConfirmationDashboardResponse,
    PeriodConfirmationSummaryItem,
    ProjectChargesConfirmRequest,
    ProrationPreviewResponse,
    ProrationProjectItem,
    ProrationExecuteRequest,
    OverheadAllocationResponse,
)


def _round_currency(val: Decimal) -> Decimal:
    """Round currency decimal to 2 decimal places using standard half-up rounding."""
    return val.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


# =============================================================================
# Validation Helpers: Period Overlap and Closed Date Blocking
# =============================================================================

def check_date_overlap_with_closed_period(
    db: Session,
    start_date: date,
    end_date: date,
    exclude_period_id: Optional[str] = None
) -> None:
    """
    Ensure the date range does not overlap with any closed or prorated period (HU-23).
    [start_date, end_date] overlaps with [p.start_date, p.end_date] when:
    start_date <= p.end_date AND end_date >= p.start_date
    """
    query = db.query(AccountingPeriod).filter(
        AccountingPeriod.status.in_(["Cerrado", "Prorrateado"]),
        AccountingPeriod.start_date <= end_date,
        AccountingPeriod.end_date >= start_date,
    )
    if exclude_period_id:
        query = query.filter(AccountingPeriod.id != exclude_period_id)

    conflicting = query.first()
    if conflicting:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"El rango seleccionado ({start_date.strftime('%d/%m/%Y')} al {end_date.strftime('%d/%m/%Y')}) "
                f"se cruza con el período cerrado '{conflicting.period_name}' "
                f"({conflicting.start_date.strftime('%d/%m/%Y')} al {conflicting.end_date.strftime('%d/%m/%Y')}). "
                f"Empiece el período después de la fecha final del período en conflicto."
            )
        )


def check_date_not_in_closed_period(
    db: Session,
    target_date: date,
    action_label: str = "la operación"
) -> None:
    """
    Block new dispatches, expense executions or corrections within a closed period (F7.2).
    """
    closed_period = db.query(AccountingPeriod).filter(
        AccountingPeriod.status.in_(["Cerrado", "Prorrateado"]),
        AccountingPeriod.start_date <= target_date,
        AccountingPeriod.end_date >= target_date,
    ).first()

    if closed_period:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"No se puede registrar {action_label} con fecha {target_date.strftime('%d/%m/%Y')}: "
                f"el período contable '{closed_period.period_name}' "
                f"({closed_period.start_date.strftime('%d/%m/%Y')} al {closed_period.end_date.strftime('%d/%m/%Y')}) "
                f"ya se encuentra cerrado (F7.2)."
            )
        )


# =============================================================================
# 1. F7.1: Period Opening and Confirmation Dashboard (HU-22)
# =============================================================================

def open_accounting_period_review(
    db: Session,
    payload: AccountingPeriodCreateRequest,
    current_user: User,
    ip_address: str
) -> AccountingPeriodResponse:
    """
    Open accounting period review and initialize coordinator confirmations (F7.1 | HU-22).
    - Validates no overlap with closed or prorated periods.
    - Calculates period overhead from general consumable batches if not supplied.
    - Initializes PeriodProjectConfirmation rows for active projects (RN-05).
    - Records in audit_log.
    """
    check_date_overlap_with_closed_period(db, payload.start_date, payload.end_date)

    # Determine overhead cost: if user explicitly provided a positive amount, use it;
    # otherwise sum purchase batches of 'Consumible de uso general' within [start_date, end_date] (RN-02)
    computed_overhead = Decimal("0.00")
    if payload.total_overhead_cost is not None and payload.total_overhead_cost > Decimal("0.00"):
        computed_overhead = payload.total_overhead_cost
    else:
        batches_overhead = db.query(
            func.coalesce(func.sum(Batch.initial_quantity * Batch.unit_cost), 0)
        ).join(Item, Batch.item_id == Item.id).filter(
            Item.item_type == "Consumible de uso general",
            Batch.received_date >= payload.start_date,
            Batch.received_date <= payload.end_date,
        ).scalar() or Decimal("0.00")
        computed_overhead = Decimal(str(batches_overhead))

    period = AccountingPeriod(
        id=str(uuid.uuid4()),
        period_name=payload.period_name.strip(),
        period_type=payload.period_type,
        start_date=payload.start_date,
        end_date=payload.end_date,
        status="En revisión",
        proration_criterion=None,
        total_overhead_cost=_round_currency(computed_overhead),
        closed_by_user_id=None,
        closed_at=None,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
    )
    db.add(period)
    db.flush()

    # Find active projects ('En ejecución' - RN-05) and create confirmation trackers
    active_projects = db.query(Project).filter(
        Project.operational_status == "En ejecución"
    ).all()

    for proj in active_projects:
        # If project has no coordinator, fallback to admin or current user
        coord_id = proj.coordinator_id or current_user.id
        conf = PeriodProjectConfirmation(
            id=str(uuid.uuid4()),
            period_id=period.id,
            project_id=proj.id,
            coordinator_user_id=coord_id,
            confirmed=False,
            confirmed_at=None,
            comments=None,
        )
        db.add(conf)
        avisar(db, proj.coordinator_id, "info", f"Confirma los cargos de {proj.code}",
               "/cierre/cargos", detalle=f"El período cierra el {period.end_date.strftime('%d/%m/%Y')}.")

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"PERIODO:{period.period_name}",
        target_table="accounting_periods",
        target_id=period.id,
        action_type="ACCOUNTING_PERIOD_OPENED_FOR_REVIEW",
        old_value=None,
        new_value={
            "period_name": period.period_name,
            "period_type": period.period_type,
            "start_date": str(period.start_date),
            "end_date": str(period.end_date),
            "total_overhead_cost": str(period.total_overhead_cost),
            "active_projects_count": len(active_projects),
        },
        justification="Apertura de período contable para revisión de cargos (F7.1 - HU-22)"
    )

    db.flush()
    return AccountingPeriodResponse.from_orm(period)


def get_period_confirmation_dashboard(
    db: Session,
    period_id: str,
    current_user: User
) -> PeriodConfirmationDashboardResponse:
    """
    Get approver dashboard with active projects confirmation progress (F7.1).
    """
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período contable no encontrado.")

    confirmations = db.query(PeriodProjectConfirmation).filter(
        PeriodProjectConfirmation.period_id == period.id
    ).all()

    summary_items: List[PeriodConfirmationSummaryItem] = []
    confirmed_count = 0

    for c in confirmations:
        proj = db.query(Project).filter(Project.id == c.project_id).first()
        coord = db.query(User).filter(User.id == c.coordinator_user_id).first()

        # Calculate charges count & total amount for this project in this period
        dispatches = db.query(Dispatch).filter(
            Dispatch.project_id == c.project_id,
            func.date(Dispatch.dispatched_at) >= period.start_date,
            func.date(Dispatch.dispatched_at) <= period.end_date,
        ).all()
        disp_amount = sum(d.signed_quantity * d.unit_cost_snapshot for d in dispatches)

        expenses = db.query(Request).filter(
            Request.project_id == c.project_id,
            Request.request_type == "Gasto",
            Request.status == "Ejecutado",
            func.date(Request.updated_at) >= period.start_date,
            func.date(Request.updated_at) <= period.end_date,
        ).all()
        exp_amount = sum(e.actual_amount for e in expenses)

        total_proj_charges = len(dispatches) + len(expenses)
        total_proj_amount = Decimal(str(disp_amount + exp_amount))

        if c.confirmed:
            confirmed_count += 1

        summary_items.append(
            PeriodConfirmationSummaryItem(
                project_id=c.project_id,
                project_code=proj.code if proj else "N/A",
                project_title=proj.title if proj else "Proyecto",
                coordinator_id=c.coordinator_user_id,
                coordinator_name=coord.full_name if coord else "Sin asignar",
                charges_count=total_proj_charges,
                total_amount=_round_currency(total_proj_amount),
                is_confirmed=c.confirmed,
                confirmed_at=c.confirmed_at,
            )
        )

    total_projs = len(summary_items)
    pct = _round_currency(Decimal(confirmed_count * 100) / Decimal(total_projs)) if total_projs > 0 else Decimal("0.00")

    return PeriodConfirmationDashboardResponse(
        period_id=period.id,
        period_name=period.period_name,
        period_type=period.period_type,
        start_date=period.start_date,
        end_date=period.end_date,
        status=period.status,
        total_active_projects=total_projs,
        confirmed_projects_count=confirmed_count,
        confirmation_percentage=pct,
        confirmations=summary_items,
    )


def get_project_charges_for_coordinator(
    db: Session,
    period_id: str,
    project_id: str,
    current_user: User
) -> ProjectChargesReviewResponse:
    """
    List direct charges for a project in a period (F7.1 | HU-22 | RN-07).
    - Scoped: coordinators only view their assigned projects.
    """
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período contable no encontrado.")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")

    # Scoping check (RN-07)
    if current_user.role == "Coordinador de Proyecto" and project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Solo puede revisar cargos de sus proyectos asignados."
        )

    # 1. Dispatches within period
    dispatches = db.query(Dispatch).filter(
        Dispatch.project_id == project.id,
        func.date(Dispatch.dispatched_at) >= period.start_date,
        func.date(Dispatch.dispatched_at) <= period.end_date,
    ).order_by(Dispatch.dispatched_at.asc()).all()

    charges: List[ProjectChargeDetail] = []
    total_amount = Decimal("0.00")

    for d in dispatches:
        b = d.batch
        it = b.item if b else None
        amt = _round_currency(d.signed_quantity * d.unit_cost_snapshot)
        total_amount += amt

        concept = f"{it.name if it else 'Insumo'} · {d.dispatched_quantity} {it.unit_of_measure if it else ''}"
        if d.is_compensatory:
            concept = f"Corrección de despacho · {d.dispatched_quantity} {it.unit_of_measure if it else ''}"

        charges.append(
            ProjectChargeDetail(
                id=d.id,
                charge_date=d.dispatched_at.date() if isinstance(d.dispatched_at, datetime) else d.dispatched_at,
                concept=concept,
                origin_type="Despacho",
                reference_code=d.dispatch_number,
                amount=amt,
                is_correction=d.is_compensatory,
                can_request_correction=not d.is_compensatory and period.status in ("Abierto", "En revisión"),
            )
        )

    # 2. Executed expense requests within period
    expenses = db.query(Request).filter(
        Request.project_id == project.id,
        Request.request_type == "Gasto",
        Request.status == "Ejecutado",
        func.date(Request.updated_at) >= period.start_date,
        func.date(Request.updated_at) <= period.end_date,
    ).order_by(Request.updated_at.asc()).all()

    for e in expenses:
        amt = _round_currency(e.actual_amount)
        total_amount += amt
        charges.append(
            ProjectChargeDetail(
                id=e.id,
                charge_date=e.updated_at.date() if isinstance(e.updated_at, datetime) else e.updated_at,
                concept=e.decision_reason or f"Solicitud de gasto {e.request_number}",
                origin_type="Gasto",
                reference_code=e.request_number,
                amount=amt,
                is_correction=False,
                can_request_correction=False,
            )
        )

    # Check confirmation status
    conf = db.query(PeriodProjectConfirmation).filter(
        PeriodProjectConfirmation.period_id == period.id,
        PeriodProjectConfirmation.project_id == project.id,
    ).first()

    coord = db.query(User).filter(User.id == project.coordinator_id).first() if project.coordinator_id else None

    return ProjectChargesReviewResponse(
        project_id=project.id,
        project_code=project.code,
        project_title=project.title,
        coordinator_name=coord.full_name if coord else "Sin asignar",
        is_confirmed=conf.confirmed if conf else False,
        confirmed_at=conf.confirmed_at if conf else None,
        comments=conf.comments if conf else None,
        total_charges_count=len(charges),
        total_amount=_round_currency(total_amount),
        charges=charges,
    )


def confirm_project_charges(
    db: Session,
    period_id: str,
    project_id: str,
    payload: ProjectChargesConfirmRequest,
    current_user: User,
    ip_address: str
) -> PeriodConfirmationSummaryItem:
    """
    Coordinator confirms charges for their assigned project (F7.1 | HU-22).
    """
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período contable no encontrado.")

    if period.status not in ("Abierto", "En revisión"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"No se pueden confirmar cargos en un período en estado '{period.status}'."
        )

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Proyecto no encontrado.")

    if current_user.role == "Coordinador de Proyecto" and project.coordinator_id != current_user.id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Acceso denegado: Solo puede confirmar cargos de sus proyectos asignados."
        )

    conf = db.query(PeriodProjectConfirmation).filter(
        PeriodProjectConfirmation.period_id == period.id,
        PeriodProjectConfirmation.project_id == project.id,
    ).first()

    if not conf:
        conf = PeriodProjectConfirmation(
            id=str(uuid.uuid4()),
            period_id=period.id,
            project_id=project.id,
            coordinator_user_id=current_user.id,
            confirmed=True,
            confirmed_at=datetime.now(timezone.utc),
            comments=payload.comments,
        )
        db.add(conf)
    else:
        conf.confirmed = True
        conf.confirmed_at = datetime.now(timezone.utc)
        conf.comments = payload.comments

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"CONFIRMACION_CARGOS:PERIODO:{period.period_name}:PROYECTO:{project.code}",
        target_table="period_project_confirmations",
        target_id=conf.id,
        action_type="PROJECT_CHARGES_CONFIRMED",
        old_value={"confirmed": False},
        new_value={"confirmed": True, "comments": payload.comments},
        justification=f"Confirmación de cargos del período {period.period_name} (F7.1 - HU-22)"
    )

    db.flush()

    return PeriodConfirmationSummaryItem(
        project_id=project.id,
        project_code=project.code,
        project_title=project.title,
        coordinator_id=current_user.id,
        coordinator_name=current_user.full_name,
        charges_count=0,
        total_amount=Decimal("0.00"),
        is_confirmed=True,
        confirmed_at=conf.confirmed_at,
    )


# =============================================================================
# 2. F7.2: Accounting Period Closing (HU-23)
# =============================================================================

def close_accounting_period(
    db: Session,
    period_id: str,
    payload: AccountingPeriodCloseRequest,
    current_user: User,
    ip_address: str
) -> AccountingPeriodResponse:
    """
    Close accounting period and lock movements in range (F7.2 | HU-23).
    - Checks overlap with other closed/prorated periods.
    - Checks coordinator confirmations (allows override if force_close_missing_confirmations=True).
    - Transitions status to 'Cerrado'.
    - Triggers consumption forecast update (F3.7).
    - Records in audit_log.
    """
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período contable no encontrado.")

    if period.status in ("Cerrado", "Prorrateado"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El período ya se encuentra '{period.status}'."
        )

    # Re-verify overlap against other closed periods (HU-23)
    check_date_overlap_with_closed_period(db, period.start_date, period.end_date, exclude_period_id=period.id)

    # Check confirmations
    unconfirmed = db.query(PeriodProjectConfirmation).filter(
        PeriodProjectConfirmation.period_id == period.id,
        PeriodProjectConfirmation.confirmed == False,
    ).count()

    if unconfirmed > 0 and not payload.force_close_missing_confirmations:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=(
                f"Existen {unconfirmed} proyectos pendientes de confirmación. "
                f"Envíe un recordatorio a los coordinadores o active la opción de cierre "
                f"forzado para registrar el cierre con confirmaciones pendientes."
            )
        )

    now = datetime.now(timezone.utc)
    period.status = "Cerrado"
    period.closed_by_user_id = current_user.id
    period.closed_at = now
    period.updated_at = now

    # Trigger consumption forecast recalculation (F3.7)
    # Sin commit propio: el cierre del período debe ser atómico (el router hace el commit)
    recalculate_consumption_forecasts(db, commit=False)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"CIERRE_PERIODO:{period.period_name}",
        target_table="accounting_periods",
        target_id=period.id,
        action_type="ACCOUNTING_PERIOD_CLOSED",
        old_value={"status": "En revisión"},
        new_value={
            "status": "Cerrado",
            "closed_at": str(now),
            "unconfirmed_projects_at_close": unconfirmed,
        },
        justification=f"Cierre formal de período contable (F7.2 - HU-23)"
    )

    db.flush()
    return AccountingPeriodResponse.from_orm(period)


# =============================================================================
# 3. F7.3 & F7.4: Proration Preview & Execution (HU-23)
# =============================================================================

def calculate_proration(
    db: Session,
    period: AccountingPeriod,
    criterion: str
) -> ProrationPreviewResponse:
    """
    Compute overhead proration breakdown without committing (preview / dry-run).
    - Requisite: period must be in 'Cerrado' status (rejects if already 'Prorrateado' - HU-23).
    - Strictly filters active projects: operational_status == 'En ejecución' (RN-05).
    - Proportional (F7.3) vs Equal parts (F7.4).
    - Rounds to 2 decimal places and assigns rounding residue to project with lowest code (min code ASC).
    """
    if period.status == "Prorrateado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="El período ya fue prorrateado anteriormente y no puede prorratearse de nuevo (HU-23)."
        )

    if period.status != "Cerrado":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"El período debe estar en estado 'Cerrado' para calcular el prorrateo (estado actual: '{period.status}')."
        )

    overhead_cost = Decimal(str(period.total_overhead_cost))

    # All projects query (to clearly separate active vs excluded)
    all_projects = db.query(Project).order_by(Project.code.asc()).all()
    active_projects = [p for p in all_projects if p.operational_status == "En ejecución"]
    excluded_projects = [p for p in all_projects if p.operational_status != "En ejecución"]

    # Compute direct net dispatches consumption for each active project in [start_date, end_date]
    project_consumptions: Dict[str, Decimal] = {}
    for p in active_projects:
        disp_sum = db.query(
            func.coalesce(func.sum(Dispatch.signed_quantity * Dispatch.unit_cost_snapshot), 0)
        ).filter(
            Dispatch.project_id == p.id,
            func.date(Dispatch.dispatched_at) >= period.start_date,
            func.date(Dispatch.dispatched_at) <= period.end_date,
        ).scalar() or Decimal("0.00")
        project_consumptions[p.id] = _round_currency(Decimal(str(disp_sum)))

    total_active_consumption = sum(project_consumptions.values(), Decimal("0.00"))
    num_active = len(active_projects)

    allocations: List[ProrationProjectItem] = []
    rounding_residual = Decimal("0.00")
    residual_assigned_to_code = None

    if num_active > 0:
        if criterion == "Proporcional":
            # F7.3: Direct consumption proportion
            raw_amounts: List[Decimal] = []
            percentages: List[Decimal] = []

            for p in active_projects:
                c = project_consumptions[p.id]
                pct = (c / total_active_consumption) if total_active_consumption > Decimal("0.00") else (Decimal("1.0") / Decimal(num_active))
                raw_amt = _round_currency(overhead_cost * pct)
                raw_amounts.append(raw_amt)
                percentages.append(_round_currency(pct * Decimal("100.00")))

            # Check cent residue: residual = overhead_cost - sum(raw_amounts)
            sum_allocated = sum(raw_amounts, Decimal("0.00"))
            rounding_residual = overhead_cost - sum_allocated

            # Assign residue to first active project in code ASC order
            if rounding_residual != Decimal("0.00"):
                raw_amounts[0] += rounding_residual
                residual_assigned_to_code = active_projects[0].code

            for idx, p in enumerate(active_projects):
                is_res_proj = bool(residual_assigned_to_code == p.code and rounding_residual != Decimal("0.00"))
                allocations.append(
                    ProrationProjectItem(
                        project_id=p.id,
                        project_code=p.code,
                        project_title=p.title,
                        operational_status=p.operational_status,
                        is_active_for_proration=True,
                        direct_consumption=project_consumptions[p.id],
                        consumption_percentage=percentages[idx],
                        allocated_overhead=raw_amounts[idx],
                        has_rounding_residual=is_res_proj,
                        residual_cents=rounding_residual if is_res_proj else Decimal("0.00"),
                    )
                )

        else:  # Equitativo (F7.4)
            base_amount = _round_currency(overhead_cost / Decimal(num_active))
            sum_allocated = base_amount * Decimal(num_active)
            rounding_residual = overhead_cost - sum_allocated

            for idx, p in enumerate(active_projects):
                amt = base_amount
                is_res = False
                if idx == 0 and rounding_residual != Decimal("0.00"):
                    amt += rounding_residual
                    is_res = True
                    residual_assigned_to_code = p.code

                allocations.append(
                    ProrationProjectItem(
                        project_id=p.id,
                        project_code=p.code,
                        project_title=p.title,
                        operational_status=p.operational_status,
                        is_active_for_proration=True,
                        direct_consumption=project_consumptions[p.id],
                        consumption_percentage=_round_currency(Decimal("100.00") / Decimal(num_active)),
                        allocated_overhead=amt,
                        has_rounding_residual=is_res,
                        residual_cents=rounding_residual if is_res else Decimal("0.00"),
                    )
                )

    # Append excluded projects with 0.00 allocation (RN-05)
    for p in excluded_projects:
        allocations.append(
            ProrationProjectItem(
                project_id=p.id,
                project_code=p.code,
                project_title=p.title,
                operational_status=p.operational_status,
                is_active_for_proration=False,
                direct_consumption=Decimal("0.00"),
                consumption_percentage=Decimal("0.00"),
                allocated_overhead=Decimal("0.00"),
                has_rounding_residual=False,
                residual_cents=Decimal("0.00"),
            )
        )

    return ProrationPreviewResponse(
        period_id=period.id,
        period_name=period.period_name,
        start_date=period.start_date,
        end_date=period.end_date,
        proration_criterion=criterion,
        total_overhead_cost=overhead_cost,
        total_active_projects_consumption=total_active_consumption,
        active_projects_count=num_active,
        excluded_projects_count=len(excluded_projects),
        rounding_residual=rounding_residual,
        residual_assigned_to_project_code=residual_assigned_to_code,
        allocations=allocations,
    )


def execute_proration(
    db: Session,
    period_id: str,
    payload: ProrationExecuteRequest,
    current_user: User,
    ip_address: str
) -> List[OverheadAllocationResponse]:
    """
    Execute and commit proration in a single atomic transaction (F7.3, F7.4 | HU-23).
    - Checks period is 'Cerrado' (rejects if already 'Prorrateado').
    - Calculates proration allocations.
    - Saves OverheadAllocation records.
    - Updates AccountingPeriod status to 'Prorrateado'.
    - Updates Project.executed_budget for each active project (F2.7).
    - Records in audit_log.
    """
    period = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not period:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período contable no encontrado.")

    # Calculate preview/breakdown using verified business rules
    preview = calculate_proration(db, period, payload.proration_criterion)

    now = datetime.now(timezone.utc)
    allocations_saved: List[OverheadAllocation] = []

    for item in preview.allocations:
        if not item.is_active_for_proration:
            continue  # Excluded projects receive no record / 0

        alloc = OverheadAllocation(
            id=str(uuid.uuid4()),
            period_id=period.id,
            project_id=item.project_id,
            registered_consumption=item.direct_consumption,
            consumption_pct=item.consumption_percentage / Decimal("100.00"),
            allocated_amount=item.allocated_overhead,
            applied_at=now,
        )
        db.add(alloc)
        allocations_saved.append(alloc)

        # F2.7: el gasto del proyecto incluye esta asignación automáticamente (Project.executed_budget
        # suma overhead_allocations, decisión 5); no se escribe aquí.

    # Update period status
    period.status = "Prorrateado"
    period.proration_criterion = payload.proration_criterion
    period.updated_at = now

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"PRORRATEO:{period.period_name}:CRITERIO:{payload.proration_criterion}",
        target_table="accounting_periods",
        target_id=period.id,
        action_type="OVERHEAD_PRORATION_APPLIED",
        old_value={"status": "Cerrado"},
        new_value={
            "status": "Prorrateado",
            "proration_criterion": payload.proration_criterion,
            "total_overhead_cost": str(period.total_overhead_cost),
            "allocated_projects_count": len(allocations_saved),
            "applied_at": str(now),
        },
        justification=f"Aplicación definitiva de reparto de gastos compartidos ({payload.proration_criterion}) (F7.3/F7.4 - HU-23)"
    )

    db.flush()

    return [
        OverheadAllocationResponse(
            id=a.id,
            period_id=a.period_id,
            project_id=a.project_id,
            registered_consumption=a.registered_consumption,
            consumption_pct=a.consumption_pct,
            allocated_amount=a.allocated_amount,
            applied_at=a.applied_at,
        )
        for a in allocations_saved
    ]


def list_accounting_periods(
    db: Session,
    status_filter: Optional[str] = None
) -> List[AccountingPeriodResponse]:
    """List accounting periods with optional status filtering."""
    query = db.query(AccountingPeriod)
    if status_filter and status_filter != "Todos":
        query = query.filter(AccountingPeriod.status == status_filter)

    periods = query.order_by(AccountingPeriod.start_date.desc()).all()
    return [AccountingPeriodResponse.from_orm(p) for p in periods]


def get_accounting_period_detail(
    db: Session,
    period_id: str
) -> AccountingPeriodResponse:
    """Get single accounting period detail."""
    p = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    if not p:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Período contable no encontrado.")
    return AccountingPeriodResponse.from_orm(p)
