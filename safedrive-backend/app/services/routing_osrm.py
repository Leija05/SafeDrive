"""OSRM routing and geocoding service."""
import logging
import requests
import httpx
from typing import List, Optional
from fastapi import HTTPException
from app.core.config import OSRM_BASE_URL
from app.services.geo_helpers import haversine_m, BRIDGES, DEAD_ZONES, CORRIDOR_TOLERANCE_M

logger = logging.getLogger(__name__)

def validate_point(point: list, label: str) -> List[float]:
    """Validate latitude/longitude point."""
    if len(point) != 2:
        raise HTTPException(status_code=400, detail=f"{label} debe tener latitud y longitud")
    lat, lng = float(point[0]), float(point[1])
    if not -90 <= lat <= 90 or not -180 <= lng <= 180:
        raise HTTPException(status_code=400, detail=f"{label} fuera de rango")
    return [lat, lng]

def parse_coordinate_text(value: str) -> Optional[List[float]]:
    """Parse coordinate string 'lat,lng'."""
    parts = [p.strip() for p in value.split(",")]
    if len(parts) != 2:
        return None
    try:
        lat, lng = float(parts[0]), float(parts[1])
    except ValueError:
        return None
    if not (-90 <= lat <= 90 and -180 <= lng <= 180):
        return None
    return [lat, lng]

def approximate_address_point(address: str, fallback: List[float]) -> List[float]:
    """Generate approximate point for address using hash."""
    seed = sum(ord(c) for c in address)
    return [
        fallback[0] + ((seed % 80) - 40) / 10000,
        fallback[1] + (((seed // 7) % 80) - 40) / 10000
    ]

def geocode_address(address: str, fallback: List[float]) -> List[float]:
    """Convert address string to coordinates using Nominatim."""
    query = address.strip()
    if not query:
        return fallback
    
    try:
        res = requests.get(
            "https://nominatim.openstreetmap.org/search",
            params={
                "q": f"{query}, Nuevo Laredo, Tamaulipas, Mexico",
                "format": "json",
                "limit": 1
            },
            headers={"User-Agent": "SafeDrive/1.0"},
            timeout=8,
        )
        res.raise_for_status()
        items = res.json()
        if items:
            return [float(items[0]["lat"]), float(items[0]["lon"])]
    except Exception as exc:
        logger.warning(f"Geocoding fallback for {query}: {exc}")
    
    return approximate_address_point(query, fallback)

async def street_route(origin: list, destination: list) -> dict:
    """Calculate driving route using OSRM."""
    origin = validate_point(origin, "Origen")
    destination = validate_point(destination, "Destino")

    fallback = {
        "origin": origin,
        "destination": destination,
        "corridor": [origin, destination],
        "distance_m": round(haversine_m(origin[0], origin[1], destination[0], destination[1]), 0),
        "duration_s": None,
        "provider": "fallback",
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
            "origin": origin,
            "destination": destination,
            "corridor": corridor,
            "distance_m": round(route.get("distance", fallback["distance_m"]), 0),
            "duration_s": round(route.get("duration"), 0) if route.get("duration") else None,
            "provider": "osrm",
            "bridges": BRIDGES,
            "dead_zones": DEAD_ZONES,
            "tolerance_m": CORRIDOR_TOLERANCE_M,
        }
    except Exception as exc:
        logger.warning(f"OSRM route error: {exc}")
        return fallback

def shortest_driving_route(start: List[float], destination: List[float]) -> List[List[float]]:
    """Get shortest route coordinates from OSRM."""
    try:
        coords = f"{start[1]},{start[0]};{destination[1]},{destination[0]}"
        res = requests.get(
            f"https://router.project-osrm.org/route/v1/driving/{coords}",
            params={
                "overview": "full",
                "geometries": "geojson",
                "alternatives": "false",
                "steps": "false"
            },
            timeout=10,
        )
        res.raise_for_status()
        data = res.json()
        route = data.get("routes", [{}])[0].get("geometry", {}).get("coordinates", [])
        points = [[lat, lng] for lng, lat in route]
        if len(points) >= 2:
            return points
    except Exception as exc:
        logger.warning(f"OSRM route fallback: {exc}")
    
    return [start, destination]
