import os

from dotenv import load_dotenv
from supabase import Client, create_client

load_dotenv()

_client = None


def get_client() -> Client:
    global _client
    if _client is not None:
        return _client

    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SECRET_KEY") or os.getenv("SUPABASE_SERVICE_ROLE_KEY")

    if not url or not key:
        raise RuntimeError("SUPABASE_URL and SUPABASE_SECRET_KEY must be set in .env")

    _client = create_client(url, key)
    return _client
