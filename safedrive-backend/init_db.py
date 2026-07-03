"""Initialize MongoDB collections and default admin user for SafeDrive backend."""
import asyncio
import logging
from motor.motor_asyncio import AsyncIOMotorClient
from app.core.config import MONGO_URL, DB_NAME, ADMIN_EMAIL, ADMIN_PASSWORD
from app.core.security import hash_password

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger(__name__)

async def init_db():
    if not MONGO_URL or not DB_NAME:
        raise RuntimeError("MONGO_URL and DB_NAME must be set in .env")

    client = AsyncIOMotorClient(MONGO_URL)
    db = client[DB_NAME]

    collections = ["users", "units", "positions", "alerts", "chat", "crossings"]
    existing = await db.list_collection_names()
    for coll in collections:
        if coll not in existing:
            await db.create_collection(coll)
            logger.info(f"Created collection: {coll}")
        else:
            logger.info(f"Collection already exists: {coll}")

    if ADMIN_EMAIL and ADMIN_PASSWORD:
        admin = await db.users.find_one({"email": ADMIN_EMAIL.lower()})
        if not admin:
            await db.users.insert_one({
                "id": "admin-0001",
                "email": ADMIN_EMAIL.lower(),
                "password_hash": hash_password(ADMIN_PASSWORD),
                "name": "Administrador",
                "role": "admin",
                "phone": None,
                "token_version": 1,
                "current_session_id": None,
                "created_at": "",
            })
            logger.info(f"Created admin user: {ADMIN_EMAIL}")
        else:
            logger.info(f"Admin user already exists: {ADMIN_EMAIL}")
    else:
        logger.warning("ADMIN_EMAIL or ADMIN_PASSWORD is not configured. Skipping admin creation.")

    client.close()

if __name__ == "__main__":
    asyncio.run(init_db())
