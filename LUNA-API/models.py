# models.py
from __future__ import annotations

from typing import Optional
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class UserLogin(BaseModel):
    employee_id: str = Field(..., min_length=3, max_length=50)
    password: str = Field(..., min_length=6, max_length=128)


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    name: Optional[str] = None
    employee_id: Optional[str] = None
    department: Optional[str] = None


class ResourceResponse(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    type: str
    url: Optional[str] = None
    icon: Optional[str] = None
    department_id: Optional[UUID] = None
    required_role: Optional[str] = None


class ResourceCreate(BaseModel):
    title: str = Field(..., min_length=1, max_length=120)
    description: Optional[str] = None
    type: str = Field(default="webapp", min_length=1, max_length=50)
    url: Optional[str] = None
    icon: Optional[str] = None
    department_id: Optional[UUID] = None
    required_role: Optional[str] = None


class ResourceUpdate(BaseModel):
    title: Optional[str] = Field(default=None, min_length=1, max_length=120)
    description: Optional[str] = None
    type: Optional[str] = Field(default=None, min_length=1, max_length=50)
    url: Optional[str] = None
    icon: Optional[str] = None
    department_id: Optional[UUID] = None
    required_role: Optional[str] = None


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
    role: str = Field(default="User", min_length=1, max_length=30)
    department: Optional[str] = None
    active: bool = True
    email: Optional[str] = Field(default=None, min_length=3, max_length=160)
    phone: Optional[str] = Field(default=None, min_length=3, max_length=40)

    @field_validator("email")
    @classmethod
    def require_luna_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if "@" not in normalized or normalized.rsplit("@", 1)[1].lower() != "luna.co.in":
            raise ValueError("Employee email must use the @luna.co.in domain")
        return f"{normalized.rsplit('@', 1)[0]}@luna.co.in"


class UserUpdate(BaseModel):
    name: Optional[str] = Field(default=None, min_length=1, max_length=120)
    password: Optional[str] = Field(default=None, min_length=6, max_length=128)
    role: Optional[str] = Field(default=None, min_length=1, max_length=30)
    department: Optional[str] = None
    active: Optional[bool] = None
    email: Optional[str] = Field(default=None, min_length=3, max_length=160)
    phone: Optional[str] = Field(default=None, min_length=3, max_length=40)

    @field_validator("email")
    @classmethod
    def require_luna_email(cls, value: Optional[str]) -> Optional[str]:
        if value is None:
            return value
        normalized = value.strip()
        if "@" not in normalized or normalized.rsplit("@", 1)[1].lower() != "luna.co.in":
            raise ValueError("Employee email must use the @luna.co.in domain")
        return f"{normalized.rsplit('@', 1)[0]}@luna.co.in"
