"""Authentication endpoints (shared between web and mobile)."""
import secrets
import uuid
from fastapi import APIRouter, HTTPException, Depends, Request, Query
from app.core.database import get_db
from app.core.security import (
    hash_password, verify_password, create_access_token,
    get_current_user, require_admin, require_superadmin, require_conductor,
    get_company_id
)
from app.core.ratelimiter import auth_limiter
from app.models.schemas_auth import (
    LoginIn, RegisterIn, UserResponse,
    SiteTokenVerifyIn, SiteTokenCreateIn,
    DriverTokenVerifyIn, DriverTokenCreateIn,
    CompanyCreateIn, CompanyUpdateIn,
    SuperAdminUpdateUserIn,
)
from app.models.schemas_telemetry import Telemetry
from app.services.geo_helpers import interp_corridor, CORRIDOR, CORRIDOR_TOLERANCE_M
from app.services.ws_manager import manager
from datetime import datetime, timezone, timedelta
from typing import Optional

router = APIRouter(prefix="/auth", tags=["authentication"])

# ── Plans catalog ─────────────────────────────────────────────────────────────

PLANS_CATALOG = {
    "bronce": {"name": "Plan Bronce", "devices": 10},
    "plata":  {"name": "Plan Plata",  "devices": 25},
    "oro":    {"name": "Plan Oro",    "devices": 50},
}

CYCLE_DAYS = {
    "Semanal": 7, "Mensual": 30, "Bimestral": 60,
    "Trimestral": 90, "Anual": 365,
}


def _expires_in(cycle: str) -> datetime:
    """Calculate expiration date from cycle string."""
    days = CYCLE_DAYS.get(cycle, 30)
    return datetime.now(timezone.utc) + timedelta(days=days)


def _is_expired(tok: dict) -> bool:
    """Check if token has expired."""
    exp = tok.get("expires_at")
    if not exp:
        return False
    try:
        return datetime.fromisoformat(exp) < datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


# ── SuperAdmin: Company CRUD ──────────────────────────────────────────────────

@router.post("/companies")
async def create_company(body: CompanyCreateIn, user: dict = Depends(require_superadmin)):
    """Create a new company + its first monitorista user (superadmin only).
    If plan_id is provided, saves plan info and optionally creates the monitorista token."""
    db = get_db()

    company_id = f"comp_{uuid.uuid4().hex[:12]}"

    plan = PLANS_CATALOG.get(body.plan_id) if body.plan_id else None

    company = {
        "id": company_id,
        "name": body.name.strip(),
        "rfc": body.rfc,
        "phone": body.phone,
        "email": body.email,
        "address": body.address,
        "plan_id": body.plan_id,
        "plan_name": plan["name"] if plan else None,
        "cycle": body.cycle or ("Mensual" if plan else None),
        "max_drivers": plan["devices"] if plan else None,
        "has_token": False,
        "active": True,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.companies.insert_one(company)

    monitor_email = body.monitor_email.lower()
    if await db.users.find_one({"email": monitor_email}):
        await db.companies.delete_one({"id": company_id})
        raise HTTPException(status_code=400, detail="El correo del monitorista ya esta registrado")

    uid = str(uuid.uuid4())
    monitor_user = {
        "id": uid,
        "email": monitor_email,
        "password_hash": hash_password(body.monitor_password),
        "name": body.monitor_name.strip(),
        "role": "monitorista",
        "company_id": company_id,
        "phone": None,
        "token_version": 1,
        "current_session_id": str(uuid.uuid4()),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(monitor_user)

    site_token = None
    if plan and body.plan_id:
        raw = secrets.token_hex(24)
        site_token = {
            "token": raw,
            "name": body.name.strip(),
            "role": "monitorista",
            "company_id": company_id,
            "active": True,
            "use_count": 0,
            "max_uses": None,
            "unit_id": None,
            "driver_id": None,
            "device_id": None,
            "created_by": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used_at": None,
            "plan_id": body.plan_id,
            "plan_name": plan["name"],
            "max_drivers": plan["devices"],
            "drivers_used": 0,
            "cycle": body.cycle or "Mensual",
            "expires_at": _expires_in(body.cycle or "Mensual").isoformat(),
        }
        await db.site_tokens.insert_one(site_token)
        await db.companies.update_one(
            {"id": company_id},
            {"$set": {
                "has_token": True,
                "subscription_expires_at": site_token["expires_at"],
            }}
        )

    return {
        "company": {k: v for k, v in company.items() if k != "_id"},
        "monitor": {
            "id": uid,
            "email": monitor_email,
            "name": body.monitor_name,
            "role": "monitorista",
        },
        "site_token": {
            "token": site_token["token"],
            "plan_name": site_token["plan_name"],
            "max_drivers": site_token["max_drivers"],
            "cycle": site_token["cycle"],
            "expires_at": site_token["expires_at"],
        } if site_token else None,
    }


@router.get("/companies")
async def list_companies(user: dict = Depends(require_superadmin)):
    """List all companies (superadmin only). Shows token/plan status."""
    db = get_db()
    companies = await db.companies.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)
    now = datetime.now(timezone.utc)
    for c in companies:
        c["user_count"] = await db.users.count_documents({"company_id": c["id"]})
        c["unit_count"] = await db.units.count_documents({"company_id": c["id"]})

        has_token = c.get("has_token", False)
        active_token = await db.site_tokens.find_one(
            {"company_id": c["id"], "role": "monitorista", "active": True},
            {"_id": 0, "plan_name": 1, "expires_at": 1, "cycle": 1,
             "max_drivers": 1, "drivers_used": 1, "plan_id": 1, "token": 1}
        )
        if active_token:
            expired = False
            if active_token.get("expires_at"):
                try:
                    expired = datetime.fromisoformat(active_token["expires_at"]) < now
                except (ValueError, TypeError):
                    pass
            active_token["expired"] = expired
            c["subscription"] = active_token
        else:
            c["subscription"] = {"has_token": False} if not has_token else {"has_token": True, "active": False}
    return companies


@router.get("/companies/{company_id}")
async def get_company(company_id: str, user: dict = Depends(require_superadmin)):
    """Get company details (superadmin only). Includes token/plan info."""
    db = get_db()
    company = await db.companies.find_one({"id": company_id}, {"_id": 0})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")
    company["users"] = await db.users.find(
        {"company_id": company_id},
        {"_id": 0, "password_hash": 0, "current_session_id": 0}
    ).to_list(500)
    company["units"] = await db.units.find(
        {"company_id": company_id},
        {"_id": 0}
    ).to_list(500)
    monitor_token = await db.site_tokens.find_one(
        {"company_id": company_id, "role": "monitorista"},
        {"_id": 0, "token": 1, "plan_name": 1, "max_drivers": 1, "drivers_used": 1,
         "cycle": 1, "expires_at": 1, "active": 1}
    )
    company["monitor_token"] = monitor_token
    return company


@router.patch("/companies/{company_id}")
async def update_company(company_id: str, body: CompanyUpdateIn, user: dict = Depends(require_superadmin)):
    """Update company (superadmin only)."""
    db = get_db()
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    upd = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if upd:
        await db.companies.update_one({"id": company_id}, {"$set": upd})

    return await db.companies.find_one({"id": company_id}, {"_id": 0})


@router.patch("/users/{user_id}")
async def superadmin_update_user(user_id: str, body: SuperAdminUpdateUserIn, user: dict = Depends(require_superadmin)):
    """SuperAdmin updates any user's name/email/password. Requires the company's site_token to confirm."""
    db = get_db()

    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    company_id = target.get("company_id")

    # Verify site_token belongs to the user's company and is active
    if company_id:
        site_tok = await db.site_tokens.find_one({
            "token": body.site_token.strip(),
            "company_id": company_id,
            "role": "monitorista",
            "active": True,
        })
        if not site_tok:
            raise HTTPException(status_code=403, detail="El token de acceso no coincide con la empresa del usuario o esta desactivado")
        if _is_expired(site_tok):
            raise HTTPException(status_code=403, detail="La suscripcion de la empresa esta vencida")
    else:
        # user has no company_id (e.g. a different superadmin) — just verify token exists as any active monitorista token
        site_tok = await db.site_tokens.find_one({
            "token": body.site_token.strip(),
            "role": "monitorista",
            "active": True,
        })
        if not site_tok:
            raise HTTPException(status_code=403, detail="Token de acceso invalido")

    upd = {}
    if body.name is not None:
        upd["name"] = body.name.strip()
    if body.email is not None:
        new_email = body.email.lower().strip()
        existing = await db.users.find_one({"email": new_email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="El correo ya esta registrado por otro usuario")
        upd["email"] = new_email
    if body.password is not None:
        upd["password_hash"] = hash_password(body.password)

    if not upd:
        raise HTTPException(status_code=400, detail="No hay campos para actualizar")

    await db.users.update_one({"id": user_id}, {"$set": upd})

    return {
        "id": user_id,
        "email": upd.get("email", target["email"]),
        "name": upd.get("name", target["name"]),
        "updated_fields": list(upd.keys()),
    }


# ── Register ──────────────────────────────────────────────────────────────────

@router.post("/register")
async def register(body: RegisterIn, request: Request, user: dict = Depends(require_admin)):
    """Register new user (conductor or monitorista). Only admin-level users may create accounts."""
    await auth_limiter.check(request)
    db = get_db()
    email = body.email.lower()

    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="El correo ya esta registrado")

    role = body.role or "conductor"
    if role not in ("conductor", "driver", "monitorista", "admin", "operator"):
        raise HTTPException(status_code=400, detail="Rol invalido")

    # Only superadmin can create monitoristas
    if role in ("monitorista", "admin") and user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Solo SuperAdmin puede crear monitoristas")

    # Inherit company_id from creator (superadmin can override via body.company_id)
    company_id = body.company_id or get_company_id(user)

    uid = str(uuid.uuid4())
    sid = str(uuid.uuid4())

    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": role,
        "company_id": company_id,
        "phone": body.phone,
        "token_version": 1,
        "current_session_id": sid,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }

    await db.users.insert_one(doc)

    resp_user = UserResponse(
        id=uid, email=email, name=body.name,
        role=role, phone=body.phone, company_id=company_id
    )

    unit = None
    if role in ("conductor", "driver"):
        # If unit_id is provided, assign existing unit instead of creating new one
        if body.unit_id:
            unit_query = {"id": body.unit_id}
            if company_id:
                unit_query["company_id"] = company_id
            existing_unit = await db.units.find_one(unit_query)
            if existing_unit:
                await db.units.update_one({"id": body.unit_id}, {"$set": {
                    "driver_id": uid,
                    "driver_name": body.name,
                    "driver_phone": body.phone,
                }})
                unit = await db.units.find_one({"id": body.unit_id}, {"_id": 0})
                await manager.broadcast({"type": "unit_update", "unit": unit})

        if not unit:
            count = await db.units.count_documents({})
            lat, lng, heading = interp_corridor(0.0)
            unit = {
                "id": str(uuid.uuid4()),
                "driver_id": uid,
                "company_id": company_id,
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

    token = create_access_token(uid, email, role=role, ver=1, sid=sid)

    return {
        "access_token": token,
        "user": resp_user,
        "unit": unit,
    }


# ── Site Token (Monitorista) Endpoints ────────────────────────────────────────

@router.post("/verify-site-token")
async def verify_site_token(body: SiteTokenVerifyIn, request: Request):
    """Verify a site access token for monitoristas, or a SuperAdmin device key."""
    await auth_limiter.check(request)
    db = get_db()

    token_raw = body.token.strip()

    # Try monitorista site_token first
    tok = await db.site_tokens.find_one({"token": token_raw, "role": "monitorista", "active": True})
    if tok:
        if _is_expired(tok):
            raise HTTPException(status_code=403, detail="Tu suscripcion ha expirado. Contacta a tu administrador para renovar.")
        # Token is reusable — no consumption tracking
        await db.site_tokens.update_one(
            {"_id": tok["_id"]},
            {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}}
        )
        return {"ok": True, "name": tok.get("name", ""), "role": "monitorista", "expires_at": tok.get("expires_at"),
                "plan_name": tok.get("plan_name"), "plan_id": tok.get("plan_id"),
                "max_drivers": tok.get("max_drivers"), "drivers_used": tok.get("drivers_used") or 0}

    # Try SuperAdmin device key
    key_doc = await db.superadmin_keys.find_one({"active": True})
    if key_doc and verify_password(token_raw, key_doc["key_hash"]):
        return {"ok": True, "name": "SuperAdmin", "role": "superadmin", "expires_at": None}

    raise HTTPException(status_code=403, detail="Token de acceso invalido o desactivado")


@router.post("/site-tokens")
async def create_site_token(body: SiteTokenCreateIn, user: dict = Depends(require_superadmin)):
    """Create a new monitorista site token (superadmin only). Only ONE active token allowed per company.
    Use POST /driver-tokens for conductor tokens (enforces plan limits)."""
    db = get_db()

    role = body.role or "monitorista"
    if role != "monitorista":
        raise HTTPException(status_code=400, detail="Este endpoint solo genera tokens de monitorista. Usa POST /auth/driver-tokens para tokens de conductor.")

    company_id = get_company_id(user)

    # Enforce one active monitorista token per company
    existing = await db.site_tokens.find_one({"company_id": company_id, "role": "monitorista", "active": True})
    if existing:
        raise HTTPException(
            status_code=400,
            detail=f"La empresa ya tiene un token de monitorista activo. Desactiva '{existing.get('name', 'el actual')}' antes de crear uno nuevo."
        )

    raw = secrets.token_hex(24)

    doc = {
        "token": raw,
        "name": body.name.strip(),
        "role": "monitorista",
        "company_id": company_id,
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

    plan = PLANS_CATALOG.get(body.plan_id) if body.plan_id else None
    if not plan and (body.plan_id or body.cycle):
        raise HTTPException(status_code=400, detail="Plan no valido. Usa: bronce, plata u oro")
    if plan:
        doc["plan_id"] = body.plan_id
        doc["plan_name"] = plan["name"]
        doc["max_drivers"] = plan["devices"]
        doc["drivers_used"] = 0
        doc["cycle"] = body.cycle or "Mensual"
        doc["expires_at"] = _expires_in(doc["cycle"]).isoformat()

    await db.site_tokens.insert_one(doc)
    return {
        "token": raw,
        "name": doc["name"],
        "role": doc["role"],
        "company_id": doc.get("company_id"),
        "plan_id": doc.get("plan_id"),
        "plan_name": doc.get("plan_name"),
        "max_drivers": doc.get("max_drivers"),
        "cycle": doc.get("cycle"),
        "expires_at": doc.get("expires_at"),
    }


@router.get("/site-tokens")
async def list_site_tokens(
    user: dict = Depends(require_admin),
    role: Optional[str] = Query(None, description="Filter by role: monitorista or conductor"),
    active: Optional[str] = Query(None, description="Filter by active status: true or false"),
    search: Optional[str] = Query(None, description="Search by name or token"),
):
    """List all site tokens, scoped to user's company for monitoristas."""
    db = get_db()
    company_id = get_company_id(user)

    query = {}
    if company_id:
        query["company_id"] = company_id
    if role:
        query["role"] = role
    if active is not None:
        query["active"] = active.lower() == "true"
    if search:
        query["$or"] = [
            {"name": {"$regex": search, "$options": "i"}},
            {"token": {"$regex": search, "$options": "i"}},
        ]

    tokens = await db.site_tokens.find(
        query, {"_id": 0, "token": 1, "name": 1, "role": 1, "active": 1, "use_count": 1, "max_uses": 1,
                "unit_id": 1, "driver_id": 1, "device_id": 1, "created_at": 1, "last_used_at": 1,
                "plan_id": 1, "plan_name": 1, "max_drivers": 1, "drivers_used": 1, "cycle": 1, "expires_at": 1,
                "company_id": 1, "parent_token": 1}
    ).sort("created_at", -1).to_list(500)

    now = datetime.now(timezone.utc)
    for t in tokens:
        if t.get("expires_at"):
            try:
                t["expired"] = datetime.fromisoformat(t["expires_at"]) < now
            except (ValueError, TypeError):
                t["expired"] = False
        else:
            t["expired"] = False
    return tokens


@router.patch("/site-tokens/{tid}")
async def toggle_site_token(tid: str, user: dict = Depends(require_admin)):
    """Toggle a site token active/inactive."""
    db = get_db()
    tok = await db.site_tokens.find_one({"token": tid})
    if not tok:
        raise HTTPException(status_code=404, detail="Token no encontrado")

    company_id = get_company_id(user)
    if company_id and tok.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este token")

    new_active = not tok.get("active", True)
    await db.site_tokens.update_one({"token": tid}, {"$set": {"active": new_active}})
    return {"ok": True, "active": new_active}


@router.delete("/site-tokens/{tid}")
async def delete_site_token(tid: str, user: dict = Depends(require_superadmin)):
    """Delete any site token (superadmin only). Also frees unit if token had a unit bound."""
    db = get_db()
    tok = await db.site_tokens.find_one({"token": tid})
    if not tok:
        raise HTTPException(status_code=404, detail="Token no encontrado")

    # If token had a unit bound, free it
    if tok.get("unit_id"):
        await db.units.update_one({"id": tok["unit_id"]}, {"$set": {"driver_id": None}})

    await db.site_tokens.delete_one({"token": tid})
    return {"ok": True}


@router.post("/renew-token/{tid}")
async def renew_site_token(tid: str, user: dict = Depends(require_admin)):
    """Extend a monitorista token expiration by its cycle length."""
    db = get_db()
    tok = await db.site_tokens.find_one({"token": tid, "role": "monitorista"})
    if not tok:
        raise HTTPException(status_code=404, detail="Token monitorista no encontrado")

    company_id = get_company_id(user)
    if company_id and tok.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este token")

    cycle = tok.get("cycle", "Mensual")
    new_exp = _expires_in(cycle)

    await db.site_tokens.update_one(
        {"token": tid},
        {"$set": {"expires_at": new_exp.isoformat(), "active": True, "last_used_at": None}}
    )

    return {"ok": True, "expires_at": new_exp.isoformat(), "cycle": cycle}


@router.get("/token-status/{tid}")
async def token_status(tid: str, user: dict = Depends(require_admin)):
    """Get detailed status of a monitorista token."""
    db = get_db()
    tok = await db.site_tokens.find_one(
        {"token": tid, "role": "monitorista"},
        {"_id": 0, "token": 1, "name": 1, "active": 1, "plan_id": 1, "plan_name": 1,
         "max_drivers": 1, "drivers_used": 1, "cycle": 1, "expires_at": 1, "created_at": 1,
         "company_id": 1}
    )
    if not tok:
        raise HTTPException(status_code=404, detail="Token monitorista no encontrado")

    company_id = get_company_id(user)
    if company_id and tok.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este token")

    now = datetime.now(timezone.utc)
    expired = False
    if tok.get("expires_at"):
        try:
            expired = datetime.fromisoformat(tok["expires_at"]) < now
        except (ValueError, TypeError):
            pass

    return {
        **tok,
        "expired": expired,
        "remaining_drivers": max(0, (tok.get("max_drivers") or 0) - (tok.get("drivers_used") or 0)),
    }


# ── Driver / Conductor Token Endpoints ────────────────────────────────────────

@router.post("/driver-tokens")
async def create_driver_tokens(body: DriverTokenCreateIn, user: dict = Depends(require_superadmin)):
    """Generate conductor activation tokens. Requires a parent monitorista token to enforce plan limits."""
    db = get_db()
    tokens = []

    parent_tok = None
    if body.parent_token:
        parent_tok = await db.site_tokens.find_one({"token": body.parent_token.strip(), "role": "monitorista"})
        if not parent_tok:
            raise HTTPException(status_code=404, detail="Token monitorista no encontrado")
        if not parent_tok.get("active"):
            raise HTTPException(status_code=403, detail="El token monitorista esta desactivado")
        if _is_expired(parent_tok):
            raise HTTPException(status_code=403, detail="La suscripcion ha expirado. Renueva antes de crear tokens de conductor.")

        max_drivers = parent_tok.get("max_drivers") or 0
        drivers_used = parent_tok.get("drivers_used") or 0
        remaining = max_drivers - drivers_used

        if max_drivers > 0 and remaining < body.count:
            raise HTTPException(
                status_code=403,
                detail=f"Limite alcanzado: tu plan permite {max_drivers} conductores y ya usaste {drivers_used}. "
                       f"Solo puedes crear {max(0, remaining)} mas."
            )

    company_id = parent_tok.get("company_id") if parent_tok else get_company_id(user)

    for i in range(body.count):
        raw = secrets.token_hex(16)
        doc = {
            "token": raw,
            "name": f"Conductor-{uuid.uuid4().hex[:4].upper()}",
            "role": "conductor",
            "company_id": company_id,
            "active": True,
            "use_count": 0,
            "max_uses": body.max_uses,  # None = reusable
            "unit_id": None,
            "driver_id": None,
            "device_id": None,
            "parent_token": body.parent_token,
            "created_by": user["id"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used_at": None,
        }

        if body.unit_ids and i < len(body.unit_ids):
            unit_query = {"id": body.unit_ids[i]}
            if company_id:
                unit_query["company_id"] = company_id
            unit = await db.units.find_one(unit_query, {"_id": 0})
            if unit:
                doc["unit_id"] = unit["id"]
                doc["driver_id"] = unit.get("driver_id")
                doc["name"] = f"{unit.get('name', 'Unidad')} · {unit.get('driver_name', 'Conductor')}"

        if not doc["driver_id"] and body.driver_ids and i < len(body.driver_ids):
            driver_query = {"id": body.driver_ids[i], "role": {"$in": ["conductor", "driver"]}}
            if company_id:
                driver_query["company_id"] = company_id
            driver = await db.users.find_one(driver_query, {"_id": 0})
            if driver:
                doc["driver_id"] = driver["id"]
                doc["name"] = driver.get("name", "Conductor")

        await db.site_tokens.insert_one(doc)
        tokens.append({"token": raw, "name": doc["name"], "unit_id": doc["unit_id"], "driver_id": doc["driver_id"]})

    if parent_tok:
        await db.site_tokens.update_one(
            {"token": body.parent_token.strip()},
            {"$inc": {"drivers_used": body.count}}
        )

    return {"tokens": tokens, "parent_token": body.parent_token}


@router.get("/driver-tokens")
async def list_driver_tokens(user: dict = Depends(require_admin)):
    """List all conductor tokens, scoped to user's company for monitoristas."""
    db = get_db()
    company_id = get_company_id(user)
    query = {"role": "conductor"}
    if company_id:
        query["company_id"] = company_id

    tokens = await db.site_tokens.find(
        query,
        {"_id": 0, "token": 1, "name": 1, "active": 1, "use_count": 1, "max_uses": 1,
         "unit_id": 1, "driver_id": 1, "device_id": 1, "created_at": 1, "last_used_at": 1}
    ).sort("created_at", -1).to_list(500)
    return tokens


@router.get("/monitor-token-drivers/{token}")
async def get_driver_tokens_by_monitor_token(token: str, request: Request):
    """Public endpoint: given a valid monitorista token, list its conductor tokens (for pre-login view)."""
    await auth_limiter.check(request)
    db = get_db()

    parent = await db.site_tokens.find_one({"token": token.strip(), "role": "monitorista", "active": True})
    if not parent:
        raise HTTPException(status_code=403, detail="Token de monitorista invalido o desactivado")
    if _is_expired(parent):
        raise HTTPException(status_code=403, detail="La suscripcion ha expirado")

    driver_tokens = await db.site_tokens.find(
        {"parent_token": token.strip(), "role": "conductor"},
        {"_id": 0, "token": 1, "name": 1, "active": 1, "use_count": 1, "max_uses": 1,
         "unit_id": 1, "driver_id": 1, "device_id": 1, "created_at": 1, "last_used_at": 1}
    ).sort("created_at", -1).to_list(500)

    return {
        "parent_token_name": parent.get("name"),
        "plan_name": parent.get("plan_name"),
        "max_drivers": parent.get("max_drivers"),
        "drivers_used": parent.get("drivers_used") or 0,
        "tokens": driver_tokens,
    }


@router.post("/verify-driver-token")
async def verify_driver_token(body: DriverTokenVerifyIn, request: Request):
    """Verify a conductor activation token. Optionally locks to device."""
    await auth_limiter.check(request)
    db = get_db()

    tok = await db.site_tokens.find_one({"token": body.token.strip(), "role": "conductor", "active": True})
    if not tok:
        raise HTTPException(status_code=403, detail="Token de conductor invalido o desactivado")

    parent_token = tok.get("parent_token")
    if parent_token:
        parent = await db.site_tokens.find_one({"token": parent_token, "active": True})
        if not parent:
            raise HTTPException(status_code=403, detail="La suscripcion asociada a este token ya no esta activa")
        if _is_expired(parent):
            raise HTTPException(status_code=403, detail="La suscripcion ha expirado. Contacta a tu administrador.")

        company = await db.companies.find_one({"id": parent.get("company_id")})
        if company and not company.get("active", True):
            raise HTTPException(status_code=403, detail="La empresa esta desactivada. Contacta a tu administrador.")

    if tok.get("device_id") and body.device_id and tok["device_id"] != body.device_id:
        raise HTTPException(status_code=403, detail="Este token ya esta vinculado a otro dispositivo")

    # Token is reusable — no consumption tracking
    upd = {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat()}}
    if body.device_id and not tok.get("device_id"):
        upd["$set"]["device_id"] = body.device_id

    await db.site_tokens.update_one({"token": body.token.strip()}, upd)

    return {
        "ok": True,
        "name": tok.get("name", ""),
        "unit_id": tok.get("unit_id"),
        "driver_id": tok.get("driver_id"),
    }


# ── Login ─────────────────────────────────────────────────────────────────────

@router.post("/login")
async def login(body: LoginIn, request: Request):
    """Login user. Blocks if subscription expired or company is inactive."""
    await auth_limiter.check(request)
    db = get_db()
    email = body.email.lower()
    user = await db.users.find_one({"email": email})

    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")

    role = user.get("role")
    company_id = user.get("company_id")

    # SuperAdmin requires device-bound key (from site_token field, since frontend stores it there)
    if role == "superadmin":
        admin_key = body.admin_key or body.site_token
        if not admin_key:
            raise HTTPException(status_code=403, detail="Llave de administrador requerida para SuperAdmin")
        key_doc = await db.superadmin_keys.find_one({"active": True})
        if not key_doc:
            raise HTTPException(status_code=403, detail="No hay llaves de SuperAdmin registradas. Ejecuta generate_superadmin_key.py")
        if not verify_password(admin_key.strip(), key_doc["key_hash"]):
            raise HTTPException(status_code=403, detail="Llave de administrador invalida")
        await db.superadmin_keys.update_one(
            {"_id": key_doc["_id"]},
            {"$set": {"last_used_at": datetime.now(timezone.utc).isoformat(), "last_used_by": email}}
        )

    # Site token check for monitorista-level roles
    if role in ("monitorista", "admin", "operator", "dev"):
        if not body.site_token:
            raise HTTPException(status_code=403, detail="Token de acceso requerido para monitoristas")
        site_tok = await db.site_tokens.find_one({"token": body.site_token.strip(), "role": "monitorista", "active": True})
        if not site_tok:
            raise HTTPException(status_code=403, detail="Token de acceso invalido o desactivado")
        if _is_expired(site_tok):
            raise HTTPException(status_code=403, detail="Tu suscripcion ha expirado. Contacta a tu administrador para renovar.")

        # Verify company is still active
        if company_id:
            company = await db.companies.find_one({"id": company_id})
            if company and not company.get("active", True):
                raise HTTPException(status_code=403, detail="Tu empresa esta desactivada. Contacta a tu administrador.")

    # Conductor token check
    if role in ("conductor", "driver"):
        if not body.driver_token:
            raise HTTPException(status_code=403, detail="Token de activacion requerido para conductores")
        drv_tok = await db.site_tokens.find_one({"token": body.driver_token.strip(), "role": "conductor", "active": True})
        if not drv_tok:
            raise HTTPException(status_code=403, detail="Token de conductor invalido o desactivado")

        parent_token = drv_tok.get("parent_token")
        if parent_token:
            parent = await db.site_tokens.find_one({"token": parent_token, "active": True})
            if not parent:
                raise HTTPException(status_code=403, detail="La suscripcion asociada a tu cuenta ya no esta activa")
            if _is_expired(parent):
                raise HTTPException(status_code=403, detail="Tu suscripcion ha expirado. Solicita renovacion a tu administrador.")

            parent_company_id = parent.get("company_id")
            if parent_company_id:
                company = await db.companies.find_one({"id": parent_company_id})
                if company and not company.get("active", True):
                    raise HTTPException(status_code=403, detail="La empresa esta desactivada. Contacta a tu administrador.")

        if body.device_id and not drv_tok.get("device_id"):
            await db.site_tokens.update_one({"token": body.driver_token.strip()}, {"$set": {"device_id": body.device_id}})

    # Single session enforcement
    new_ver = int(user.get("token_version", 0)) + 1
    sid = str(uuid.uuid4())

    await db.users.update_one({"id": user["id"]}, {"$set": {"token_version": new_ver, "current_session_id": sid}})

    pub_user = UserResponse(
        id=user["id"],
        email=email,
        name=user.get("name"),
        role=user.get("role"),
        phone=user.get("phone"),
        company_id=company_id,
    )

    unit = None
    if role in ("conductor", "driver"):
        unit = await db.units.find_one({"driver_id": user["id"]}, {"_id": 0})
        if not unit:
            count = await db.units.count_documents({})
            lat, lng, heading = interp_corridor(0.0)
            unit = {
                "id": str(uuid.uuid4()),
                "driver_id": user["id"],
                "company_id": company_id,
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

    token = create_access_token(user["id"], email, role=role, ver=new_ver, sid=sid)

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
        company_id=user.get("company_id"),
    )


@router.post("/companies/{company_id}/assign-token")
async def assign_company_token(company_id: str, body: SiteTokenCreateIn, user: dict = Depends(require_superadmin)):
    """Assign a monitorista token to a company that doesn't have one (superadmin only)."""
    db = get_db()
    company = await db.companies.find_one({"id": company_id})
    if not company:
        raise HTTPException(status_code=404, detail="Empresa no encontrada")

    existing = await db.site_tokens.find_one({"company_id": company_id, "role": "monitorista", "active": True})
    if existing:
        raise HTTPException(status_code=400, detail="La empresa ya tiene un token de monitorista activo")

    plan = PLANS_CATALOG.get(body.plan_id) if body.plan_id else None
    if not plan:
        raise HTTPException(status_code=400, detail="Plan no valido. Usa: bronce, plata u oro")

    raw = secrets.token_hex(24)
    cycle = body.cycle or "Mensual"
    doc = {
        "token": raw,
        "name": company["name"].strip(),
        "role": "monitorista",
        "company_id": company_id,
        "active": True,
        "use_count": 0,
        "max_uses": None,
        "unit_id": None,
        "driver_id": None,
        "device_id": None,
        "created_by": user["id"],
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "plan_id": body.plan_id,
        "plan_name": plan["name"],
        "max_drivers": plan["devices"],
        "drivers_used": 0,
        "cycle": cycle,
        "expires_at": _expires_in(cycle).isoformat(),
    }
    await db.site_tokens.insert_one(doc)
    await db.companies.update_one(
        {"id": company_id},
        {"$set": {
            "has_token": True,
            "plan_id": body.plan_id,
            "plan_name": plan["name"],
            "cycle": cycle,
            "max_drivers": plan["devices"],
            "subscription_expires_at": doc["expires_at"],
        }}
    )
    return {"token": raw, "plan_name": plan["name"], "max_drivers": plan["devices"],
            "cycle": cycle, "expires_at": doc["expires_at"]}


@router.get("/superadmin-key-status")
async def superadmin_key_status():
    """Check if a SuperAdmin key is registered (so frontend knows to show admin_key field)."""
    db = get_db()
    key = await db.superadmin_keys.find_one({"active": True})
    return {"registered": key is not None}


@router.get("/company-token-overview")
async def company_token_overview(user: dict = Depends(require_admin)):
    """Get the company's monitorista token (highlighted) + all conductor tokens grouped.
    Monitoristas use this for read-only token view."""
    db = get_db()
    company_id = get_company_id(user)

    if not company_id:
        return {"monitor_token": None, "conductor_tokens": [], "total_drivers_used": 0, "max_drivers": 0}

    # Get the unique monitorista token
    monitor_token = await db.site_tokens.find_one(
        {"company_id": company_id, "role": "monitorista"},
        {"_id": 0, "token": 1, "name": 1, "active": 1, "plan_id": 1, "plan_name": 1,
         "max_drivers": 1, "drivers_used": 1, "cycle": 1, "expires_at": 1, "created_at": 1,
         "use_count": 1, "last_used_at": 1, "company_id": 1}
    )

    if monitor_token:
        if monitor_token.get("expires_at"):
            try:
                monitor_token["expired"] = datetime.fromisoformat(monitor_token["expires_at"]) < datetime.now(timezone.utc)
            except (ValueError, TypeError):
                monitor_token["expired"] = False
        else:
            monitor_token["expired"] = False
        monitor_token["remaining_drivers"] = max(0, (monitor_token.get("max_drivers") or 0) - (monitor_token.get("drivers_used") or 0))

    # Get all conductor tokens for this company
    conductor_tokens = await db.site_tokens.find(
        {"company_id": company_id, "role": "conductor"},
        {"_id": 0, "token": 1, "name": 1, "active": 1, "use_count": 1, "max_uses": 1,
         "unit_id": 1, "driver_id": 1, "device_id": 1, "created_at": 1, "last_used_at": 1,
         "parent_token": 1}
    ).sort("created_at", -1).to_list(500)

    # For each conductor token, try to get unit info
    for ct in conductor_tokens:
        ct["expired"] = False
        if ct.get("unit_id"):
            unit_info = await db.units.find_one({"id": ct["unit_id"]}, {"_id": 0, "name": 1, "plate": 1, "driver_name": 1})
            if unit_info:
                ct["unit_info"] = unit_info

    return {
        "monitor_token": monitor_token,
        "conductor_tokens": conductor_tokens,
        "total_drivers_used": monitor_token.get("drivers_used", 0) if monitor_token else 0,
        "max_drivers": monitor_token.get("max_drivers", 0) if monitor_token else 0,
    }


@router.post("/logout")
async def logout(user: dict = Depends(get_current_user)):
    """Logout user (invalidate session)."""
    db = get_db()
    await db.users.update_one({"id": user["id"]}, {"$set": {"current_session_id": None}})
    return {"ok": True}
