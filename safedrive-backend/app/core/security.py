"""JWT, password hashing, and authentication utilities."""
from jose import jwt
import bcrypt
from datetime import datetime, timezone, timedelta
from fastapi import HTTPException, Request, Depends
from app.core.config import JWT_SECRET, JWT_ALGORITHM, JWT_EXPIRATION_DAYS_MOBILE
from app.core.database import get_db

def hash_password(pw: str) -> str:
    """Hash password with bcrypt."""
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def verify_password(pw: str, hashed: str) -> bool:
    """Verify password against bcrypt hash."""
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False

def create_access_token(
    user_id: str, 
    email: str, 
    role: str = "driver",
    ver: int = 1,
    sid: str = None,
    days: int = JWT_EXPIRATION_DAYS_MOBILE
) -> str:
    """Create JWT access token."""
    exp_days = days if role == "driver" else 7  # Web operators get 7 days, drivers 30
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

async def get_current_user(request: Request) -> dict:
    """Extract and validate JWT token from request."""
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")
    
    db = get_db()
    user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    
    if not user:
        raise HTTPException(status_code=401, detail="Usuario no encontrado")
    
    # Single-session enforcement for mobile drivers
    if user.get("role") == "driver":
        if user.get("token_version", 0) != payload.get("ver") or user.get("current_session_id") != payload.get("sid"):
            raise HTTPException(status_code=409, detail="Sesion iniciada en otro dispositivo")
    
    return user

async def require_admin(user: dict = Depends(get_current_user)) -> dict:
    """Require admin or dev-level role."""
    if user.get("role") not in ("admin", "operator", "dev"):
        raise HTTPException(status_code=403, detail="Requiere acceso de administrador")
    return user

async def require_driver(user: dict = Depends(get_current_user)) -> dict:
    """Require driver role."""
    if user.get("role") != "driver":
        raise HTTPException(status_code=403, detail="Requiere acceso de conductor")
    return user
