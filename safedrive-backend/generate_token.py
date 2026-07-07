"""
CLI script to manage companies, plans, and tokens for SafeDrive.

Usage:
    python generate_token.py                              # interactive menu
    python generate_token.py --list                       # list companies with token status
    python generate_token.py --create-company             # create company with plan
    python generate_token.py --assign-token               # assign monitorista token
    python generate_token.py --generate-drivers           # generate conductor tokens
"""
import argparse
import secrets
import uuid
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


async def create_company(db, name: str, plan_id: str, cycle: str,
                         rfc: str = None, phone: str = None, email: str = None, address: str = None,
                         monitor_name: str = None, monitor_email: str = None, monitor_password: str = None):
    plan = PLANS_CATALOG.get(plan_id)
    if not plan:
        print("ERROR: Plan no valido.")
        return None

    company_id = f"comp_{uuid.uuid4().hex[:12]}"
    company = {
        "id": company_id,
        "name": name.strip(),
        "rfc": rfc,
        "phone": phone,
        "email": email,
        "address": address,
        "plan_id": plan_id,
        "plan_name": plan["name"],
        "cycle": cycle,
        "max_drivers": plan["devices"],
        "has_token": False,
        "active": True,
        "created_by": "cli",
        "created_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.companies.insert_one(company)
    return company


async def create_monitorista_token(db, company: dict, plan_id: str, cycle: str, max_uses: int = None):
    plan = PLANS_CATALOG.get(plan_id)
    if not plan:
        print("ERROR: Plan no valido.")
        return None

    existing = await db.site_tokens.find_one({"company_id": company["id"], "role": "monitorista", "active": True})
    if existing:
        print(f"ERROR: La empresa '{company['name']}' ya tiene un token monitorista activo.")
        return None

    raw = secrets.token_hex(24)
    doc = {
        "token": raw,
        "name": company["name"],
        "role": "monitorista",
        "company_id": company["id"],
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
    await db.companies.update_one(
        {"id": company["id"]},
        {"$set": {
            "has_token": True,
            "plan_id": plan_id,
            "plan_name": plan["name"],
            "cycle": cycle,
            "max_drivers": plan["devices"],
            "subscription_expires_at": doc["expires_at"],
        }}
    )
    return doc


async def create_conductor_tokens(db, parent_token: str, count: int = 1, max_uses: int = None):
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

    reuse = "Ilimitado" if max_uses is None else str(max_uses)

    tokens = []
    for i in range(count):
        raw = secrets.token_hex(16)
        doc = {
            "token": raw,
            "name": f"Conductor {drivers_used + i + 1}",
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
        choice = input(f"  Selecciona (1-{len(options)}): ").strip()
        if choice.isdigit() and 1 <= int(choice) <= len(options):
            return options[int(choice) - 1]
        if default and not choice:
            return default
        print("  Opcion invalida.")


# ── List companies ─────────────────────────────────────────────────────────────

async def list_companies(db):
    companies = await db.companies.find({}, {"_id": 0}).sort("created_at", -1).to_list(500)

    print()
    print("=" * 70)
    print("  LISTADO DE EMPRESAS")
    print("=" * 70)
    if not companies:
        print("  (No hay empresas registradas)")
        print("=" * 70)
        return

    for i, c in enumerate(companies, 1):
        has = c.get("has_token", False)
        plan = c.get("plan_name", "")
        exp = c.get("subscription_expires_at", "")
        expired = False
        if exp:
            try:
                expired = datetime.fromisoformat(exp) < datetime.now(timezone.utc)
            except (ValueError, TypeError):
                pass

        status = ""
        if has and expired:
            status = f"\033[91m VENCIDO\033[0m"
        elif has:
            status = f"\033[92m ACTIVO\033[0m"
        else:
            status = f"\033[93m SIN TOKEN\033[0m"

        plan_info = f" | {plan} ({c.get('max_drivers', '?')} cond.)" if plan else ""
        exp_info = f" | Vence: {datetime.fromisoformat(exp).strftime('%Y-%m-%d')}" if exp else ""
        active = "\033[92m[*]\033[0m" if c.get("active", True) else "\033[90m[ ]\033[0m"

        print(f"  {active} \033[1m{c['name']}\033[0m{status}{plan_info}{exp_info}")

    print("=" * 70)
    print(f"  Total: {len(companies)} empresa(s)")
    print("=" * 70)
    print()

    return companies


# ── Company with token status ──────────────────────────────────────────────────

async def print_company_status(company):
    has = company.get("has_token", False)
    plan = company.get("plan_name", "")
    exp = company.get("subscription_expires_at", "")
    expired = False
    if exp:
        try:
            expired = datetime.fromisoformat(exp) < datetime.now(timezone.utc)
        except (ValueError, TypeError):
            pass

    print(f"  Empresa    : {company['name']}")
    print(f"  RFC        : {company.get('rfc', '—')}")
    print(f"  Estado     : ", end="")
    if not has:
        print("\033[93mSIN TOKEN\033[0m — aun no tiene token de suscripcion")
    elif expired:
        print(f"\033[91mTOKEN VENCIDO\033[0m ({plan})")
    else:
        print(f"\033[92mTOKEN ACTIVO\033[0m — {plan} ({company.get('max_drivers', '?')} conductores)")
    if exp:
        status = "Venci" if expired else "Vence"
        print(f"  {status}o     : {exp[:10]}")
    print()


# ── Create company ─────────────────────────────────────────────────────────────

async def create_company_flow(db):
    print()
    print("=" * 60)
    print("  CREAR NUEVA EMPRESA")
    print("=" * 60)

    name = input("  Nombre de la empresa: ").strip()
    while not name:
        name = input("  Nombre (obligatorio): ").strip()

    rfc = input("  RFC (opcional): ").strip() or None
    phone = input("  Telefono (opcional): ").strip() or None
    email = input("  Correo (opcional): ").strip() or None
    address = input("  Direccion (opcional): ").strip() or None

    print()
    print("  PLANES DISPONIBLES:")
    for pid, pinfo in PLANS_CATALOG.items():
        print(f"    [{pid.upper():8}] {pinfo['name']:15} — {pinfo['devices']} conductores")
    plan_id = select_from_list(list(PLANS_CATALOG.keys()), "  Selecciona el plan:")
    cycle = select_from_list(CYCLE_OPTIONS, "  Ciclo de facturacion:", default="Mensual")

    company = await create_company(db, name, plan_id, cycle, rfc, phone, email, address)
    if not company:
        return

    print()
    print("-" * 60)
    print(f"  \033[92mEMPRESA CREADA\033[0m")
    await print_company_status(company)

    assign = input("  \033[93mLa empresa no tiene token.\033[0m ¿Asignarle un token ahora? (s/N): ").strip().lower()
    if assign == "s":
        await assign_token_flow(db, company)


# ── Assign token ───────────────────────────────────────────────────────────────

async def assign_token_flow(db, company=None):
    if not company:
        print()
        print("=" * 60)
        print("  ASIGNAR TOKEN A EMPRESA")
        print("=" * 60)

        companies_without = []
        all_companies = await db.companies.find({}, {"_id": 0}).to_list(500)
        for c in all_companies:
            if not c.get("has_token", False):
                companies_without.append(c)

        if not companies_without:
            print("  \033[93mTodas las empresas ya tienen token asignado.\033[0m")
            return

        print("\n  EMPRESAS SIN TOKEN:")
        for i, c in enumerate(companies_without, 1):
            print(f"    [{i}] {c['name']}")
        print()

        while True:
            choice = input(f"  Selecciona empresa (1-{len(companies_without)}): ").strip()
            if choice.isdigit() and 1 <= int(choice) <= len(companies_without):
                company = companies_without[int(choice) - 1]
                break
            print("  Opcion invalida.")

    print()
    print(f"  Plan actual: {company.get('plan_name', 'No definido')}")
    print(f"  Max conductores: {company.get('max_drivers', 'No definido')}")

    change_plan = input("\n  ¿Cambiar plan? (s/N): ").strip().lower()
    plan_id = company.get("plan_id")
    cycle = company.get("cycle", "Mensual")

    if change_plan == "s":
        print("\n  PLANES DISPONIBLES:")
        for pid, pinfo in PLANS_CATALOG.items():
            print(f"    [{pid.upper():8}] {pinfo['name']:15} — {pinfo['devices']} conductores")
        plan_id = select_from_list(list(PLANS_CATALOG.keys()), "  Selecciona el plan:")
        cycle = select_from_list(CYCLE_OPTIONS, "  Ciclo de facturacion:", default=cycle)

    if not plan_id:
        print("ERROR: No se ha definido un plan para esta empresa.")
        return

    doc = await create_monitorista_token(db, company, plan_id, cycle)
    if not doc:
        return

    plan_info = PLANS_CATALOG[plan_id]

    print()
    print("=" * 60)
    print(f"  \033[92mTOKEN MONITORISTA GENERADO\033[0m")
    print("=" * 60)
    print(f"  Empresa      : {company['name']}")
    print(f"  Plan         : {doc['plan_name']} ({plan_info['devices']} conductores)")
    print(f"  Ciclo        : {doc['cycle']}")
    print(f"  Expira       : {doc['expires_at']}")
    print(f"  Token        : \033[93m{doc['token']}\033[0m")
    print("=" * 60)
    print(f"  El monitorista usara este token UNA SOLA VEZ al iniciar sesion.")
    print(f"  Podra crear hasta {plan_info['devices']} tokens de conductor desde el panel.")
    print("=" * 60)

    # ── Ask to generate conductor tokens ──
    gen_drivers = input(f"\n  ¿Generar tokens de conductor ahora? (max {plan_info['devices']}) (s/N): ").strip().lower()
    if gen_drivers == "s":
        await generate_drivers_flow(db, doc["token"], plan_info["devices"])


# ── Generate conductor tokens ──────────────────────────────────────────────────

async def generate_drivers_flow(db, parent_token: str = None, max_possible: int = None):
    if not parent_token:
        print()
        print("=" * 60)
        print("  GENERAR TOKENS DE CONDUCTOR")
        print("=" * 60)

        parent_token = input("\n  Token del monitorista (parent): ").strip()
        while not parent_token:
            parent_token = input("  Token (obligatorio): ").strip()

    parent = await db.site_tokens.find_one({"token": parent_token.strip(), "role": "monitorista"})
    if not parent:
        print("ERROR: Token monitorista no encontrado.")
        return

    if not parent.get("active"):
        print("ERROR: El token monitorista esta desactivado.")
        return

    if _is_expired(parent):
        print("ERROR: La suscripcion ha expirado.")
        return

    max_drivers = parent.get("max_drivers") or 0
    drivers_used = parent.get("drivers_used") or 0
    remaining = max_drivers - drivers_used

    print(f"\n  Plan           : {parent.get('plan_name', 'N/A')}")
    print(f"  Max conductores: {max_drivers}")
    print(f"  Usados         : {drivers_used}")
    print(f"  Disponibles    : {remaining}")
    print(f"  Expira         : {parent.get('expires_at', 'N/A')}")

    if max_drivers > 0 and remaining <= 0:
        print("\nERROR: No quedan espacios para mas conductores en este plan.")
        return

    max_count = remaining if max_drivers > 0 else max_possible or 999
    count_str = input(f"\n  Cantidad de tokens a generar (max {max_count}): ").strip()
    count = int(count_str) if count_str.isdigit() and int(count_str) > 0 else 1
    if count > max_count:
        print(f"ERROR: Solo puedes crear {max_count} conductor(es) mas.")
        return

    print("\n  USO DE TOKENS DE CONDUCTOR:")
    print("    [1] Un solo uso (el conductor lo usa una vez y se marca como usado)")
    print("    [2] Reutilizable (el conductor puede usarlo multiples veces)")
    use_choice = input("  Selecciona (1-2) [1]: ").strip()
    max_uses = None if use_choice == "2" else 1

    tokens = await create_conductor_tokens(db, parent_token, count, max_uses)
    if not tokens:
        return

    print()
    print("=" * 60)
    print(f"  \033[92m{len(tokens)} TOKEN(S) DE CONDUCTOR GENERADO(S)\033[0m")
    print("=" * 60)
    for i, t in enumerate(tokens, 1):
        reuse = "Ilimitado" if max_uses is None else str(max_uses)
        print(f"  [{i}] \033[1m{t['name']}\033[0m")
        print(f"      Token: \033[93m{t['token']}\033[0m")
        print(f"      Usos  : {reuse}")
        if i < len(tokens):
            print()
    print("=" * 60)
    print(f"  Ahora usados: {drivers_used + count}/{max_drivers}")
    print("=" * 60)


# ── Main menu ──────────────────────────────────────────────────────────────────

async def interactive(db, mongo_url, db_name):
    while True:
        print()
        print("=" * 60)
        print("  \033[1mSAFEDRIVE — ADMINISTRACION DE EMPRESAS Y TOKENS\033[0m")
        print("=" * 60)
        print(f"  MongoDB: {mongo_url} / {db_name}")
        print("=" * 60)
        print("  \033[97m[1]\033[0m  Listar empresas (con estado de tokens)")
        print("  \033[97m[2]\033[0m  Crear nueva empresa (con plan)")
        print("  \033[97m[3]\033[0m  Asignar token a empresa (solo empresas sin token)")
        print("  \033[97m[4]\033[0m  Generar tokens de conductor")
        print("  \033[97m[5]\033[0m  Salir")
        print("=" * 60)

        choice = input("  Selecciona (1-5): ").strip()
        print()

        if choice == "1":
            await list_companies(db)
        elif choice == "2":
            await create_company_flow(db)
        elif choice == "3":
            await assign_token_flow(db)
        elif choice == "4":
            await generate_drivers_flow(db)
        elif choice == "5":
            print("  Saliendo...")
            break
        else:
            print("  Opcion invalida.")


async def main():
    parser = argparse.ArgumentParser(description="SafeDrive — Administracion de empresas y tokens")
    parser.add_argument("--mongo-url", default=None, help="MongoDB URL (default from .env)")
    parser.add_argument("--db", default=None, help="Database name (default from .env)")
    parser.add_argument("--list", action="store_true", help="List companies with token status")
    parser.add_argument("--create-company", action="store_true", help="Create a new company with plan")
    parser.add_argument("--assign-token", action="store_true", help="Assign monitorista token to a company")
    parser.add_argument("--generate-drivers", action="store_true", help="Generate conductor tokens")
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
        await list_companies(db)
    elif args.create_company:
        await create_company_flow(db)
    elif args.assign_token:
        await assign_token_flow(db)
    elif args.generate_drivers:
        await generate_drivers_flow(db)
    else:
        await interactive(db, mongo_url, db_name)

    client.close()


if __name__ == "__main__":
    asyncio.run(main())
