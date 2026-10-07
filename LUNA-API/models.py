# models.py
from __future__ import annotations

from datetime import datetime
from typing import Any, Dict, List, Literal, Optional
from uuid import UUID

from pydantic import AliasChoices, BaseModel, Field, field_validator

RoleLevel = Literal["User", "Supervisor", "Manager", "Admin"]


class UserLogin(BaseModel):
    employee_id: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)


class PasswordResetRequest(BaseModel):
    employee_id: str = Field(..., min_length=3, max_length=50)


class PasswordResetConfirm(BaseModel):
    employee_id: str = Field(..., min_length=3, max_length=50)
    code: str = Field(..., min_length=6, max_length=6, pattern=r"^\d{6}$")
    password: str = Field(..., min_length=8, max_length=128)

    @field_validator("password")
    @classmethod
    def normalize_password(cls, value: str) -> str:
        normalized = value.strip()
        if len(normalized) < 8:
            raise ValueError("Password must contain at least 8 non-whitespace characters")
        return normalized


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None


class ProfileUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    department: Optional[str] = Field(default=None, min_length=1, max_length=120)
    email: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, max_length=40)

    @field_validator("email")
    @classmethod
    def require_luna_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        return normalized or None


class WorkspaceSettingsUpdate(BaseModel):
    favorites: Optional[List[str]] = None
    workspace_layout: Optional[List[Dict[str, Any]]] = None


class ResourceResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    type: Optional[str] = None
    url: Optional[str] = None
    icon: Optional[str] = None
    department_id: Optional[UUID] = None
    viewing_level: RoleLevel = "User"


class ResourceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    type: Optional[str] = Field(default="webapp", min_length=1, max_length=50)
    url: Optional[str] = None
    icon: Optional[str] = None
    department_id: Optional[UUID] = None
    viewing_level: Optional[RoleLevel] = Field(
        default=None,
        validation_alias=AliasChoices("viewing_level", "required_role"),
    )


class ResourceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    type: Optional[str] = Field(default=None, min_length=1, max_length=50)
    url: Optional[str] = None
    icon: Optional[str] = None
    department_id: Optional[UUID] = None
    viewing_level: Optional[RoleLevel] = Field(
        default=None,
        validation_alias=AliasChoices("viewing_level", "required_role"),
    )


class NotificationCreate(BaseModel):
    message: str = Field(..., min_length=1, max_length=300)
    target_role_level: RoleLevel
    is_read: bool = False


class NotificationResponse(BaseModel):
    id: UUID
    message: str
    target_role_level: RoleLevel
    created_at: datetime
    is_read: bool = False


class PushTokenRegistration(BaseModel):
    expo_push_token: str = Field(
        ...,
        min_length=20,
        max_length=200,
        pattern=r"^(Expo|Exponent)PushToken\[[^\]]+\]$",
    )


class DepartmentResponse(BaseModel):
    id: UUID
    name: str
    icon: Optional[str] = None
    sort_order: int = 0


class DepartmentCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=60)
    icon: Optional[str] = None
    sort_order: int = 0


class UserCreate(BaseModel):
    employee_id: str = Field(..., min_length=3, max_length=50)
    name: str = Field(..., min_length=1, max_length=120)
    password: str = Field(..., min_length=6, max_length=128)
    role: RoleLevel = "User"
    department: Optional[str] = None
    active: bool = True
    email: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, min_length=3, max_length=40)

    @field_validator("email")
    @classmethod
    def require_luna_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        return normalized or None


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)
    role: Optional[RoleLevel] = None
    department: Optional[str] = None
    active: Optional[bool] = None
    email: Optional[str] = Field(default=None, max_length=160)
    phone: Optional[str] = Field(default=None, min_length=3, max_length=40)

    @field_validator("email")
    @classmethod
    def require_luna_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        return normalized or None
