"""Shared endpoints for monitoring center (web dashboard and mobile)."""
import uuid
import html
from fastapi import APIRouter, HTTPException, Depends, Query
from datetime import datetime, timezone
from typing import Optional, List
from app.core.database import get_db
from app.core.security import get_current_user, require_admin, require_monitorista, hash_password, verify_password, get_company_id
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
        "company_id": user.get("company_id"),
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
    if role not in ("conductor", "driver", "monitorista", "admin"):
        raise HTTPException(status_code=400, detail="Rol invalido. Usa conductor o monitorista")
    if role in ("monitorista", "admin") and user.get("role") != "superadmin":
        raise HTTPException(status_code=403, detail="Solo SuperAdmin puede crear monitoristas")

    company_id = get_company_id(user)

    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="El correo ya esta registrado")

    uid = str(uuid.uuid4())
    doc = {
        "id": uid,
        "email": email,
        "password_hash": hash_password(body.password),
        "name": body.name,
        "role": role,
        "company_id": company_id,
        "phone": body.phone,
        "token_version": 0,
        "current_session_id": None,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.users.insert_one(doc)

    # Assign existing unit if provided
    unit = None
    if role in ("conductor", "driver") and body.unit_id:
        unit_query = {"id": body.unit_id}
        if company_id:
            unit_query["company_id"] = company_id
        existing_unit = await db.units.find_one(unit_query)
        if existing_unit:
            unit_update = {
                "driver_id": uid,
                "driver_name": body.name,
                "driver_phone": body.phone,
            }
            if body.plate:
                unit_update["plate"] = body.plate
            await db.units.update_one({"id": body.unit_id}, {"$set": unit_update})
            unit = await db.units.find_one({"id": body.unit_id}, {"_id": 0})

    return {"user": {"id": uid, "email": email, "name": body.name, "role": role, "phone": body.phone, "company_id": company_id}, "unit": unit}

@router.get("/users")
async def admin_list_users(user: dict = Depends(require_admin)):
    db = get_db()
    company_id = get_company_id(user)
    query = {}
    if company_id:
        query["company_id"] = company_id
    users = await db.users.find(query, {"_id": 0, "password_hash": 0, "current_session_id": 0}).sort("created_at", -1).to_list(500)
    unit_query = {}
    if company_id:
        unit_query["company_id"] = company_id
    units = await db.units.find(unit_query, {"_id": 0}).to_list(500)
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

    company_id = get_company_id(user)
    if company_id and target.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este usuario")

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
        if role not in ("conductor", "driver", "monitorista", "admin"):
            raise HTTPException(status_code=400, detail="Rol invalido. Usa conductor, driver, monitorista o admin")
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
    """List all vehicle units. Scoped to company for monitoristas."""
    db = get_db()
    company_id = get_company_id(user)
    query = {}
    if company_id:
        query["company_id"] = company_id
    units = await db.units.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    return units

@router.get("/units/available")
async def list_available_units(user: dict = Depends(require_admin)):
    """List units that are NOT assigned to any driver (available for assignment)."""
    db = get_db()
    company_id = get_company_id(user)
    query = {"driver_id": None}
    if company_id:
        query["company_id"] = company_id
    units = await db.units.find(query, {"_id": 0, "password_hash": 0}).to_list(500)
    return units


@router.get("/units/with-drivers")
async def list_units_with_drivers(user: dict = Depends(get_current_user)):
    """List all units with driver info and availability status. Returns enriched data."""
    db = get_db()
    company_id = get_company_id(user)
    query = {}
    if company_id:
        query["company_id"] = company_id
    units = await db.units.find(query, {"_id": 0, "password_hash": 0}).to_list(500)

    # Fetch all drivers for this company to enrich
    driver_query = {"role": {"$in": ["conductor", "driver"]}}
    if company_id:
        driver_query["company_id"] = company_id
    drivers = await db.users.find(driver_query, {"_id": 0, "id": 1, "name": 1, "email": 1, "phone": 1}).to_list(500)
    driver_map = {d["id"]: d for d in drivers}

    result = []
    for u in units:
        u["available"] = u.get("driver_id") is None
        if u.get("driver_id") and u["driver_id"] in driver_map:
            u["driver_info"] = driver_map[u["driver_id"]]
            u["available"] = False
        result.append(u)
    return result


@router.put("/users/{user_id}/assign-unit")
async def assign_unit_to_user(user_id: str, body: dict, user: dict = Depends(require_admin)):
    """Assign a different unit to a driver, freeing the old one."""
    db = get_db()
    company_id = get_company_id(user)

    unit_id = body.get("unit_id")
    if not unit_id:
        raise HTTPException(status_code=400, detail="unit_id es requerido")

    # Verify target user exists and is a driver
    target = await db.users.find_one({"id": user_id})
    if not target:
        raise HTTPException(status_code=404, detail="Usuario no encontrado")
    if target.get("role") not in ("conductor", "driver"):
        raise HTTPException(status_code=400, detail="El usuario no es un conductor")

    if company_id and target.get("company_id") != company_id:
        raise HTTPException(status_code=403, detail="No tienes acceso a este usuario")

    # Verify the new unit exists and is available (or already assigned to this user)
    unit_query = {"id": unit_id}
    if company_id:
        unit_query["company_id"] = company_id
    new_unit = await db.units.find_one(unit_query)
    if not new_unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    if new_unit.get("driver_id") and new_unit["driver_id"] != user_id:
        raise HTTPException(status_code=400, detail="La unidad ya esta asignada a otro conductor")

    # Free the old unit (if any)
    old_unit = await db.units.find_one({"driver_id": user_id})
    if old_unit:
        await db.units.update_one({"id": old_unit["id"]}, {"$set": {"driver_id": None, "driver_name": None, "driver_phone": None}})

    # Assign new unit
    await db.units.update_one({"id": unit_id}, {"$set": {
        "driver_id": user_id,
        "driver_name": target.get("name"),
        "driver_phone": target.get("phone"),
    }})

    updated = await db.units.find_one({"id": unit_id}, {"_id": 0, "password_hash": 0})
    await manager.broadcast({"type": "unit_update", "unit": updated})
    return updated


@router.get("/units/{unit_id}")
async def get_unit(unit_id: str, user: dict = Depends(get_current_user)):
    """Get specific unit details and track."""
    db = get_db()
    company_id = get_company_id(user)
    query = {"id": unit_id}
    if company_id:
        query["company_id"] = company_id
    unit = await db.units.find_one(query, {"_id": 0, "password_hash": 0})
    
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    
    track = await db.positions.find({"unit_id": unit_id}, {"_id": 0}).sort("ts", -1).limit(50).to_list(50)
    unit["track"] = list(reversed(track))
    
    return unit

@router.post("/units")
async def create_unit(body: UnitCreate, user: dict = Depends(require_admin)):
    db = get_db()
    company_id = get_company_id(user)
    driver_id = None
    driver_name = body.driver_name
    driver_phone = body.driver_phone or body.phone

    if body.driver_id:
        driver_query = {"id": body.driver_id, "role": {"$in": ["conductor", "driver"]}}
        if company_id:
            driver_query["company_id"] = company_id
        driver = await db.users.find_one(driver_query)
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
            raise HTTPException(status_code=400, detail="El correo ya esta registrado")
        uid = str(uuid.uuid4())
        await db.users.insert_one({
            "id": uid,
            "email": email,
            "password_hash": hash_password(body.driver_password),
            "name": driver_name,
            "role": "conductor",
            "company_id": company_id,
            "phone": driver_phone,
            "token_version": 0,
            "current_session_id": None,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })
        driver_id = uid

    unit = {
        "id": str(uuid.uuid4()),
        "driver_id": driver_id,
        "company_id": company_id,
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
    company_id = get_company_id(user)
    query = {"id": unit_id}
    if company_id:
        query["company_id"] = company_id
    unit = await db.units.find_one(query, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None}
    if "email" in update:
        update["email"] = str(update["email"]).lower()
    if "driver_id" in update:
        driver_query = {"id": update["driver_id"], "role": {"$in": ["conductor", "driver"]}}
        if company_id:
            driver_query["company_id"] = company_id
        driver = await db.users.find_one(driver_query)
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
    """List alerts with optional status filter. Scoped to company for monitoristas."""
    db = get_db()
    company_id = get_company_id(user)
    q = {}
    if status:
        q["status"] = status
    if company_id:
        q["company_id"] = company_id
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
    company_id = get_company_id(user)
    query = {"id": unit_id}
    if company_id:
        query["company_id"] = company_id
    unit = await db.units.find_one(query, {"_id": 0})
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
    company_id = get_company_id(user)
    query = {"id": unit_id}
    if company_id:
        query["company_id"] = company_id
    unit = await db.units.find_one(query, {"_id": 0, "assigned_route": 1, "route_name": 1, "route_tolerance_m": 1})
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
    company_id = get_company_id(user)
    query = {"id": alert_id}
    if company_id:
        query["company_id"] = company_id
    upd = {"status": body.status}

    if body.status == "resolved":
        upd["resolved_at"] = datetime.now(timezone.utc).isoformat()

    result = await db.alerts.update_one(query, {"$set": upd})
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Alerta no encontrada")
    alert = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
    
    await manager.broadcast({"type": "alert_update", "alert": alert})
    
    return alert

@router.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    """Get monitoring center statistics. Scoped to company for monitoristas."""
    db = get_db()
    company_id = get_company_id(user)
    unit_query = {}
    alert_query = {}
    if company_id:
        unit_query["company_id"] = company_id
        alert_query["company_id"] = company_id
    units = await db.units.find(unit_query, {"_id": 0}).to_list(500)
    active_alerts_query = {"status": "active", "severity": "critical", **alert_query}
    warn_alerts_query = {"status": "active", "severity": "warning", **alert_query}
    active_alerts = await db.alerts.count_documents(active_alerts_query)
    warn_alerts = await db.alerts.count_documents(warn_alerts_query)
    
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
    company_id = get_company_id(user)
    query = {"unit_id": unit_id}
    if company_id:
        query["company_id"] = company_id
    msgs = await db.chat.find(query, {"_id": 0}).sort("created_at", 1).limit(200).to_list(200)
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
        "company_id": get_company_id(user),
        "sender": "base",
        "text": sanitized_text,
        "quick": body.quick,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.chat.insert_one({**msg})
    await manager.broadcast({"type": "chat", "message": msg})
    
    return msg


# ── Safety Score ──────────────────────────────────────────────────────────────

def _days_ago(n: int) -> str:
    """Return ISO string for n days ago."""
    from datetime import timedelta
    return (datetime.now(timezone.utc) - timedelta(days=n)).isoformat()


def _score_breakdown(alerts: list, unit: dict) -> dict:
    """
    Calculate safety score (0-100) and dimension breakdown from alerts + unit state.
    Higher = safer.  Base 100, penalties per category.
    """
    penalty_velocidad = 0
    penalty_eventos = 0
    penalty_desvio = 0
    penalty_senal = 0

    for a in alerts:
        t = a.get("type", "")
        sev = a.get("severity", "warning")
        w = 2 if sev == "critical" else 1

        if t == "exceso_velocidad":
            penalty_velocidad += 3 * w
        elif t in ("panico", "distractor", "impacto"):
            penalty_eventos += 6 * w
        elif t == "desvio":
            penalty_desvio += 4 * w
        elif t == "jammer":
            penalty_senal += 5 * w

    # penalty for low battery in current reading
    bat = unit.get("battery", 100)
    bat_penalty = 3 if bat is not None and bat < 20 else 1 if bat is not None and bat < 50 else 0

    total = max(0, 100 - (penalty_velocidad + penalty_eventos + penalty_desvio + penalty_senal + bat_penalty))

    return {
        "total": round(total, 0),
        "dimensions": {
            "velocidad": max(0, 100 - penalty_velocidad),
            "eventos_criticos": max(0, 100 - penalty_eventos),
            "desviaciones": max(0, 100 - penalty_desvio),
            "senal": max(0, 100 - penalty_senal),
            "bateria": max(0, 100 - bat_penalty),
        },
        "alerts_count": {
            "critical": sum(1 for a in alerts if a.get("severity") == "critical"),
            "warning": sum(1 for a in alerts if a.get("severity") == "warning"),
        },
    }


@router.get("/safety-scores")
async def safety_scores(user: dict = Depends(get_current_user)):
    """Safety score (0–100) for each unit based on recent alerts. Scoped to company."""
    db = get_db()
    company_id = get_company_id(user)
    unit_query = {}
    alert_query = {"created_at": {"$gte": _days_ago(7)}}
    if company_id:
        unit_query["company_id"] = company_id
        alert_query["company_id"] = company_id
    units = await db.units.find(unit_query, {"_id": 0}).to_list(500)

    unit_alerts = await db.alerts.find(
        alert_query,
        {"_id": 0, "unit_id": 1, "type": 1, "severity": 1, "created_at": 1},
    ).to_list(5000)

    by_unit: dict[str, list] = {}
    for a in unit_alerts:
        by_unit.setdefault(a["unit_id"], []).append(a)

    results = []
    for u in units:
        alerts = by_unit.get(u["id"], [])
        score = _score_breakdown(alerts, u)
        results.append({
            "unit_id": u["id"],
            "unit_name": u.get("name"),
            "driver_name": u.get("driver_name"),
            "plate": u.get("plate"),
            "score": score["total"],
            "dimensions": score["dimensions"],
            "alerts_count": score["alerts_count"],
            "status": u.get("status"),
            "last_update": u.get("last_update"),
        })

    results.sort(key=lambda r: r["score"])
    return results


@router.get("/safety-scores/{unit_id}/history")
async def safety_score_history(unit_id: str, days: int = Query(7, ge=1, le=30), user: dict = Depends(get_current_user)):
    """Per-day safety score history for a unit (for sparkline charts)."""
    db = get_db()
    company_id = get_company_id(user)
    query = {"id": unit_id}
    if company_id:
        query["company_id"] = company_id
    unit = await db.units.find_one(query, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")

    from datetime import timedelta

    history = []
    now = datetime.now(timezone.utc)

    for d in range(days, -1, -1):
        day_start = (now - timedelta(days=d)).replace(hour=0, minute=0, second=0, microsecond=0)
        day_end = (now - timedelta(days=d)).replace(hour=23, minute=59, second=59, microsecond=999999)

        day_alerts = await db.alerts.find({
            "unit_id": unit_id,
            "created_at": {"$gte": day_start.isoformat(), "$lte": day_end.isoformat()},
        }, {"_id": 0, "type": 1, "severity": 1}).to_list(1000)

        score = _score_breakdown(day_alerts, unit)
        history.append({
            "date": day_start.strftime("%Y-%m-%d"),
            "score": score["total"],
            "dimensions": score["dimensions"],
        })

    return {"unit_id": unit_id, "unit_name": unit.get("name"), "history": history}
