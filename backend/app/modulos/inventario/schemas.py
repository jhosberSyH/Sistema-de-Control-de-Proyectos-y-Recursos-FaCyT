"""Pydantic schemas for Module 3: Inventory (F3.1 to F3.7)."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


VALID_ITEM_TYPES = [
    "Materia prima",
    "Consumible de proyecto",
    "Consumible de uso general",
]


class ItemBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150, description="Nombre descriptivo del insumo")
    unit_of_measure: str = Field(..., min_length=1, max_length=30, description="Unidad de medida (ej. L, mL, g, kg, unidad)")
    item_type: str = Field(..., description="Tipo de insumo (RN-02)")

    @field_validator("name", "unit_of_measure")
    @classmethod
    def strip_whitespace(cls, v: str) -> str:
        cleaned = v.strip()
        if not cleaned:
            raise ValueError("El campo no puede estar vacío ni contener solo espacios.")
        return cleaned

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_ITEM_TYPES:
            raise ValueError(
                f"Tipo de insumo inválido. Debe ser uno de: {', '.join(VALID_ITEM_TYPES)}."
            )
        return clean


class ItemCreate(ItemBase):
    min_stock: Optional[Decimal] = Field(None, description="Stock mínimo para alertas (> 0)")

    @field_validator("min_stock")
    @classmethod
    def validate_min_stock(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("El stock mínimo debe ser un número positivo mayor a 0.")
        return v


class ItemUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    unit_of_measure: Optional[str] = Field(None, min_length=1, max_length=30)
    item_type: Optional[str] = None
    is_active: Optional[bool] = None

    @field_validator("item_type")
    @classmethod
    def validate_item_type(cls, v: Optional[str]) -> Optional[str]:
        if v is not None:
            clean = v.strip()
            if clean not in VALID_ITEM_TYPES:
                raise ValueError(
                    f"Tipo de insumo inválido. Debe ser uno de: {', '.join(VALID_ITEM_TYPES)}."
                )
            return clean
        return v


class ItemMinStockUpdate(BaseModel):
    min_stock: Optional[Decimal] = Field(..., description="Nuevo stock mínimo (> 0) o null para desactivar")

    @field_validator("min_stock")
    @classmethod
    def validate_min_stock(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("El stock mínimo debe ser un número positivo mayor a 0.")
        return v


class BatchSummary(BaseModel):
    id: str
    batch_number: str
    location_id: str
    location_name: str
    initial_quantity: Decimal
    available_quantity: Decimal
    unit_cost: Decimal
    supplier: Optional[str] = None
    received_date: date
    expiration_date: Optional[date] = None
    expiration_status: str
    days_until_expiration: Optional[int] = None
    is_blocked: bool = False

    class Config:
        from_attributes = True


class AutomaticReplenishmentSummary(BaseModel):
    request_id: str
    request_number: str
    status: str
    suggested_quantity: Decimal
    created_at: datetime
    can_submit: bool = True
    can_discard: bool = True

    class Config:
        from_attributes = True


class ItemResponse(BaseModel):
    id: str
    name: str
    unit_of_measure: str
    item_type: str
    current_stock: Decimal
    min_stock: Optional[Decimal] = None
    forecasted_consumption: Optional[Decimal] = None
    is_active: bool
    is_low_stock: bool
    batches_count: int
    next_expiration_date: Optional[date] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ItemDetailResponse(ItemResponse):
    batches: List[BatchSummary] = []
    active_replenishment: Optional[AutomaticReplenishmentSummary] = None
    forecast_message: Optional[str] = None


class InventoryAlertCounters(BaseModel):
    low_stock_count: int
    near_expiry_count: int
    expired_count: int


class ReplenishmentDecisionRequest(BaseModel):
    action: str = Field(..., description="'submit' para enviar a aprobación o 'discard' para descartar borrador")
    adjusted_quantity: Optional[Decimal] = Field(None, description="Cantidad ajustada opcionalmente por el gestor")

    @field_validator("action")
    @classmethod
    def validate_action(cls, v: str) -> str:
        clean = v.strip().lower()
        if clean not in ("submit", "discard"):
            raise ValueError("La acción debe ser 'submit' (enviar a aprobación) o 'discard' (descartar).")
        return clean

    @field_validator("adjusted_quantity")
    @classmethod
    def validate_qty(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None and v <= 0:
            raise ValueError("La cantidad debe ser mayor a 0.")
        return v


class StockMovementRequest(BaseModel):
    item_id: str
    batch_id: str
    quantity_change: Decimal
    movement_type: str = Field(..., description="'RECEIPT' o 'DISPATCH'")
    notes: Optional[str] = None

