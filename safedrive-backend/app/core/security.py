"""JWT, password hashing, and authentication utilities."""
import bcrypt
from jose import jwt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends, WebSocket
from app.core.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_DAYS_MOBILE
from app.core.database import get_db

MONITOR_ROLES = ("monitorista", "admin", "operator", "dev", "superadmin")
ADMIN_ROLES = ("admin", "operator", "dev", "superadmin")

def hash_password(pw: str) -> str:
    """Hash password with bcrypt."""
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    """Verify password against bcrypt hash (constant-time comparison)."""
    try:
        if not isinstance(hashed, str) or not hashed:
            return False
        return bcrypt.checkpw(pw.encode("utf-8"), hashed.encode("utf-8"))
    except (TypeError, ValueError, AttributeError):
        return False

def create_access_token(
    user_id: str,
    email: str,
    role: str = "conductor",
    ver: int = 1,
    sid: str = None,
    days: int = JWT_EXPIRATION_DAYS_MOBILE
) -> str:
    """Create JWT access token."""
    exp_days = days if role in ("conductor", "driver") else 7
    payload = {
        "sub": user_id,
        "email": email,
        "role": role,
        "ver": ver,
        "sid": sid,
        "exp": datetime.now(timezone.utc) + timedelta(days=exp_days),
        "type": "access",
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

def decode_token(token: str) -> dict:
    """Decode and validate a JWT token. Returns payload dict or raises."""
    try:
        return jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")

async def get_user_from_payload(payload: dict) -> dict:
    """
    Fetch user from DB by token payload.
    Enforces single-session for drivers/conductors.
    """
    db = get_db()
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})

    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")

    if user.get("role") in ("conductor", "driver"):
        if (user.get("token_version", 0) != payload.get("ver") or
            user.get("current_session_id") != payload.get("sid")):
            raise HTTPException(status_code=409, detail="Sesion iniciada en otro dispositivo")

    return user

def extract_bearer_token(auth_header: str) -> str:
    """Extract Bearer token from Authorization header."""
    if auth_header.startswith("Bearer "):
        return auth_header[7:]
    return ""

async def get_current_user(request: Request) -> dict:
    """Extract and validate JWT token from request."""
    token = extract_bearer_token(request.headers.get("Authorization", ""))
    if not token:
        token = request.cookies.get("access_token", "")
        if not token:
            raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(token)
    return await get_user_from_payload(payload)

async def get_current_user_ws(ws: WebSocket) -> dict:
    """Authenticate WebSocket connection via token query param."""
    token = ws.query_params.get("token", "")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    payload = decode_token(token)
    user = await get_user_from_payload(payload)
    return user

def get_company_id(user: dict) -> str:
    """Extract company_id from user, defaulting to None for superadmin."""
    return user.get("company_id")

async def require_superadmin(user: dict = Depends(get_current_user)) -> dict:
    """Require superadmin role (global platform access)."""
    if user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Requiere acceso de SuperAdmin")
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """
    Require monitorista-level or above.
    Allows: superadmin, dev, operator, admin, monitorista
    """
    if user.get("role") not in ("superadmin", "dev", "operator", "admin", "monitorista"):
        raise HTTPException(status_code=403, detail="Requiere acceso de administrador")
    return user

async def require_monitorista(user: dict = Depends(get_current_user)) -> dict:
    """
    Require monitorista-level or above (includes superadmin).
    For company-scoped endpoints.
    """
    if user.get("role") not in MONITOR_ROLES:
        raise HTTPException(status_code=403, detail="Requiere acceso de monitorista")
    return user

async def require_conductor(user: dict = Depends(get_current_user)) -> dict:
    """Require conductor/driver role."""
    if user.get("role") not in ("conductor", "driver"):
        raise HTTPException(status_code=403, detail="Requiere acceso de conductor")
    return user
