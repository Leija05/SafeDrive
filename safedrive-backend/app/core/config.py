"""Configuration and environment variables."""
import os
from pathlib import Path
from dotenv import load_dotenv

ROOT_DIR = Path(__file__).parent.parent.parent
load_dotenv(ROOT_DIR / ".env")

# Database
MONGO_URL = os.environ.get("MONGO_URL")
DB_NAME = os.environ.get("DB_NAME")

# JWT
JWT_SECRET = os.environ.get("JWT_SECRET")
JWT_ALGORITHM = "HS256"
JWT_EXPIRATION_DAYS_WEB = 7
JWT_EXPIRATION_DAYS_MOBILE = 30

# CORS
CORS_ORIGINS = os.environ.get("CORS_ORIGINS", "*").split(",")

# OSRM (Open Street Route Machine)
OSRM_BASE_URL = os.environ.get("OSRM_BASE_URL")

# Admin user bootstrap
ADMIN_EMAIL = os.environ.get("ADMIN_EMAIL")
ADMIN_PASSWORD = os.environ.get("ADMIN_PASSWORD")

# Logging
LOG_LEVEL = os.environ.get("LOG_LEVEL", "INFO")
