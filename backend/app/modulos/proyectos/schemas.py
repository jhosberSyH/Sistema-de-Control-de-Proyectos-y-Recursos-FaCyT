"""Pydantic schemas for Module 2: Projects and Advancement (F2.1 to F2.7)."""

from datetime import date, datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

VALID_PROJECT_STATUSES = ["Propuesta", "En ejecución", "Suspendido", "Finalizado"]
VALID_PRIORITIES = ["Crítica", "Alta", "Media", "Baja"]


class UserSummary(BaseModel):
    id: str
    full_name: str
    email: str

    class Config:
        from_attributes = True


class ProjectBase(BaseModel):
    code: str = Field(..., min_length=1, max_length=30, description="Código único alfanumérico institucional")
    title: str = Field(..., min_length=2, max_length=255, description="Nombre del proyecto")
    priority: str = Field(..., description="Nivel de prioridad (Crítica, Alta, Media, Baja)")
    assigned_budget: Decimal = Field(..., gt=0, description="Presupuesto asignado (> 0)")

    @field_validator("code")
    @classmethod
    def validate_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if not clean:
            raise ValueError("El código no puede estar vacío.")
        if not all(c.isalnum() or c == "-" for c in clean):
            raise ValueError("El código solo puede contener letras, números y guiones.")
        return clean

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: str) -> str:
        return v.strip()

    @field_validator("priority")
    @classmethod
    def validate_priority(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_PRIORITIES:
            raise ValueError(f"Prioridad inválida. Debe ser una de: {', '.join(VALID_PRIORITIES)}.")
        return clean


class ProjectCreate(ProjectBase):
    pass


class ProjectUpdate(BaseModel):
    title: Optional[str] = Field(None, min_length=2, max_length=255)
    assigned_budget: Optional[Decimal] = Field(None, gt=0)

    @field_validator("title")
    @classmethod
    def strip_title(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v is not None else v


class ProjectStatusUpdate(BaseModel):
    status: str = Field(..., description="Nuevo estatus operativo")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_PROJECT_STATUSES:
            raise ValueError(f"Estatus inválido. Debe ser uno de: {', '.join(VALID_PROJECT_STATUSES)}.")
        return clean


class ProjectCoordinatorUpdate(BaseModel):
    coordinator_id: str = Field(..., description="ID del usuario con rol Coordinador de Proyecto")


class ProjectMetricsResponse(BaseModel):
    assigned_budget: Decimal
    executed_budget: Decimal
    execution_pct: Decimal
    physical_progress_pct: Optional[Decimal] = None
    physical_progress_available: bool
    total_milestones_weight: Decimal
    milestones_count: int


class ProjectResponse(BaseModel):
    id: str
    code: str
    title: str
    status: str
    priority: str
    assigned_budget: Decimal
    executed_budget: Decimal
    execution_pct: Decimal
    physical_progress_pct: Optional[Decimal] = None
    physical_progress_available: bool
    coordinator: Optional[UserSummary] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ProjectDetailResponse(ProjectResponse):
    total_milestones_weight: Decimal
    milestones_count: int


class MilestoneBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=150)
    description: Optional[str] = None
    weight: Decimal = Field(..., gt=0, le=100, description="Peso del hito (> 0 y <= 100)")
    target_date: Optional[date] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class MilestoneCreate(MilestoneBase):
    pass


class MilestoneUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    description: Optional[str] = None
    weight: Optional[Decimal] = Field(None, gt=0, le=100)
    target_date: Optional[date] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v is not None else v


class MilestoneProgressCreate(BaseModel):
    progress_pct: Decimal = Field(..., ge=0, le=100, description="Porcentaje completado (0-100)")
    notes: Optional[str] = None


class MilestoneResponse(BaseModel):
    id: str
    project_id: str
    name: str
    description: Optional[str] = None
    weight: Decimal
    current_progress_pct: Decimal
    target_date: Optional[date] = None
    completed_at: Optional[datetime] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class MilestoneProgressLogResponse(BaseModel):
    id: str
    milestone_id: str
    reported_by: UserSummary
    previous_progress_pct: Decimal
    new_progress_pct: Decimal
    notes: Optional[str] = None
    reported_at: datetime

    class Config:
        from_attributes = True