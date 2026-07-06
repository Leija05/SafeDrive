"""Authentication endpoints (shared between web and mobile)."""
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Depends, Request
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_driver, require_admin
)
from app.core.ratelimiter import auth_limiter
from app.models.schemas_auth import (
    LoginIn, RegisterIn, UserResponse,
    SiteTokenVerifyIn, SiteTokenCreateIn
)
from app.models.schemas_telemetry import Telemetry
from app.services.geo_helpers import interp_corridor, CORRIDOR, CORRIDOR_TOLERANCE_M
from app.services.ws_manager import manager
from datetime import datetime, timezone

router = APIRouter(prefix="/auth", tags=["authentication"])

@router.post("/register")
async def register(body: RegisterIn, request: Request, user: dict = Depends(require_admin)):
    """Register new user (driver or operator). Only admin users may create accounts."""
    await auth_limiter.check(request)
    db = get_db()
    email = body.email.lower()
    
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="El correo ya está registrado")
    
    uid = str(uuid.uuid4())
    sid = str(uuid.uuid4())
    
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": body.role or "driver",
        "phone": body.phone,
        "token_version": 1,
        "current_session_id": sid,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.users.insert_one(doc)
    
    user = UserResponse(
        id=uid, email=email, name=body.name,
        role=body.role or "driver", phone=body.phone
    )
    
    # Auto-create unit for drivers
    unit = None
    if body.role == "driver" or not body.role:
        count = await db.units.count_documents({})
        lat, lng, heading = interp_corridor(0.0)
        unit = {
            "id": str(uuid.uuid4()),
            "driver_id": uid,
            "name": f"NL-{count + 1:02d}",
            "driver_name": body.name,
            "plate": body.plate or f"NL-{uuid.uuid4().hex[:6].upper()}",
            "driver_phone": body.phone,
            "imei": str(uuid.uuid4())[:15],
            "lat": lat,
            "lng": lng,
            "speed": 0,
            "heading": heading,
            "battery": 100,
            "deviation_m": 0,
            "status": "detenido",
            "signal": "ok",
            "online": True,
            "panic": False,
            "fiscal": {"active": False},
            "in_bridge": None,
            "route_progress": 0.0,
            "assigned_route": CORRIDOR,
            "route_name": "FED-85 · Monterrey → Nuevo Laredo",
            "route_tolerance_m": CORRIDOR_TOLERANCE_M,
            "trip_active": False,
            "last_update": datetime.now(timezone.utc).isoformat(),
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.units.insert_one({**unit})
        await manager.broadcast({"type": "unit_update", "unit": unit})
    
    token = create_access_token(uid, email, role=body.role or "driver", ver=1, sid=sid)
    
    return {
        "access_token": token,
        "user": user,
        "unit": unit,
    }

# --- Site Token Endpoints ---

@router.post("/verify-site-token")
async def verify_site_token(body: SiteTokenVerifyIn, request: Request):
    """Verify a site access token. Returns ok if token is valid and active."""
    await auth_limiter.check(request)
    db = get_db()
    tok = await db.site_tokens.find_one({"token": body.token.strip(), "active": True})
    if not tok:
        raise HTTPException(status_code=403, detail="Token de acceso invalido o desactivado")

    if tok.get("max_uses") is not None:
        used = tok.get("use_count", 0)
        if used >= tok["max_uses"]:
            raise HTTPException(status_code=403, detail="Token de acceso ha alcanzado su maximo de usos")

    await db.site_tokens.update_one(
        {"_id": tok["_id"]},
        {"$inc": {"use_count": 1}, "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}}
    )

    return {"ok": True, "name": tok.get("name", "")}

@router.post("/site-tokens")
async def create_site_token(body: SiteTokenCreateIn, user: dict = Depends(require_admin)):
    """Create a new site access token (admin only)."""
    db = get_db()
    raw = secrets.token_hex(24)
    doc = {
        "token": raw,
        "name": body.name.strip(),
        "active": True,
        "use_count": 0,
        "max_uses": body.max_uses,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
    }
    await db.site_tokens.insert_one(doc)
    return {"token": raw, "name": doc["name"]}

@router.get("/site-tokens")
async def list_site_tokens(user: dict = Depends(require_admin)):
    """List all site tokens."""
    db = get_db()
    tokens = await db.site_tokens.find(
        {}, {"_id": 0, "token": 1, "name": 1, "active": 1, "use_count": 1, "max_uses": 1, "created_at": 1, "last_used_at": 1}
    ).sort("created_at", -1).to_list(500)
    return tokens

@router.patch("/site-tokens/{tid}")
async def toggle_site_token(tid: str, user: dict = Depends(require_admin)):
    """Toggle a site token active/inactive."""
    db = get_db()
    tok = await db.site_tokens.find_one({"token": tid})
    if not tok:
        raise HTTPException(status_code=404, detail="Token no encontrado")
    new_active = not tok.get("active", True)
    await db.site_tokens.update_one({"token": tid}, {"$set": {"active": new_active}})
    return {"ok": True, "active": new_active}

# --- Login ---

@router.post("/login")
async def login(body: LoginIn, request: Request):
    """Login user."""
    await auth_limiter.check(request)
    db = get_db()
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contraseña incorrectos")

    # Site token check for admin/monitoring roles
    if user.get("role") in ("admin", "operator", "dev"):
        if not body.site_token:
            raise HTTPException(status_code=403, detail="Token de acceso requerido para monitoristas")
        site_tok = await db.site_tokens.find_one({"token": body.site_token.strip(), "active": True})
        if not site_tok:
            raise HTTPException(status_code=403, detail="Token de acceso invalido o desactivado")
    
    # Single session enforcement: bump version + new session id
    new_ver = int(user.get("token_version", 0)) + 1
    sid = str(uuid.uuid4())
    
    await db.users.update_one({"id": user["id"]}, {"$set": {"token_version": new_ver, "current_session_id": sid}})
    
    pub_user = UserResponse(
        id=user["id"],
        email=email,
        name=user.get("name"),
        role=user.get("role"),
        phone=user.get("phone")
    )
    
    unit = None
    if user.get("role") == "driver":
        unit = await db.units.find_one({"driver_id": user["id"]}, {"_id": 0})
        if not unit:
            # Auto-create unit if missing
            count = await db.units.count_documents({})
            lat, lng, heading = interp_corridor(0.0)
            unit = {
                "id": str(uuid.uuid4()),
                "driver_id": user["id"],
                "name": f"NL-{count + 1:02d}",
                "driver_name": user.get("name", "Conductor"),
                "plate": f"NL-{uuid.uuid4().hex[:6].upper()}",
                "driver_phone": user.get("phone"),
                "imei": str(uuid.uuid4())[:15],
                "lat": lat,
                "lng": lng,
                "speed": 0,
                "heading": heading,
                "battery": 100,
                "deviation_m": 0,
                "status": "detenido",
                "signal": "ok",
                "online": True,
                "panic": False,
                "fiscal": {"active": False},
                "in_bridge": None,
                "route_progress": 0.0,
                "assigned_route": CORRIDOR,
                "route_name": "FED-85 · Monterrey → Nuevo Laredo",
                "route_tolerance_m": CORRIDOR_TOLERANCE_M,
                "trip_active": False,
                "last_update": datetime.now(timezone.utc).isoformat(),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.units.insert_one({**unit})
    
    token = create_access_token(user["id"], email, role=user.get("role"), ver=new_ver, sid=sid)
    
    return {
        "access_token": token,
        "user": pub_user,
        "unit": unit,
    }

@router.get("/me")
async def me(user: dict = Depends(get_current_user)):
    """Get current user profile."""
    return UserResponse(
        id=user["id"],
        email=user["email"],
        name=user.get("name"),
        role=user.get("role"),
        phone=user.get("phone"),
    )

@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """Logout user (invalidate session)."""
    db = get_db()
    await db.users.update_one({"id": user["id"]}, {"$set": {"current_session_id": None}})
    return {"ok": True}
