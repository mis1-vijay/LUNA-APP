# main.py
from __future__ import annotations

import os
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import get_supabase
from models import (
    DepartmentCreate,
    DepartmentResponse,
    ResourceCreate,
    ResourceResponse,
    ResourceUpdate,
    Token,
    UserCreate,
    UserLogin,
    UserUpdate,
)

app = FastAPI(title="Luna Tech Portal API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

JWT_SECRET_KEY = os.getenv("JWT_SECRET_KEY", "change-me-in-production")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60 * 8

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

ROLE_PRIORITY = {
    "User": 1,
    "Supervisor": 2,
    "Manager": 3,
    "Admin": 4,
}

DEFAULT_DEPARTMENTS = [
    {"name": "Automation", "icon": "cpu", "sort_order": 1},
    {"name": "Hiwin", "icon": "factory", "sort_order": 2},
    {"name": "Cutting", "icon": "scissors", "sort_order": 3},
    {"name": "Machining", "icon": "cog", "sort_order": 4},
    {"name": "Packing", "icon": "package", "sort_order": 5},
    {"name": "RFD", "icon": "truck", "sort_order": 6},
    {"name": "Invoice", "icon": "receipt", "sort_order": 7},
    {"name": "Dispatch", "icon": "send", "sort_order": 8},
]

DEPARTMENT_SORT_ORDER = {
    "Automation": 1,
    "Hiwin": 2,
    "Cutting": 3,
    "Machining": 4,
    "Packing": 5,
    "RFD": 6,
    "Invoice": 7,
    "Dispatch": 8,
}

DEFAULT_RESOURCES = [
    {"title": "Task Manager", "description": "Daily task planning and execution", "type": "webapp", "url": "https://example.com/task-manager", "icon": "clipboard", "department": "Automation", "required_role": "User"},
    {"title": "Stock Query", "description": "Material and inventory visibility", "type": "webapp", "url": "https://example.com/stock-query", "icon": "box", "department": "Machining", "required_role": "Manager"},
    {"title": "Packing Photos", "description": "Packing and dispatch visual checks", "type": "webapp", "url": "https://example.com/packing-photos", "icon": "image", "department": "Packing", "required_role": "User"},
    {"title": "Production Board", "description": "Line performance and bottlenecks", "type": "webapp", "url": "https://example.com/production-board", "icon": "chart", "department": "Automation", "required_role": "Supervisor"},
    {"title": "Quality Tracker", "description": "Defect and compliance monitoring", "type": "webapp", "url": "https://example.com/quality-tracker", "icon": "shield-check", "department": "Hiwin", "required_role": "User"},
    {"title": "Daily Production Summary", "description": "Latest update from the floor", "type": "report", "icon": "file-text", "department": "Automation", "required_role": "User"},
    {"title": "Gate Pass Register", "description": "Vehicle and dispatch tracking", "type": "form", "icon": "clipboard-list", "department": "Dispatch", "required_role": "Supervisor"},
    {"title": "Equipment Downtime Log", "description": "Trend and maintenance notes", "type": "report", "icon": "tool", "department": "Machining", "required_role": "Manager"},
    {"title": "User Access Matrix", "description": "Role and department mapping", "type": "report", "icon": "users", "department": "Automation", "required_role": "Admin"},
    {"title": "System Audit", "description": "Recent operational review log", "type": "report", "icon": "activity", "department": "Automation", "required_role": "Manager"},
]


def create_access_token(employee_id: str, role: str) -> str:
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=JWT_EXPIRATION_MINUTES)
    payload = {
        "sub": employee_id,
        "role": role,
        "exp": expires_at,
    }
    return jwt.encode(payload, JWT_SECRET_KEY, algorithm=JWT_ALGORITHM)


def has_access(user_role: str, required_role: Optional[str]) -> bool:
    if not required_role:
        return True
    return ROLE_PRIORITY.get(user_role, 0) >= ROLE_PRIORITY.get(required_role, 0)


def get_user_by_employee_id(employee_id: str) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    response = supabase.table("users").select("*").eq("employee_id", employee_id).limit(1).execute()
    if not response.data:
        return None
    return response.data[0]


def insert_user_record(supabase: Any, user_record: Dict[str, Any]) -> Any:
    try:
        return supabase.table("users").insert(user_record).execute()
    except Exception as exc:  # pragma: no cover - fallback for live schema drift
        error_text = str(exc).lower()
        if "department" not in error_text or (
            "does not exist" not in error_text
            and "could not find" not in error_text
            and "schema cache" not in error_text
        ):
            raise

        fallback_record = {key: value for key, value in user_record.items() if key != "department"}
        return supabase.table("users").insert(fallback_record).execute()


def update_user_record(supabase: Any, employee_id: str, data: Dict[str, Any]) -> Any:
    try:
        return supabase.table("users").update(data).eq("employee_id", employee_id).execute()
    except Exception as exc:  # pragma: no cover - fallback for live schema drift
        error_text = str(exc).lower()
        if "department" not in error_text or (
            "does not exist" not in error_text
            and "could not find" not in error_text
            and "schema cache" not in error_text
        ):
            raise

        fallback_data = {key: value for key, value in data.items() if key != "department"}
        if not fallback_data:
            raise
        return supabase.table("users").update(fallback_data).eq("employee_id", employee_id).execute()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    employee_id = payload.get("sub")
    if not employee_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    user = get_user_by_employee_id(employee_id)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not user.get("active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return user


def require_admin(credentials: HTTPAuthorizationCredentials = Depends(security)) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, JWT_SECRET_KEY, algorithms=[JWT_ALGORITHM])
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid or expired token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc

    employee_id = payload.get("sub")
    if not employee_id:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid token payload",
            headers={"WWW-Authenticate": "Bearer"},
        )

    current_user = get_user_by_employee_id(str(employee_id))
    if not current_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if not current_user.get("active", False):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Inactive user account",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if str(current_user.get("role") or "User") != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


def ensure_unique_module_title(supabase: Any, title: str, excluded_id: Optional[str] = None) -> None:
    module_title = (title or "").strip()
    if not module_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Module title is required")

    response = supabase.table("resources").select("id,title").execute()
    for row in response.data or []:
        existing_title = str(row.get("title") or "").strip()
        if not existing_title:
            continue
        if existing_title.lower() == module_title.lower() and str(row.get("id")) != str(excluded_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Module name already exists")


def normalize_department_sort_order(supabase: Any) -> None:
    departments_response = supabase.table("departments").select("*").execute()
    departments = departments_response.data or []

    for department in departments:
        name = str(department.get("name") or "")
        desired_order = DEPARTMENT_SORT_ORDER.get(name)
        if desired_order is None:
            continue

        current_order = department.get("sort_order")
        if current_order != desired_order:
            supabase.table("departments").update({"sort_order": desired_order}).eq("id", department["id"]).execute()


def ensure_seed_data() -> Dict[str, int]:
    supabase = get_supabase()

    departments_response = supabase.table("departments").select("*").execute()
    departments = departments_response.data or []
    if not departments:
        insert_response = supabase.table("departments").insert(DEFAULT_DEPARTMENTS).execute()
        departments = insert_response.data or []

    normalize_department_sort_order(supabase)

    department_lookup = {
        str(item.get("name") or "").lower(): item
        for item in departments
        if item.get("name")
    }

    resources_response = supabase.table("resources").select("*").execute()
    if not resources_response.data:
        seed_rows = []
        for resource in DEFAULT_RESOURCES:
            department = department_lookup.get(str(resource["department"]).lower())
            if not department:
                continue
            seed_rows.append(
                {
                    "title": resource["title"],
                    "description": resource.get("description"),
                    "type": resource.get("type", "web_app"),
                    "url": resource.get("url"),
                    "icon": resource.get("icon"),
                    "department_id": department["id"],
                    "required_role": resource.get("required_role"),
                }
            )

        if seed_rows:
            supabase.table("resources").insert(seed_rows).execute()

        resource_total = len(seed_rows)
    else:
        resource_total = len(resources_response.data)

    return {"departments": len(departments), "resources": resource_total}


@app.on_event("startup")
def startup() -> None:
    ensure_seed_data()


@app.post("/api/auth/login", response_model=Token)
def login(payload: UserLogin) -> Token:
    user = get_user_by_employee_id(payload.employee_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid employee ID or password")

    if not user.get("active", False):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Account is inactive")

    if not pwd_context.verify(payload.password, user["password_hash"]):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid employee ID or password")

    token = create_access_token(str(user["employee_id"]), str(user["role"]))
    return Token(
        access_token=token,
        token_type="bearer",
        role=str(user["role"]),
        name=str(user.get("name") or user.get("employee_id") or "Employee"),
        employee_id=str(user.get("employee_id") or ""),
        department=str(user.get("department") or "Operations"),
    )


@app.get("/api/portal/dashboard")
def get_dashboard(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    ensure_seed_data()
    supabase = get_supabase()
    user_role = str(current_user.get("role", "User"))
    departments_response = supabase.table("departments").select("*").order("sort_order").execute()
    resources_response = supabase.table("resources").select("*").execute()

    departments: List[DepartmentResponse] = [
        DepartmentResponse(**department) for department in departments_response.data
    ]

    accessible_resources: List[ResourceResponse] = []
    for resource in resources_response.data:
        if has_access(user_role, resource.get("required_role")):
            accessible_resources.append(ResourceResponse(**resource))

    if user_role != "Admin":
        visible_department_ids = {
            resource.department_id
            for resource in accessible_resources
            if resource.department_id is not None
        }

        departments = [
            department
            for department in departments
            if department.id in visible_department_ids
        ]

    return {
        "role": user_role,
        "departments": departments,
        "resources": accessible_resources,
    }


@app.get("/api/admin/departments")
def list_departments(current_user: Dict[str, Any] = Depends(require_admin)) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    response = supabase.table("departments").select("*").order("sort_order").execute()
    return response.data


@app.post("/api/admin/departments", status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    response = supabase.table("departments").insert(payload.model_dump()).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Department creation failed")
    return response.data[0]


@app.put("/api/admin/departments/{department_id}")
def update_department(department_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    data = {key: value for key, value in payload.items() if value is not None}
    if not data:
        return {"id": department_id, "updated": False}

    response = supabase.table("departments").update(data).eq("id", department_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return response.data[0]


@app.delete("/api/admin/departments/{department_id}")
def delete_department(department_id: str, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, str]:
    supabase = get_supabase()
    response = supabase.table("departments").delete().eq("id", department_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return {"status": "deleted", "id": department_id}


@app.post("/api/modules", status_code=status.HTTP_201_CREATED)
def create_module(payload: ResourceCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    ensure_unique_module_title(supabase, payload.title)
    response = supabase.table("resources").insert(payload.model_dump()).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Module creation failed")
    return response.data[0]


@app.put("/api/modules/{module_id}")
def update_module(module_id: str, payload: ResourceUpdate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    data = payload.model_dump(exclude_none=True)

    if "title" in data:
        ensure_unique_module_title(supabase, str(data["title"]), excluded_id=module_id)

    if not data:
        return {"id": module_id, "updated": False}

    response = supabase.table("resources").update(data).eq("id", module_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    return response.data[0]


@app.delete("/api/modules/{module_id}")
def delete_module(module_id: str, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, str]:
    supabase = get_supabase()
    response = supabase.table("resources").delete().eq("id", module_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Module not found")
    return {"status": "deleted", "id": module_id}


@app.get("/api/admin/resources")
def list_resources(current_user: Dict[str, Any] = Depends(require_admin)) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    response = supabase.table("resources").select("*").execute()
    return response.data


@app.post("/api/admin/resources", status_code=status.HTTP_201_CREATED)
def create_resource(payload: ResourceCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    response = supabase.table("resources").insert(payload.model_dump()).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="Resource creation failed")
    return response.data[0]


@app.put("/api/admin/resources/{resource_id}")
def update_resource(resource_id: str, payload: ResourceUpdate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    data = {key: value for key, value in payload.model_dump(exclude_none=True).items() if key is not None}
    if not data:
        return {"id": resource_id, "updated": False}

    response = supabase.table("resources").update(data).eq("id", resource_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return response.data[0]


@app.delete("/api/admin/resources/{resource_id}")
def delete_resource(resource_id: str, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, str]:
    supabase = get_supabase()
    response = supabase.table("resources").delete().eq("id", resource_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    return {"status": "deleted", "id": resource_id}


@app.get("/api/admin/users")
def list_users(current_user: Dict[str, Any] = Depends(require_admin)) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    response = supabase.table("users").select("*").order("employee_id").execute()
    return response.data


@app.post("/api/admin/users", status_code=status.HTTP_201_CREATED)
def create_user(payload: UserCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    if get_user_by_employee_id(payload.employee_id):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Employee already exists")

    user_record = {
        "employee_id": payload.employee_id,
        "name": payload.name,
        "password_hash": pwd_context.hash(payload.password),
        "role": payload.role,
        "department": payload.department,
        "active": payload.active,
        "email": payload.email,
        "phone": payload.phone,
    }
    response = insert_user_record(supabase, user_record)
    if not response.data:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail="User creation failed")
    return response.data[0]


@app.put("/api/admin/users/{employee_id}")
def update_user(employee_id: str, payload: UserUpdate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    data = payload.model_dump(exclude_none=True)
    if "password" in data:
        data["password_hash"] = pwd_context.hash(data.pop("password"))

    if "email" in data and not data["email"]:
        data.pop("email")
    if "phone" in data and not data["phone"]:
        data.pop("phone")

    if not data:
        return {"employee_id": employee_id, "updated": False}

    response = update_user_record(supabase, employee_id, data)
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return response.data[0]


@app.delete("/api/admin/users/{employee_id}")
def delete_user(employee_id: str, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, str]:
    supabase = get_supabase()
    response = supabase.table("users").delete().eq("employee_id", employee_id).execute()
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return {"status": "deleted", "employee_id": employee_id}
