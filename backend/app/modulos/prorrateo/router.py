"""FastAPI router for Module 7: Accounting Period Closing & Overhead Proration (F7.1 to F7.4)."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_role, get_client_ip
from app.modulos.usuarios.models import User
from app.modulos.prorrateo.schemas import (
    AccountingPeriodCreateRequest,
    AccountingPeriodResponse,
    AccountingPeriodCloseRequest,
    ProjectChargesReviewResponse,
    PeriodConfirmationDashboardResponse,
    PeriodConfirmationSummaryItem,
    ProjectChargesConfirmRequest,
    ProrationPreviewResponse,
    ProrationExecuteRequest,
    OverheadAllocationResponse,
)
from app.modulos.prorrateo.service import (
    open_accounting_period_review,
    list_accounting_periods,
    get_accounting_period_detail,
    get_period_confirmation_dashboard,
    get_project_charges_for_coordinator,
    confirm_project_charges,
    close_accounting_period,
    calculate_proration,
    execute_proration,
)

router = APIRouter(prefix="/prorrateo", tags=["Cierre de Período y Gastos Compartidos"])


# =============================================================================
# 1. F7.1: Period Review Opening & Dashboard
# =============================================================================

@router.post(
    "/periodos",
    response_model=AccountingPeriodResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Abrir período contable para revisión de cargos (F7.1 | HU-22)"
)
def api_open_accounting_period(
    payload: AccountingPeriodCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    ip_addr = get_client_ip(request)
    result = open_accounting_period_review(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return result


@router.get(
    "/periodos",
    response_model=List[AccountingPeriodResponse],
    summary="Listar períodos contables (F7.1)"
)
def api_list_periods(
    status: Optional[str] = Query(None, description="Filtrar por estado: Abierto, En revisión, Cerrado, Prorrateado"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role([
            "Administrador del Sistema",
            "Aprobador / Gestor de Inventario",
            "Coordinador de Proyecto"
        ])
    )
):
    return list_accounting_periods(db=db, status_filter=status)


@router.get(
    "/periodos/{period_id}",
    response_model=AccountingPeriodResponse,
    summary="Detalle de un período contable (F7.1)"
)
def api_get_period_detail(
    period_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role([
            "Administrador del Sistema",
            "Aprobador / Gestor de Inventario",
            "Coordinador de Proyecto"
        ])
    )
):
    return get_accounting_period_detail(db=db, period_id=period_id)


@router.get(
    "/periodos/{period_id}/tablero",
    response_model=PeriodConfirmationDashboardResponse,
    summary="Tablero de confirmaciones de proyectos para el aprobador (F7.1)"
)
def api_get_confirmation_dashboard(
    period_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    return get_period_confirmation_dashboard(
        db=db,
        period_id=period_id,
        current_user=current_user
    )


# =============================================================================
# 2. F7.1: Project Charges Review & Confirmation by Coordinator
# =============================================================================

@router.get(
    "/periodos/{period_id}/proyectos/{project_id}/cargos",
    response_model=ProjectChargesReviewResponse,
    summary="Revisar lista de cargos directos del proyecto en el período (F7.1 | HU-22 | RN-07)"
)
def api_get_project_charges(
    period_id: str,
    project_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role([
            "Administrador del Sistema",
            "Aprobador / Gestor de Inventario",
            "Coordinador de Proyecto"
        ])
    )
):
    return get_project_charges_for_coordinator(
        db=db,
        period_id=period_id,
        project_id=project_id,
        current_user=current_user
    )


@router.post(
    "/periodos/{period_id}/proyectos/{project_id}/confirmar",
    response_model=PeriodConfirmationSummaryItem,
    summary="Confirmar cargos directos del proyecto (F7.1 | HU-22)"
)
def api_confirm_project_charges(
    period_id: str,
    project_id: str,
    payload: ProjectChargesConfirmRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Coordinador de Proyecto"])
    )
):
    ip_addr = get_client_ip(request)
    result = confirm_project_charges(
        db=db,
        period_id=period_id,
        project_id=project_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return result


# =============================================================================
# 3. F7.2: Accounting Period Closing
# =============================================================================

@router.post(
    "/periodos/{period_id}/cerrar",
    response_model=AccountingPeriodResponse,
    summary="Cerrar formalmente un período contable (F7.2 | HU-23)"
)
def api_close_period(
    period_id: str,
    payload: AccountingPeriodCloseRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    ip_addr = get_client_ip(request)
    result = close_accounting_period(
        db=db,
        period_id=period_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return result


# =============================================================================
# 4. F7.3 & F7.4: Overhead Proration Preview & Execution
# =============================================================================

@router.get(
    "/periodos/{period_id}/prorrateo/vista-previa",
    response_model=ProrationPreviewResponse,
    summary="Vista previa del reparto de gastos compartidos (F7.3, F7.4 | HU-23)"
)
def api_proration_preview(
    period_id: str,
    criterio: str = Query("Proporcional", description="Criterio: 'Proporcional' o 'Equitativo'"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    clean_crit = criterio.strip().capitalize()
    if clean_crit not in ("Proporcional", "Equitativo"):
        clean_crit = "Proporcional"

    period = get_accounting_period_detail(db, period_id)
    # retrieve raw model for calculate_proration
    period_model = db.query(AccountingPeriod).filter(AccountingPeriod.id == period_id).first()
    return calculate_proration(db=db, period=period_model, criterion=clean_crit)


@router.post(
    "/periodos/{period_id}/prorrateo/ejecutar",
    response_model=List[OverheadAllocationResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Ejecutar y aplicar reparto definitivo de gastos compartidos (F7.3, F7.4 | HU-23)"
)
def api_execute_proration(
    period_id: str,
    payload: ProrationExecuteRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    ip_addr = get_client_ip(request)
    results = execute_proration(
        db=db,
        period_id=period_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return results
