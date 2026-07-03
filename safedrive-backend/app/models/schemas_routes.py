"""Route-related Pydantic models."""
from pydantic import BaseModel
from typing import Optional, List

class RouteAssign(BaseModel):
    """Assign route to vehicle."""
    route_id: Optional[str] = None
    points: Optional[List[List[float]]] = None
    origin: Optional[List[float]] = None
    start: Optional[List[float]] = None
    destination: Optional[List[float]] = None
    origin_address: Optional[str] = None
    destination_address: Optional[str] = None
    name: Optional[str] = None
    tolerance_m: Optional[float] = None

class CustomRouteIn(BaseModel):
    """Custom route by origin and destination addresses."""
    origin: str
    destination: str
    name: Optional[str] = None
    tolerance_m: Optional[float] = None

class UnitCreate(BaseModel):
    """Create vehicle unit."""
    name: str
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    driver_email: Optional[str] = None
    driver_password: Optional[str] = None
    driver_phone: Optional[str] = None
    plate: str
    imei: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None

class UnitUpdate(BaseModel):
    """Update vehicle unit."""
    name: Optional[str] = None
    driver_id: Optional[str] = None
    driver_name: Optional[str] = None
    plate: Optional[str] = None
    imei: Optional[str] = None
    email: Optional[str] = None
    password: Optional[str] = None
    phone: Optional[str] = None
    color: Optional[str] = None
    driver_phone: Optional[str] = None
