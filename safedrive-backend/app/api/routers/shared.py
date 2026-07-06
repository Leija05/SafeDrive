"""Shared endpoints for monitoring center (web dashboard and mobile)."""
import uuid
import html
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user, require_admin, hash_password, verify_password
from app.models.schemas_telemetry import AlertAction, ChatIn
from app.models.schemas_routes import CustomRouteIn, RouteAssign, UnitCreate, UnitUpdate
from app.models.schemas_auth import AdminCreateUserIn, AdminUpdateUserIn
from app.services.geo_helpers import deviation_from_route_m, BRIDGES, DEAD_ZONES, CORRIDOR, CORRIDOR_TOLERANCE_M, haversine_m, interp_corridor
from app.services.routing_osrm import validate_point, street_route, geocode_address
from app.services.ws_manager import manager

router = APIRouter(tags=["monitoring-shared"])

PREDEFINED_ROUTES = [
    {"id": "nld-laredo-tx", "name": "Nuevo Laredo → Laredo, TX", "points": [[27.4763, -99.5164], [27.5100, -99.5200], [27.5306, -99.4803]]},
    {"id": "nld-world-trade", "name": "Nuevo Laredo → World Trade Bridge", "points": [[27.4763, -99.5164], [27.5900, -99.5600], [27.6336, -99.5847], [27.6411, -99.5400]]},
    {"id": "nld-san-antonio", "name": "Nuevo Laredo → San Antonio, TX", "points": [[27.4763, -99.5164], [27.5306, -99.4803], [28.7110, -100.4995], [29.4241, -98.4936]]},
]

@router.get("/")
async def root():
    """API health check."""
    return {"service": "SafeDrive GPS Unified Backend", "status": "ok"}

@router.get("/route")
async def get_route():
    """Get corridor geometry and geofences."""
    from app.services.geo_helpers import CORRIDOR, BRIDGES, DEAD_ZONES, CORRIDOR_TOLERANCE_M
    return {
        "corridor": CORRIDOR,
        "bridges": BRIDGES,
        "dead_zones": DEAD_ZONES,
        "tolerance_m": CORRIDOR_TOLERANCE_M
    }

@router.get("/plans")
async def get_plans():
    """Get available plans and onboarding packages."""
    PLANS = [
        {
            "id": "bronce",
            "name": "Plan Bronce",
            "devices": 10,
            "tagline": "Para transfers pequeños o líneas expres nacientes.",
            "prices": {"Semanal": 650, "Mensual": 2200, "Bimestral": 4000, "Trimestral": 5400, "Anual": 18000},
            "per_truck": "Desde $150 por camión",
            "highlight": False,
        },
        {
            "id": "plata",
            "name": "Plan Plata",
            "devices": 25,
            "tagline": "Para la típica PyME transportista de Nuevo Laredo.",
            "prices": {"Semanal": 1500, "Mensual": 5000, "Bimestral": 9000, "Trimestral": 12000, "Anual": 39600},
            "per_truck": "Desde $132 mensuales por camión",
            "highlight": True,
        },
        {
            "id": "oro",
            "name": "Plan Oro",
            "devices": 50,
            "tagline": "Para empresas medianas-grandes de alto volumen.",
            "prices": {"Semanal": 2750, "Mensual": 9000, "Bimestral": 16500, "Trimestral": 22500, "Anual": 72000},
            "per_truck": "Desde $120 mensuales por camión",
            "highlight": False,
        },
    ]

    ONBOARDING = [
        {
            "id": "instalacion",
            "name": "Instalación del Programa",
            "price": 3500,
            "desc": "Infraestructura backend en la nube, configuración de rutas aduanales, geocercas de Nuevo Laredo y capacitación.",
        },
        {
            "id": "token-pc",
            "name": "Activación por Computadora (Token)",
            "price": 1500,
            "desc": "Costo por cada PC de oficina con acceso al Dashboard de monitoreo en tiempo real.",
        },
    ]

    return {"plans": PLANS, "onboarding": ONBOARDING}

@router.get("/routes")
async def get_routes(user: dict = Depends(get_current_user)):
    """Get predefined routes for assignment."""
    from app.services.geo_helpers import CORRIDOR_TOLERANCE_M
    from app.models.schemas_routes import UnitCreate
    
    PREDEFINED_ROUTES = [
        {"id": "nld-laredo-tx", "name": "Nuevo Laredo → Laredo, TX", "points": [[27.4763, -99.5164], [27.5100, -99.5200], [27.5306, -99.4803]]},
        {"id": "nld-world-trade", "name": "Nuevo Laredo → World Trade Bridge", "points": [[27.4763, -99.5164], [27.5900, -99.5600], [27.6336, -99.5847], [27.6411, -99.5400]]},
        {"id": "nld-san-antonio", "name": "Nuevo Laredo → San Antonio, TX", "points": [[27.4763, -99.5164], [27.5306, -99.4803], [28.7110, -100.4995], [29.4241, -98.4936]]},
    ]
    
    return {"routes": PREDEFINED_ROUTES, "default_tolerance_m": CORRIDOR_TOLERANCE_M}

async def ensure_unit_for_driver(user: dict, plate: Optional[str] = None, phone: Optional[str] = None) -> dict:
    db = get_db()
    unit = await db.units.find_one({"driver_id": user["id"]}, {"_id": 0})
    if unit:
        return unit

    count = await db.units.count_documents({})
    lat, lng, heading = interp_corridor(0.0)
    unit = {
        "id": str(uuid.uuid4()),
        "driver_id": user["id"],
        "name": f"NL-{count + 1:02d}",
        "driver_name": user.get("name", "Conductor"),
        "plate": plate or f"NL-{uuid.uuid4().hex[:6].upper()}",
        "driver_phone": phone,
        "imei": str(uuid.uuid4())[:15],
        "lat": lat,
        "lng": lng,
        "speed": 0,
        "heading": 0,
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
    return unit

@router.post("/users")
async def admin_create_user(body: AdminCreateUserIn, user: dict = Depends(require_admin)):
    db = get_db()
    role = body.role.strip().lower()
    if role not in ("driver", "admin"):
        raise HTTPException(status_code=400, detail="Rol invalido. Usa driver o admin")
    if role == "admin" and user.get("role") != "dev":
        raise HTTPException(status_code=403, detail="Solo el rol dev puede crear administradores")

    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="El correo ya está registrado")

    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": role,
        "phone": body.phone,
        "token_version": 0,
        "current_session_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)

    return {"user": {"id": uid, "email": email, "name": body.name, "role": role, "phone": body.phone}}

@router.get("/users")
async def admin_list_users(user: dict = Depends(require_admin)):
    db = get_db()
    users = await db.users.find({}, {"_id": 0, "password_hash": 0, "current_session_id": 0}).sort("created_at", -1).to_list(500)
    units = await db.units.find({}, {"_id": 0}).to_list(500)
    by_driver = {u.get("driver_id"): u for u in units if u.get("driver_id")}
    for item in users:
        item["unit"] = by_driver.get(item.get("id"))
    return users

@router.patch("/users/{user_id}")
async def admin_update_user(user_id: str, body: AdminUpdateUserIn, user: dict = Depends(require_admin)):
    db = get_db()
    admin_private = await db.users.find_one({"id": user["id"]})
    if not admin_private or not verify_password(body.admin_password, admin_private["password_hash"]):
        raise HTTPException(status_code=403, detail="Contraseña de monitorista incorrecta")

    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")

    upd = {}
    if body.email is not None:
        email = body.email.lower()
        existing = await db.users.find_one({"email": email, "id": {"$ne": user_id}})
        if existing:
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
        upd["email"] = email
    if body.password:
        upd["password_hash"] = hash_password(body.password)
        upd["token_version"] = int(target.get("token_version", 0)) + 1
        upd["current_session_id"] = None
    if body.name is not None:
        upd["name"] = body.name
    if body.role is not None:
        role = body.role.strip().lower()
        if role not in ("driver", "admin"):
            raise HTTPException(status_code=400, detail="Rol invalido. Usa driver o admin")
        upd["role"] = role
    if body.phone is not None:
        upd["phone"] = body.phone

    if upd:
        await db.users.update_one({"id": user_id}, {"$set": upd})

    public = await db.users.find_one({"id": user_id}, {"_id": 0, "password_hash": 0, "current_session_id": 0})
    if public.get("role") == "driver":
        unit = await ensure_unit_for_driver(public, body.plate, public.get("phone"))
        unit_update = {"driver_name": public.get("name"), "driver_phone": public.get("phone")}
        if body.plate is not None:
            unit_update["plate"] = body.plate
        await db.units.update_one({"id": unit["id"]}, {"$set": unit_update})
        public["unit"] = await db.units.find_one({"id": unit["id"]}, {"_id": 0})
    return public

@router.get("/units")
async def list_units(user: dict = Depends(get_current_user)):
    """List all vehicle units."""
    db = get_db()
    units = await db.units.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return units

@router.get("/units/{unit_id}")
async def get_unit(unit_id: str, user: dict = Depends(get_current_user)):
    """Get specific unit details and track."""
    db = get_db()
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0, "password_hash": 0})
    
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    
    track = await db.positions.find({"unit_id": unit_id}, {"_id": 0}).sort("ts", -1).limit(50).to_list(50)
    unit["track"] = list(reversed(track))
    
    return unit

@router.post("/units")
async def create_unit(body: UnitCreate, user: dict = Depends(require_admin)):
    db = get_db()
    driver_id = None
    driver_name = body.driver_name
    driver_phone = body.driver_phone or body.phone

    if body.driver_id:
        driver = await db.users.find_one({"id": body.driver_id, "role": "driver"})
        if not driver:
            raise HTTPException(status_code=404, detail="Conductor no encontrado")
        driver_id = driver["id"]
        driver_name = driver_name or driver.get("name")
        driver_phone = driver_phone or driver.get("phone")
    elif body.driver_email and body.driver_password:
        if not driver_name:
            raise HTTPException(status_code=400, detail="Nombre del conductor es obligatorio")
        email = body.driver_email.lower()
        if await db.users.find_one({"email": email}):
            raise HTTPException(status_code=400, detail="El correo ya está registrado")
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": email,
            "password_hash": hash_password(body.driver_password),
            "name": driver_name,
            "role": "driver",
            "phone": driver_phone,
            "token_version": 0,
            "current_session_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        driver_id = uid

    unit = {
        "id": str(uuid.uuid4()),
        "driver_id": driver_id,
        "name": body.name,
        "driver_name": driver_name,
        "plate": body.plate,
        "imei": body.imei or str(uuid.uuid4())[:15],
        "email": body.email.lower() if body.email else None,
        "phone": body.phone,
        "password_hash": hash_password(body.password) if body.password else None,
        "color": body.color or "#00E676",
        "route": {
            "origin": CORRIDOR[0],
            "destination": CORRIDOR[-1],
            "corridor": CORRIDOR,
            "bridges": BRIDGES,
            "dead_zones": DEAD_ZONES,
            "tolerance_m": CORRIDOR_TOLERANCE_M,
            "name": "FED-85 · Monterrey → Nuevo Laredo",
        },
        "assigned_route": CORRIDOR,
        "route_name": "FED-85 · Monterrey → Nuevo Laredo",
        "route_tolerance_m": CORRIDOR_TOLERANCE_M,
        "lat": CORRIDOR[0][0],
        "lng": CORRIDOR[0][1],
        "speed": 0,
        "heading": 0,
        "battery": 100,
        "deviation_m": 0,
        "status": "detenido",
        "signal": "ok",
        "online": True,
        "panic": False,
        "fiscal": {"active": False},
        "in_bridge": None,
        "route_progress": 0.0,
        "last_update": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.units.insert_one({**unit})
    await manager.broadcast({"type": "unit_update", "unit": unit})
    return unit

@router.put("/units/{unit_id}")
async def update_unit(unit_id: str, body: UnitUpdate, user: dict = Depends(require_admin)):
    db = get_db()
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "email" in update:
        update["email"] = str(update["email"]).lower()
    if "driver_id" in update:
        driver = await db.users.find_one({"id": update["driver_id"], "role": "driver"})
        if not driver:
            raise HTTPException(status_code=404, detail="Conductor no encontrado")
        update["driver_name"] = update.get("driver_name") or driver.get("name")
        update["driver_phone"] = update.get("driver_phone") or driver.get("phone")
    if body.password:
        update["password_hash"] = hash_password(body.password)
        update.pop("password", None)
    if update:
        await db.units.update_one({"id": unit_id}, {"$set": update})

    updated = await db.units.find_one({"id": unit_id}, {"_id": 0, "password_hash": 0})
    await manager.broadcast({"type": "unit_update", "unit": updated})
    return updated

@router.get("/alerts")
async def list_alerts(
    status: Optional[str] = Query(None),
    user: dict = Depends(get_current_user)
):
    """List alerts with optional status filter."""
    db = get_db()
    q = {"status": status} if status else {}
    alerts = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return alerts

async def build_route_for_unit(unit: dict, body: RouteAssign, user: dict) -> dict:
    name = body.name or "Ruta personalizada"

    if body.route_id:
        match = next((r for r in PREDEFINED_ROUTES if r["id"] == body.route_id), None)
        if not match:
            raise HTTPException(status_code=400, detail="Ruta predefinida no encontrada")
        corridor = [validate_point(p, "Punto de ruta") for p in match["points"]]
        return {
            "origin": corridor[0],
            "destination": corridor[-1],
            "corridor": corridor,
            "distance_m": round(sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(corridor, corridor[1:])), 0),
            "duration_s": None,
            "provider": "predefined",
            "name": match["name"],
            "bridges": BRIDGES,
            "dead_zones": DEAD_ZONES,
            "tolerance_m": body.tolerance_m if body.tolerance_m is not None else CORRIDOR_TOLERANCE_M,
        }

    points = body.points
    if points and len(points) >= 2:
        corridor = [validate_point(p, "Punto de ruta") for p in points]
        return {
            "origin": corridor[0],
            "destination": corridor[-1],
            "corridor": corridor,
            "distance_m": round(sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(corridor, corridor[1:])), 0),
            "duration_s": None,
            "provider": "manual",
            "name": name,
            "bridges": BRIDGES,
            "dead_zones": DEAD_ZONES,
            "tolerance_m": body.tolerance_m if body.tolerance_m is not None else CORRIDOR_TOLERANCE_M,
        }

    origin = body.origin or body.start
    destination = body.destination
    if origin and destination:
        if body.origin_address and body.destination_address:
            origin = geocode_address(body.origin_address, origin)
            destination = geocode_address(body.destination_address, destination)
        route = await street_route(origin, destination)
        route["name"] = body.name or route.get("name") or name
        route["tolerance_m"] = body.tolerance_m if body.tolerance_m is not None else route.get("tolerance_m", CORRIDOR_TOLERANCE_M)
        return route

    if body.origin_address and body.destination_address:
        fallback = unit.get("assigned_route") or CORRIDOR
        origin = geocode_address(body.origin_address, fallback[0])
        destination = geocode_address(body.destination_address, fallback[-1])
        route = await street_route(origin, destination)
        route["name"] = body.name or route.get("name") or name
        route["tolerance_m"] = body.tolerance_m if body.tolerance_m is not None else route.get("tolerance_m", CORRIDOR_TOLERANCE_M)
        return route

    raise HTTPException(status_code=400, detail="Proporciona ruta predefinida, puntos, origen y destino")

async def assign_route_shared(unit_id: str, body: RouteAssign, user: dict) -> dict:
    db = get_db()
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    route = await build_route_for_unit(unit, body, user)
    deviation = deviation_from_route_m(unit.get("lat", route["origin"][0]), unit.get("lng", route["origin"][1]), route["corridor"])
    update = {
        "assigned_route": route["corridor"],
        "route_name": route.get("name", "Ruta asignada"),
        "route_tolerance_m": route.get("tolerance_m", CORRIDOR_TOLERANCE_M),
        "deviation_m": round(deviation, 0),
    }
    await db.units.update_one({"id": unit_id}, {"$set": update})
    updated = await db.units.find_one({"id": unit_id}, {"_id": 0, "password_hash": 0})
    await manager.broadcast({"type": "unit_update", "unit": updated})
    return updated

@router.get("/units/{unit_id}/route")
async def get_unit_route(unit_id: str, user: dict = Depends(get_current_user)):
    db = get_db()
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0, "assigned_route": 1, "route_name": 1, "route_tolerance_m": 1})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    return unit

@router.put("/units/{unit_id}/route")
async def update_unit_route(unit_id: str, body: RouteAssign, user: dict = Depends(get_current_user)):
    return await assign_route_shared(unit_id, body, user)

@router.post("/units/{unit_id}/route")
async def post_unit_route(unit_id: str, body: RouteAssign, user: dict = Depends(get_current_user)):
    return await assign_route_shared(unit_id, body, user)

@router.post("/alerts/{alert_id}")
async def update_alert(alert_id: str, body: AlertAction, user: dict = Depends(require_admin)):
    """Update alert status."""
    db = get_db()
    upd = {"status": body.status}

    if body.status == "resolved":
        upd["resolved_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.alerts.update_one({"id": alert_id}, {"$set": upd})
    alert = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
    
    await manager.broadcast({"type": "alert_update", "alert": alert})
    
    return alert

@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    """Get monitoring center statistics."""
    db = get_db()
    units = await db.units.find({}, {"_id": 0}).to_list(500)
    active_alerts = await db.alerts.count_documents({"status": "active", "severity": "critical"})
    warn_alerts = await db.alerts.count_documents({"status": "active", "severity": "warning"})
    
    by_status = {}
    for u in units:
        by_status[u["status"]] = by_status.get(u["status"], 0) + 1
    
    return {
        "total_units": len(units),
        "en_ruta": by_status.get("en_ruta", 0),
        "detenido": by_status.get("detenido", 0),
        "alerta": by_status.get("alerta", 0),
        "offline": by_status.get("offline", 0),
        "cruce_fiscal": by_status.get("cruce_fiscal", 0),
        "critical_alerts": active_alerts,
        "warning_alerts": warn_alerts,
    }

@router.get("/units/{unit_id}/chat")
async def get_unit_chat(unit_id: str, user: dict = Depends(get_current_user)):
    """Get chat history for unit."""
    db = get_db()
    msgs = await db.chat.find({"unit_id": unit_id}, {"_id": 0}).sort("created_at", 1).limit(200).to_list(200)
    return msgs

@router.post("/units/{unit_id}/chat")
async def post_unit_chat(unit_id: str, body: ChatIn, user: dict = Depends(require_admin)):
    """Send message to unit."""
    db = get_db()
    
    sanitized_text = html.escape(body.text.strip()[:500])
    if not sanitized_text:
        raise HTTPException(status_code=400, detail="El mensaje no puede estar vacio")
    
    msg = {
        "id": str(uuid.uuid4()),
        "unit_id": unit_id,
        "sender": "base",
        "text": sanitized_text,
        "quick": body.quick,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.chat.insert_one({**msg})
    await manager.broadcast({"type": "chat", "message": msg})
    
    return msg
