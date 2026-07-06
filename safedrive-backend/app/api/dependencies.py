"""API dependencies (authentication, authorization, etc)."""
from fastapi import Depends
from app.core.security import (
    get_current_user, get_company_id,
    require_admin, require_superadmin, require_monitorista, require_conductor
)

# Re-export main dependencies
__all__ = [
    "get_current_user", "get_company_id",
    "require_admin", "require_superadmin", "require_monitorista", "require_conductor",
]
