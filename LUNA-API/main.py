# main.py
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import os
import secrets
import smtplib
import uuid
from datetime import datetime, timedelta, timezone
from email.message import EmailMessage
from pathlib import Path
from typing import Any, Dict, List, Optional
from urllib.error import URLError
from urllib.request import Request, urlopen

from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from passlib.context import CryptContext

from database import get_supabase
from models import (
    DepartmentCreate,
    DepartmentResponse,
    NotificationCreate,
    NotificationResponse,
    PasswordResetConfirm,
    PasswordResetRequest,
    ProfileUpdate,
    PushTokenRegistration,
    ResourceCreate,
    ResourceResponse,
    ResourceUpdate,
    Token,
    UserCreate,
    UserLogin,
    UserUpdate,
    WorkspaceSettingsUpdate,
)

for environment_variable in (
    "SUPABASE_URL",
    "SUPABASE_KEY",
    "JWT_SECRET_KEY",
    "SMTP_HOST",
    "SMTP_PORT",
    "SMTP_USERNAME",
    "SMTP_PASSWORD",
    "SMTP_FROM_EMAIL",
):
    if not os.getenv(environment_variable, "").strip():
        os.environ.pop(environment_variable, None)

load_dotenv()
load_dotenv(Path(__file__).resolve().parent / ".env")

app = FastAPI(title="Luna Tech Portal API", version="1.0.0")
logger = logging.getLogger(__name__)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

security = HTTPBearer()

JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_MINUTES = 60 * 8
PASSWORD_RESET_EXPIRATION_MINUTES = 10
PASSWORD_RESET_RESEND_SECONDS = 60
PASSWORD_RESET_MAX_ATTEMPTS = 5
EXPO_PUSH_SEND_URL = "https://exp.host/--/api/v2/push/send"
EXPO_PUSH_BATCH_SIZE = 100

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
    return jwt.encode(payload, get_jwt_secret_key(), algorithm=JWT_ALGORITHM)


def get_jwt_secret_key() -> str:
    secret_key = os.getenv("JWT_SECRET_KEY")
    if not secret_key:
        raise RuntimeError(
            "Missing required environment variable JWT_SECRET_KEY. "
            "Set a strong random value in LUNA-API/.env or the deployment environment."
        )
    return secret_key


def has_access(user_role: str, required_role: Optional[str]) -> bool:
    normalized_user_role = normalize_required_role(user_role)
    if normalized_user_role == "Admin":
        return True

    normalized_required_role = normalize_required_role(required_role)
    user_priority = ROLE_PRIORITY.get(normalized_user_role, 0)
    required_priority = ROLE_PRIORITY.get(normalized_required_role, 0)
    return user_priority > 0 and required_priority > 0 and user_priority >= required_priority


def can_view_resource(user_role: str, required_role: Optional[str]) -> bool:
    normalized_user_role = normalize_required_role(user_role)
    normalized_required_role = normalize_required_role(required_role)
    return has_access(normalized_user_role, normalized_required_role) or (
        normalized_user_role == "Manager" and normalized_required_role == "Admin"
    )


def visible_resource_levels(user_role: str) -> Optional[List[str]]:
    normalized_role = normalize_required_role(user_role)
    if normalized_role == "Admin":
        return None

    return {
        "User": ["User"],
        "Supervisor": ["User", "Supervisor"],
        "Manager": ["User", "Supervisor", "Manager", "Admin"],
    }.get(normalized_role, ["User"])


def fetch_visible_resources(supabase: Any, user_role: str) -> List[Dict[str, Any]]:
    response = supabase.table("resources").select("*").execute()
    resources = response.data or []
    normalized_user_role = normalize_required_role(user_role)
    if normalized_user_role == "Admin":
        return resources

    return [
        resource
        for resource in resources
        if isinstance(resource, dict)
        and can_view_resource(
            normalized_user_role,
            next(
                (
                    str(resource[field])
                    for field in ("viewing_level", "access_level", "required_role", "role")
                    if isinstance(resource.get(field), str) and resource[field].strip()
                ),
                None,
            ),
        )
    ]


def require_resource_management_access(
    current_user: Dict[str, Any],
    resource: Dict[str, Any],
    requested_role: Optional[str] = None,
) -> None:
    user_role = normalize_required_role(str(current_user.get("role") or "User"))
    resource_role = next(
        (
            str(resource[field])
            for field in ("viewing_level", "access_level", "required_role", "role")
            if isinstance(resource.get(field), str) and resource[field].strip()
        ),
        None,
    )
    if not has_access(user_role, resource_role):
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Insufficient access to manage this resource")

    if requested_role is not None and not has_access(user_role, requested_role):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You cannot assign this resource to a higher access level",
        )


def notification_role_allows(user_role: str, target_role_level: str) -> bool:
    user_priority = ROLE_PRIORITY.get(normalize_required_role(user_role), 0)
    target_priority = ROLE_PRIORITY.get(normalize_required_role(target_role_level), 0)
    return user_priority > 0 and target_priority > 0 and user_priority >= target_priority


def get_user_by_employee_id(employee_id: str) -> Optional[Dict[str, Any]]:
    supabase = get_supabase()
    response = supabase.table("users").select("*").eq("employee_id", employee_id).limit(1).execute()
    if not response.data:
        return None
    return response.data[0]


def record_audit_log(
    supabase: Any,
    current_user: Dict[str, Any],
    action: str,
    target_type: str,
    target_id: Optional[str] = None,
    details: Optional[Dict[str, Any]] = None,
) -> None:
    entry = {
        "actor_employee_id": str(current_user.get("employee_id") or ""),
        "actor_name": str(current_user.get("name") or current_user.get("employee_id") or "Admin"),
        "action": action,
        "target_type": target_type,
        "target_id": target_id,
        "details": details or {},
    }
    try:
        supabase.table("audit_logs").insert(entry).execute()
    except Exception:
        logger.exception("Administrative action could not be written to audit logs")


def send_resource_push_notification(supabase: Any, resource: Dict[str, Any]) -> None:
    try:
        response = supabase.table("user_push_tokens").select("expo_push_token").execute()
        tokens = sorted(
            {
                str(row["expo_push_token"])
                for row in response.data or []
                if isinstance(row, dict) and row.get("expo_push_token")
            }
        )
    except Exception:
        logger.exception("Resource was created, but registered push tokens could not be loaded")
        return

    if not tokens:
        return

    access_token = os.getenv("EXPO_ACCESS_TOKEN", "").strip()
    invalid_tokens: List[str] = []
    for start in range(0, len(tokens), EXPO_PUSH_BATCH_SIZE):
        messages = [
            {
                "to": token,
                "title": "New portal resource",
                "body": str(resource.get("title") or "A new resource is available"),
                "data": {"resource_id": str(resource.get("id") or "")},
                "sound": "default",
                "channelId": "portal-updates",
            }
            for token in tokens[start : start + EXPO_PUSH_BATCH_SIZE]
        ]
        headers = {"Accept": "application/json", "Content-Type": "application/json"}
        if access_token:
            headers["Authorization"] = f"Bearer {access_token}"
        request = Request(
            EXPO_PUSH_SEND_URL,
            data=json.dumps(messages).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        try:
            with urlopen(request, timeout=10) as result:
                payload = json.loads(result.read().decode("utf-8"))
        except (URLError, TimeoutError, OSError, ValueError):
            logger.exception("Resource was created, but Expo push delivery could not be requested")
            continue

        if not isinstance(payload, dict):
            logger.error("Expo push service returned a non-object response")
            continue
        tickets = payload.get("data", [])
        if not isinstance(tickets, list):
            logger.error("Expo push service returned an invalid ticket response")
            continue

        batch_tokens = tokens[start : start + EXPO_PUSH_BATCH_SIZE]
        if len(tickets) != len(batch_tokens):
            logger.error("Expo returned %s push tickets for a batch of %s", len(tickets), len(batch_tokens))
        for token, ticket in zip(batch_tokens, tickets):
            if not isinstance(ticket, dict):
                logger.error("Expo returned an invalid push ticket")
                continue
            details = ticket.get("details")
            if (
                ticket.get("status") == "error"
                and isinstance(details, dict)
                and details.get("error") == "DeviceNotRegistered"
            ):
                invalid_tokens.append(token)
            elif ticket.get("status") == "error":
                logger.error("Expo push was rejected for a registered device: %s", ticket.get("message"))

    if invalid_tokens:
        try:
            supabase.table("user_push_tokens").delete().in_("expo_push_token", invalid_tokens).execute()
        except Exception:
            logger.exception("Unable to remove invalid Expo push tokens")


def serialize_jsonb_value(value: Any) -> Any:
    if value is None:
        return None
    if isinstance(value, (str, bytes)):
        return value
    try:
        return json.dumps(value)
    except (TypeError, ValueError):
        return value


def deserialize_jsonb_value(value: Any) -> Any:
    if isinstance(value, str):
        stripped = value.strip()
        if not stripped:
            return []
        try:
            parsed = json.loads(stripped)
            return parsed if isinstance(parsed, (list, dict)) else value
        except (TypeError, ValueError):
            return value
    return value


def build_user_profile_record(user: Dict[str, Any]) -> Dict[str, Any]:
    favorites_value = deserialize_jsonb_value(user.get("favorite_departments"))
    favorites = (
        [value.strip() for value in favorites_value if isinstance(value, str) and value.strip()]
        if isinstance(favorites_value, list)
        else []
    )
    return {
        "employee_id": str(user.get("employee_id") or ""),
        "name": str(user.get("name") or "Employee"),
        "role": str(user.get("role") or "User"),
        "department": str(user.get("department") or "Operations"),
        "email": user.get("email") or "",
        "phone": user.get("phone") or "",
        "favorites": favorites,
        "workspace_layout": deserialize_jsonb_value(user.get("workspace_layout")) or [],
    }


def insert_user_record(supabase: Any, user_record: Dict[str, Any]) -> Any:
    for key in ("favorite_departments", "workspace_layout"):
        if key in user_record and user_record[key] is not None:
            user_record[key] = serialize_jsonb_value(user_record[key])
    return supabase.table("users").insert(user_record).execute()


def update_user_record(supabase: Any, employee_id: str, data: Dict[str, Any]) -> Any:
    for key in ("favorite_departments", "workspace_layout"):
        if key in data and data[key] is not None:
            data[key] = serialize_jsonb_value(data[key])
    return (
        supabase.table("users")
        .update(data)
        .eq("employee_id", employee_id)
        .select("*")
        .execute()
    )


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(security),
) -> Dict[str, Any]:
    token = credentials.credentials
    try:
        payload = jwt.decode(token, get_jwt_secret_key(), algorithms=[JWT_ALGORITHM])
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


def require_admin(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if str(current_user.get("role") or "User") != "Admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required",
        )

    return current_user


def require_admin_or_manager(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    if str(current_user.get("role") or "User") not in {"Admin", "Manager"}:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin or Manager access required",
        )
    return current_user


def get_smtp_settings() -> tuple[str, int, str, str, str]:
    host = os.getenv("SMTP_HOST")
    username = os.getenv("SMTP_USERNAME")
    password = os.getenv("SMTP_PASSWORD")
    sender = os.getenv("SMTP_FROM_EMAIL")

    if not host or not username or not password or not sender:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured.",
        )

    try:
        port = int(os.getenv("SMTP_PORT", "587"))
    except ValueError as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured.",
        ) from exc

    if port < 1 or port > 65535:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Password reset email is not configured.",
        )
    return host, port, username, password, sender


def hash_reset_code(employee_id: str, code: str) -> str:
    message = f"{employee_id}:{code}".encode("utf-8")
    return hmac.new(get_jwt_secret_key().encode("utf-8"), message, hashlib.sha256).hexdigest()


def send_password_reset_email(email: str, code: str) -> None:
    host, port, username, password, sender = get_smtp_settings()
    message = EmailMessage()
    message["Subject"] = "Luna portal password reset"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        f"Your Luna portal password reset code is {code}. "
        f"It expires in {PASSWORD_RESET_EXPIRATION_MINUTES} minutes. "
        "If you did not request this reset, you can ignore this email."
    )

    try:
        with smtplib.SMTP(host, port, timeout=10) as smtp:
            smtp.starttls()
            smtp.login(username, password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to send password reset email. Please try again later.",
        ) from exc


def normalize_resource_kind(value: Optional[str]) -> str:
    candidate = (value or "webapp").strip().lower()
    if not candidate:
        return "webapp"

    normalized = (
        candidate
        .replace("-", "_")
        .replace(" ", "_")
        .replace("/", "_")
        .replace(".", "_")
    )

    aliases = {
        "webapp": "webapp",
        "web_app": "webapp",
        "web": "webapp",
        "app": "webapp",
        "form": "form",
        "forms": "form",
        "report": "report",
        "reports": "report",
        "sheet": "sheet",
        "sheets": "sheet",
        "module": "module",
        "modules": "module",
        "custom_module": "module",
        "custom_modules": "module",
        "resource": "module",
        "resources": "module",
        "department": "department",
        "departments": "department",
        "tiny": "tiny",
        "tiny_element": "tiny",
        "tiny_elements": "tiny",
        "admin": "admin",
    }

    return aliases.get(normalized, normalized)


def normalize_required_role(value: Optional[str]) -> str:
    if value is None:
        return "User"

    candidate = str(value).strip()
    if not candidate:
        return "User"

    normalized = candidate.lower()
    aliases = {
        "employee": "User",
        "staff": "User",
        "user": "User",
        "supervisor": "Supervisor",
        "manager": "Manager",
        "admin": "Admin",
    }
    return aliases.get(normalized, candidate.title())


def normalize_resource_payload(data: Dict[str, Any], apply_defaults: bool = False) -> Dict[str, Any]:
    payload = {key: value for key, value in data.items() if value is not None}
    if "type" in payload and not payload.get("type"):
        payload.pop("type")

    payload.pop("category", None)

    if "link" in payload and "url" not in payload:
        payload["url"] = payload["link"]
    elif "link" in payload and payload["link"]:
        payload["url"] = payload["link"]
    payload.pop("link", None)

    if "url" in payload and payload.get("url"):
        payload["url"] = str(payload["url"]).strip()

    resource_level = payload.get("viewing_level") or payload.get("required_role") or payload.get("role")
    payload.pop("required_role", None)
    payload.pop("role", None)
    if resource_level is not None:
        payload["viewing_level"] = normalize_required_role(str(resource_level))

    if "type" in payload or apply_defaults:
        type_value = payload.get("type") or "webapp"
        normalized_type = normalize_resource_kind(type_value)
        payload["type"] = normalized_type

    if apply_defaults:
        payload.setdefault("viewing_level", "User")

    return payload


def ensure_valid_backend_id(raw_value: Any, field_name: str) -> str:
    value = str(raw_value or "").strip()
    if not value:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"{field_name} is required.")

    try:
        return str(uuid.UUID(value))
    except (TypeError, ValueError, AttributeError) as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid {field_name}. Refresh the list and retry.",
        ) from exc


def ensure_unique_module_title(supabase: Any, title: str, excluded_id: Optional[str] = None) -> None:
    module_title = (title or "").strip()
    if not module_title:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Resource title is required")

    response = supabase.table("resources").select("id,title").execute()
    for row in response.data or []:
        existing_title = str(row.get("title") or "").strip()
        if not existing_title:
            continue
        if existing_title.lower() == module_title.lower() and str(row.get("id")) != str(excluded_id):
            raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Resource name already exists")


def normalize_department_sort_order(supabase: Any) -> None:
    departments_response = supabase.table("departments").select("*").execute()
    departments = departments_response.data or []

    for department in departments:
        name = str(department.get("name") or "")
        desired_order = DEPARTMENT_SORT_ORDER.get(name)
        if desired_order is None:
            continue

        department_id = department.get("id")
        current_order = department.get("sort_order")
        if current_order != desired_order and department_id is not None:
            supabase.table("departments").update({"sort_order": desired_order}).eq("id", department_id).execute()


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
            department_id = department.get("id")
            seed_rows.append(
                {
                    "title": resource["title"],
                    "description": resource.get("description"),
                    "type": normalize_resource_kind(resource.get("type", "web_app")),
                    "url": resource.get("url"),
                    "icon": resource.get("icon"),
                    "department_id": department_id,
                    "viewing_level": resource.get("required_role"),
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
    get_jwt_secret_key()


@app.post("/api/auth/login", response_model=Token)
@app.post("/token", response_model=Token)
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


@app.get("/api/users/me")
def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return build_user_profile_record(current_user)


@app.put("/api/users/me")
def update_current_user_profile(
    payload: ProfileUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    employee_id = str(current_user.get("employee_id") or "")
    data = payload.model_dump(exclude_unset=True)
    for field in ("name", "department", "phone"):
        if field in data and isinstance(data[field], str):
            data[field] = data[field].strip()
    if "email" in data and data["email"] is None:
        data["email"] = ""

    if data:
        response = update_user_record(get_supabase(), employee_id, data)
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        current_user = {**current_user, **response.data[0]}

    return build_user_profile_record(current_user)


@app.get("/api/users/workspace")
def get_user_workspace(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    profile = build_user_profile_record(current_user)
    return {
        "favorites": profile["favorites"],
        "workspace_layout": profile["workspace_layout"],
    }


@app.put("/api/users/workspace")
def save_user_workspace(
    payload: WorkspaceSettingsUpdate,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, Any]:
    employee_id = str(current_user.get("employee_id") or "")
    data = payload.model_dump(exclude_unset=True)
    if "favorites" in data:
        favorites_value = data.pop("favorites")
        favorites = (
            [value.strip() for value in favorites_value if isinstance(value, str) and value.strip()]
            if isinstance(favorites_value, list)
            else []
        )
        data["favorite_departments"] = serialize_jsonb_value(favorites)

    if "workspace_layout" in data:
        data["workspace_layout"] = serialize_jsonb_value(data["workspace_layout"])

    if data:
        try:
            response = update_user_record(get_supabase(), employee_id, data)
        except HTTPException:
            raise
        except Exception as exc:  # pragma: no cover - defensive backend guard
            raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Workspace update failed: {exc}") from exc
        if not response.data:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
        current_user = {**current_user, **response.data[0]}

    profile = build_user_profile_record(current_user)
    return {
        "favorites": profile["favorites"],
        "workspace_layout": profile["workspace_layout"],
    }


@app.post("/api/auth/request-password-reset")
def request_password_reset(payload: PasswordResetRequest) -> Dict[str, str]:
    get_smtp_settings()
    response_message = "If the account exists and has an email address on file, reset instructions have been sent."
    supabase = get_supabase()
    user = get_user_by_employee_id(payload.employee_id)
    email = user.get("email") if user else None
    if not user or not user.get("active", False) or not isinstance(email, str) or not email.strip():
        return {"message": response_message}

    now = datetime.now(timezone.utc)
    existing = (
        supabase.table("password_reset_tokens")
        .select("requested_at")
        .eq("employee_id", payload.employee_id)
        .limit(1)
        .execute()
    )
    if existing.data:
        requested_at = datetime.fromisoformat(str(existing.data[0]["requested_at"]).replace("Z", "+00:00"))
        if requested_at.tzinfo is None:
            requested_at = requested_at.replace(tzinfo=timezone.utc)
        if (now - requested_at).total_seconds() < PASSWORD_RESET_RESEND_SECONDS:
            return {"message": response_message}

    code = f"{secrets.randbelow(1_000_000):06d}"
    supabase.table("password_reset_tokens").upsert(
        {
            "employee_id": payload.employee_id,
            "token_hash": hash_reset_code(payload.employee_id, code),
            "expires_at": (now + timedelta(minutes=PASSWORD_RESET_EXPIRATION_MINUTES)).isoformat(),
            "requested_at": now.isoformat(),
            "attempts": 0,
        },
        on_conflict="employee_id",
    ).execute()

    try:
        send_password_reset_email(email.strip(), code)
    except HTTPException:
        supabase.table("password_reset_tokens").delete().eq("employee_id", payload.employee_id).execute()
        raise
    return {"message": response_message}


@app.post("/api/auth/reset-password")
def reset_password(payload: PasswordResetConfirm) -> Dict[str, str]:
    supabase = get_supabase()
    response = (
        supabase.table("password_reset_tokens")
        .select("*")
        .eq("employee_id", payload.employee_id)
        .limit(1)
        .execute()
    )
    if not response.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

    challenge = response.data[0]
    now = datetime.now(timezone.utc)
    expires_at = datetime.fromisoformat(str(challenge["expires_at"]).replace("Z", "+00:00"))
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    attempts = int(challenge.get("attempts") or 0)
    if now >= expires_at or attempts >= PASSWORD_RESET_MAX_ATTEMPTS:
        supabase.table("password_reset_tokens").delete().eq("employee_id", payload.employee_id).execute()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

    expected_hash = str(challenge["token_hash"])
    supplied_hash = hash_reset_code(payload.employee_id, payload.code)
    if not hmac.compare_digest(expected_hash, supplied_hash):
        attempts += 1
        if attempts >= PASSWORD_RESET_MAX_ATTEMPTS:
            supabase.table("password_reset_tokens").delete().eq("employee_id", payload.employee_id).execute()
        else:
            supabase.table("password_reset_tokens").update({"attempts": attempts}).eq(
                "employee_id", payload.employee_id
            ).eq("token_hash", expected_hash).execute()
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

    consumed = (
        supabase.table("password_reset_tokens")
        .delete()
        .eq("employee_id", payload.employee_id)
        .eq("token_hash", expected_hash)
        .execute()
    )
    if not consumed.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")

    updated = update_user_record(
        supabase,
        payload.employee_id,
        {"password_hash": pwd_context.hash(payload.password)},
    )
    if not updated.data:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid or expired reset code.")
    return {"message": "Password reset successfully."}


@app.get("/api/portal/dashboard")
def get_dashboard(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    supabase = get_supabase()
    user_role = str(current_user.get("role", "User"))
    departments_response = supabase.table("departments").select("*").order("sort_order").execute()
    resources = fetch_visible_resources(supabase, user_role)

    departments: List[DepartmentResponse] = [
        DepartmentResponse(**department) for department in departments_response.data or []
    ]

    accessible_resources = [ResourceResponse(**resource) for resource in resources]

    return {
        "role": user_role,
        "departments": departments,
        "resources": accessible_resources,
    }


@app.get("/api/admin/departments")
def list_departments(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    response = supabase.table("departments").select("*").order("sort_order").execute()
    return response.data


@app.post("/api/admin/departments", status_code=status.HTTP_201_CREATED)
def create_department(payload: DepartmentCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    try:
        response = supabase.table("departments").insert(payload.model_dump()).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Department creation failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Department creation failed")
    return response.data[0]


@app.put("/api/admin/departments/{department_id}")
def update_department(department_id: str, payload: Dict[str, Any], current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    data = {key: value for key, value in payload.items() if value is not None}
    if not data:
        return {"id": department_id, "updated": False}

    try:
        response = supabase.table("departments").update(data).eq("id", department_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Department update failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return response.data[0]


@app.delete("/api/admin/departments/{department_id}")
def delete_department(department_id: str, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, str]:
    supabase = get_supabase()
    try:
        response = supabase.table("departments").delete().eq("id", department_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Department deletion failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Department not found")
    return {"status": "deleted", "id": department_id}


@app.post("/api/modules", status_code=status.HTTP_201_CREATED)
def create_module(payload: ResourceCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    return create_resource(payload, current_user)


@app.put("/api/modules/{module_id}")
def update_module(module_id: str, payload: ResourceUpdate, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return update_resource(module_id, payload, current_user)


@app.delete("/api/modules/{module_id}")
def delete_module(module_id: str, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    return delete_resource(module_id, current_user)


@app.get("/api/resources")
@app.get("/api/admin/resources")
def list_resources(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    user_role = str(current_user.get("role") or "User")
    return fetch_visible_resources(supabase, user_role)


@app.get("/api/notifications", response_model=List[NotificationResponse])
def get_notifications(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[NotificationResponse]:
    supabase = get_supabase()
    try:
        response = supabase.table("notifications").select("*").order("created_at", desc=True).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Notifications are unavailable. Apply the notifications database migration and retry.",
        ) from exc

    user_role = str(current_user.get("role") or "User")
    return [
        NotificationResponse(**notification)
        for notification in response.data or []
        if notification_role_allows(user_role, str(notification.get("target_role_level") or ""))
    ]


@app.post("/api/push-tokens")
def register_push_token(
    payload: PushTokenRegistration,
    current_user: Dict[str, Any] = Depends(get_current_user),
) -> Dict[str, str]:
    try:
        get_supabase().table("user_push_tokens").upsert(
            {
                "employee_id": str(current_user["employee_id"]),
                "expo_push_token": payload.expo_push_token,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            },
            on_conflict="expo_push_token",
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push token registration is unavailable. Apply the push and audit migration and retry.",
        ) from exc
    return {"status": "registered"}


@app.delete("/api/push-tokens")
def unregister_push_tokens(current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    try:
        get_supabase().table("user_push_tokens").delete().eq(
            "employee_id", str(current_user["employee_id"])
        ).execute()
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Push token removal is unavailable. Apply the push and audit migration and retry.",
        ) from exc
    return {"status": "unregistered"}


@app.get("/api/audit-logs")
def get_audit_logs(current_user: Dict[str, Any] = Depends(require_admin)) -> List[Dict[str, Any]]:
    try:
        response = (
            get_supabase()
            .table("audit_logs")
            .select("id,actor_employee_id,actor_name,action,target_type,target_id,details,created_at")
            .order("created_at", desc=True)
            .limit(200)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Audit logs are unavailable. Apply the push and audit migration and retry.",
        ) from exc
    return response.data or []


@app.post("/api/admin/resources", status_code=status.HTTP_201_CREATED)
def create_resource(payload: ResourceCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    supabase = get_supabase()
    data = normalize_resource_payload(payload.model_dump(exclude_none=True), apply_defaults=True)
    ensure_unique_module_title(supabase, str(data.get("title") or ""))
    try:
        response = supabase.table("resources").insert(data).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Resource creation failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Resource creation failed")
    created_resource = response.data[0]

    try:
        notification = NotificationCreate(
            message=f"New resource: {created_resource.get('title') or data['title']}",
            target_role_level=normalize_required_role(str(created_resource.get("viewing_level") or data["viewing_level"])),
        )
        supabase.table("notifications").insert(notification.model_dump()).execute()
    except Exception:
        logger.exception("Resource was created, but its notification could not be stored")

    record_audit_log(
        supabase,
        current_user,
        "resource_created",
        "resource",
        str(created_resource.get("id") or ""),
        {"title": str(created_resource.get("title") or data["title"])},
    )
    send_resource_push_notification(supabase, created_resource)
    return created_resource


@app.put("/api/admin/resources/{resource_id}")
def update_resource(resource_id: str, payload: ResourceUpdate, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    supabase = get_supabase()
    normalized_resource_id = ensure_valid_backend_id(resource_id, "Resource ID")
    data = normalize_resource_payload(payload.model_dump(exclude_none=True))

    try:
        existing_response = (
            supabase.table("resources")
            .select("*")
            .eq("id", normalized_resource_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Resource lookup failed: {exc}") from exc
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    existing_resource = existing_response.data[0]
    requested_role = data.get("viewing_level")
    require_resource_management_access(current_user, existing_resource, requested_role)

    if "title" in data:
        ensure_unique_module_title(supabase, str(data["title"]), excluded_id=normalized_resource_id)

    if not data:
        return {"id": normalized_resource_id, "updated": False}

    try:
        response = supabase.table("resources").update(data).eq("id", normalized_resource_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Resource update failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    record_audit_log(
        supabase,
        current_user,
        "resource_updated",
        "resource",
        normalized_resource_id,
        {"changed_fields": sorted(data.keys()), "title": str(response.data[0].get("title") or "")},
    )
    return response.data[0]


@app.delete("/api/admin/resources/{resource_id}")
def delete_resource(resource_id: str, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    supabase = get_supabase()
    normalized_resource_id = ensure_valid_backend_id(resource_id, "Resource ID")
    try:
        existing_response = (
            supabase.table("resources")
            .select("*")
            .eq("id", normalized_resource_id)
            .limit(1)
            .execute()
        )
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Resource lookup failed: {exc}") from exc
    if not existing_response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    require_resource_management_access(current_user, existing_response.data[0])

    try:
        response = supabase.table("resources").delete().eq("id", normalized_resource_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"Resource deletion failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resource not found")
    record_audit_log(
        supabase,
        current_user,
        "resource_deleted",
        "resource",
        normalized_resource_id,
        {"title": str(response.data[0].get("title") or "")},
    )
    return {"status": "deleted", "id": normalized_resource_id}


@app.get("/api/admin/items")
def list_items(current_user: Dict[str, Any] = Depends(get_current_user)) -> List[Dict[str, Any]]:
    return list_resources(current_user)


@app.post("/api/admin/items", status_code=status.HTTP_201_CREATED)
def create_item(payload: ResourceCreate, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, Any]:
    return create_resource(payload, current_user)


@app.put("/api/admin/items/{item_id}")
def update_item(item_id: str, payload: ResourceUpdate, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, Any]:
    return update_resource(item_id, payload, current_user)


@app.delete("/api/admin/items/{item_id}")
def delete_item(item_id: str, current_user: Dict[str, Any] = Depends(get_current_user)) -> Dict[str, str]:
    return delete_resource(item_id, current_user)


@app.get("/api/users")
def list_users(current_user: Dict[str, Any] = Depends(require_admin_or_manager)) -> List[Dict[str, Any]]:
    supabase = get_supabase()
    response = (
        supabase.table("users")
        .select("employee_id,name,role,department,active,email,phone")
        .order("employee_id")
        .execute()
    )
    return response.data


@app.get("/api/admin/users")
def list_admin_users(current_user: Dict[str, Any] = Depends(require_admin)) -> List[Dict[str, Any]]:
    return list_users(current_user)


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
        "favorite_departments": [],
        "workspace_layout": [],
    }
    try:
        response = insert_user_record(supabase, user_record)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"User creation failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="User creation failed")
    record_audit_log(
        supabase,
        current_user,
        "user_created",
        "user",
        payload.employee_id,
        {"name": payload.name, "role": payload.role},
    )
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

    try:
        response = update_user_record(supabase, employee_id, data)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"User update failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    record_audit_log(
        supabase,
        current_user,
        "user_updated",
        "user",
        employee_id,
        {
            "changed_fields": sorted(
                "password" if field == "password_hash" else field
                for field in data
            )
        },
    )
    return response.data[0]


@app.delete("/api/admin/users/{employee_id}")
def delete_user(employee_id: str, current_user: Dict[str, Any] = Depends(require_admin)) -> Dict[str, str]:
    supabase = get_supabase()
    try:
        response = supabase.table("users").delete().eq("employee_id", employee_id).execute()
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=f"User deletion failed: {exc}") from exc
    if not response.data:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    record_audit_log(supabase, current_user, "user_deleted", "user", employee_id)
    return {"status": "deleted", "employee_id": employee_id}
