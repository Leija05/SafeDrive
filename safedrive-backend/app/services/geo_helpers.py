"""Geographical helper functions."""
import math

# Geography: Corredor Monterrey - Nuevo Laredo (Carretera Federal 85)
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

def haversine_m(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    """Calculate distance in meters between two lat/lng points."""
    R = 6371000.0
    p1, p2 = math.radians(lat1), math.radians(lat2)
    dphi = math.radians(lat2 - lat1)
    dl = math.radians(lng2 - lng1)
    a = math.sin(dphi / 2) ** 2 + math.cos(p1) * math.cos(p2) * math.sin(dl / 2) ** 2
    return 2 * R * math.asin(min(1, math.sqrt(a)))

def point_segment_dist_m(lat: float, lng: float, alat: float, alng: float, blat: float, blng: float) -> float:
    """Distance from point to line segment."""
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

def deviation_from_route_m(lat: float, lng: float, route: list) -> float:
    """Calculate deviation from route in meters."""
    if not route or len(route) < 2:
        if route:
            return haversine_m(lat, lng, route[0][0], route[0][1])
        return float("inf")
    
    best = float("inf")
    for i in range(len(route) - 1):
        a, b = route[i], route[i + 1]
        d = point_segment_dist_m(lat, lng, a[0], a[1], b[0], b[1])
        best = min(best, d)
    return best

def inside_bridge(lat: float, lng: float) -> dict:
    """Check if inside bridge geofence."""
    for br in BRIDGES:
        if haversine_m(lat, lng, br["lat"], br["lng"]) <= br["radius_m"]:
            return br
    return None

def inside_dead_zone(lat: float, lng: float) -> dict:
    """Check if inside dead zone (no signal expected)."""
    for dz in DEAD_ZONES:
        if haversine_m(lat, lng, dz["lat"], dz["lng"]) <= dz["radius_m"]:
            return dz
    return None

def interp_corridor(frac: float) -> tuple:
    """Interpolate position along corridor."""
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
