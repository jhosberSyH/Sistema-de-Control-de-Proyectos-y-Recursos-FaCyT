"""Pydantic validation schemas for Module 1."""

import re
from datetime import datetime
from typing import List, Optional
from pydantic import BaseModel, Field, field_validator

EMAIL_REGEX = re.compile(r"^[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+$")

VALID_ROLES = [
    "Administrador del Sistema",
    "Coordinador de Proyecto",
    "Aprobador / Gestor de Inventario"
]


# -----------------------------------------------------------------------------
# User Schemas (F1.1, F1.2, F1.3)
# -----------------------------------------------------------------------------

class UserBase(BaseModel):
    full_name: str = Field(..., min_length=2, max_length=150, description="Nombre completo de la persona")
    email: str = Field(..., description="Correo electrónico único")
    role: str = Field(..., description="Rol institucional en el sistema")

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        clean = value.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Escribe un correo electrónico válido (ejemplo: usuario@cpq.local).")
        return clean

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: str) -> str:
        if value not in VALID_ROLES:
            raise ValueError(f"Rol no permitido. Roles válidos: {', '.join(VALID_ROLES)}")
        return value


class UserCreate(UserBase):
    password: Optional[str] = Field(default="Demo2026*", min_length=6, description="Contraseña inicial")


class UserUpdate(BaseModel):
    full_name: Optional[str] = Field(None, min_length=2, max_length=150)
    email: Optional[str] = None
    role: Optional[str] = None
    confirm_reassignment: Optional[bool] = Field(
        default=False,
        description="Confirmación explícita para desvincular proyectos si cambia el rol de Coordinador"
    )

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: Optional[str]) -> Optional[str]:
        if value is not None:
            clean = value.strip().lower()
            if not EMAIL_REGEX.match(clean):
                raise ValueError("Escribe un correo electrónico válido (ejemplo: usuario@cpq.local).")
            return clean
        return value

    @field_validator("role")
    @classmethod
    def validate_role(cls, value: Optional[str]) -> Optional[str]:
        if value is not None and value not in VALID_ROLES:
            raise ValueError(f"Rol no permitido. Roles válidos: {', '.join(VALID_ROLES)}")
        return value


class ProjectSummary(BaseModel):
    id: str
    code: str
    title: str
    status: str

    class Config:
        from_attributes = True


class UserImpactResponse(BaseModel):
    user_id: str
    full_name: str
    role: str
    affected_projects: List[ProjectSummary]
    requires_confirmation: bool
    warning_message: Optional[str] = None


class UserResponse(BaseModel):
    id: str
    full_name: str
    email: str
    role: str
    is_active: bool
    last_login_at: Optional[datetime] = None
    coordinated_projects_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class UserStatusToggle(BaseModel):
    is_active: bool
    confirm_deactivation: Optional[bool] = Field(
        default=False,
        description="Confirmación de impacto si el usuario coordina proyectos activos"
    )


# -----------------------------------------------------------------------------
# Location Schemas (F1.4)
# -----------------------------------------------------------------------------

class LocationBase(BaseModel):
    name: str = Field(..., min_length=2, max_length=120, description="Nombre descriptivo del depósito")
    description: Optional[str] = Field(None, description="Detalle de ubicación física o condiciones")
    is_active: bool = Field(default=True, description="Estado operativo de la ubicación")


class LocationCreate(LocationBase):
    pass


class LocationUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=2, max_length=120)
    description: Optional[str] = None
    is_active: Optional[bool] = None


class LocationResponse(BaseModel):
    id: str
    name: str
    description: Optional[str] = None
    is_active: bool
    batches_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# System Parameter Schemas (F1.5)
# -----------------------------------------------------------------------------

class SystemParameterUpdate(BaseModel):
    parameter_value: int = Field(..., description="Valor entero estrictamente positivo (> 0)")

    @field_validator("parameter_value")
    @classmethod
    def validate_positive_integer(cls, value: int) -> int:
        if value <= 0:
            raise ValueError("El valor del parámetro debe ser un número entero mayor que cero (> 0).")
        return value


class SystemParameterResponse(BaseModel):
    id: str
    parameter_key: str
    parameter_value: int
    label: str
    description: Optional[str] = None
    unit: str
    updated_by_user_id: Optional[str] = None
    updated_by_name: Optional[str] = None
    updated_at: datetime

    class Config:
        from_attributes = True


# -----------------------------------------------------------------------------
# Auth Schemas
# -----------------------------------------------------------------------------

class LoginRequest(BaseModel):
    email: str
    password: str

    @field_validator("email")
    @classmethod
    def validate_email_format(cls, value: str) -> str:
        clean = value.strip().lower()
        if not EMAIL_REGEX.match(clean):
            raise ValueError("Escribe un correo electrónico válido.")
        return clean


class SessionInfo(BaseModel):
    user_id: str
    full_name: str
    email: str
    role: str
    csrf_token: str

