"""Schemas and DTOs for Module 7: Accounting Period Closing & Overhead Proration (F7.1 to F7.4)."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator


# =============================================================================
# F7.1: Period Opening and Review Schemas (HU-22)
# =============================================================================

class AccountingPeriodCreateRequest(BaseModel):
    period_name: str = Field(..., min_length=3, max_length=100, description="Name e.g. 'Octubre 2026'")
    period_type: str = Field(..., description="'Mensual' or 'Trimestral'")
    start_date: date = Field(..., description="Start date of period")
    end_date: date = Field(..., description="End date of period")
    total_overhead_cost: Optional[Decimal] = Field(
        None, ge=0, description="Optional manual overhead override (if not auto-computed from general batches)"
    )

    @field_validator("period_type")
    def validate_period_type(cls, v: str) -> str:
        clean = v.strip().capitalize()
        if clean not in ("Mensual", "Trimestral"):
            raise ValueError("El tipo de período debe ser 'Mensual' o 'Trimestral'.")
        return clean

    @field_validator("end_date")
    def validate_date_range(cls, v: date, info) -> date:
        start = info.data.get("start_date")
        if start and v < start:
            raise ValueError("La fecha final no puede ser anterior a la fecha inicial.")
        return v


class ProjectChargeDetail(BaseModel):
    id: str
    charge_date: date
    concept: str
    origin_type: str  # 'Despacho' o 'Gasto'
    reference_code: str  # e.g. DES-0318 or SOL-109
    amount: Decimal
    is_correction: bool = False
    can_request_correction: bool = False


class ProjectChargesReviewResponse(BaseModel):
    project_id: str
    project_code: str
    project_title: str
    coordinator_name: str
    is_confirmed: bool
    confirmed_at: Optional[datetime] = None
    comments: Optional[str] = None
    total_charges_count: int
    total_amount: Decimal
    charges: List[ProjectChargeDetail]


class PeriodConfirmationSummaryItem(BaseModel):
    project_id: str
    project_code: str
    project_title: str
    coordinator_id: str
    coordinator_name: str
    charges_count: int
    total_amount: Decimal
    is_confirmed: bool
    confirmed_at: Optional[datetime] = None


class PeriodConfirmationDashboardResponse(BaseModel):
    period_id: str
    period_name: str
    period_type: str
    start_date: date
    end_date: date
    status: str
    total_active_projects: int
    confirmed_projects_count: int
    confirmation_percentage: Decimal
    confirmations: List[PeriodConfirmationSummaryItem]


class ProjectChargesConfirmRequest(BaseModel):
    comments: Optional[str] = Field(None, description="Optional coordinator remarks")


# =============================================================================
# F7.2: Period Closing Schemas (HU-23)
# =============================================================================

class AccountingPeriodCloseRequest(BaseModel):
    force_close_missing_confirmations: bool = Field(
        default=False,
        description="Allow closing even if some active coordinators have not yet confirmed"
    )


class AccountingPeriodResponse(BaseModel):
    id: str
    period_name: str
    period_type: str
    start_date: date
    end_date: date
    status: str
    proration_criterion: Optional[str] = None
    total_overhead_cost: Decimal
    closed_by_user_id: Optional[str] = None
    closed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# =============================================================================
# F7.3 & F7.4: Proration Preview & Execution Schemas (HU-23)
# =============================================================================

class ProrationProjectItem(BaseModel):
    project_id: str
    project_code: str
    project_title: str
    operational_status: str
    is_active_for_proration: bool
    direct_consumption: Decimal
    consumption_percentage: Decimal
    allocated_overhead: Decimal
    has_rounding_residual: bool = False
    residual_cents: Decimal = Decimal("0.00")


class ProrationPreviewResponse(BaseModel):
    period_id: str
    period_name: str
    start_date: date
    end_date: date
    proration_criterion: str  # 'Proporcional' or 'Equitativo'
    total_overhead_cost: Decimal
    total_active_projects_consumption: Decimal
    active_projects_count: int
    excluded_projects_count: int
    rounding_residual: Decimal
    residual_assigned_to_project_code: Optional[str] = None
    allocations: List[ProrationProjectItem]


class ProrationExecuteRequest(BaseModel):
    proration_criterion: str = Field(..., description="'Proporcional' or 'Equitativo'")

    @field_validator("proration_criterion")
    def validate_criterion(cls, v: str) -> str:
        clean = v.strip().capitalize()
        if clean not in ("Proporcional", "Equitativo"):
            raise ValueError("El criterio de prorrateo debe ser 'Proporcional' o 'Equitativo'.")
        return clean


class OverheadAllocationResponse(BaseModel):
    id: str
    period_id: str
    project_id: str
    project_code: Optional[str] = None
    registered_consumption: Decimal
    consumption_pct: Decimal
    allocated_amount: Decimal
    applied_at: datetime

    class Config:
        from_attributes = True
