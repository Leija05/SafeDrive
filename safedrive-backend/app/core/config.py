"""Configuration and environment variables."""
import os
import sys
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME", "safedrive_database")

# JWT
JWT_SECRET = os.environ.get("JWT_SECRET")
if not JWT_SECRET or len(JWT_SECRET) < 32:
    print("ERROR: JWT_SECRET must be at least 32 characters long", file=sys.stderr)
    sys.exit(1)
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS_WEB = 7
JWT_EXPIRATION_DAYS_MOBILE = 30

# CORS - filter out empty strings from comma-separated list
CORS_ORIGINS = [o for o in os.environ.get("CORS_ORIGINS", "").split(",") if o.strip()]

# OSRM (Open Street Route Machine)
OSRM_BASE_URL = os.environ.get("OSRM_BASE_URL", "https://router.project-osrm.org")

# Admin user bootstrap
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

# Logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
