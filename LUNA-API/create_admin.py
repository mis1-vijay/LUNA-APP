from supabase import create_client
from passlib.context import CryptContext

# CORRECTED URL (i ki jagah j hai)
URL = "https://xvlkjsuquhriiqnpujjt.supabase.co"
KEY = "sb_publishable_rxqPUrj9-tIsuVah5IWBNA_Yuw9aubZ"

print("Connecting to Supabase...")
supabase = create_client(URL, KEY)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
hashed_password = pwd_context.hash("luna123")

data = {
    "employee_id": "11233",
    "name": "Vijay Jadhav",
    "password_hash": hashed_password,
    "role": "Admin",
    "active": True
}

print("Inserting data...")
supabase.table("users").insert(data).execute()
print("Admin User 11233 Created Successfully! 🚀")
