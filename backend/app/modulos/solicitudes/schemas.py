"""Pydantic schemas for Module 5: Requests and Prioritization (F5.1 to F5.7)."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

VALID_REQUEST_TYPES = ["Gasto", "Retiro"]
VALID_REQUEST_STATUSES = [
    "Borrador",
    "Pendiente de Aprobación",
    "Aprobado",
    "Rechazado",
    "Ejecutado",
]
VALID_PRIORITIES = ["Crítica", "Alta", "Media", "Baja"]


# -----------------------------------------------------------------------------
# Nested summaries
# -----------------------------------------------------------------------------

class UserSummary(BaseModel):
    id: str
    full_name: str
    email: str

    class Config:
        from_attributes = True


class ProjectMetricsResponse(BaseModel):
    assigned_budget: Decimal
    executed_budget: Decimal
    execution_pct: Decimal
    physical_progress_pct: Optional[Decimal] = None
    physical_progress_available: bool


# -----------------------------------------------------------------------------
# Request items
# -----------------------------------------------------------------------------

class RequestItemCreate(BaseModel):
    item_id: str = Field(..., description="ID del insumo en el catálogo unificado")
    requested_quantity: Decimal = Field(..., gt=0, description="Cantidad solicitada (> 0)")
    unit_cost_estimate: Optional[Decimal] = Field(
        None,
        ge=0,
        description=(
            "Costo unitario estimado. Para Gasto puede enviarse o dejarse en 0. "
            "Para Retiro el servidor lo autocalcula con el último lote."
        ),
    )


class RequestItemResponse(BaseModel):
    id: str
    item_id: str
    item_name: str
    unit_of_measure: str
    requested_quantity: Decimal
    approved_quantity: Optional[Decimal] = None
    unit_cost_estimate: Decimal

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Create / Update (F5.1, F5.2, F5.3)
# -----------------------------------------------------------------------------

class RequestCreate(BaseModel):
    request_type: str = Field(..., description="'Gasto' o 'Retiro'")
    project_id: str
    description: str = Field(
        ...,
        min_length=2,
        max_length=1000,
        description="Descripción libre de la solicitud (se guarda en decision_reason).",
    )
    items: List[RequestItemCreate] = Field(..., min_length=1)

    @field_validator("request_type")
    @classmethod
    def validate_type(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_REQUEST_TYPES:
            raise ValueError(
                f"Tipo inválido. Debe ser uno de: {', '.join(VALID_REQUEST_TYPES)}."
            )
        return clean

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("La descripción no puede estar vacía.")
        return clean

    @model_validator(mode="after")
    def validate_unique_items(self):
        item_ids = [it.item_id for it in self.items]
        if len(item_ids) != len(set(item_ids)):
            raise ValueError(
                "Cada insumo debe aparecer una sola vez por solicitud. "
                "Use una cantidad mayor si necesita más del mismo insumo."
            )
        return self


class RequestUpdate(BaseModel):
    description: Optional[str] = Field(None, min_length=2, max_length=1000)
    items: Optional[List[RequestItemCreate]] = None

    @field_validator("description")
    @classmethod
    def strip_description(cls, v: Optional[str]) -> Optional[str]:
        if v is None:
            return v
        clean = v.strip()
        if not clean:
            raise ValueError("La descripción no puede estar vacía.")
        return clean

    @model_validator(mode="after")
    def validate_unique_items(self):
        if self.items is not None:
            item_ids = [it.item_id for it in self.items]
            if len(item_ids) != len(set(item_ids)):
                raise ValueError(
                    "Cada insumo debe aparecer una sola vez por solicitud."
                )
            if len(self.items) == 0:
                raise ValueError("La solicitud debe tener al menos un ítem.")
        return self


# -----------------------------------------------------------------------------
# Decisions (F5.4, F5.5)
# -----------------------------------------------------------------------------

class ApprovedItemAdjustment(BaseModel):
    request_item_id: str
    approved_quantity: Decimal = Field(..., gt=0)


class DecisionRequest(BaseModel):
    reason: Optional[str] = Field(
        None,
        max_length=1000,
        description="Obligatorio al rechazar. Opcional al aprobar.",
    )
    adjustments: Optional[List[ApprovedItemAdjustment]] = Field(
        None,
        description="Ajustes opcionales a la baja de las cantidades aprobadas.",
    )


class ExecuteRequest(BaseModel):
    actual_amount: Decimal = Field(
        ...,
        gt=0,
        description="Monto real de la adquisición (> 0). Puede diferir del estimado.",
    )
    notes: Optional[str] = Field(None, max_length=1000)


# -----------------------------------------------------------------------------
# Output
# -----------------------------------------------------------------------------

class RequestResponse(BaseModel):
    id: str
    request_number: str
    request_type: str
    status: str
    project_id: str
    project_code: str
    project_title: str
    description: Optional[str] = None
    estimated_amount: Decimal
    actual_amount: Decimal
    requester: UserSummary
    decided_by: Optional[UserSummary] = None
    decided_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime


class RequestDetailResponse(RequestResponse):
    items: List[RequestItemResponse]
    project_metrics: ProjectMetricsResponse


# -----------------------------------------------------------------------------
# Prioritization (F5.6, F5.7)
# -----------------------------------------------------------------------------

class PrioritizedProjectResponse(BaseModel):
    id: str
    code: str
    title: str
    priority: str
    status: str
    coordinator: Optional[UserSummary] = None
    execution_pct: Decimal


class PriorityChangeRequest(BaseModel):
    priority: str
    justification: str = Field(..., min_length=3, max_length=1000)

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_PRIORITIES:
            raise ValueError(
                f"Prioridad inválida. Debe ser una de: {', '.join(VALID_PRIORITIES)}."
            )
        return clean

    @field_validator("justification")
    @classmethod
    def strip_justification(cls, v: str) -> str:
        clean = v.strip()
        if not clean:
            raise ValueError("La justificación es obligatoria.")
        return clean