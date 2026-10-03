from __future__ import annotations

import os
from pathlib import Path

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv(Path(__file__).resolve().parent / ".env")

supabase: Client | None = None


def get_supabase() -> Client:
    global supabase

    if supabase is None:
        current_url = os.getenv("SUPABASE_URL")
        current_key = os.getenv("SUPABASE_KEY")

        if not current_url or not current_key:
            raise RuntimeError(
                "Missing required environment variables: SUPABASE_URL and SUPABASE_KEY. "
                "Set them in the environment or the LUNA-API/.env file."
            )
        supabase = create_client(current_url, current_key)

    return supabase
