"""Telemetry processing and alert generation engine."""
import asyncio
import logging
import uuid
from datetime import datetime, timezone, timedelta
from app.core.database import get_db
from app.models.schemas_telemetry import Telemetry
from app.services.geo_helpers import (
    deviation_from_route_m, inside_bridge, inside_dead_zone,
    CORRIDOR_TOLERANCE_M, SPEED_LIMIT_KMH, CORRIDOR
)
from app.services.ws_manager import manager

logger = logging.getLogger(__name__)

async def create_alert(unit: dict, atype: str, severity: str, message: str, lat: float, lng: float) -> dict:
    """Create and broadcast alert."""
    db = get_db()
    alert = {
        "id": str(uuid.uuid4()),
        "unit_id": unit["id"],
        "unit_name": unit["name"],
        "driver_name": unit.get("driver_name"),
        "type": atype,
        "severity": severity,
        "message": message,
        "lat": lat,
        "lng": lng,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "resolved_at": None,
    }
    await db.alerts.insert_one({**alert})
    await manager.broadcast({"type": "alert", "alert": alert})
    return alert

async def process_telemetry(unit: dict, t: Telemetry) -> dict:
    """Analyze telemetry and generate alerts (the analytic brain)."""
    db = get_db()
    now = datetime.now(timezone.utc)
    
    # Routing & location analysis
    route = unit.get("assigned_route") or CORRIDOR
    deviation = deviation_from_route_m(t.lat, t.lng, route)
    tolerance_m = float(unit.get("route_tolerance_m") or CORRIDOR_TOLERANCE_M)
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
    
    # --- Distraction detection ---
    if t.event == "distractor":
        status = "alerta"
        new_alerts.append(("distractor", "critical", f"DESACATO CERO DISTRACCIONES: {t.reason or 'Intento de salir de SafeDrive'} ({t.speed:.0f} km/h)"))
    
    # --- Signal / jammer intelligence ---
    if t.signal_lost:
        if dz:
            signal = "lost"
            status = "offline" if status != "alerta" else status
        else:
            signal = "jammer"
            status = "alerta"
            new_alerts.append(("jammer", "critical", "POSIBLE INHIBIDOR (JAMMER): señal perdida fuera de zona muerta conocida"))
    
    # --- G-force impact detection ---
    if t.g_force is not None and t.g_force >= 2.5:
        dur = t.g_duration_ms or 0
        if dur >= 300:
            status = "alerta"
            new_alerts.append(("impacto", "critical", f"IMPACTO / FRENADO DE PANICO detectado ({t.g_force:.1f}G sostenido {dur}ms)"))
    
    # --- Border crossing fiscal tracking ---
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
                "id": str(uuid.uuid4()),
                "unit_id": unit["id"],
                "unit_name": unit["name"],
                "bridge": fiscal["bridge"],
                "entry": fiscal["entry"],
                "exit": now.isoformat(),
                "minutes": round(mins, 1),
            })
            fiscal = {"active": False}
    
    # --- Route deviation (huachicol / desvío) ---
    if not bridge and deviation > tolerance_m and status not in ("alerta", "cruce_fiscal"):
        status = "alerta"
        new_alerts.append(("desvio", "warning", f"DESVIO DE RUTA: {deviation:.0f}m fuera de ruta autorizada (tolerancia {tolerance_m:.0f}m)"))
    
    # --- Speeding ---
    if t.speed > SPEED_LIMIT_KMH and status == "en_ruta":
        new_alerts.append(("exceso_velocidad", "warning", f"Exceso de velocidad: {t.speed:.0f} km/h"))
    
    # --- Stopped detection ---
    if t.speed < 3 and status == "en_ruta":
        status = "detenido"
    
    # --- Update unit state ---
    update = {
        "lat": t.lat,
        "lng": t.lng,
        "speed": round(t.speed, 1),
        "heading": heading,
        "battery": t.battery if t.battery is not None else unit.get("battery", 100),
        "deviation_m": round(deviation, 0),
        "status": status,
        "signal": signal,
        "online": not t.signal_lost,
        "panic": t.panic,
        "fiscal": fiscal,
        "last_update": (t.ts or now.isoformat()),
        "in_bridge": bridge["name"] if bridge else None,
    }
    
    # Concurrent DB updates
    await asyncio.gather(
        db.units.update_one({"id": unit["id"]}, {"$set": update}),
        db.positions.insert_one({
            "unit_id": unit["id"],
            "lat": t.lat,
            "lng": t.lng,
            "speed": round(t.speed, 1),
            "ts": (t.ts or now.isoformat())
        })
    )
    
    # --- Generate alerts (deduplicate within 30s) ---
    unit = {**unit, **update}
    fired = []
    for atype, sev, msg in new_alerts:
        recent = await db.alerts.find_one({
            "unit_id": unit["id"],
            "type": atype,
            "status": "active",
            "created_at": {"$gt": (now - timedelta(seconds=30)).isoformat()},
        })
        if not recent:
            a = await create_alert(unit, atype, sev, msg, t.lat, t.lng)
            fired.append(a)
    
    # --- Broadcast real-time update ---
    await manager.broadcast({
        "type": "unit_update",
        "unit_id": unit["id"],
        "lat": t.lat,
        "lng": t.lng,
        "speed": round(t.speed, 1),
        "heading": heading,
        "status": status,
        "signal": signal,
        "battery": t.battery if t.battery is not None else unit.get("battery", 100),
        "panic": t.panic,
        "last_update": now.isoformat()
    })
    
    result = dict(unit)
    result.pop("_id", None)
    result.pop("password_hash", None)
    result["new_alerts"] = fired
    
    return result
