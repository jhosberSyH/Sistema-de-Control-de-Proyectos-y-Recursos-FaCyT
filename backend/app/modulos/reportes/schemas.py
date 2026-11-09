"""Pydantic schemas for Module 8: Reports (F8.1 to F8.4)."""

from datetime import date
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel


class DashboardProjectItem(BaseModel):
    id: str
    code: str
    title: str
    priority: str
    assigned_budget: Decimal
    executed_budget: Decimal
    execution_pct: Decimal
    physical_progress_pct: Optional[Decimal] = None
    physical_progress_available: bool


class LowStockAlertItem(BaseModel):
    item_id: str
    item_name: str
    unit_of_measure: str
    current_stock: Decimal
    min_stock: Decimal


class NearExpiryAlertItem(BaseModel):
    batch_id: str
    batch_number: str
    item_id: str
    item_name: str
    expiration_date: date
    days_remaining: int
    status: str  # "Próximo a vencer" | "Vencido"


class DashboardResponse(BaseModel):
    active_projects_count: int
    global_assigned_budget: Decimal
    global_executed_budget: Decimal
    global_execution_pct: Decimal
    active_projects: List[DashboardProjectItem]
    low_stock_alerts: List[LowStockAlertItem]
    near_expiry_alerts: List[NearExpiryAlertItem]