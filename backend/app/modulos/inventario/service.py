"""Service layer for Module 3: Inventory (F3.1 to F3.7, RN-02, RN-03, RNF-10)."""

import uuid
from datetime import datetime, date, timezone, timedelta
from decimal import Decimal
from typing import List, Optional, Tuple, Dict, Any
from fastapi import HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from app.auditoria.service import record_audit_log
from app.avisos.service import avisar, avisar_a, ids_por_rol
from app.modulos.usuarios.models import (
    Item,
    Batch,
    Dispatch,
    Request,
    RequestItem,
    Project,
    User,
    SystemParameter,
    Location,
)
from app.modulos.inventario.schemas import (
    ItemCreate,
    ItemUpdate,
    ItemMinStockUpdate,
    ItemResponse,
    ItemDetailResponse,
    BatchSummary,
    AutomaticReplenishmentSummary,
    InventoryAlertCounters,
)


# -----------------------------------------------------------------------------
# System Parameter Helpers
# -----------------------------------------------------------------------------

def get_system_param_int(db: Session, key: str, default_val: int) -> int:
    """Retrieve an integer system parameter or return default."""
    param = db.query(SystemParameter).filter(SystemParameter.parameter_key == key).first()
    if param and param.parameter_value is not None and param.parameter_value > 0:
        return int(param.parameter_value)
    return default_val


# -----------------------------------------------------------------------------
# Reposición automática: reglas compartidas (F3.4, F3.5)
# -----------------------------------------------------------------------------

#: Una reposición sigue "abierta" hasta que se recibe el lote (Ejecutado) o se descarta (Rechazado)
REPOSICION_ABIERTA = ("Borrador", "Pendiente de Aprobación", "Aprobado")


def _minuscula(texto: str) -> str:
    return texto[:1].lower() + texto[1:] if texto else texto


def reposicion_abierta(db: Session, item_id: str) -> Optional[Request]:
    """La reposición automática abierta del insumo (la más reciente), si hay una."""
    return (
        db.query(Request)
        .join(RequestItem)
        .filter(
            RequestItem.item_id == item_id,
            Request.request_type == "Reposición automática",
            Request.status.in_(REPOSICION_ABIERTA),
        )
        .order_by(Request.created_at.desc())
        .first()
    )


def _siguiente_correlativo(db: Session, columna, prefijo: str) -> int:
    """Siguiente número de un código PREFIJO-n, a partir del mayor que existe (no de count(), D10)."""
    mayor = 0
    for (valor,) in db.query(columna).filter(columna.like(f"{prefijo}-%")).all():
        parte = (valor or "")[len(prefijo) + 1:].split("-")[0]
        if parte.isdigit():
            mayor = max(mayor, int(parte))
    return mayor + 1


def siguiente_numero_reposicion(db: Session) -> str:
    """REP-2026-0001, REP-2026-0002… (el año en curso)."""
    prefijo = f"REP-{datetime.now(timezone.utc).year}"
    return f"{prefijo}-{_siguiente_correlativo(db, Request.request_number, prefijo):04d}"


# -----------------------------------------------------------------------------
# F3.1: Unified Item Catalog
# -----------------------------------------------------------------------------

def create_item(
    db: Session,
    payload: ItemCreate,
    current_user: User,
    ip_address: str
) -> Item:
    """
    Create a new item in the unified catalog (F3.1 | HU-07).
    Enforces composite uniqueness (name, unit_of_measure).
    Enforces initial current_stock = 0.
    Evaluates immediate min_stock alert and auto-replenishment if min_stock > 0.
    """
    clean_name = payload.name.strip()
    clean_unit = payload.unit_of_measure.strip()

    # Composite uniqueness check: (LOWER(name), LOWER(unit_of_measure))
    existing = db.query(Item).filter(
        func.lower(Item.name) == clean_name.lower(),
        func.lower(Item.unit_of_measure) == clean_unit.lower()
    ).first()

    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=(
                f"Ya existe un insumo registrado con el nombre '{existing.name}' "
                f"y unidad '{existing.unit_of_measure}'. "
                f"Abra la ficha de ese insumo o modifique el nombre/unidad."
            )
        )

    # Item creation (initial current_stock strictly 0)
    item = Item(
        id=str(uuid.uuid4()),
        name=clean_name,
        unit_of_measure=clean_unit,
        item_type=payload.item_type,
        current_stock=Decimal("0.000"),
        min_stock=payload.min_stock if payload.min_stock is not None else Decimal("0.000"),
        forecasted_consumption=None,
        is_active=True,
    )
    db.add(item)
    db.flush()

    # Record transactional audit log
    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"ITEM:{item.name}",
        action_type="CREATE",
        old_value=None,
        new_value={
            "id": item.id,
            "name": item.name,
            "unit_of_measure": item.unit_of_measure,
            "item_type": item.item_type,
            "min_stock": str(item.min_stock) if item.min_stock else None,
            "current_stock": "0.000",
        },
        target_table="items",
        target_id=item.id,
        justification="Alta de insumo en catálogo unificado (F3.1)"
    )

    # Immediate min_stock evaluation (HU-07): current_stock (0) < min_stock
    if item.min_stock and item.min_stock > Decimal("0.000"):
        check_and_create_replenishment(db, item, current_user.id, ip_address)

    db.commit()
    db.refresh(item)
    return item


def update_item(
    db: Session,
    item_id: str,
    payload: ItemUpdate,
    current_user: User,
    ip_address: str
) -> Item:
    """Update item general details (name, unit, type, active status)."""
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insumo no encontrado.")

    old_state = {
        "name": item.name,
        "unit_of_measure": item.unit_of_measure,
        "item_type": item.item_type,
        "is_active": item.is_active,
    }

    new_name = payload.name.strip() if payload.name is not None else item.name
    new_unit = payload.unit_of_measure.strip() if payload.unit_of_measure is not None else item.unit_of_measure

    # Validate composite uniqueness if name or unit changed
    if new_name.lower() != item.name.lower() or new_unit.lower() != item.unit_of_measure.lower():
        duplicate = db.query(Item).filter(
            func.lower(Item.name) == new_name.lower(),
            func.lower(Item.unit_of_measure) == new_unit.lower(),
            Item.id != item.id
        ).first()
        if duplicate:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail=f"Ya existe otro insumo con el nombre '{duplicate.name}' y unidad '{duplicate.unit_of_measure}'."
            )

    if payload.name is not None:
        item.name = new_name
    if payload.unit_of_measure is not None:
        item.unit_of_measure = new_unit
    if payload.item_type is not None:
        item.item_type = payload.item_type
    if payload.is_active is not None:
        item.is_active = payload.is_active

    item.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"ITEM:{item.name}",
        action_type="UPDATE",
        old_value=old_state,
        new_value={
            "name": item.name,
            "unit_of_measure": item.unit_of_measure,
            "item_type": item.item_type,
            "is_active": item.is_active,
        },
        target_table="items",
        target_id=item.id,
        justification="Actualización de datos del insumo (F3.1)"
    )

    db.commit()
    db.refresh(item)
    return item


# -----------------------------------------------------------------------------
# F3.2: Configure Minimum Stock
# -----------------------------------------------------------------------------

def update_min_stock(
    db: Session,
    item_id: str,
    payload: ItemMinStockUpdate,
    current_user: User,
    ip_address: str
) -> Item:
    """
    Configure or update item min_stock (F3.2 | HU-07).
    Evaluates immediate low stock alert & auto-replenishment if current_stock < min_stock.
    """
    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insumo no encontrado.")

    old_min = str(item.min_stock) if item.min_stock is not None else None
    new_min = payload.min_stock if payload.min_stock is not None else Decimal("0.000")

    item.min_stock = new_min
    item.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"ITEM:{item.name}",
        action_type="UPDATE_MIN_STOCK",
        old_value={"min_stock": old_min},
        new_value={"min_stock": str(new_min) if new_min > 0 else None},
        target_table="items",
        target_id=item.id,
        justification="Actualización de umbral de stock mínimo (F3.2)"
    )

    # Immediate evaluation (HU-07): if current_stock < min_stock, trigger replenishment
    if item.min_stock and item.min_stock > Decimal("0.000"):
        if Decimal(str(item.current_stock)) < item.min_stock:
            check_and_create_replenishment(db, item, current_user.id, ip_address)

    db.commit()
    db.refresh(item)
    return item


# -----------------------------------------------------------------------------
# F3.5: Automatic Replenishment Requests (RN-03, HU-09)
# -----------------------------------------------------------------------------

def check_and_create_replenishment(
    db: Session,
    item: Item,
    user_id: Optional[str],
    ip_address: str
) -> Optional[Request]:
    """
    Generate automatic replenishment request if current_stock < min_stock (F3.5 | HU-09).
    Prevents duplicate requests: if an open request (Borrador or Pendiente de Aprobación)
    already exists for this item, keeps the existing one and does NOT create a duplicate.
    """
    if not item.min_stock or item.min_stock <= Decimal("0.000"):
        return None

    if Decimal(str(item.current_stock)) >= item.min_stock:
        return None

    # Una reposición abierta (también la aprobada que espera la compra) basta: no se duplica
    existing_open = reposicion_abierta(db, item.id)

    if existing_open:
        # Keep existing request without creating a duplicate
        return existing_open

    # Decisión 4: la compra para reponer stock no se carga a ningún proyecto (centro de costo
    # 'general'). A los proyectos les llega el costo cuando se les despacha; los consumibles de uso
    # general se reparten en el cierre del período (RN-02, M7).
    # Determine user/requester
    requester_id = user_id
    if not requester_id:
        admin_user = db.query(User).filter(User.role == "Administrador del Sistema").first()
        requester_id = admin_user.id if admin_user else None

    if not requester_id:
        system_user = db.query(User).first()
        requester_id = system_user.id if system_user else None

    # Cantidad sugerida: llegar al doble del mínimo (como el mock y la semilla del frontend)
    suggested_qty = (Decimal(str(item.min_stock)) * 2 - Decimal(str(item.current_stock))).quantize(Decimal("0.001"))
    suggested_qty = max(suggested_qty, Decimal("0.001"))

    req_number = siguiente_numero_reposicion(db)

    # Estimated unit cost snapshot based on latest batch or 0
    latest_batch = db.query(Batch).filter(Batch.item_id == item.id).order_by(Batch.received_date.desc()).first()
    unit_cost_est = latest_batch.unit_cost if latest_batch else Decimal("10.00")
    estimated_total = suggested_qty * unit_cost_est

    req = Request(
        id=str(uuid.uuid4()),
        request_number=req_number,
        request_type="Reposición automática",
        cost_center="general",
        project_id=None,
        requester_user_id=requester_id,
        status="Borrador",  # RN-03 initial state
        estimated_amount=estimated_total,
        actual_amount=Decimal("0.00"),
        decision_reason=f"Generada automáticamente al bajar el stock ({item.current_stock} {item.unit_of_measure}) del mínimo ({item.min_stock} {item.unit_of_measure})."
    )
    db.add(req)
    db.flush()

    req_item = RequestItem(
        id=str(uuid.uuid4()),
        request_id=req.id,
        item_id=item.id,
        requested_quantity=suggested_qty,
        approved_quantity=None,
        unit_cost_estimate=unit_cost_est,
    )
    db.add(req_item)
    if hasattr(Request, "description"):
        req.description = f"Reposición automática de {_minuscula(item.name)}"
    db.flush()
    avisar_a(db, ids_por_rol(db, "Aprobador / Gestor de Inventario"), "info",
             f"Reposición automática en Borrador: {_minuscula(item.name)}", f"/bandeja?tipo=reposicion&pedido={req.id}",
             detalle="El stock está bajo el mínimo. Revisa la cantidad sugerida antes de aprobar.")

    record_audit_log(
        db=db,
        user_id=requester_id,
        ip_address=ip_address or "127.0.0.1",
        target_object=f"REQUEST:{req.request_number}",
        action_type="CREATE_AUTO_REPLENISHMENT",
        old_value=None,
        new_value={
            "request_id": req.id,
            "request_number": req.request_number,
            "item_id": item.id,
            "item_name": item.name,
            "suggested_quantity": str(suggested_qty),
            "status": req.status,
        },
        target_table="requests",
        target_id=req.id,
        justification="Disparo automático de solicitud de reposición por stock bajo mínimo (F3.5)"
    )

    return req


def decide_replenishment_request(
    db: Session,
    request_id: str,
    action: str,  # 'submit' | 'discard'
    adjusted_quantity: Optional[Decimal],
    current_user: User,
    ip_address: str
) -> Request:
    """
    Approver decision on automatic replenishment draft (F3.5 | HU-09).
    1. 'submit': advances status from 'Borrador' to 'Pendiente de Aprobación'.
    2. 'discard': marks request as 'Rechazado' (discarded draft); min stock alert stays visible.
    """
    req = db.query(Request).filter(
        Request.id == request_id,
        Request.request_type == "Reposición automática"
    ).first()

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Solicitud de reposición no encontrada."
        )

    if req.status != "Borrador":
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"La solicitud ya se encuentra en estado '{req.status}' y no puede modificarse como borrador."
        )

    old_status = req.status
    req_item = db.query(RequestItem).filter(RequestItem.request_id == req.id).first()

    if adjusted_quantity is not None and req_item:
        req_item.requested_quantity = adjusted_quantity
        req.estimated_amount = adjusted_quantity * req_item.unit_cost_estimate

    if action == "submit":
        req.status = "Pendiente de Aprobación"  # RN-03
        req.decision_reason = "Enviada a aprobación de compra por el gestor de inventario."
    elif action == "discard":
        req.status = "Rechazado"  # Discarded
        req.decision_reason = "Reposición automática descartada por el gestor de inventario (no se compra nada)."
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Acción no reconocida.")

    req.updated_at = datetime.now(timezone.utc)

    record_audit_log(
        db=db,
        user_id=current_user.id,
        ip_address=ip_address,
        target_object=f"REQUEST:{req.request_number}",
        action_type=f"REPLENISHMENT_{action.upper()}",
        old_value={"status": old_status},
        new_value={"status": req.status, "action": action},
        target_table="requests",
        target_id=req.id,
        justification="Decisión de gestor sobre reposición automática (F3.5)"
    )

    db.commit()
    db.refresh(req)
    return req


# -----------------------------------------------------------------------------
# F3.6: Batch Expiration Evaluation & Blocking
# -----------------------------------------------------------------------------

def evaluate_batch_expirations(db: Session) -> Dict[str, Any]:
    """
    Evaluate batch expiration status (F3.6 | HU-10).
    Uses SystemParameter 'batch_expiration_alert_days' (default 30 days).
    Status:
      - 'Vencido' if expiration_date < CURRENT_DATE (Blocked from dispatch)
      - 'Próximo a vencer' if CURRENT_DATE <= expiration_date <= CURRENT_DATE + alert_days
      - 'Vigente' otherwise.
    """
    alert_days = get_system_param_int(db, "batch_expiration_alert_days", default_val=30)
    today = date.today()
    threshold = today + timedelta(days=alert_days)

    active_batches = db.query(Batch).filter(Batch.available_quantity > 0).all()
    updated_count = 0

    for b in active_batches:
        new_status = "Vigente"
        if b.expiration_date:
            if b.expiration_date < today:
                new_status = "Vencido"
            elif today <= b.expiration_date <= threshold:
                new_status = "Próximo a vencer"
            else:
                new_status = "Vigente"

        if b.expiration_status != new_status:
            b.expiration_status = new_status
            updated_count += 1

    # Sin commit: las lecturas no escriben (decisión 5). El estado de vencimiento se calcula al
    # consultar desde la fecha; esta columna solo se guarda si la operación que llama hace commit.
    return {"alert_days_threshold": alert_days, "batches_evaluated": len(active_batches), "updated_count": updated_count}


# -----------------------------------------------------------------------------
# F3.7: Consumption Forecast Calculation (IA-01, HU-11)
# -----------------------------------------------------------------------------

def recalculate_consumption_forecasts(db: Session, item_id: Optional[str] = None, commit: bool = True) -> Dict[str, Any]:
    """
    Calculate consumption forecast for items based on dispatches history (F3.7 / IA-01 | HU-11).
    Uses SystemParameter 'min_dispatch_history_months' (default 3 months).
    Rule:
      - If dispatches span < min_dispatch_history_months: forecasted_consumption = None
        ("Sin historial suficiente para pronosticar")
      - If >= min_dispatch_history_months: calculates moving average of monthly consumption.
    """
    min_months = get_system_param_int(db, "min_dispatch_history_months", default_val=3)
    today = date.today()

    query = db.query(Item).filter(Item.is_active == True)
    if item_id:
        query = query.filter(Item.id == item_id)

    items = query.all()
    results = {}

    for it in items:
        # Fetch dispatches for this item's batches
        item_dispatches = db.query(Dispatch).join(Batch).filter(
            Batch.item_id == it.id,
            Dispatch.is_compensatory == False  # Exclude compensatory reversals for pure consumption
        ).order_by(Dispatch.dispatched_at.asc()).all()

        if not item_dispatches:
            it.forecasted_consumption = None
            results[it.id] = {
                "forecast": None,
                "message": "Sin historial suficiente para pronosticar",
                "months_history": 0,
            }
            continue

        earliest = item_dispatches[0].dispatched_at
        latest = item_dispatches[-1].dispatched_at
        if earliest.tzinfo:
            earliest_date = earliest.date()
        else:
            earliest_date = earliest.date()

        days_span = (today - earliest_date).days
        months_history = days_span / 30.0

        if months_history < min_months:
            it.forecasted_consumption = None
            results[it.id] = {
                "forecast": None,
                "message": "Sin historial suficiente para pronosticar",
                "months_history": round(months_history, 1),
            }
        else:
            # Aggregate monthly consumption
            monthly_sums: Dict[str, Decimal] = {}
            for d in item_dispatches:
                month_key = d.dispatched_at.strftime("%Y-%m")
                qty = Decimal(str(d.dispatched_quantity))
                monthly_sums[month_key] = monthly_sums.get(month_key, Decimal("0.000")) + qty

            if monthly_sums:
                total_qty = sum(monthly_sums.values())
                avg_monthly = total_qty / Decimal(str(len(monthly_sums)))
                forecast_val = round(avg_monthly, 3)
                it.forecasted_consumption = forecast_val
                results[it.id] = {
                    "forecast": float(forecast_val),
                    "message": f"{forecast_val} {it.unit_of_measure}",
                    "months_history": round(months_history, 1),
                }
            else:
                it.forecasted_consumption = None
                results[it.id] = {
                    "forecast": None,
                    "message": "Sin historial suficiente para pronosticar",
                    "months_history": round(months_history, 1),
                }

    if commit:
        db.commit()
    else:
        db.flush()
    return {"min_history_months_threshold": min_months, "items_processed": len(items), "details": results}


# -----------------------------------------------------------------------------
# F3.3: Transactional Stock Movement (Atomic RNF-10)
# -----------------------------------------------------------------------------

def update_stock_atomic(
    db: Session,
    item_id: str,
    batch_id: str,
    quantity_change: Decimal,
    movement_type: str,  # 'RECEIPT' | 'DISPATCH'
    current_user_id: Optional[str],
    ip_address: str
) -> Tuple[Item, Batch]:
    """
    Atomic transactional stock update (F3.3 | RNF-10).
    Synchronizes items.current_stock and batches.available_quantity.
    Rolls back entire transaction if constraint/stock violates rules.
    """
    item = db.query(Item).filter(Item.id == item_id).with_for_update().first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insumo no encontrado.")

    batch = db.query(Batch).filter(Batch.id == batch_id, Batch.item_id == item_id).with_for_update().first()
    if not batch:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Lote no encontrado para este insumo.")

    old_item_stock = Decimal(str(item.current_stock))
    old_batch_stock = Decimal(str(batch.available_quantity))

    if movement_type == "RECEIPT":
        new_batch_stock = old_batch_stock + quantity_change
        new_item_stock = old_item_stock + quantity_change
    elif movement_type == "DISPATCH":
        # Check expired batch blocking (F3.6)
        if batch.expiration_status == "Vencido" or (batch.expiration_date and batch.expiration_date < date.today()):
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Operación bloqueada: El lote está vencido y no puede despacharse (F3.6)."
            )
        if old_batch_stock < quantity_change:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Cantidad insuficiente en el lote: disponible {old_batch_stock}, solicitado {quantity_change}."
            )
        new_batch_stock = old_batch_stock - quantity_change
        new_item_stock = old_item_stock - quantity_change
    else:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Tipo de movimiento no válido.")

    batch.available_quantity = new_batch_stock
    item.current_stock = new_item_stock
    item.updated_at = datetime.now(timezone.utc)

    # Immediate min stock check on depletion
    if movement_type == "DISPATCH" and item.min_stock and item.min_stock > Decimal("0.000"):
        if new_item_stock < item.min_stock:
            check_and_create_replenishment(db, item, current_user_id, ip_address)

    record_audit_log(
        db=db,
        user_id=current_user_id,
        ip_address=ip_address,
        target_object=f"STOCK:{item.name}:LOTE:{batch.batch_number}",
        action_type=f"STOCK_{movement_type}",
        old_value={"item_stock": str(old_item_stock), "batch_stock": str(old_batch_stock)},
        new_value={"item_stock": str(new_item_stock), "batch_stock": str(new_batch_stock)},
        target_table="items",
        target_id=item.id,
        justification=f"Movimiento atómico de stock ({movement_type}) (F3.3)"
    )

    db.flush()
    return item, batch


# -----------------------------------------------------------------------------
# Query & Read Endpoints Helpers (Catalog, Detail, Alerts)
# -----------------------------------------------------------------------------

def list_items(
    db: Session,
    search: Optional[str] = None,
    item_type: Optional[str] = None,
    location_id: Optional[str] = None,
    low_stock_only: bool = False
) -> List[ItemResponse]:
    """Retrieve catalog items with computed alert status and batch counts."""
    # Ensure expirations are up-to-date
    evaluate_batch_expirations(db)

    query = db.query(Item).filter(Item.is_active == True)

    if search:
        s = f"%{search.strip().lower()}%"
        # Match item name or associated batch number
        query = query.filter(
            or_(
                func.lower(Item.name).like(s),
                Item.batches.any(func.lower(Batch.batch_number).like(s))
            )
        )

    if item_type and item_type != "Todos":
        query = query.filter(Item.item_type == item_type)

    if location_id and location_id != "Todas":
        query = query.filter(Item.batches.any(Batch.location_id == location_id))

    items = query.order_by(Item.name.asc()).all()
    results = []

    for it in items:
        batches = [b for b in it.batches if b.available_quantity > 0]
        # Next expiration date among available batches
        exp_dates = [b.expiration_date for b in batches if b.expiration_date]
        next_exp = min(exp_dates) if exp_dates else None

        min_s = Decimal(str(it.min_stock)) if it.min_stock is not None else Decimal("0")
        curr_s = Decimal(str(it.current_stock))
        is_low = bool(it.min_stock and it.min_stock > 0 and curr_s < min_s)

        if low_stock_only and not is_low:
            continue

        results.append(
            ItemResponse(
                id=it.id,
                name=it.name,
                unit_of_measure=it.unit_of_measure,
                item_type=it.item_type,
                current_stock=curr_s,
                min_stock=it.min_stock if it.min_stock and it.min_stock > 0 else None,
                forecasted_consumption=it.forecasted_consumption,
                is_active=it.is_active,
                is_low_stock=is_low,
                batches_count=len(batches),
                next_expiration_date=next_exp,
                created_at=it.created_at,
                updated_at=it.updated_at,
            )
        )

    return results


def get_item_detail(db: Session, item_id: str) -> ItemDetailResponse:
    """Detailed item card with lots breakdown and active automatic replenishment."""
    evaluate_batch_expirations(db)

    item = db.query(Item).filter(Item.id == item_id).first()
    if not item:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Insumo no encontrado.")

    alert_days = get_system_param_int(db, "batch_expiration_alert_days", default_val=30)
    today = date.today()

    batch_summaries = []
    for b in sorted(item.batches, key=lambda x: (x.expiration_date or date.max)):
        days_left = (b.expiration_date - today).days if b.expiration_date else None
        is_blocked = bool(b.expiration_status == "Vencido" or (b.expiration_date and b.expiration_date < today))

        batch_summaries.append(
            BatchSummary(
                id=b.id,
                batch_number=b.batch_number,
                location_id=b.location_id,
                location_name=b.location.name if b.location else "Sin asignar",
                initial_quantity=b.initial_quantity,
                available_quantity=b.available_quantity,
                unit_cost=b.unit_cost,
                supplier=b.supplier,
                received_date=b.received_date,
                expiration_date=b.expiration_date,
                expiration_status=b.expiration_status,
                days_until_expiration=days_left,
                is_blocked=is_blocked,
            )
        )

    # Active replenishment (Borrador or Pendiente de Aprobación)
    active_req = db.query(Request).join(RequestItem).filter(
        RequestItem.item_id == item.id,
        Request.request_type == "Reposición automática",
        Request.status.in_(["Borrador", "Pendiente de Aprobación"])
    ).first()

    replenishment_summary = None
    if active_req:
        req_item = db.query(RequestItem).filter(RequestItem.request_id == active_req.id).first()
        replenishment_summary = AutomaticReplenishmentSummary(
            request_id=active_req.id,
            request_number=active_req.request_number,
            status=active_req.status,
            suggested_quantity=req_item.requested_quantity if req_item else Decimal("0"),
            created_at=active_req.created_at,
            can_submit=active_req.status == "Borrador",
            can_discard=active_req.status == "Borrador",
        )

    # Forecast message
    forecast_msg = (
        f"{item.forecasted_consumption} {item.unit_of_measure}"
        if item.forecasted_consumption is not None
        else "Sin historial suficiente para pronosticar"
    )

    min_s = Decimal(str(item.min_stock)) if item.min_stock is not None else Decimal("0")
    curr_s = Decimal(str(item.current_stock))
    is_low = bool(item.min_stock and item.min_stock > 0 and curr_s < min_s)

    exp_dates = [b.expiration_date for b in item.batches if b.available_quantity > 0 and b.expiration_date]
    next_exp = min(exp_dates) if exp_dates else None

    return ItemDetailResponse(
        id=item.id,
        name=item.name,
        unit_of_measure=item.unit_of_measure,
        item_type=item.item_type,
        current_stock=curr_s,
        min_stock=item.min_stock if item.min_stock and item.min_stock > 0 else None,
        forecasted_consumption=item.forecasted_consumption,
        is_active=item.is_active,
        is_low_stock=is_low,
        batches_count=len([b for b in item.batches if b.available_quantity > 0]),
        next_expiration_date=next_exp,
        created_at=item.created_at,
        updated_at=item.updated_at,
        batches=batch_summaries,
        active_replenishment=replenishment_summary,
        forecast_message=forecast_msg,
    )


def get_inventory_alert_counters(db: Session) -> InventoryAlertCounters:
    """Dashboard / header alert counters (F3.4, F3.6)."""
    evaluate_batch_expirations(db)

    items = db.query(Item).filter(Item.is_active == True).all()
    low_stock = sum(
        1 for it in items
        if it.min_stock and it.min_stock > Decimal("0") and Decimal(str(it.current_stock)) < Decimal(str(it.min_stock))
    )

    alert_days = get_system_param_int(db, "batch_expiration_alert_days", default_val=30)
    today = date.today()
    threshold = today + timedelta(days=alert_days)

    batches_with_stock = db.query(Batch).filter(Batch.available_quantity > 0, Batch.expiration_date != None).all()
    near_expiry = sum(1 for b in batches_with_stock if today <= b.expiration_date <= threshold)
    expired = sum(1 for b in batches_with_stock if b.expiration_date < today)

    return InventoryAlertCounters(
        low_stock_count=low_stock,
        near_expiry_count=near_expiry,
        expired_count=expired
    )

