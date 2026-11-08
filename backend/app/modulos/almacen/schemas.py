"""Schemas and DTOs for Module 6: Warehouse and Immutable Outbound Log (F6.1 to F6.6)."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# F6.1: Batch Reception Schemas (HU-18)
# =============================================================================

class BatchCreateRequest(BaseModel):
    item_id: str = Field(..., description="Item ID from unified catalog (F3.1)")
    location_id: str = Field(..., description="Active location ID (F1.4)")
    batch_number: str = Field(..., min_length=1, max_length=60, description="Supplier or internal batch code")
    quantity: Decimal = Field(..., gt=0, description="Received quantity (> 0)")
    unit_cost: Decimal = Field(..., ge=0, description="Unit cost (>= 0)")
    supplier: Optional[str] = Field(None, max_length=150, description="Supplier name")
    received_date: date = Field(default_factory=date.today, description="Reception date")
    expiration_date: Optional[date] = Field(None, description="Expiration date (null if non-perishable)")
    expense_request_id: Optional[str] = Field(None, description="Optional associated expense request ID")
    force_expired_acceptance: bool = Field(
        default=False,
        description="Explicit confirmation flag if receiving an expired batch after warning"
    )

    @field_validator("quantity")
    def validate_quantity(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("La cantidad recibida debe ser un número positivo mayor que cero.")
        return v

    @field_validator("unit_cost")
    def validate_unit_cost(cls, v: Decimal) -> Decimal:
        if v < Decimal("0"):
            raise ValueError("El costo unitario no puede ser negativo.")
        return v


class BatchResponse(BaseModel):
    id: str
    item_id: Optional[str]
    item_name: Optional[str] = None
    item_unit: Optional[str] = None
    location_id: str
    location_name: Optional[str] = None
    batch_number: str
    initial_quantity: Decimal
    available_quantity: Decimal
    unit_cost: Decimal
    supplier: Optional[str]
    received_date: date
    expiration_date: Optional[date]
    expiration_status: str
    days_until_expiration: Optional[int] = None
    is_blocked_for_dispatch: bool = False
    created_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# F6.2: Dispatch Execution Schemas (HU-19)
# =============================================================================

class DispatchAllocationItem(BaseModel):
    batch_id: str = Field(..., description="Batch from which stock will be dispatched")
    quantity: Decimal = Field(..., gt=0, description="Quantity to dispatch from this batch")


class DispatchCreateRequest(BaseModel):
    request_id: str = Field(..., description="Approved withdrawal request ID (status 'Aprobado')")
    received_by_name: str = Field(..., min_length=2, max_length=150, description="Name of person withdrawing")
    allocations: List[DispatchAllocationItem] = Field(..., min_length=1, description="Batch quantity allocations")
    notes: Optional[str] = Field(None, description="Optional dispatch observations")


class DispatchResponse(BaseModel):
    id: str
    dispatch_number: str
    batch_id: str
    batch_number: Optional[str] = None
    item_id: Optional[str] = None
    item_name: Optional[str] = None
    item_unit: Optional[str] = None
    project_id: str
    project_code: Optional[str] = None
    project_title: Optional[str] = None
    dispatched_quantity: Decimal
    unit_cost_snapshot: Decimal
    total_cost: Decimal
    dispatched_by: str
    dispatched_by_name: Optional[str] = None
    received_by_name: str
    request_id: Optional[str]
    is_compensatory: bool
    original_dispatch_id: Optional[str] = None
    dispatched_at: datetime

    class Config:
        from_attributes = True


class SuggestedBatchForDispatch(BaseModel):
    batch_id: str
    batch_number: str
    location_name: str
    available_quantity: Decimal
    unit_cost: Decimal
    expiration_date: Optional[date] = None
    expiration_status: str
    days_until_expiration: Optional[int] = None
    is_suggested: bool = False
    is_blocked: bool = False


class WithdrawalItemDispatchSuggestion(BaseModel):
    item_id: str
    item_name: str
    unit_of_measure: str
    requested_quantity: Decimal
    approved_quantity: Decimal
    available_batches: List[SuggestedBatchForDispatch]


class WithdrawalRequestDispatchPreparation(BaseModel):
    request_id: str
    request_number: str
    project_id: str
    project_code: str
    project_title: str
    requester_name: str
    status: str
    items: List[WithdrawalItemDispatchSuggestion]


# =============================================================================
# F6.4: Raw Material Usage Schemas (HU-20)
# =============================================================================

class RawMaterialUsageCreateRequest(BaseModel):
    project_id: str = Field(..., description="Project ID")
    dispatch_id: str = Field(..., description="Original dispatch ID against which usage is reported")
    quantity_used: Decimal = Field(..., gt=0, description="Quantity actually used (> 0)")
    waste_quantity: Decimal = Field(default=Decimal("0.000"), ge=0, description="Waste or scrap quantity")
    usage_date: date = Field(default_factory=date.today, description="Date when material was consumed")
    notes: Optional[str] = Field(None, description="Observations / experiment notes")


class RawMaterialUsageResponse(BaseModel):
    id: str
    dispatch_id: str
    dispatch_number: Optional[str] = None
    project_id: str
    project_code: Optional[str] = None
    reported_by_user_id: str
    reported_by_name: Optional[str] = None
    item_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    dispatched_quantity: Decimal
    quantity_used: Decimal
    waste_quantity: Decimal
    usage_date: date
    notes: Optional[str]
    is_excess_over_dispatched: bool = False
    excess_quantity: Decimal = Decimal("0.000")
    created_at: datetime

    class Config:
        from_attributes = True


class ProjectMaterialBalanceSummary(BaseModel):
    project_id: str
    project_code: str
    item_id: str
    item_name: str
    unit_of_measure: str
    total_dispatched: Decimal
    total_used: Decimal
    total_waste: Decimal
    remaining_unreported: Decimal
    is_usage_exceeded: bool
    excess_quantity: Decimal


# =============================================================================
# F6.5 & F6.6: Dispatch Correction Schemas (HU-21, RF-35)
# =============================================================================

class DispatchCorrectionCreateRequest(BaseModel):
    original_dispatch_id: str = Field(..., description="Dispatch ID to correct")
    correct_quantity: Decimal = Field(..., ge=0, description="Correct actual quantity (>= 0)")
    justification: str = Field(..., min_length=5, description="Written reason for correction (mandatory)")


class DispatchCorrectionReviewRequest(BaseModel):
    approved: bool = Field(..., description="True to approve compensatory movement, False to deny")
    review_notes: Optional[str] = Field(None, description="Review remarks")


class DispatchCorrectionResponse(BaseModel):
    id: str
    original_dispatch_id: str
    original_dispatch_number: Optional[str] = None
    project_id: Optional[str] = None
    project_code: Optional[str] = None
    item_name: Optional[str] = None
    unit_of_measure: Optional[str] = None
    original_quantity: Decimal
    correct_quantity: Decimal
    quantity_difference: Decimal
    requested_by_user_id: str
    requested_by_name: Optional[str] = None
    reviewed_by_user_id: Optional[str] = None
    reviewed_by_name: Optional[str] = None
    status: str
    justification: str
    compensatory_dispatch_id: Optional[str] = None
    compensatory_dispatch_number: Optional[str] = None
    reviewed_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True
