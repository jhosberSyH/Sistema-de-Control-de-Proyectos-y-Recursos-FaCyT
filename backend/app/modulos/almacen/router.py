"""FastAPI router for Module 6: Warehouse and Immutable Outbound Log (F6.1 to F6.6)."""

from datetime import date
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, Request, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_role, get_client_ip
from app.modulos.usuarios.models import User
from app.modulos.almacen.schemas import (
    BatchCreateRequest,
    BatchResponse,
    DispatchCreateRequest,
    DispatchResponse,
    WithdrawalRequestDispatchPreparation,
    RawMaterialUsageCreateRequest,
    RawMaterialUsageResponse,
    ProjectMaterialBalanceSummary,
    DispatchCorrectionCreateRequest,
    DispatchCorrectionReviewRequest,
    DispatchCorrectionResponse,
)
from app.modulos.almacen.service import (
    receive_batch,
    get_withdrawal_dispatch_preparation,
    execute_dispatch,
    list_dispatches,
    report_raw_material_usage,
    get_project_material_balance,
    request_dispatch_correction,
    review_dispatch_correction,
    list_dispatch_corrections,
)


router = APIRouter(prefix="/almacen", tags=["Almacén y Bitácora"])


# =============================================================================
# 1. F6.1: Batch Reception (HU-18)
# =============================================================================

@router.post(
    "/lotes",
    response_model=BatchResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar recepción física de lote de compra (F6.1 | HU-18)"
)
def api_receive_batch(
    payload: BatchCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    ip_addr = get_client_ip(request)
    result = receive_batch(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return result


# =============================================================================
# 2. F6.2: Dispatch Preparation (FEFO)
# =============================================================================

@router.get(
    "/solicitudes-retiro/{request_id}/preparar",
    response_model=WithdrawalRequestDispatchPreparation,
    summary="Preparar despacho con lotes sugeridos por vencimiento (FEFO) (F6.2)"
)
def api_prepare_withdrawal_dispatch(
    request_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role([
            "Administrador del Sistema",
            "Aprobador / Gestor de Inventario",
            "Coordinador de Proyecto"
        ])
    )
):
    return get_withdrawal_dispatch_preparation(
        db=db,
        request_id=request_id,
        current_user=current_user
    )


# =============================================================================
# 3. F6.2 & F6.3: Dispatch Execution
# =============================================================================

@router.post(
    "/despachos",
    response_model=List[DispatchResponse],
    status_code=status.HTTP_201_CREATED,
    summary="Ejecutar despacho físico inalterable desde solicitud aprobada (F6.2, F6.3 | HU-19)"
)
def api_execute_dispatch(
    payload: DispatchCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    ip_addr = get_client_ip(request)
    results = execute_dispatch(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return results


# =============================================================================
# 4. F6.3: Immutable Outbound Log Query (RN-07)
# =============================================================================

@router.get(
    "/despachos",
    response_model=List[DispatchResponse],
    summary="Consultar bitácora inalterable de despachos (F6.3 | RN-06, RN-07)"
)
def api_list_dispatches(
    project_id: Optional[str] = Query(None, description="Filtrar por ID de proyecto"),
    from_date: Optional[date] = Query(None, description="Fecha inicio (YYYY-MM-DD)"),
    to_date: Optional[date] = Query(None, description="Fecha fin (YYYY-MM-DD)"),
    search: Optional[str] = Query(None, description="Buscar por insumo, despacho, lote o quien retiró"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role([
            "Administrador del Sistema",
            "Aprobador / Gestor de Inventario",
            "Coordinador de Proyecto"
        ])
    )
):
    return list_dispatches(
        db=db,
        current_user=current_user,
        project_id=project_id,
        from_date=from_date,
        to_date=to_date,
        search=search
    )


# =============================================================================
# 5. F6.4: Raw Material Usage Reporting
# =============================================================================

@router.post(
    "/uso-materia-prima",
    response_model=RawMaterialUsageResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Registrar consumo real de materia prima por proyecto (F6.4 | HU-20)"
)
def api_report_raw_material_usage(
    payload: RawMaterialUsageCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Coordinador de Proyecto"])
    )
):
    ip_addr = get_client_ip(request)
    result = report_raw_material_usage(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return result


@router.get(
    "/proyectos/{project_id}/balance-materia-prima",
    response_model=List[ProjectMaterialBalanceSummary],
    summary="Balance de materia prima despachada vs consumida en un proyecto (F6.4)"
)
def api_get_project_material_balance(
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
    return get_project_material_balance(
        db=db,
        project_id=project_id,
        current_user=current_user
    )


# =============================================================================
# 6. F6.5 & F6.6: Compensatory Dispatch Corrections
# =============================================================================

@router.post(
    "/correcciones",
    response_model=DispatchCorrectionResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Solicitar corrección formal de un despacho registrado (F6.5 | HU-21 | RF-35)"
)
def api_request_dispatch_correction(
    payload: DispatchCorrectionCreateRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Coordinador de Proyecto"])
    )
):
    ip_addr = get_client_ip(request)
    result = request_dispatch_correction(
        db=db,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return result


@router.get(
    "/correcciones",
    response_model=List[DispatchCorrectionResponse],
    summary="Listar solicitudes de corrección de despachos (F6.5, F6.6)"
)
def api_list_dispatch_corrections(
    status: Optional[str] = Query(None, description="Filtrar por estado: Pendiente, Aprobado, Denegado"),
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role([
            "Administrador del Sistema",
            "Aprobador / Gestor de Inventario",
            "Coordinador de Proyecto"
        ])
    )
):
    return list_dispatch_corrections(
        db=db,
        current_user=current_user,
        status_filter=status
    )


@router.post(
    "/correcciones/{correction_id}/revisar",
    response_model=DispatchCorrectionResponse,
    summary="Aprobar o denegar solicitud de corrección compensatoria (F6.6 | HU-21 | RF-35)"
)
def api_review_dispatch_correction(
    correction_id: str,
    payload: DispatchCorrectionReviewRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(
        require_role(["Administrador del Sistema", "Aprobador / Gestor de Inventario"])
    )
):
    ip_addr = get_client_ip(request)
    result = review_dispatch_correction(
        db=db,
        correction_id=correction_id,
        payload=payload,
        current_user=current_user,
        ip_address=ip_addr
    )
    db.commit()
    return result
