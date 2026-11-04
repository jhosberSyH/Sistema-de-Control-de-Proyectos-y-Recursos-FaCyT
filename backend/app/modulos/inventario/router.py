"""FastAPI router for Module 3: Inventory (F3.1 to F3.7)."""

from typing import List, Optional
from fastapi import APIRouter, Depends, Request, Query, status
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.autenticacion.dependencies import require_role, get_client_ip
from app.modulos.usuarios.models import User
from app.modulos.inventario.schemas import (
    ItemCreate,
    ItemUpdate,
    ItemMinStockUpdate,
    ItemResponse,
    ItemDetailResponse,
    InventoryAlertCounters,
    ReplenishmentDecisionRequest,
    StockMovementRequest,
)
from app.modulos.inventario import service

router = APIRouter(prefix="/inventario", tags=["Módulo 3: Inventario"])

# Role groups
ROLE_ADMIN_ONLY = ["Administrador del Sistema"]
ROLE_ADMIN_OR_APPROVER = ["Administrador del Sistema", "Aprobador / Gestor de Inventario"]
ROLE_ALL_AUTH = [
    "Administrador del Sistema",
    "Aprobador / Gestor de Inventario",
    "Coordinador de Proyecto",
]


@router.get(
    "/items",
    response_model=List[ItemResponse],
    summary="List inventory items with alert badges and batch counts (F3.1, F3.4)"
)
def list_inventory_items(
    search: Optional[str] = Query(None, description="Buscar por nombre o número de lote"),
    item_type: Optional[str] = Query(None, alias="tipo", description="Filtrar por tipo de insumo"),
    location_id: Optional[str] = Query(None, alias="ubicacion", description="Filtrar por ubicación"),
    low_stock_only: bool = Query(False, alias="bajo_minimo", description="Solo insumos bajo el stock mínimo"),
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH))
):
    """Retrieve items in unified catalog. Accessible by Admin, Approver, and Coordinator."""
    return service.list_items(
        db=db,
        search=search,
        item_type=item_type,
        location_id=location_id,
        low_stock_only=low_stock_only
    )


@router.post(
    "/items",
    response_model=ItemResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new item in unified catalog (F3.1 | HU-07)"
)
def create_item(
    payload: ItemCreate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN_ONLY))
):
    """Register new item. Exclusively for Administrator. Starts with stock 0."""
    client_ip = get_client_ip(request)
    created = service.create_item(db, payload, current_user, client_ip)
    # Return detail formatted
    detail = service.get_item_detail(db, created.id)
    return detail


@router.get(
    "/items/{item_id}",
    response_model=ItemDetailResponse,
    summary="Get item detail card with lot breakdown, forecast and auto-replenishment (F3.3 to F3.7)"
)
def get_item_detail(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH))
):
    """Retrieve full item sheet including batches, forecast, and open replenishment request."""
    return service.get_item_detail(db, item_id)


@router.put(
    "/items/{item_id}",
    response_model=ItemResponse,
    summary="Update item metadata (F3.1)"
)
def update_item(
    item_id: str,
    payload: ItemUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN_ONLY))
):
    """Update item metadata. Exclusively for Administrator."""
    client_ip = get_client_ip(request)
    updated = service.update_item(db, item_id, payload, current_user, client_ip)
    return service.get_item_detail(db, updated.id)


@router.patch(
    "/items/{item_id}/min-stock",
    response_model=ItemResponse,
    summary="Configure minimum stock threshold with immediate alert evaluation (F3.2 | HU-07)"
)
def update_min_stock(
    item_id: str,
    payload: ItemMinStockUpdate,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN_ONLY))
):
    """Set min stock threshold (>0) or null. Triggers immediate alert & auto-replenishment if stock is below."""
    client_ip = get_client_ip(request)
    updated = service.update_min_stock(db, item_id, payload, current_user, client_ip)
    return service.get_item_detail(db, updated.id)


@router.get(
    "/alertas",
    response_model=InventoryAlertCounters,
    summary="Get count of low stock items, near-expiry lots, and expired lots (F3.4, F3.6)"
)
def get_alert_counters(
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ALL_AUTH))
):
    """Alert summary for dashboard and inventory top cards."""
    return service.get_inventory_alert_counters(db)


@router.post(
    "/reposiciones/{request_id}/decidir",
    summary="Submit or discard draft automatic replenishment request (F3.5 | HU-09)"
)
def decide_replenishment(
    request_id: str,
    payload: ReplenishmentDecisionRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN_OR_APPROVER))
):
    """
    Decide automatic replenishment:
    - 'submit': passes draft to 'Pendiente de Aprobación'
    - 'discard': discards draft (marks 'Rechazado'), low stock alert stays active.
    """
    client_ip = get_client_ip(request)
    updated_req = service.decide_replenishment_request(
        db=db,
        request_id=request_id,
        action=payload.action,
        adjusted_quantity=payload.adjusted_quantity,
        current_user=current_user,
        ip_address=client_ip
    )
    return {
        "status": "ok",
        "request_id": updated_req.id,
        "request_number": updated_req.request_number,
        "new_status": updated_req.status,
        "decision_reason": updated_req.decision_reason
    }


@router.post(
    "/items/{item_id}/recalcular-pronostico",
    summary="Recalculate consumption forecast for an item based on dispatch history (F3.7 | HU-11)"
)
def recalculate_forecast(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN_OR_APPROVER))
):
    """Recalculate consumption forecast on demand."""
    return service.recalculate_consumption_forecasts(db, item_id=item_id)


@router.post(
    "/movimientos/stock",
    summary="Execute atomic stock movement with rollback on constraint failure (F3.3 | RNF-10)"
)
def execute_stock_movement(
    payload: StockMovementRequest,
    request: Request,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(ROLE_ADMIN_OR_APPROVER))
):
    """Perform atomic stock increment (RECEIPT) or decrement (DISPATCH)."""
    client_ip = get_client_ip(request)
    item, batch = service.update_stock_atomic(
        db=db,
        item_id=payload.item_id,
        batch_id=payload.batch_id,
        quantity_change=payload.quantity_change,
        movement_type=payload.movement_type,
        current_user_id=current_user.id,
        ip_address=client_ip
    )
    db.commit()
    return {
        "status": "ok",
        "item_id": item.id,
        "item_current_stock": float(item.current_stock),
        "batch_id": batch.id,
        "batch_available_quantity": float(batch.available_quantity)
    }

