"""Authentication-related Pydantic models."""
from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginIn(BaseModel):
    """Login request."""
    email: EmailStr
    password: str
    site_token: Optional[str] = None
    driver_token: Optional[str] = None
    device_id: Optional[str] = None

class RegisterIn(BaseModel):
    """User registration request."""
    email: EmailStr
    password: str
    name: str
    phone: Optional[str] = None
    plate: Optional[str] = None
    role: Optional[str] = "driver"

class AdminCreateUserIn(BaseModel):
    """Admin creating a new user."""
    email: EmailStr
    password: str
    name: str
    role: str = "driver"
    phone: Optional[str] = None
    plate: Optional[str] = None

class AdminUpdateUserIn(BaseModel):
    """Admin updating a user."""
    admin_password: str
    email: Optional[EmailStr] = None
    password: Optional[str] = None
    name: Optional[str] = None
    role: Optional[str] = None
    phone: Optional[str] = None
    plate: Optional[str] = None

class SiteTokenVerifyIn(BaseModel):
    """Site token verification request."""
    token: str

class SiteTokenCreateIn(BaseModel):
    """Create a new site token (admin only)."""
    name: str
    max_uses: Optional[int] = None
    role: Optional[str] = "monitorista"  # 'monitorista' | 'conductor'
    unit_id: Optional[str] = None
    driver_id: Optional[str] = None
    plan_id: Optional[str] = None       # 'bronce' | 'plata' | 'oro' (for monitorista)
    cycle: Optional[str] = None         # 'Semanal' | 'Mensual' | etc.

class DriverTokenVerifyIn(BaseModel):
    """Driver token verification request."""
    token: str
    device_id: Optional[str] = None

class DriverTokenCreateIn(BaseModel):
    """Create one or more driver tokens."""
    count: int = 1
    parent_token: Optional[str] = None  # monitorista token to enforce plan limit
    unit_ids: Optional[list[str]] = None
    driver_ids: Optional[list[str]] = None
    max_uses: Optional[int] = None

class UserResponse(BaseModel):
    """User response (safe public info)."""
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
