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
    SiteTokenVerifyIn, SiteTokenCreateIn,
    DriverTokenVerifyIn, DriverTokenCreateIn
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
    """Verify a site access token for monitoristas. Returns ok if token is valid and active."""
    await auth_limiter.check(request)
    db = get_db()
    tok = await db.site_tokens.find_one({"token": body.token.strip(), "role": "monitorista", "active": True})
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
        "role": body.role or "monitorista",
        "active": True,
        "use_count": 0,
        "max_uses": body.max_uses,
        "unit_id": body.unit_id,
        "driver_id": body.driver_id,
        "device_id": None,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
    }
    await db.site_tokens.insert_one(doc)
    return {"token": raw, "name": doc["name"], "role": doc["role"]}

@router.get("/site-tokens")
async def list_site_tokens(user: dict = Depends(require_admin)):
    """List all site tokens (monitorista + conductor)."""
    db = get_db()
    tokens = await db.site_tokens.find(
        {}, {"_id": 0, "token": 1, "name": 1, "role": 1, "active": 1, "use_count": 1, "max_uses": 1,
             "unit_id": 1, "driver_id": 1, "device_id": 1, "created_at": 1, "last_used_at": 1}
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


# --- Driver Token Endpoints ---

@router.post("/driver-tokens")
async def create_driver_tokens(body: DriverTokenCreateIn, user: dict = Depends(require_admin)):
    """Generate driver activation tokens. One per unit/driver."""
    db = get_db()
    tokens = []

    for i in range(body.count):
        raw = secrets.token_hex(16)  # shorter than monitorista tokens for easy typing
        doc = {
            "token": raw,
            "name": f"Conductor-{uuid.uuid4().hex[:4].upper()}",
            "role": "conductor",
            "active": True,
            "use_count": 0,
            "max_uses": body.max_uses or 1,
            "unit_id": None,
            "driver_id": None,
            "device_id": None,
            "created_by": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used_at": None,
        }

        # Link to specific unit if provided
        if body.unit_ids and i < len(body.unit_ids):
            unit = await db.units.find_one({"id": body.unit_ids[i]}, {"_id": 0})
            if unit:
                doc["unit_id"] = unit["id"]
                doc["driver_id"] = unit.get("driver_id")
                doc["name"] = f"{unit.get('name', 'Unidad')} · {unit.get('driver_name', 'Conductor')}"

        # Link to specific driver if provided
        if not doc["driver_id"] and body.driver_ids and i < len(body.driver_ids):
            driver = await db.users.find_one({"id": body.driver_ids[i], "role": "driver"}, {"_id": 0})
            if driver:
                doc["driver_id"] = driver["id"]
                doc["name"] = driver.get("name", "Conductor")

        await db.site_tokens.insert_one(doc)
        tokens.append({"token": raw, "name": doc["name"], "unit_id": doc["unit_id"], "driver_id": doc["driver_id"]})

    return {"tokens": tokens}


@router.get("/driver-tokens")
async def list_driver_tokens(user: dict = Depends(require_admin)):
    """List all driver activation tokens."""
    db = get_db()
    tokens = await db.site_tokens.find(
        {"role": "conductor"},
        {"_id": 0, "token": 1, "name": 1, "active": 1, "use_count": 1, "max_uses": 1,
         "unit_id": 1, "driver_id": 1, "device_id": 1, "created_at": 1, "last_used_at": 1}
    ).sort("created_at", -1).to_list(500)
    return tokens


@router.post("/verify-driver-token")
async def verify_driver_token(body: DriverTokenVerifyIn, request: Request):
    """Verify a driver activation token. Optionally locks to device."""
    await auth_limiter.check(request)
    db = get_db()

    tok = await db.site_tokens.find_one({"token": body.token.strip(), "role": "conductor", "active": True})
    if not tok:
        raise HTTPException(status_code=403, detail="Token de conductor invalido o desactivado")

    if tok.get("max_uses") is not None:
        used = tok.get("use_count", 0)
        if used >= tok["max_uses"]:
            raise HTTPException(status_code=403, detail="Este token ya alcanzo su maximo de usos")

    # Enforce one-device if already registered
    if tok.get("device_id") and body.device_id and tok["device_id"] != body.device_id:
        raise HTTPException(status_code=403, detail="Este token ya esta vinculado a otro dispositivo")

    # Lock to device on first use
    upd = {"$inc": {"use_count": 1}, "$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}}
    if body.device_id and not tok.get("device_id"):
        upd["$set"]["device_id"] = body.device_id

    await db.site_tokens.update_one({"token": body.token.strip()}, upd)

    return {
        "ok": True,
        "name": tok.get("name", ""),
        "unit_id": tok.get("unit_id"),
        "driver_id": tok.get("driver_id"),
    }


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
        site_tok = await db.site_tokens.find_one({"token": body.site_token.strip(), "role": "monitorista", "active": True})
        if not site_tok:
            raise HTTPException(status_code=403, detail="Token de acceso invalido o desactivado")

    # Driver token check — required for driver role
    if user.get("role") == "driver":
        if not body.driver_token:
            raise HTTPException(status_code=403, detail="Token de activacion requerido para conductores")
        drv_tok = await db.site_tokens.find_one({"token": body.driver_token.strip(), "role": "conductor", "active": True})
        if not drv_tok:
            raise HTTPException(status_code=403, detail="Token de conductor invalido o desactivado")

        # Lock to device on first use
        if body.device_id and not drv_tok.get("device_id"):
            await db.site_tokens.update_one({"token": body.driver_token.strip()}, {"$set": {"device_id": body.device_id}})
    
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
