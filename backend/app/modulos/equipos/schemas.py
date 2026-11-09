"""Pydantic schemas for Module 4: Equipment and Reservations (F4.1 to F4.6)."""

from datetime import datetime
from decimal import Decimal
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator, model_validator

VALID_EQUIPMENT_STATUSES = ["Disponible", "En uso", "En mantenimiento"]
VALID_RESERVATION_STATUSES = [
    "Borrador",
    "Pendiente de Aprobación",
    "Aprobado",
    "Rechazado",
    "Cancelado",
]


# -----------------------------------------------------------------------------
# Nested summaries
# -----------------------------------------------------------------------------

class UserSummary(BaseModel):
    id: str
    full_name: str
    email: str

    class Config:
        from_attributes = True


class LocationSummary(BaseModel):
    id: str
    name: str

    class Config:
        from_attributes = True


class ProjectSummary(BaseModel):
    id: str
    code: str
    title: str

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Equipment (F4.1, F4.2)
# -----------------------------------------------------------------------------

class EquipmentBase(BaseModel):
    asset_code: str = Field(..., min_length=1, max_length=50, description="Código único de activo")
    name: str = Field(..., min_length=2, max_length=150)
    location_id: str = Field(..., description="Ubicación activa del catálogo (F1.4)")
    description: Optional[str] = None

    @field_validator("asset_code")
    @classmethod
    def normalize_code(cls, v: str) -> str:
        clean = v.strip().upper()
        if not clean:
            raise ValueError("El código de activo no puede estar vacío.")
        return clean

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: str) -> str:
        return v.strip()


class EquipmentCreate(EquipmentBase):
    pass


class EquipmentUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=150)
    location_id: Optional[str] = None
    description: Optional[str] = None

    @field_validator("name")
    @classmethod
    def strip_name(cls, v: Optional[str]) -> Optional[str]:
        return v.strip() if v is not None else v


class EquipmentStatusUpdate(BaseModel):
    status: str = Field(..., description="Nuevo estado operacional")

    @field_validator("status")
    @classmethod
    def validate_status(cls, v: str) -> str:
        clean = v.strip()
        if clean not in VALID_EQUIPMENT_STATUSES:
            raise ValueError(
                f"Estado inválido. Debe ser uno de: {', '.join(VALID_EQUIPMENT_STATUSES)}."
            )
        if clean == "En uso":
            raise ValueError(
                "El estado 'En uso' no se gestiona manualmente en esta versión. "
                "Use 'Disponible' o 'En mantenimiento'."
            )
        return clean


class EquipmentResponse(BaseModel):
    id: str
    asset_code: str
    name: str
    location: LocationSummary
    operational_status: str
    description: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class EquipmentDetailResponse(EquipmentResponse):
    active_reservations_count: int = 0
    total_usages: int = 0


# -----------------------------------------------------------------------------
# Reservations (F4.3, F4.4, F4.5)
# -----------------------------------------------------------------------------

class ReservationCreate(BaseModel):
    project_id: str = Field(..., description="Proyecto del coordinador autenticado")
    start_time: datetime
    end_time: datetime
    notes: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def ensure_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError(
                "La fecha y hora deben incluir zona horaria (ej. 2026-11-09T10:00:00Z)."
            )
        return v

    @model_validator(mode="after")
    def validate_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("La hora de inicio debe ser anterior a la hora de fin.")
        return self


class ReservationResponse(BaseModel):
    id: str
    equipment: EquipmentResponse
    project: ProjectSummary
    reserved_by: UserSummary
    approved_by: Optional[UserSummary] = None
    start_time: datetime
    end_time: datetime
    status: str
    notes: Optional[str] = None
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class ReservationDecisionRequest(BaseModel):
    reason: Optional[str] = Field(
        None,
        max_length=500,
        description="Motivo opcional de la decisión (se guarda en notes si se proporciona).",
    )


class ReservationCancelReason(BaseModel):
    reason: Optional[str] = None


# -----------------------------------------------------------------------------
# Calendar / overlap diagnostics (F4.4, D19)
# -----------------------------------------------------------------------------

class CalendarConflict(BaseModel):
    reservation_id: str
    project: ProjectSummary
    start_time: datetime
    end_time: datetime
    status: str


class CalendarResponse(BaseModel):
    equipment_id: str
    occupied_ranges: List[CalendarConflict] = []
    next_free_before: Optional[datetime] = None
    next_free_after: Optional[datetime] = None


# -----------------------------------------------------------------------------
# Equipment usage (F4.6, D25, D26)
# -----------------------------------------------------------------------------

class UsageCreate(BaseModel):
    project_id: str = Field(..., description="Proyecto del coordinador autenticado")
    reservation_id: Optional[str] = Field(
        None,
        description="Reserva aprobada del mismo equipo y proyecto (opcional, SP-06)",
    )
    start_time: datetime
    end_time: datetime
    observations: Optional[str] = None

    @field_validator("start_time", "end_time")
    @classmethod
    def ensure_timezone(cls, v: datetime) -> datetime:
        if v.tzinfo is None:
            raise ValueError("La fecha y hora deben incluir zona horaria.")
        return v

    @model_validator(mode="after")
    def validate_range(self):
        if self.start_time >= self.end_time:
            raise ValueError("La hora de inicio debe ser anterior a la hora de fin.")
        return self


class UsageResponse(BaseModel):
    id: str
    equipment_id: str
    project: ProjectSummary
    reservation_id: Optional[str] = None
    registered_by: UserSummary
    start_time: datetime
    end_time: datetime
    used_hours: Decimal
    observations: Optional[str] = None
    created_at: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Status change response with auto-cancelled reservations (D21)
# -----------------------------------------------------------------------------

class EquipmentStatusChangeResponse(BaseModel):
    equipment: EquipmentResponse
    cancelled_reservations: List[ReservationResponse] = []
    warning_message: Optional[str] = None