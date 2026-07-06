"""
CLI script to generate site access tokens with plan support.

Usage:
    python generate_token.py                              # interactive
    python generate_token.py --name "Cliente" --plan bronce --cycle Mensual
    python generate_token.py --name "Cliente" --max-uses 5
    python generate_token.py --type conductor --parent-token <token>
"""
import argparse
import secrets
import sys
from datetime import datetime, timezone, timedelta
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

PLANS_CATALOG = {
    "bronce": {"name": "Plan Bronce", "devices": 10},
    "plata": {"name": "Plan Plata", "devices": 25},
    "oro": {"name": "Plan Oro", "devices": 50},
}

CYCLE_OPTIONS = ["Semanal", "Mensual", "Bimestral", "Trimestral", "Anual"]
CYCLE_DAYS = {"Semanal": 7, "Mensual": 30, "Bimestral": 60, "Trimestral": 90, "Anual": 365}


def _expires_in(cycle: str) -> datetime:
    days = CYCLE_DAYS.get(cycle, 30)
    return datetime.now(timezone.utc) + timedelta(days=days)


def _is_expired(tok: dict) -> bool:
    exp = tok.get("expires_at")
    if not exp:
        return False
    try:
        return datetime.fromisoformat(exp) < datetime.now(timezone.utc)
    except (ValueError, TypeError):
        return False


async def create_monitorista_token(db, name: str, plan_id: str, cycle: str, max_uses: int = None, company_id: str = None):
    plan = PLANS_CATALOG.get(plan_id)
    raw = secrets.token_hex(24)
    doc = {
        "token": raw,
        "name": name.strip(),
        "role": "monitorista",
        "company_id": company_id,
        "active": True,
        "use_count": 0,
        "max_uses": max_uses,
        "unit_id": None,
        "driver_id": None,
        "device_id": None,
        "created_by": "cli",
        "created_at": datetime.now(timezone.utc).isoformat(),
        "last_used_at": None,
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "max_drivers": plan["devices"],
        "drivers_used": 0,
        "cycle": cycle,
        "expires_at": _expires_in(cycle).isoformat(),
    }
    await db.site_tokens.insert_one(doc)
    return doc


async def create_conductor_token(db, parent_token: str, count: int = 1, max_uses: int = 1):
    parent = await db.site_tokens.find_one({"token": parent_token.strip(), "role": "monitorista"})
    if not parent:
        print("ERROR: Token monitorista no encontrado.")
        return None

    if not parent.get("active"):
        print("ERROR: El token monitorista esta desactivado.")
        return None

    if _is_expired(parent):
        print("ERROR: La suscripcion ha expirado. Renueva antes de crear tokens de conductor.")
        return None

    max_drivers = parent.get("max_drivers") or 0
    drivers_used = parent.get("drivers_used") or 0
    remaining = max_drivers - drivers_used

    if max_drivers > 0 and remaining <= 0:
        print(f"ERROR: Limite alcanzado. Tu plan permite {max_drivers} conductores y ya usaste todos.")
        return None

    if count > remaining:
        print(f"ERROR: Solo puedes crear {remaining} conductor(es) mas, pero pediste {count}.")
        return None

    tokens = []
    for i in range(count):
        raw = secrets.token_hex(16)
        doc = {
            "token": raw,
            "name": f"Conductor-{secrets.token_hex(2).upper()}",
            "role": "conductor",
            "company_id": parent.get("company_id"),
            "active": True,
            "use_count": 0,
            "max_uses": max_uses,
            "unit_id": None,
            "driver_id": None,
            "device_id": None,
            "parent_token": parent_token.strip(),
            "created_by": "cli",
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_used_at": None,
        }
        await db.site_tokens.insert_one(doc)
        tokens.append(doc)

    await db.site_tokens.update_one(
        {"token": parent_token.strip()},
        {"$inc": {"drivers_used": count}}
    )

    return tokens


def select_from_list(options, prompt: str, default=None):
    print(f"\n{prompt}")
    for i, opt in enumerate(options, 1):
        marker = " (default)" if opt == default else ""
        print(f"  [{i}] {opt}{marker}")
    while True:
        choice = input(f"Selecciona (1-{len(options)}): ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return options[int(choice) - 1]
        if default and not choice:
            return default
        print("Opcion invalida.")


async def interactive(db, mongo_url, db_name):
    print("=" * 60)
    print("  GENERADOR DE TOKENS - SafeDrive")
    print("=" * 60)
    print(f"  MongoDB: {mongo_url} / {db_name}")
    print("=" * 60)

    tok_type = select_from_list(["monitorista", "conductor"], "Tipo de token a generar:")

    if tok_type == "monitorista":
        companies = await db.companies.find({}, {"_id": 0, "id": 1, "name": 1}).to_list(500)
        company_id = None
        if companies:
            print("\n" + "-" * 60)
            print("  EMPRESAS DISPONIBLES")
            print("-" * 60)
            for i, c in enumerate(companies, 1):
                print(f"  [{i}] {c['name']} ({c['id']})")
            print(f"  [{len(companies) + 1}] Sin empresa (token generico)")
            print("-" * 60)
            while True:
                choice = input(f"Selecciona empresa (1-{len(companies) + 1}): ").strip()
                if choice.isdigit() and 1 <= int(choice) <= len(companies):
                    company_id = companies[int(choice) - 1]["id"]
                    break
                elif choice.isdigit() and int(choice) == len(companies) + 1:
                    break
                print("Opcion invalida.")
        else:
            print("\n  (No hay empresas registradas. El token se creara sin company_id)")

        print("\n" + "-" * 60)
        print("  PLANES DISPONIBLES")
        print("-" * 60)
        for pid, pinfo in PLANS_CATALOG.items():
            print(f"  [{pid.upper():8}] {pinfo['name']:15} - {pinfo['devices']} conductores")
        print("-" * 60)

        plan_id = select_from_list(list(PLANS_CATALOG.keys()), "Selecciona el plan:")
        plan = PLANS_CATALOG[plan_id]

        name = input(f"\nNombre del cliente: ").strip()
        while not name:
            name = input("Nombre del cliente (obligatorio): ").strip()

        cycle = select_from_list(CYCLE_OPTIONS, "Ciclo de facturacion:", default="Mensual")

        max_uses_str = input("\nLimite de usos (dejar vacio para ilimitado): ").strip()
        max_uses = int(max_uses_str) if max_uses_str.isdigit() else None

        doc = await create_monitorista_token(db, name, plan_id, cycle, max_uses, company_id)
        print("\n" + "-" * 60)
        print("  PLANES DISPONIBLES")
        print("-" * 60)
        for pid, pinfo in PLANS_CATALOG.items():
            print(f"  [{pid.upper():8}] {pinfo['name']:15} - {pinfo['devices']} conductores")
        print("-" * 60)

        plan_id = select_from_list(list(PLANS_CATALOG.keys()), "Selecciona el plan:")
        plan = PLANS_CATALOG[plan_id]

        name = input(f"\nNombre del cliente: ").strip()
        while not name:
            name = input("Nombre del cliente (obligatorio): ").strip()

        cycle = select_from_list(CYCLE_OPTIONS, "Ciclo de facturacion:", default="Mensual")

        max_uses_str = input("\nLimite de usos (dejar vacio para ilimitado): ").strip()
        max_uses = int(max_uses_str) if max_uses_str.isdigit() else None

        doc = await create_monitorista_token(db, name, plan_id, cycle, max_uses)

        print(f"\n{'='*60}")
        print(f"  TOKEN MONITORISTA GENERADO")
        print(f"{'='*60}")
        print(f"  Cliente       : {doc['name']}")
        print(f"  Plan          : {doc['plan_name']} ({plan['devices']} conductores)")
        print(f"  Ciclo         : {doc['cycle']}")
        print(f"  Expira        : {doc['expires_at']}")
        print(f"  Token         : {doc['token']}")
        print(f"{'='*60}")
        print(f"  Entrega este token al monitorista.")
        print(f"  Debera ingresarlo UNA SOLA VEZ al entrar al login.")
        print(f"  Podra crear hasta {plan['devices']} tokens de conductor.")
        print(f"{'='*60}\n")

    else:
        parent_token = input("\nToken del monitorista (parent): ").strip()
        while not parent_token:
            parent_token = input("Token del monitorista (obligatorio): ").strip()

        parent = await db.site_tokens.find_one({"token": parent_token.strip(), "role": "monitorista"})
        if not parent:
            print("ERROR: Token monitorista no encontrado.")
            return

        if not parent.get("active"):
            print("ERROR: El token monitorista esta desactivado.")
            return

        if _is_expired(parent):
            print("ERROR: La suscripcion ha expirado. Renueva antes de crear tokens de conductor.")
            return

        max_drivers = parent.get("max_drivers") or 0
        drivers_used = parent.get("drivers_used") or 0
        remaining = max_drivers - drivers_used

        print(f"\n  Plan           : {parent.get('plan_name', 'N/A')}")
        print(f"  Conductores    : {drivers_used}/{max_drivers} usados")
        print(f"  Disponibles    : {remaining}")
        print(f"  Expira         : {parent.get('expires_at', 'N/A')}")

        if max_drivers > 0 and remaining <= 0:
            print("\nERROR: No quedan espacios para mas conductores en este plan.")
            return

        count_str = input(f"\nCuantos tokens de conductor generar? (max {remaining}): ").strip()
        count = int(count_str) if count_str.isdigit() else 1
        if count > remaining:
            print(f"ERROR: Solo puedes crear {remaining} conductor(es) mas.")
            return

        max_uses_str = input("Limite de usos por token (vacio = 1): ").strip()
        max_uses = int(max_uses_str) if max_uses_str.isdigit() else 1

        tokens = await create_conductor_token(db, parent_token, count, max_uses)
        if not tokens:
            return

        print(f"\n{'='*60}")
        print(f"  {len(tokens)} TOKEN(S) DE CONDUCTOR GENERADO(S)")
        print(f"{'='*60}")
        for i, t in enumerate(tokens, 1):
            print(f"  [{i}] {t['name']}")
            print(f"      Token: {t['token']}")
        print(f"{'='*60}")
        print(f"  Ahora usados: {drivers_used + count}/{max_drivers}")
        print(f"{'='*60}\n")


async def main():
    parser = argparse.ArgumentParser(description="Generate site access tokens with plan support")
    parser.add_argument("--name", default=None, help="Client name")
    parser.add_argument("--type", default=None, choices=["monitorista", "conductor"], help="Token type")
    parser.add_argument("--plan", default=None, choices=list(PLANS_CATALOG.keys()), help="Plan (bronce/plata/oro)")
    parser.add_argument("--cycle", default=None, choices=CYCLE_OPTIONS, help="Billing cycle")
    parser.add_argument("--max-uses", type=int, default=None, help="Max uses (unlimited if omitted)")
    parser.add_argument("--parent-token", default=None, help="Parent monitorista token (for conductor tokens)")
    parser.add_argument("--count", type=int, default=1, help="Number of conductor tokens to generate")
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

    # Interactive mode if no CLI flags for the main decision
    if not args.type and not args.name and not args.plan:
        await interactive(db, mongo_url, db_name)
        client.close()
        return

    # CLI-driven mode
    tok_type = args.type or "monitorista"

    if tok_type == "monitorista":
        name = args.name
        if not name:
            name = input("Client name: ")

        plan_id = args.plan
        if not plan_id:
            plan_id = select_from_list(list(PLANS_CATALOG.keys()), "Select plan:")

        cycle = args.cycle
        if not cycle:
            cycle = select_from_list(CYCLE_OPTIONS, "Billing cycle:", default="Mensual")

        doc = await create_monitorista_token(db, name, plan_id, cycle, args.max_uses)

        print(f"\n{'='*60}")
        print(f"  TOKEN MONITORISTA GENERADO")
        print(f"{'='*60}")
        print(f"  Cliente       : {doc['name']}")
        print(f"  Plan          : {doc['plan_name']}")
        print(f"  Ciclo         : {doc['cycle']}")
        print(f"  Expira        : {doc['expires_at']}")
        print(f"  Token         : {doc['token']}")
        print(f"{'='*60}\n")

    else:
        parent_token = args.parent_token
        if not parent_token:
            parent_token = input("Parent monitorista token: ")

        tokens = await create_conductor_token(db, parent_token, args.count, args.max_uses or 1)
        if not tokens:
            client.close()
            return

        print(f"\n{'='*60}")
        print(f"  {len(tokens)} CONDUCTOR TOKEN(S) GENERATED")
        print(f"{'='*60}")
        for i, t in enumerate(tokens, 1):
            print(f"  [{i}] {t['name']}")
            print(f"      Token: {t['token']}")
        print(f"{'='*60}\n")

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
