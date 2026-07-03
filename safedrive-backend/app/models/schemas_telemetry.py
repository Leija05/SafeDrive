"""Telemetry and tracking related Pydantic models."""
from pydantic import BaseModel, field_validator
from typing import Optional, List

class Telemetry(BaseModel):
    """Vehicle telemetry data from mobile app."""
    unit_id: Optional[str] = None
    lat: float
    lng: float
    speed: float = 0.0
    heading: Optional[float] = None
    battery: Optional[int] = None
    g_force: Optional[float] = None
    g_duration_ms: Optional[int] = None
    signal_lost: bool = False
    panic: bool = False
    event: Optional[str] = None  # 'distractor', etc.
    reason: Optional[str] = None
    ts: Optional[str] = None
    
    @field_validator('lat', 'lng', mode='before')
    @classmethod
    def transform_to_float(cls, v):
        """Coerce string to float."""
        if isinstance(v, str):
            try:
                return float(v)
            except ValueError:
                raise ValueError(f"No se pudo convertir '{v}' a un flotante válido")
        return v

class TelemetryBatch(BaseModel):
    """Batch of telemetry points."""
    points: List[Telemetry]

class DistractionIn(BaseModel):
    """Distraction alert from mobile app."""
    lat: float
    lng: float
    speed: float = 0.0
    reason: str = "Intento de salir de SafeDrive"
    ts: Optional[str] = None

class AlertAction(BaseModel):
    """Action on alert."""
    status: str  # 'acknowledged' | 'resolved'

class ChatIn(BaseModel):
    """Chat message."""
    unit_id: Optional[str] = None
    text: str
    quick: bool = False
    sender: Optional[str] = None  # 'driver' or 'base'
