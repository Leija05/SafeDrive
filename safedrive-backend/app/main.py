import logging
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi import Request

from app.core.config import CORS_ORIGINS, LOG_LEVEL
from app.core.database import connect_to_mongo, close_mongo_connection
from app.api.routers import auth, mobile, shared
from app.api import websockets

# Configure logging
logging.basicConfig(
    level=LOG_LEVEL,
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

# Create FastAPI app
app = FastAPI(
    title="SafeDrive GPS Unified Backend",
    description="Unified backend for web dashboard and mobile app",
    version="1.0.0",
)

# --- Middleware ---

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=CORS_ORIGINS,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Exception Handlers ---

@app.exception_handler(RequestValidationError)
async def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Handle validation errors with detail."""
    try:
        body = await request.body()
    except:
        body = b""
    
    logger.error(f"[422] Validation error: {exc.errors()}")
    logger.error(f"[PAYLOAD] Request body: {body.decode(errors='ignore')}")
    
    return JSONResponse(
        status_code=422,
        content={
            "detail": exc.errors(),
            "body": body.decode(errors='ignore')
        },
    )

# --- Startup / Shutdown ---

@app.on_event("startup")
async def startup_event():
    """Connect to MongoDB on startup."""
    logger.info("[INIT] Starting SafeDrive GPS backend...")
    await connect_to_mongo()
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