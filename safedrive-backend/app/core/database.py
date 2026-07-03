"""MongoDB connection and database setup."""
import logging
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from app.core.config import MONGO_URL, DB_NAME

logger = logging.getLogger(__name__)

class Database:
    client: AsyncIOMotorClient = None
    db: AsyncIOMotorDatabase = None

async def connect_to_mongo():
    """Connect to MongoDB."""
    Database.client = AsyncIOMotorClient(MONGO_URL)
    Database.db = Database.client[DB_NAME]
    logger.info(f"✓ Connected to MongoDB: {DB_NAME}")

async def close_mongo_connection():
    """Close MongoDB connection."""
    if Database.client:
        Database.client.close()
        logger.info("✓ MongoDB connection closed")

def get_db() -> AsyncIOMotorDatabase:
    """Get MongoDB database instance."""
    return Database.db
