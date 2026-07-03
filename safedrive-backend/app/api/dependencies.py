"""API dependencies (authentication, authorization, etc)."""
from fastapi import Depends
from app.core.security import get_current_user, require_admin, require_driver

# Re-export main dependencies
__all__ = ["get_current_user", "require_admin", "require_driver"]
