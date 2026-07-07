"""Generate test data for SafeDriveTest company.
Usage:
  python seed_test_data.py              # uses env vars for credentials
  python seed_test_data.py --url https://safedrive-backend.onrender.com
"""
import argparse, json, os, sys
import requests

BACKEND = "https://safedrive-backend.onrender.com"
API = f"{BACKEND}/api"
ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "leija901123@Drive.com")
ADMIN_PASSWORD = os.getenv("ADMIN_PASSWORD", "leija1234")

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--url", default=BACKEND)
    parser.add_argument("--email", default=ADMIN_EMAIL)
    parser.add_argument("--password", default=ADMIN_PASSWORD)
    args = parser.parse_args()
    base = args.url.rstrip("/")
    api = f"{base}/api"

    print("1. Logging in as superadmin...")
    r = requests.post(f"{api}/auth/login", json={"email": args.email, "password": args.password})
    if r.status_code != 200:
        print(f"  Login failed ({r.status_code}): {r.text}")
        sys.exit(1)
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}
    print("  OK")

    print("\n2. Creating/checking SafeDriveTest company...")
    r = requests.get(f"{api}/auth/companies", headers=headers)
    companies = r.json() if r.status_code == 200 else []
    company = next((c for c in companies if c.get("name") == "SafeDriveTest"), None)

    if company:
        cid = company["id"]
        print(f"  SafeDriveTest already exists: {cid}")
    else:
        payload = {
            "name": "SafeDriveTest",
            "rfc": "SFT220101TEST",
            "phone": "+52 867 111 2233",
            "email": "test@safedrive.com",
            "address": "Av. Test 123, Nuevo Laredo, Tamps.",
            "monitor_name": "Monitor Test",
            "monitor_email": "monitor.test@safedrive.com",
            "monitor_password": "Monitor1234!",
            "plan_id": "plata",
            "cycle": "Mensual",
        }
        r = requests.post(f"{api}/auth/companies", json=payload, headers=headers)
        if r.status_code not in (200, 201):
            print(f"  Create failed ({r.status_code}): {r.text}")
            sys.exit(1)
        data = r.json()
        cid = data["company"]["id"]
        print(f"  Created SafeDriveTest: {cid}")
        print(f"  Site token: {data.get('site_token', {}).get('token', 'N/A')}")

    print(f"\n3. Creating units for {cid}...")
    units_data = [
        {"name": "NLD-01", "plate": "ABC-12-34", "marca": "Kenworth", "modelo": "T680", "anio": 2024, "tipo": "Tractocamion", "imei": "IMEI-NLD01", "color": "#00E676"},
        {"name": "NLD-02", "plate": "DEF-56-78", "marca": "Freightliner", "modelo": "Cascadia", "anio": 2023, "tipo": "Caja seca", "imei": "IMEI-NLD02", "color": "#007AFF"},
        {"name": "NLD-03", "plate": "GHI-90-12", "marca": "International", "modelo": "LT625", "anio": 2024, "tipo": "Refrigerado", "imei": "IMEI-NLD03", "color": "#FFB800"},
        {"name": "NLD-04", "plate": "JKL-34-56", "marca": "Volvo", "modelo": "VNL 860", "anio": 2022, "tipo": "Plataforma", "imei": "IMEI-NLD04", "color": "#FF2A2A"},
        {"name": "NLD-05", "plate": "MNO-78-90", "marca": "Kenworth", "modelo": "T880", "anio": 2025, "tipo": "Tanque", "imei": "IMEI-NLD05", "color": "#A855F7"},
    ]
    unit_ids = []
    for u in units_data:
        payload = {**u, "company_id": cid}
        r = requests.post(f"{api}/units", json=payload, headers=headers)
        if r.status_code in (200, 201):
            uid = r.json().get("id") or r.json().get("_id")
            unit_ids.append(uid)
            print(f"  Created unit {u['name']}: {uid}")
        else:
            print(f"  Failed to create unit {u['name']}: {r.status_code} {r.text}")

    print(f"\n4. Creating conductors for {cid}...")
    conductors_data = [
        {"name": "Carlos Hernandez", "email": "carlos.hernandez@safedrive.com", "password": "Conductor1!", "phone": "+52 867 111 0001"},
        {"name": "Maria Garcia", "email": "maria.garcia@safedrive.com", "password": "Conductor2!", "phone": "+52 867 111 0002"},
        {"name": "Jose Martinez", "email": "jose.martinez@safedrive.com", "password": "Conductor3!", "phone": "+52 867 111 0003"},
        {"name": "Ana Lopez", "email": "ana.lopez@safedrive.com", "password": "Conductor4!", "phone": "+52 867 111 0004"},
        {"name": "Pedro Ramirez", "email": "pedro.ramirez@safedrive.com", "password": "Conductor5!", "phone": "+52 867 111 0005"},
    ]
    conductor_ids = []
    for c in conductors_data:
        payload = {**c, "role": "conductor", "company_id": cid}
        r = requests.post(f"{api}/auth/register", json=payload, headers=headers)
        if r.status_code in (200, 201):
            uid = r.json().get("id") or r.json().get("user", {}).get("id")
            conductor_ids.append(uid)
            print(f"  Created conductor {c['name']}: {uid}")
        else:
            print(f"  Failed to create conductor {c['name']}: {r.status_code} {r.text}")

    print(f"\n5. Assigning units to conductors...")
    for i, uid in enumerate(unit_ids):
        if i < len(conductor_ids):
            cid_id = conductor_ids[i]
            r = requests.put(f"{api}/users/{cid_id}/assign-unit", json={"unit_id": uid}, headers=headers)
            status = "OK" if r.status_code in (200, 201) else f"FAIL ({r.status_code}): {r.text}"
            print(f"  Assigned unit {unit_ids[i]} to conductor {cid_id}: {status}")

    print(f"\n6. Generating conductor tokens...")
    r = requests.get(f"{api}/auth/company-token-overview", headers=headers)
    monitor_token = None
    if r.status_code == 200:
        data = r.json()
        if isinstance(data, dict) and data.get("monitor_token"):
            monitor_token = data["monitor_token"].get("token")
    if not monitor_token:
        print("  No monitor token found (expected if company was just created with plan)")
    else:
        r = requests.post(f"{api}/auth/driver-tokens", json={"count": 3, "parent_token": monitor_token, "max_uses": 1}, headers=headers)
        if r.status_code in (200, 201):
            tokens = r.json().get("tokens", [])
            print(f"  Generated {len(tokens)} conductor tokens")
            for t in tokens[:3]:
                print(f"    {t.get('token', 'N/A')[:24]}...")
        else:
            print(f"  Failed: {r.status_code} {r.text}")

    print("\n✅ Done. Test data generated for SafeDriveTest.")

if __name__ == "__main__":
    main()
