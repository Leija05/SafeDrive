import logging
from datetime import datetime, timezone
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request
from starlette.middleware.base import BaseHTTPMiddleware

from app.core.config import CORS_ORIGINS, LOG_LEVEL
from app.core.database import connect_to_mongo, close_mongo_connection, get_db
from app.api.routers import auth, mobile, shared
from app.api import websockets

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# --- Security Headers Middleware ---

class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-XSS-Protection"] = "0"
        response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
        response.headers["Cache-Control"] = "no-store"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        return response

# Create FastAPI app
app = FastAPI(
    title="SafeDrive GPS Unified Backend",
    description="Unified backend for web dashboard and mobile app",
    version="1.0.0",
)

# --- Middleware ---

app.add_middleware(SecurityHeadersMiddleware)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allow_headers=["Authorization", "Content-Type", "X-Requested-With"],
)

# --- Exception Handlers ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors without leaking request body."""
    logger.error(f"[422] Validation error: {exc.errors()}")
    
    return JSONResponse(
        status_code=422,
        content={"detail": exc.errors()},
    )

# --- Startup / Shutdown ---

@app.on_event("startup")
async def startup_event():
    """Connect to MongoDB on startup and bootstrap superadmin."""
    logger.info("[INIT] Starting SafeDrive GPS backend...")
    await connect_to_mongo()

    db = get_db()

    # Bootstrap superadmin if configured
    try:
        from app.core.config import ADMIN_EMAIL, ADMIN_PASSWORD
        if ADMIN_EMAIL and ADMIN_PASSWORD:
            existing = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
            if not existing:
                from app.core.security import hash_password
                import uuid
                await db.users.insert_one({
                    "id": str(uuid.uuid4()),
                    "email": ADMIN_EMAIL.lower(),
                    "password_hash": hash_password(ADMIN_PASSWORD),
                    "name": "SuperAdmin",
                    "role": "superadmin",
                    "company_id": None,
                    "phone": None,
                    "token_version": 0,
                    "current_session_id": None,
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
                logger.info(f"[BOOTSTRAP] SuperAdmin created: {ADMIN_EMAIL}")
    except Exception as e:
        logger.warning(f"[BOOTSTRAP] SuperAdmin skip: {e}")

    logger.info("[OK] Database connected")

@app.on_event("shutdown")
async def shutdown_event():
    """Close MongoDB connection on shutdown."""
    logger.info("[HALT] Shutting down SafeDrive GPS backend...")
    await close_mongo_connection()
    logger.info("[OK] Database connection closed")

# --- API Routes ---

# Auth (shared between web and mobile)
app.include_router(auth.router, prefix="/api")

# Mobile driver endpoints
app.include_router(mobile.router, prefix="/api")

# Shared monitoring endpoints
app.include_router(shared.router, prefix="/api")

# WebSocket
app.include_router(websockets.router, prefix="/api")

@app.get("/")
async def root():
    """Root endpoint."""
    return {
        "service": "SafeDrive GPS Unified Backend",
        "status": "ok",
        "docs": "/docs",
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "app.main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )