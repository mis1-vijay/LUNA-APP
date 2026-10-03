from getpass import getpass

from database import get_supabase
from passlib.context import CryptContext

employee_id = input("Employee ID: ").strip()
name = input("Employee name: ").strip()
password = getpass("Initial password (at least 8 characters): ")
if len(employee_id) < 3 or not name or len(password) < 8:
    raise SystemExit("Employee ID, name, and a password of at least 8 characters are required.")

supabase = get_supabase()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
data = {
    "employee_id": employee_id,
    "name": name,
    "password_hash": pwd_context.hash(password),
    "role": "Admin",
    "active": True,
}

supabase.table("users").insert(data).execute()
print("Admin user created successfully.")
