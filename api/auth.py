import base64
import hashlib
import hmac
import os
import secrets
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from api.rate_limit import rate_limit
from database.supabase_client import get_client

USERS_TABLE = "users"
SESSIONS_TABLE = "auth_sessions"

SESSION_DAYS = int(os.getenv("AUTH_SESSION_DAYS") or 7)
PASSWORD_ITERATIONS = 600_000
MIN_PASSWORD_LENGTH = 8

INVALID_LOGIN = "Incorrect email or password."
SIGN_IN_REQUIRED = "Please sign in to continue."

router = APIRouter(prefix="/auth", tags=["auth"])

# Slows down password guessing without getting in a real user's way.
login_limit = rate_limit(
    "login",
    per_minute=int(os.getenv("RATE_LIMIT_LOGIN_PER_MINUTE") or 10),
    per_day=int(os.getenv("RATE_LIMIT_LOGIN_PER_DAY") or 100),
)


# ---------------------------------------------------------------- passwords

def hash_password(password):
    salt = secrets.token_bytes(16)
    digest = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, PASSWORD_ITERATIONS)
    encode = lambda raw: base64.b64encode(raw).decode()
    return f"pbkdf2_sha256${PASSWORD_ITERATIONS}${encode(salt)}${encode(digest)}"


def verify_password(password, stored):
    try:
        scheme, iterations, salt, digest = stored.split("$")
    except (AttributeError, ValueError):
        return False
    if scheme != "pbkdf2_sha256":
        return False
    candidate = hashlib.pbkdf2_hmac(
        "sha256", password.encode(), base64.b64decode(salt), int(iterations)
    )
    return hmac.compare_digest(candidate, base64.b64decode(digest))


# ----------------------------------------------------------------- sessions

def _token_hash(token):
    return hashlib.sha256(token.encode()).hexdigest()


def create_session(client, user_id):
    token = secrets.token_urlsafe(32)
    expires = datetime.now(timezone.utc) + timedelta(days=SESSION_DAYS)
    client.table(SESSIONS_TABLE).insert(
        {"token_hash": _token_hash(token), "user_id": user_id, "expires_at": expires.isoformat()}
    ).execute()
    return token


def public_user(row):
    return {"id": row["id"], "name": row["name"], "email": row["email"], "role": row["role"]}


def _bearer_token(request):
    header = request.headers.get("authorization", "")
    scheme, _, token = header.partition(" ")
    return token.strip() if scheme.lower() == "bearer" and token.strip() else None


def optional_user(request: Request):
    """The signed-in user, or None when there is no valid session."""
    token = _bearer_token(request)
    if not token:
        return None

    client = get_client()
    rows = (
        client.table(SESSIONS_TABLE)
        .select("expires_at, users(id, name, email, role)")
        .eq("token_hash", _token_hash(token))
        .limit(1)
        .execute()
        .data
    )
    if not rows or not rows[0].get("users"):
        return None

    expires = datetime.fromisoformat(rows[0]["expires_at"].replace("Z", "+00:00"))
    if expires <= datetime.now(timezone.utc):
        client.table(SESSIONS_TABLE).delete().eq("token_hash", _token_hash(token)).execute()
        return None

    return public_user(rows[0]["users"])


def require_user(user=Depends(optional_user)):
    if user is None:
        raise HTTPException(status_code=401, detail=SIGN_IN_REQUIRED)
    return user


def require_admin(user=Depends(require_user)):
    if user["role"] != "admin":
        raise HTTPException(status_code=403, detail="This page is for administrators only.")
    return user


# ---------------------------------------------------------------- endpoints

class LoginRequest(BaseModel):
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=200)


class RegisterRequest(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=MIN_PASSWORD_LENGTH, max_length=200)


def _normal_email(email):
    email = email.strip().lower()
    if "@" not in email or email.startswith("@") or email.endswith("@"):
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")
    return email


@router.post("/register", dependencies=[Depends(login_limit)])
def register(request: RegisterRequest):
    """Students sign themselves up. Admins are created with scripts/create_admin.py."""
    client = get_client()
    email = _normal_email(request.email)

    if client.table(USERS_TABLE).select("id").eq("email", email).limit(1).execute().data:
        raise HTTPException(status_code=409, detail="That email is already in use. Sign in instead.")

    row = (
        client.table(USERS_TABLE)
        .insert(
            {
                "name": request.name.strip(),
                "email": email,
                "password_hash": hash_password(request.password),
                "role": "student",
            }
        )
        .execute()
        .data[0]
    )
    return {"token": create_session(client, row["id"]), "user": public_user(row)}


@router.post("/login", dependencies=[Depends(login_limit)])
def login(request: LoginRequest):
    client = get_client()
    email = _normal_email(request.email)

    rows = client.table(USERS_TABLE).select("*").eq("email", email).limit(1).execute().data
    if not rows or not verify_password(request.password, rows[0]["password_hash"]):
        raise HTTPException(status_code=401, detail=INVALID_LOGIN)

    row = rows[0]
    client.table(USERS_TABLE).update(
        {"last_login_at": datetime.now(timezone.utc).isoformat()}
    ).eq("id", row["id"]).execute()
    return {"token": create_session(client, row["id"]), "user": public_user(row)}


@router.post("/logout", status_code=204)
def logout(request: Request):
    token = _bearer_token(request)
    if token:
        get_client().table(SESSIONS_TABLE).delete().eq("token_hash", _token_hash(token)).execute()


@router.get("/me")
def me(user=Depends(require_user)):
    return user
