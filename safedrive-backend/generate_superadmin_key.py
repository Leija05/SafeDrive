"""
Generate a device-bound SuperAdmin key for secure login.

Usage:
    python generate_superadmin_key.py                    # interactive
    python generate_superadmin_key.py --label "PC-Oficina"
    python generate_superadmin_key.py --list             # list registered keys

This generates a random key, stores its hash in MongoDB, and
saves the plain-text key to a local file (superadmin.key).

The key file must be present on the machine used to login as SuperAdmin.
"""
import argparse
import secrets
import os
from pathlib import Path
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

KEY_FILE = Path.home() / ".safedrive" / "superadmin.key"


async def list_keys(db):
    keys = await db.superadmin_keys.find(
        {}, {"_id": 0, "label": 1, "active": 1, "created_at": 1, "last_used_at": 1, "last_used_by": 1}
    ).sort("created_at", -1).to_list(100)
    if not keys:
        print("  No hay llaves de SuperAdmin registradas.")
        return
    print(f"\n{'='*60}")
    print(f"  LLAVES DE SUPERADMIN REGISTRADAS")
    print(f"{'='*60}")
    for k in keys:
        status = "ACTIVA" if k.get("active") else "INACTIVA"
        print(f"  [{status}] {k.get('label', 'Sin etiqueta')}")
        print(f"         Creada: {k.get('created_at', 'N/A')}")
        if k.get("last_used_at"):
            print(f"         Ultimo uso: {k.get('last_used_at')} por {k.get('last_used_by', '?')}")
        print()
    print(f"{'='*60}\n")


async def create_key(db, label: str = None):
    try:
        from app.core.security import hash_password
    except ImportError:
        print("ERROR: No se puede importar desde app.core.security")
        print("Ejecuta este script desde el directorio safedrive-backend/")
        return

    raw_key = secrets.token_hex(32)
    key_hash = hash_password(raw_key)

    doc = {
        "key_hash": key_hash,
        "label": label or f"SuperAdmin-{secrets.token_hex(3).upper()}",
        "active": True,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "last_used_by": None,
    }

    await db.superadmin_keys.insert_one(doc)

    KEY_FILE.parent.mkdir(parents=True, exist_ok=True)
    with open(KEY_FILE, "w") as f:
        f.write(raw_key.strip())
    os.chmod(KEY_FILE, 0o600)

    print(f"\n{'='*60}")
    print(f"  LLAVE DE SUPERADMIN GENERADA")
    print(f"{'='*60}")
    print(f"  Etiqueta  : {doc['label']}")
    print(f"  Archivo   : {KEY_FILE}")
    print(f"  Key       : {raw_key}")
    print(f"{'='*60}")
    print(f"  GUARDA ESTA LLAVE EN UN LUGAR SEGURO.")
    print(f"  Sin este archivo no podras iniciar sesion como SuperAdmin.")
    print(f"  La llave se ha guardado en: {KEY_FILE}")
    print(f"{'='*60}\n")

    return raw_key


async def revoke_key(db, label: str):
    result = await db.superadmin_keys.update_one(
        {"label": label, "active": True},
        {"$set": {"active": False}}
    )
    if result.modified_count:
        print(f"  Llave '{label}' desactivada.")
    else:
        print(f"  No se encontro llave activa con etiqueta '{label}'.")


async def main():
    parser = argparse.ArgumentParser(description="Generate/Manage SuperAdmin device keys")
    parser.add_argument("--label", default=None, help="Label for this key (e.g. PC-Oficina)")
    parser.add_argument("--list", action="store_true", help="List registered keys")
    parser.add_argument("--revoke", default=None, help="Revoke a key by label")
    parser.add_argument("--mongo-url", default=None, help="MongoDB URL (default from .env)")
    parser.add_argument("--db", default=None, help="Database name (default from .env)")
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

    if args.list:
        await list_keys(db)
    elif args.revoke:
        await revoke_key(db, args.revoke)
    else:
        label = args.label
        if not label:
            label = input("Etiqueta para esta llave (ej. PC-Oficina): ").strip() or None
        await create_key(db, label)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
