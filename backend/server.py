import os
import uuid
import math
import hashlib
import logging
from pathlib import Path
from datetime import datetime, timezone, timedelta
from typing import List, Optional

from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / ".env")

import jwt
import bcrypt
import httpx
from fastapi import FastAPI, APIRouter, HTTPException, Request, Depends, WebSocket, WebSocketDisconnect
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
from pydantic import BaseModel, Field, EmailStr

# ---------------------------------------------------------------------------
# Config / DB
# ---------------------------------------------------------------------------
mongo_url = os.environ["MONGO_URL"]
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ["DB_NAME"]]

JWT_SECRET = os.environ["JWT_SECRET"]
JWT_ALGORITHM = "HS256"

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s")
logger = logging.getLogger("safedrive")

app = FastAPI(title="SafeDrive GPS")
api = APIRouter(prefix="/api")

# ---------------------------------------------------------------------------
# Geography: Corredor Monterrey - Nuevo Laredo (Carretera Federal 85)
# ---------------------------------------------------------------------------
CORRIDOR = [
    [25.6866, -100.3161],   # Monterrey
    [25.7900, -100.2400],   # Salida norte
    [25.9530, -100.1800],   # Cienega de Flores
    [26.2400, -100.1700],   # Cienega -> Sabinas
    [26.5059, -100.1828],   # Sabinas Hidalgo
    [26.6600, -99.9800],    # Vallecillo
    [26.9300, -99.7900],    # Tramo norte
    [27.2000, -99.6400],    # Aproximacion
    [27.4763, -99.5164],    # Nuevo Laredo
    [27.6336, -99.5847],    # Puente del Comercio Mundial
]

BRIDGES = [
    {"name": "Puente del Comercio Mundial", "lat": 27.6336, "lng": -99.5847, "radius_m": 1800},
    {"name": "Puente Internacional 3", "lat": 27.5100, "lng": -99.5200, "radius_m": 1500},
]

DEAD_ZONES = [
    {"name": "Zona muerta Sabinas", "lat": 26.5059, "lng": -100.1828, "radius_m": 4000},
    {"name": "Zona muerta Vallecillo", "lat": 26.6600, "lng": -99.9800, "radius_m": 5000},
]

CORRIDOR_TOLERANCE_M = 400.0
SPEED_LIMIT_KMH = 95.0
PREDEFINED_ROUTES = [
    {"id": "nld-laredo-tx", "name": "Nuevo Laredo → Laredo, TX", "points": [[27.4763, -99.5164], [27.5100, -99.5200], [27.5306, -99.4803]]},
    {"id": "nld-world-trade", "name": "Nuevo Laredo → World Trade Bridge", "points": [[27.4763, -99.5164], [27.5900, -99.5600], [27.6336, -99.5847], [27.6411, -99.5400]]},
    {"id": "nld-san-antonio", "name": "Nuevo Laredo → San Antonio, TX", "points": [[27.4763, -99.5164], [27.5306, -99.4803], [28.7110, -100.4995], [29.4241, -98.4936]]},
]
OSRM_BASE_URL = os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org")

PLANS = [
    {
        "id": "bronce", "name": "Plan Bronce", "devices": 10, "tagline": "Para transfers pequenos o lineas expres nacientes.",
        "prices": {"Semanal": 650, "Mensual": 2200, "Bimestral": 4000, "Trimestral": 5400, "Anual": 18000},
        "per_truck": "Desde $150 por camion", "highlight": False,
    },
    {
        "id": "plata", "name": "Plan Plata", "devices": 25, "tagline": "Para la tipica PyME transportista de Nuevo Laredo.",
        "prices": {"Semanal": 1500, "Mensual": 5000, "Bimestral": 9000, "Trimestral": 12000, "Anual": 39600},
        "per_truck": "Desde $132 mensuales por camion", "highlight": True,
    },
    {
        "id": "oro", "name": "Plan Oro", "devices": 50, "tagline": "Para empresas medianas-grandes de alto volumen.",
        "prices": {"Semanal": 2750, "Mensual": 9000, "Bimestral": 16500, "Trimestral": 22500, "Anual": 72000},
        "per_truck": "Desde $120 mensuales por camion", "highlight": False,
    },
]

ONBOARDING = [
    {"id": "instalacion", "name": "Instalacion del Programa", "price": 3500,
     "desc": "Infraestructura backend en la nube, configuracion de rutas aduanales, geocercas de Nuevo Laredo y capacitacion."},
    {"id": "token-pc", "name": "Activacion por Computadora (Token)", "price": 1500,
     "desc": "Costo por cada PC de oficina con acceso al Dashboard de monitoreo en tiempo real."},
]

# ---------------------------------------------------------------------------
# Geo helpers
# ---------------------------------------------------------------------------
def haversine_m(lat1, lng1, lat2, lng2):
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1, math.sqrt(a)))


def point_segment_dist_m(lat, lng, alat, alng, blat, blng):
    # approximate planar projection (good enough at these scales)
    def xy(la, lo):
        x = math.radians(lo) * math.cos(math.radians(lat)) * 6371000.0
        y = math.radians(la) * 6371000.0
        return x, y
    px, py = xy(lat, lng)
    ax, ay = xy(alat, alng)
    bx, by = xy(blat, blng)
    dx, dy = bx - ax, by - ay
    if dx == 0 and dy == 0:
        return math.hypot(px - ax, py - ay)
    t = max(0, min(1, ((px - ax) * dx + (py - ay) * dy) / (dx * dx + dy * dy)))
    cx, cy = ax + t * dx, ay + t * dy
    return math.hypot(px - cx, py - cy)


def deviation_from_route_m(lat, lng, corridor=None):
    route = corridor or CORRIDOR
    if len(route) < 2:
        return haversine_m(lat, lng, route[0][0], route[0][1]) if route else float("inf")
    best = float("inf")
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        d = point_segment_dist_m(lat, lng, a[0], a[1], b[0], b[1])
        best = min(best, d)
    return best


def deviation_from_corridor_m(lat, lng):
    return deviation_from_route_m(lat, lng, CORRIDOR)


def unit_route(unit):
    if unit.get("route"):
        return unit["route"]
    assigned = unit.get("assigned_route")
    if assigned:
        return {
            "origin": assigned[0], "destination": assigned[-1], "corridor": assigned,
            "bridges": BRIDGES, "dead_zones": DEAD_ZONES,
            "tolerance_m": unit.get("route_tolerance_m", CORRIDOR_TOLERANCE_M),
            "name": unit.get("route_name", "Ruta asignada"), "provider": "shared_db",
        }
    return {
        "origin": CORRIDOR[0], "destination": CORRIDOR[-1], "corridor": CORRIDOR,
        "bridges": BRIDGES, "dead_zones": DEAD_ZONES, "tolerance_m": CORRIDOR_TOLERANCE_M,
        "name": "FED-85 · Monterrey → Nuevo Laredo",
    }


def auto_color(seed):
    palette = ["#00E676", "#007AFF", "#FFB800", "#FF2A2A", "#A855F7", "#14B8A6", "#F97316", "#EC4899", "#22D3EE", "#F43F5E", "#84CC16", "#E879F9"]
    digest = hashlib.sha256((seed or str(uuid.uuid4())).encode()).hexdigest()
    return palette[int(digest[:8], 16) % len(palette)]


def validate_point(point, label):
    if len(point) != 2:
        raise HTTPException(status_code=400, detail=f"{label} debe tener latitud y longitud")
    lat, lng = float(point[0]), float(point[1])
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise HTTPException(status_code=400, detail=f"{label} fuera de rango")
    return [lat, lng]


async def street_route(origin, destination):
    origin = validate_point(origin, "Origen")
    destination = validate_point(destination, "Destino")
    fallback = {
        "origin": origin, "destination": destination, "corridor": [origin, destination],
        "distance_m": round(haversine_m(origin[0], origin[1], destination[0], destination[1]), 0),
        "duration_s": None, "provider": "fallback",
    }
    url = f"{OSRM_BASE_URL.rstrip('/')}/route/v1/driving/{origin[1]},{origin[0]};{destination[1]},{destination[0]}"
    params = {"overview": "full", "geometries": "geojson", "steps": "false"}
    try:
        async with httpx.AsyncClient(timeout=8) as http:
            res = await http.get(url, params=params)
            res.raise_for_status()
        data = res.json()
        routes = data.get("routes") or []
        if not routes:
            return fallback
        route = routes[0]
        coords = route.get("geometry", {}).get("coordinates") or []
        corridor = [[lat, lng] for lng, lat in coords]
        if len(corridor) < 2:
            return fallback
        return {
            "origin": origin, "destination": destination, "corridor": corridor,
            "distance_m": round(route.get("distance", fallback["distance_m"]), 0),
            "duration_s": round(route.get("duration"), 0) if route.get("duration") is not None else None,
            "provider": "osrm",
        }
    except Exception as exc:
        logger.warning("No se pudo calcular ruta por calles con OSRM: %s", exc)
        return fallback


def inside_bridge(lat, lng):
    for br in BRIDGES:
        if haversine_m(lat, lng, br["lat"], br["lng"]) <= br["radius_m"]:
            return br
    return None


def inside_dead_zone(lat, lng):
    for dz in DEAD_ZONES:
        if haversine_m(lat, lng, dz["lat"], dz["lng"]) <= dz["radius_m"]:
            return dz
    return None


def interp_corridor(frac):
    frac = max(0.0, min(1.0, frac))
    n = len(CORRIDOR) - 1
    pos = frac * n
    i = min(int(pos), n - 1)
    t = pos - i
    a, b = CORRIDOR[i], CORRIDOR[i + 1]
    lat = a[0] + (b[0] - a[0]) * t
    lng = a[1] + (b[1] - a[1]) * t
    heading = math.degrees(math.atan2(b[1] - a[1], b[0] - a[0]))
    return lat, lng, heading


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------
def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()


def verify_password(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode(), hashed.encode())
    except Exception:
        return False


def create_access_token(user_id: str, email: str) -> str:
    payload = {"sub": user_id, "email": email, "exp": datetime.now(timezone.utc) + timedelta(days=7), "type": "access"}
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


async def get_current_user(request: Request) -> dict:
    auth = request.headers.get("Authorization", "")
    token = auth[7:] if auth.startswith("Bearer ") else request.cookies.get("access_token")
    if not token:
        raise HTTPException(status_code=401, detail="No autenticado")
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        user = await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
        if not user:
            raise HTTPException(status_code=401, detail="Usuario no encontrado")
        return user
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Sesion expirada")
    except jwt.InvalidTokenError:
        raise HTTPException(status_code=401, detail="Token invalido")


class RegisterIn(BaseModel):
    email: EmailStr
    password: str
    name: str = "Monitorista"


class LoginIn(BaseModel):
    email: EmailStr
    password: str


@api.post("/auth/register")
async def register(body: RegisterIn):
    email = body.email.lower()
    if await db.users.find_one({"email": email}):
        raise HTTPException(status_code=400, detail="El correo ya esta registrado")
    uid = str(uuid.uuid4())
    doc = {"id": uid, "email": email, "password_hash": hash_password(body.password),
           "name": body.name, "role": "operator", "created_at": datetime.now(timezone.utc).isoformat()}
    await db.users.insert_one(doc)
    token = create_access_token(uid, email)
    return {"access_token": token, "user": {"id": uid, "email": email, "name": body.name, "role": "operator"}}


@api.post("/auth/login")
async def login(body: LoginIn):
    email = body.email.lower()
    user = await db.users.find_one({"email": email})
    if not user or not verify_password(body.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Correo o contrasena incorrectos")
    token = create_access_token(user["id"], email)
    return {"access_token": token,
            "user": {"id": user["id"], "email": email, "name": user.get("name"), "role": user.get("role")}}


@api.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return user


# ---------------------------------------------------------------------------
# WebSocket manager
# ---------------------------------------------------------------------------
class ConnectionManager:
    def __init__(self):
        self.active: List[WebSocket] = []

    async def connect(self, ws: WebSocket):
        await ws.accept()
        self.active.append(ws)

    def disconnect(self, ws: WebSocket):
        if ws in self.active:
            self.active.remove(ws)

    async def broadcast(self, message: dict):
        dead = []
        for ws in self.active:
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws)



async def get_ws_user(ws: WebSocket) -> Optional[dict]:
    token = ws.query_params.get("token")
    if not token:
        return None
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        return await db.users.find_one({"id": payload["sub"]}, {"_id": 0, "password_hash": 0})
    except (jwt.ExpiredSignatureError, jwt.InvalidTokenError, KeyError):
        return None

manager = ConnectionManager()


@app.websocket("/api/ws")
async def websocket_endpoint(ws: WebSocket):
    user = await get_ws_user(ws)
    if not user:
        await ws.close(code=1008)
        return
    await manager.connect(ws)
    try:
        while True:
            await ws.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(ws)
    except Exception:
        manager.disconnect(ws)


# ---------------------------------------------------------------------------
# Models
# ---------------------------------------------------------------------------
class UnitCreate(BaseModel):
    name: str
    driver_name: str
    plate: str
    imei: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None


class UnitUpdate(BaseModel):
    name: Optional[str] = None
    driver_name: Optional[str] = None
    plate: Optional[str] = None
    imei: Optional[str] = None
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None


class UnitRouteUpdate(BaseModel):
    origin: Optional[List[float]] = None
    destination: Optional[List[float]] = None
    corridor: Optional[List[List[float]]] = None
    route_id: Optional[str] = None
    points: Optional[List[List[float]]] = None
    start: Optional[List[float]] = None
    name: Optional[str] = None
    tolerance_m: float = CORRIDOR_TOLERANCE_M


class Telemetry(BaseModel):
    unit_id: str  
    lat: float
    lng: float
    speed: float = 0.0
    heading: Optional[float] = None
    battery: Optional[int] = None
    g_force: Optional[float] = None
    g_duration_ms: Optional[int] = None
    signal_lost: bool = False
    panic: bool = False
    event: Optional[str] = None
    reason: Optional[str] = None
    ts: Optional[str] = None


class ChatIn(BaseModel):
    unit_id: str
    sender: str  # 'driver' | 'base'
    text: str
    quick: bool = False


class UnitChatIn(BaseModel):
    text: str
    quick: bool = False
    sender: str = "base"


class AlertAction(BaseModel):
    status: str  # acknowledged | resolved


# ---------------------------------------------------------------------------
# Alert helper
# ---------------------------------------------------------------------------
async def create_alert(unit, atype, severity, message, lat, lng):
    alert = {
        "id": str(uuid.uuid4()), "unit_id": unit["id"], "unit_name": unit["name"],
        "driver_name": unit.get("driver_name"), "type": atype, "severity": severity,
        "message": message, "lat": lat, "lng": lng, "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(), "resolved_at": None,
    }
    await db.alerts.insert_one({**alert})
    await manager.broadcast({"type": "alert", "alert": alert})
    return alert


def clean(doc):
    doc = dict(doc)
    doc.pop("_id", None)
    return doc


def public_unit(doc):
    unit = clean(doc)
    unit.pop("password_hash", None)
    route = unit_route(unit)
    unit["route"] = route
    unit["assigned_route"] = route.get("corridor")
    unit["route_name"] = route.get("name") or unit.get("route_name") or "Ruta asignada"
    unit["route_tolerance_m"] = route.get("tolerance_m", CORRIDOR_TOLERANCE_M)
    return unit


# ---------------------------------------------------------------------------
# Telemetry processing (the analytic brain)
# ---------------------------------------------------------------------------
async def process_telemetry(t: Telemetry):
    unit = await db.units.find_one({"id": t.unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no enlazada / no autorizada")

    now = datetime.now(timezone.utc)
    route_cfg = unit_route(unit)
    tolerance_m = float(route_cfg.get("tolerance_m", CORRIDOR_TOLERANCE_M))
    deviation = deviation_from_route_m(t.lat, t.lng, route_cfg.get("corridor"))
    bridge = inside_bridge(t.lat, t.lng)
    dz = inside_dead_zone(t.lat, t.lng)
    heading = t.heading if t.heading is not None else unit.get("heading", 0)

    status = "en_ruta"
    signal = "ok"
    new_alerts = []

    # --- Panic button (max priority) ---
    if t.panic:
        status = "alerta"
        new_alerts.append(("panico", "critical", "BOTON DE PANICO ACTIVADO - Microfono abierto, pantalla protegida"))

    # --- Signal / jammer intelligence ---
    if t.signal_lost:
        if dz:
            signal = "lost"
            status = "offline" if status != "alerta" else status
        else:
            signal = "jammer"
            status = "alerta"
            new_alerts.append(("jammer", "critical", "POSIBLE INHIBIDOR (JAMMER): senal perdida fuera de zona muerta conocida"))

    # --- Accelerometer filter: distinguish dropped phone vs real impact ---
    if t.g_force is not None and t.g_force >= 2.5:
        dur = t.g_duration_ms or 0
        if dur >= 300:
            status = "alerta"
            new_alerts.append(("impacto", "critical", f"IMPACTO / FRENADO DE PANICO detectado ({t.g_force:.1f}G sostenido {dur}ms)"))
        # short spike => dropped phone, ignored

    # --- Border crossing fiscal wait geofence ---
    fiscal = unit.get("fiscal", None)
    if bridge:
        if not fiscal or not fiscal.get("active"):
            fiscal = {"active": True, "bridge": bridge["name"], "entry": now.isoformat()}
        status = "cruce_fiscal" if status not in ("alerta",) else status
    else:
        if fiscal and fiscal.get("active"):
            entry = datetime.fromisoformat(fiscal["entry"])
            mins = (now - entry).total_seconds() / 60.0
            await db.crossings.insert_one({
                "id": str(uuid.uuid4()), "unit_id": unit["id"], "unit_name": unit["name"],
                "bridge": fiscal["bridge"], "entry": fiscal["entry"], "exit": now.isoformat(),
                "minutes": round(mins, 1),
            })
            fiscal = {"active": False}

    # --- Corridor deviation (huachicol / desvio) ---
    if not bridge and deviation > tolerance_m and status not in ("alerta", "cruce_fiscal"):
        status = "alerta"
        new_alerts.append(("desvio", "warning",
                           f"DESVIO DE CORREDOR: {deviation:.0f}m fuera de ruta autorizada (tolerancia {tolerance_m:.0f}m)"))

    # --- Speeding ---
    if t.speed > SPEED_LIMIT_KMH and status == "en_ruta":
        new_alerts.append(("exceso_velocidad", "warning", f"Exceso de velocidad: {t.speed:.0f} km/h"))

    if t.speed < 3 and status == "en_ruta":
        status = "detenido"

    update = {
        "lat": t.lat, "lng": t.lng, "speed": round(t.speed, 1), "heading": heading,
        "battery": t.battery if t.battery is not None else unit.get("battery", 100),
        "deviation_m": round(deviation, 0), "status": status, "signal": signal,
        "online": not t.signal_lost, "panic": t.panic, "fiscal": fiscal,
        "last_update": now.isoformat(),
        "in_bridge": bridge["name"] if bridge else None,
    }
    await db.units.update_one({"id": t.unit_id}, {"$set": update})
    await db.positions.insert_one({"unit_id": t.unit_id, "lat": t.lat, "lng": t.lng, "ts": now.isoformat()})

    unit = {**unit, **update}
    for atype, sev, msg in new_alerts:
        # avoid duplicate active alert spam of same type within 30s
        recent = await db.alerts.find_one({
            "unit_id": unit["id"], "type": atype, "status": "active",
            "created_at": {"$gt": (now - timedelta(seconds=30)).isoformat()},
        })
        if not recent:
            a = await create_alert(unit, atype, sev, msg, t.lat, t.lng)

    unit_public = public_unit(unit)
    await manager.broadcast({"type": "unit_update", "unit": unit_public})
    return unit_public


# ---------------------------------------------------------------------------
# REST endpoints
# ---------------------------------------------------------------------------
@api.get("/")
async def root():
    return {"service": "SafeDrive GPS", "status": "ok"}


@api.get("/route")
async def get_route():
    return {"corridor": CORRIDOR, "bridges": BRIDGES, "dead_zones": DEAD_ZONES, "tolerance_m": CORRIDOR_TOLERANCE_M}


@api.get("/routes")
async def get_routes(user: dict = Depends(get_current_user)):
    return {"routes": PREDEFINED_ROUTES, "default_tolerance_m": CORRIDOR_TOLERANCE_M}


@api.get("/units/{unit_id}/route")
async def get_unit_route(unit_id: str, user: dict = Depends(get_current_user)):
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0, "route": 1, "assigned_route": 1, "route_name": 1, "route_tolerance_m": 1})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    return unit_route(unit)


@api.get("/plans")
async def get_plans():
    return {"plans": PLANS, "onboarding": ONBOARDING}


@api.get("/units")
async def list_units(user: dict = Depends(get_current_user)):
    units = await db.units.find({}, {"_id": 0, "password_hash": 0}).to_list(500)
    return units


@api.get("/units/{unit_id}")
async def get_unit(unit_id: str, user: dict = Depends(get_current_user)):
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0, "password_hash": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    track = await db.positions.find({"unit_id": unit_id}, {"_id": 0}).sort("ts", -1).limit(50).to_list(50)
    unit["track"] = list(reversed(track))
    return unit


@api.post("/units")
async def create_unit(body: UnitCreate, user: dict = Depends(get_current_user)):
    lat, lng, heading = interp_corridor(0.0)
    unit = {
        "id": str(uuid.uuid4()), "name": body.name, "driver_name": body.driver_name,
        "plate": body.plate, "imei": body.imei or str(uuid.uuid4())[:15],
        "email": str(body.email).lower() if body.email else None, "phone": body.phone,
        "password_hash": hash_password(body.password) if body.password else None,
        "color": body.color or auto_color(body.name),
        "route": {"origin": CORRIDOR[0], "destination": CORRIDOR[-1], "corridor": CORRIDOR, "bridges": BRIDGES, "dead_zones": DEAD_ZONES, "tolerance_m": CORRIDOR_TOLERANCE_M, "name": "FED-85 · Monterrey → Nuevo Laredo"},
        "assigned_route": CORRIDOR, "route_name": "FED-85 · Monterrey → Nuevo Laredo", "route_tolerance_m": CORRIDOR_TOLERANCE_M,
        "lat": lat, "lng": lng, "speed": 0, "heading": heading, "battery": 100,
        "deviation_m": 0, "status": "detenido", "signal": "ok", "online": True,
        "panic": False, "fiscal": {"active": False}, "in_bridge": None,
        "route_progress": 0.0, "last_update": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.units.insert_one({**unit})
    unit_public = public_unit(unit)
    await manager.broadcast({"type": "unit_update", "unit": unit_public})
    return unit_public


@api.put("/units/{unit_id}")
async def update_unit(unit_id: str, body: UnitUpdate, user: dict = Depends(get_current_user)):
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    update = {k: v for k, v in body.model_dump(exclude_unset=True).items() if v is not None and k != "password"}
    if "email" in update:
        update["email"] = str(update["email"]).lower()
    if body.password:
        update["password_hash"] = hash_password(body.password)
    if update:
        await db.units.update_one({"id": unit_id}, {"$set": update})
    updated = await db.units.find_one({"id": unit_id}, {"_id": 0, "password_hash": 0})
    await manager.broadcast({"type": "unit_update", "unit": updated})
    return updated


async def build_route_for_unit(unit, body: UnitRouteUpdate, user: dict) -> dict:
    name = body.name or "Ruta personalizada"
    if body.route_id:
        match = next((r for r in PREDEFINED_ROUTES if r["id"] == body.route_id), None)
        if not match:
            raise HTTPException(status_code=400, detail="Ruta predefinida no encontrada")
        corridor = [validate_point(p, "Punto de ruta") for p in match["points"]]
        return {
            "origin": corridor[0], "destination": corridor[-1], "corridor": corridor,
            "distance_m": round(sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(corridor, corridor[1:])), 0),
            "duration_s": None, "provider": "predefined", "name": match["name"],
            "bridges": BRIDGES, "dead_zones": DEAD_ZONES, "tolerance_m": body.tolerance_m,
            "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user.get("id"),
        }
    points = body.points or body.corridor
    if points and len(points) >= 2:
        corridor = [validate_point(p, "Punto de ruta") for p in points]
        return {
            "origin": corridor[0], "destination": corridor[-1], "corridor": corridor,
            "distance_m": round(sum(haversine_m(a[0], a[1], b[0], b[1]) for a, b in zip(corridor, corridor[1:])), 0),
            "duration_s": None, "provider": "manual", "name": name,
            "bridges": BRIDGES, "dead_zones": DEAD_ZONES, "tolerance_m": body.tolerance_m,
            "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user.get("id"),
        }
    origin = body.origin or body.start
    destination = body.destination
    if not origin or not destination:
        raise HTTPException(status_code=400, detail="Proporciona ruta predefinida, puntos, origen y destino")
    origin = validate_point(origin, "Origen")
    destination = validate_point(destination, "Destino")
    route_base = await street_route(origin, destination)
    return {
        **route_base, "bridges": BRIDGES, "dead_zones": DEAD_ZONES, "tolerance_m": body.tolerance_m,
        "name": body.name or f"Ruta personalizada origen-destino",
        "updated_at": datetime.now(timezone.utc).isoformat(), "updated_by": user.get("id"),
    }


async def assign_route_shared(unit_id: str, body: UnitRouteUpdate, user: dict) -> dict:
    unit = await db.units.find_one({"id": unit_id}, {"_id": 0})
    if not unit:
        raise HTTPException(status_code=404, detail="Unidad no encontrada")
    route = await build_route_for_unit(unit, body, user)
    deviation = deviation_from_route_m(unit.get("lat", route["origin"][0]), unit.get("lng", route["origin"][1]), route["corridor"])
    shared_update = {
        "route": route,
        "assigned_route": route["corridor"],
        "route_name": route.get("name", "Ruta asignada"),
        "route_tolerance_m": route.get("tolerance_m", CORRIDOR_TOLERANCE_M),
        "deviation_m": round(deviation, 0),
    }
    await db.units.update_one({"id": unit_id}, {"$set": shared_update})
    updated = await db.units.find_one({"id": unit_id}, {"_id": 0, "password_hash": 0})
    updated = public_unit(updated)
    await manager.broadcast({"type": "unit_update", "unit": updated})
    await manager.broadcast({"type": "route_update", "unit": updated, "route": route})
    return updated


@api.put("/units/{unit_id}/route")
async def update_unit_route(unit_id: str, body: UnitRouteUpdate, user: dict = Depends(get_current_user)):
    return await assign_route_shared(unit_id, body, user)


@api.post("/units/{unit_id}/route")
async def post_unit_route(unit_id: str, body: UnitRouteUpdate, user: dict = Depends(get_current_user)):
    return await assign_route_shared(unit_id, body, user)

@api.delete("/units/{unit_id}")
async def delete_unit(unit_id: str, user: dict = Depends(get_current_user)):
    await db.units.delete_one({"id": unit_id})
    await db.positions.delete_many({"unit_id": unit_id})
    await manager.broadcast({"type": "unit_removed", "unit_id": unit_id})
    return {"ok": True}


@api.post("/telemetry")
async def telemetry(t: Telemetry):
    return await process_telemetry(t)


@api.get("/alerts")
async def list_alerts(status: Optional[str] = None, user: dict = Depends(get_current_user)):
    q = {"status": status} if status else {}
    alerts = await db.alerts.find(q, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return alerts


@api.post("/alerts/{alert_id}")
async def update_alert(alert_id: str, body: AlertAction, user: dict = Depends(get_current_user)):
    upd = {"status": body.status}
    if body.status == "resolved":
        upd["resolved_at"] = datetime.now(timezone.utc).isoformat()
    await db.alerts.update_one({"id": alert_id}, {"$set": upd})
    alert = await db.alerts.find_one({"id": alert_id}, {"_id": 0})
    await manager.broadcast({"type": "alert_update", "alert": alert})
    return alert


@api.get("/chat/{unit_id}")
async def get_chat(unit_id: str, user: dict = Depends(get_current_user)):
    msgs = await db.chat.find({"unit_id": unit_id}, {"_id": 0}).sort("created_at", 1).limit(200).to_list(200)
    return msgs


@api.post("/chat")
async def post_chat(body: ChatIn):
    unit = await db.units.find_one({"id": body.unit_id}, {"_id": 0})
    msg = {
        "id": str(uuid.uuid4()), "unit_id": body.unit_id,
        "unit_name": unit["name"] if unit else "Unidad", "sender": body.sender,
        "text": body.text, "quick": body.quick, "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.chat.insert_one({**msg})
    await manager.broadcast({"type": "chat", "message": msg})
    return msg


@api.get("/units/{unit_id}/chat")
async def get_unit_chat_alias(unit_id: str, user: dict = Depends(get_current_user)):
    return await get_chat(unit_id, user)


@api.post("/units/{unit_id}/chat")
async def post_unit_chat_alias(unit_id: str, body: UnitChatIn, user: dict = Depends(get_current_user)):
    return await post_chat(ChatIn(unit_id=unit_id, sender=body.sender or "base", text=body.text, quick=body.quick))


@api.get("/stats")
async def stats(user: dict = Depends(get_current_user)):
    units = await db.units.find({}, {"_id": 0}).to_list(500)
    active_alerts = await db.alerts.count_documents({"status": "active", "severity": "critical"})
    warn_alerts = await db.alerts.count_documents({"status": "active", "severity": "warning"})
    crossings = await db.crossings.find({}, {"_id": 0}).sort("exit", -1).limit(20).to_list(20)
    by_status = {}
    for u in units:
        by_status[u["status"]] = by_status.get(u["status"], 0) + 1
    avg_cross = round(sum(c["minutes"] for c in crossings) / len(crossings), 1) if crossings else 0
    return {
        "total_units": len(units),
        "en_ruta": by_status.get("en_ruta", 0),
        "detenido": by_status.get("detenido", 0),
        "alerta": by_status.get("alerta", 0),
        "offline": by_status.get("offline", 0),
        "cruce_fiscal": by_status.get("cruce_fiscal", 0),
        "critical_alerts": active_alerts,
        "warning_alerts": warn_alerts,
        "avg_crossing_min": avg_cross,
        "recent_crossings": crossings,
    }


# ---------------------------------------------------------------------------
# Startup
# ---------------------------------------------------------------------------
@app.on_event("startup")
async def startup():
    await db.users.create_index("email", unique=True)
    await db.units.create_index("id", unique=True)
    admin_email = os.environ["ADMIN_EMAIL"].lower()
    admin_pw = os.environ["ADMIN_PASSWORD"]
    existing = await db.users.find_one({"email": admin_email})
    if not existing:
        await db.users.insert_one({
            "id": str(uuid.uuid4()), "email": admin_email, "password_hash": hash_password(admin_pw),
            "name": "Administrador", "role": "admin", "created_at": datetime.now(timezone.utc).isoformat(),
        })
        logger.info("Admin seeded")
    elif not verify_password(admin_pw, existing["password_hash"]):
        await db.users.update_one({"email": admin_email}, {"$set": {"password_hash": hash_password(admin_pw)}})


@app.on_event("shutdown")
async def shutdown():
    client.close()


app.include_router(api)
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get("CORS_ORIGINS", "*").split(","),
    allow_methods=["*"],
    allow_headers=["*"],
)
