"""
Initialize MongoDB collections and indexes for SafeDrive.

Usage:
    python setup_database.py
    python setup_database.py --drop           # WARNING: drops existing data
    python setup_database.py --mongo-url mongodb://...
"""
import argparse
import asyncio
from motor.motor_asyncio import AsyncIOMotorClient

COLLECTIONS = {
    "users": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["id", "email", "password_hash", "name", "role", "created_at"],
                "properties": {
                    "id": {"bsonType": "string"},
                    "email": {"bsonType": "string"},
                    "password_hash": {"bsonType": "string"},
                    "name": {"bsonType": "string"},
                    "role": {"enum": ["superadmin", "monitorista", "admin", "operator", "dev", "conductor", "driver"]},
                    "company_id": {"bsonType": ["string", "null"]},
                    "phone": {"bsonType": ["string", "null"]},
                    "token_version": {"bsonType": "int"},
                    "current_session_id": {"bsonType": ["string", "null"]},
                    "created_at": {"bsonType": "string"},
                },
            }
        },
        "indexes": [
            {"keys": [("email", 1)], "unique": True},
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("company_id", 1)]},
            {"keys": [("role", 1)]},
        ],
    },
    "companies": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["id", "name", "active", "created_at"],
                "properties": {
                    "id": {"bsonType": "string"},
                    "name": {"bsonType": "string"},
                    "rfc": {"bsonType": ["string", "null"]},
                    "phone": {"bsonType": ["string", "null"]},
                    "email": {"bsonType": ["string", "null"]},
                    "address": {"bsonType": ["string", "null"]},
                    "active": {"bsonType": "bool"},
                    "created_by": {"bsonType": ["string", "null"]},
                    "created_at": {"bsonType": "string"},
                    "plan_id": {"bsonType": ["string", "null"]},
                    "plan_name": {"bsonType": ["string", "null"]},
                    "cycle": {"bsonType": ["string", "null"]},
                    "max_drivers": {"bsonType": ["int", "null"]},
                    "has_token": {"bsonType": ["bool", "null"]},
                    "subscription_expires_at": {"bsonType": ["string", "null"]},
                },
            }
        },
        "indexes": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("email", 1)]},
            {"keys": [("has_token", 1)]},
        ],
    },
    "site_tokens": {
        "validator": {
            "$jsonSchema": {
                "bsonType": "object",
                "required": ["token", "role", "active", "created_at"],
                "properties": {
                    "token": {"bsonType": "string"},
                    "name": {"bsonType": "string"},
                    "role": {"enum": ["monitorista", "conductor", "superadmin"]},
                    "company_id": {"bsonType": ["string", "null"]},
                    "active": {"bsonType": "bool"},
                    "use_count": {"bsonType": "int"},
                    "max_uses": {"bsonType": ["int", "null"]},
                    "unit_id": {"bsonType": ["string", "null"]},
                    "driver_id": {"bsonType": ["string", "null"]},
                    "device_id": {"bsonType": ["string", "null"]},
                    "parent_token": {"bsonType": ["string", "null"]},
                    "plan_id": {"bsonType": ["string", "null"]},
                    "plan_name": {"bsonType": ["string", "null"]},
                    "max_drivers": {"bsonType": ["int", "null"]},
                    "drivers_used": {"bsonType": ["int", "null"]},
                    "cycle": {"bsonType": ["string", "null"]},
                    "expires_at": {"bsonType": ["string", "null"]},
                    "created_by": {"bsonType": ["string", "null"]},
                    "created_at": {"bsonType": "string"},
                    "last_used_at": {"bsonType": ["string", "null"]},
                },
            }
        },
        "indexes": [
            {"keys": [("token", 1)], "unique": True},
            {"keys": [("role", 1)]},
            {"keys": [("company_id", 1)]},
            {"keys": [("parent_token", 1)]},
            {"keys": [("active", 1)]},
        ],
    },
    "units": {
        "indexes": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("driver_id", 1)]},
            {"keys": [("company_id", 1)]},
        ],
    },
    "positions": {
        "indexes": [
            {"keys": [("unit_id", 1), ("ts", -1)]},
            {"keys": [("ts", -1)]},
        ],
    },
    "alerts": {
        "indexes": [
            {"keys": [("id", 1)], "unique": True},
            {"keys": [("unit_id", 1), ("created_at", -1)]},
            {"keys": [("company_id", 1)]},
            {"keys": [("status", 1)]},
            {"keys": [("created_at", -1)]},
        ],
    },
    "chat": {
        "indexes": [
            {"keys": [("unit_id", 1), ("created_at", 1)]},
            {"keys": [("company_id", 1)]},
        ],
    },
    "crossings": {
        "indexes": [
            {"keys": [("unit_id", 1)]},
            {"keys": [("company_id", 1)]},
            {"keys": [("entry", -1)]},
        ],
    },
    "superadmin_keys": {
        "indexes": [
            {"keys": [("active", 1)]},
        ],
    },
}


async def setup():
    parser = argparse.ArgumentParser(description="Initialize SafeDrive MongoDB collections")
    parser.add_argument("--mongo-url", default=None, help="MongoDB URL (default from .env)")
    parser.add_argument("--db", default=None, help="Database name (default from .env)")
    parser.add_argument("--drop", action="store_true", help="DROP existing collections before recreating")
    args = parser.parse_args()

    try:
        from app.core.config import MONGO_URL, DB_NAME
        mongo_url = args.mongo_url or MONGO_URL
        db_name = args.db or DB_NAME
    except ImportError:
        mongo_url = args.mongo_url or input("MongoDB URL: ")
        db_name = args.db or input("Database name: ")

    if not mongo_url or not db_name:
        print("ERROR: MONGO_URL and DB_NAME are required")
        return

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    print(f"Conectado a MongoDB: {mongo_url} / {db_name}")
    print()

    existing = await db.list_collection_names()

    for name, spec in COLLECTIONS.items():
        if args.drop and name in existing:
            print(f"  DROP collection: {name}")
            await db[name].drop()

        if name in existing and not args.drop:
            print(f"  [SKIP] {name} - ya existe")
        else:
            validator = spec.get("validator")
            if validator:
                await db.create_collection(name, validator=validator)
                print(f"  [CREATE] {name} - con schema validator")
            else:
                await db.create_collection(name)
                print(f"  [CREATE] {name}")

        # Create indexes
        for idx in spec.get("indexes", []):
            keys = idx["keys"]
            unique = idx.get("unique", False)
            try:
                await db[name].create_index(
                    [(k, d) for k, d in keys],
                    unique=unique,
                    background=True,
                )
            except Exception as e:
                # Index may already exist
                pass

        print(f"  [OK] {name} - {len(spec.get('indexes', []))} indice(s)")

    client.close()

    print()
    print("=" * 60)
    print("  BASE DE DATOS INICIALIZADA")
    print("=" * 60)
    print(f"  Colecciones: {len(COLLECTIONS)}")
    for name in COLLECTIONS:
        print(f"    - {name}")
    print("=" * 60)
    print()
    print("  Ejecuta ahora: python generate_superadmin_key.py")
    print("  Para crear tu primera llave de SuperAdmin.")
    print()


if __name__ == "__main__":
    asyncio.run(setup())
