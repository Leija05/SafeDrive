"""CLI script to generate a site access token and insert it into MongoDB.

Usage:
    python generate_token.py                          # interactive
    python generate_token.py --name "Cliente ABC"    # auto-generate
    python generate_token.py --name "Cliente" --max-uses 5
"""
import argparse
import secrets
from datetime import datetime, timezone
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def main():
    parser = argparse.ArgumentParser(description="Generate a site access token")
    parser.add_argument("--name", default=None, help="Client name for this token")
    parser.add_argument("--max-uses", type=int, default=None, help="Maximum number of uses (unlimited if omitted)")
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

    name = args.name
    if not name:
        name = input("Client name for this token: ")

    raw = secrets.token_hex(24)

    client = AsyncIOMotorClient(mongo_url)
    db = client[db_name]

    doc = {
        "token": raw,
        "name": name.strip(),
        "active": True,
        "use_count": 0,
        "max_uses": args.max_uses,
        "created_by": "cli",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
    }

    await db.site_tokens.insert_one(doc)
    client.close()

    print(f"\n{'='*60}")
    print(f"  TOKEN GENERADO")
    print(f"{'='*60}")
    print(f"  Cliente : {name}")
    print(f"  Token   : {raw}")
    if args.max_uses:
        print(f"  Usos    : {args.max_uses} maximo")
    else:
        print(f"  Usos    : Ilimitado")
    print(f"{'='*60}")
    print(f"  Entrega este token al comprador.")
    print(f"  Debera ingresarlo UNA SOLA VEZ al entrar al login.")
    print(f"{'='*60}\n")

if __name__ == "__main__":
    asyncio.run(main())
