"""Mobile app endpoints for drivers."""
import uuid
from fastapi import APIRouter, HTTPException, Depends
from datetime import datetime, timezone
from app.core.database import get_db
from app.core.security import get_current_user, require_driver
from app.models.schemas_telemetry import Telemetry, TelemetryBatch, DistractionIn, ChatIn, AlertAction
from app.services.telemetry_engine import process_telemetry, create_alert
from app.services.geo_helpers import interp_corridor, CORRIDOR, CORRIDOR_TOLERANCE_M
from app.services.ws_manager import manager

router = APIRouter(prefix="/driver", tags=["mobile-driver"])

async def require_driver_unit(user: dict) -> dict:
    """Get or create unit for driver."""
    db = get_db()
    unit = await db.units.find_one({"driver_id": user["id"]}, {"_id": 0})
    
    if not unit:
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
        await manager.broadcast({"type": "unit_update", "unit": unit})

    return unit

@router.get("/unit")
async def driver_unit(user: dict = Depends(get_current_user)):
    """Get driver's vehicle unit and track history."""
    db = get_db()
    unit = await require_driver_unit(user)
    track = await db.positions.find({"unit_id": unit["id"]}, {"_id": 0}).sort("ts", -1).limit(100).to_list(100)
    unit["track"] = list(reversed(track))
    return unit

@router.post("/trip/start")
async def trip_start(user: dict = Depends(get_current_user)):
    """Start trip."""
    db = get_db()
    unit = await require_driver_unit(user)
    await db.units.update_one({"id": unit["id"]}, {"$set": {"trip_active": True, "status": "detenido", "online": True}})
    unit = await db.units.find_one({"id": unit["id"]}, {"_id": 0})
    await manager.broadcast({"type": "unit_update", "unit": unit})
    return unit

@router.post("/trip/stop")
async def trip_stop(user: dict = Depends(get_current_user)):
    """Stop trip."""
    db = get_db()
    unit = await require_driver_unit(user)
    await db.units.update_one({"id": unit["id"]}, {"$set": {"trip_active": False, "status": "detenido", "speed": 0}})
    unit = await db.units.find_one({"id": unit["id"]}, {"_id": 0})
    await manager.broadcast({"type": "unit_update", "unit": unit})
    return unit

@router.post("/telemetry")
async def driver_telemetry(t: Telemetry, user: dict = Depends(get_current_user)):
    """Send single telemetry point."""
    unit = await require_driver_unit(user)
    return await process_telemetry(unit, t)

@router.post("/telemetry/batch")
async def driver_telemetry_batch(body: TelemetryBatch, user: dict = Depends(get_current_user)):
    """Send batch of telemetry points."""
    unit = await require_driver_unit(user)
    processed = 0
    last = None
    
    for t in body.points:
        unit = await require_driver_unit(user)
        last = await process_telemetry(unit, t)
        processed += 1
    
    return {"processed": processed, "unit": last}

@router.post("/panic")
async def driver_panic(t: Telemetry, user: dict = Depends(get_current_user)):
    """Panic button pressed."""
    unit = await require_driver_unit(user)
    t.panic = True
    return await process_telemetry(unit, t)

@router.post("/distracted")
async def driver_distracted(body: DistractionIn, user: dict = Depends(get_current_user)):
    """Distraction alert from SafeDrive."""
    db = get_db()
    unit = await require_driver_unit(user)
    
    await db.units.update_one(
        {"id": unit["id"]},
        {"$set": {"status": "alerta", "last_update": body.ts or datetime.now(timezone.utc).isoformat()}}
    )
    
    alert = await create_alert(
        unit, "distractor", "critical",
        f"DESACATO CERO DISTRACCIONES: {body.reason} ({body.speed:.0f} km/h)",
        body.lat, body.lng
    )
    
    unit = await db.units.find_one({"id": unit["id"]}, {"_id": 0})
    await manager.broadcast({"type": "unit_update", "unit": unit})
    
    return {"ok": True, "alert": alert}

@router.get("/monitor-contact")
async def driver_monitor_contact(user: dict = Depends(get_current_user)):
    """Get monitoring operator contact info."""
    db = get_db()
    admin = await db.users.find_one({"role": "admin", "phone": {"$ne": None}}, {"_id": 0, "password_hash": 0})
    if not admin:
        admin = await db.users.find_one({"role": "admin"}, {"_id": 0, "password_hash": 0})
    return admin or {}

@router.get("/alerts")
async def driver_alerts(user: dict = Depends(get_current_user)):
    """Get driver's active alerts."""
    db = get_db()
    unit = await require_driver_unit(user)
    alerts = await db.alerts.find({"unit_id": unit["id"]}, {"_id": 0}).sort("created_at", -1).limit(200).to_list(200)
    return alerts

@router.get("/chat")
async def driver_chat(user: dict = Depends(get_current_user)):
    """Get chat messages with monitoring center."""
    db = get_db()
    unit = await require_driver_unit(user)
    msgs = await db.chat.find({"unit_id": unit["id"]}, {"_id": 0}).sort("created_at", 1).limit(200).to_list(200)
    return msgs

@router.post("/chat")
async def driver_post_chat(body: ChatIn, user: dict = Depends(get_current_user)):
    """Send message to monitoring center."""
    db = get_db()
    unit = await require_driver_unit(user)
    
    msg = {
        "id": str(uuid.uuid4()),
        "unit_id": unit["id"],
        "unit_name": unit["name"],
        "sender": "driver",
        "text": body.text,
        "quick": body.quick,
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    
    await db.chat.insert_one({**msg})
    await manager.broadcast({"type": "chat", "message": msg})
    
    return msg
