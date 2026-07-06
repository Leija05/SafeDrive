"""Authentication-related Pydantic models."""
from pydantic import BaseModel, EmailStr
from typing import Optional

class LoginIn(BaseModel):
    """Login request."""
    email: EmailStr
    password: str
    site_token: Optional[str] = None

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

class UserResponse(BaseModel):
    """User response (safe public info)."""
    id: str
    email: str
    name: str
    role: str
    phone: Optional[str] = None
