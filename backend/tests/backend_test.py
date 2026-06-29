"""SafeDrive GPS - Backend regression tests.

Covers:
- Auth (admin login, /me, bad creds)
- Public endpoints (/, /plans, /route)
- Units CRUD
- Telemetry analytic brain (panic, jammer, impact, dropped phone, deviation, bridge)
- Alerts list + update
- Chat post/get
- Stats
"""
import os
import uuid
import pytest
import requests

BASE_URL = os.environ["REACT_APP_BACKEND_URL"].rstrip("/") if os.environ.get("REACT_APP_BACKEND_URL") else "https://border-tracking.preview.emergentagent.com"
API = f"{BASE_URL}/api"

ADMIN_EMAIL = "leijahector5@gmail.com"
ADMIN_PASSWORD = "/Leija091105"


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


@pytest.fixture(scope="session")
def token(s):
    r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
    assert r.status_code == 200, f"Admin login failed: {r.status_code} {r.text}"
    data = r.json()
    assert "access_token" in data
    return data["access_token"]


@pytest.fixture(scope="session")
def auth(s, token):
    s.headers.update({"Authorization": f"Bearer {token}"})
    return s


# ---------------------------------------------------------------------------
# Auth tests
# ---------------------------------------------------------------------------
class TestAuth:
    def test_login_success(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": ADMIN_PASSWORD}, timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert "access_token" in d and isinstance(d["access_token"], str)
        assert d["user"]["email"] == ADMIN_EMAIL
        assert d["user"]["role"] == "admin"

    def test_login_bad_credentials(self, s):
        r = s.post(f"{API}/auth/login", json={"email": ADMIN_EMAIL, "password": "wrong-pass"}, timeout=20)
        assert r.status_code == 401

    def test_me_requires_token(self, s):
        # use a clean session without Authorization
        clean = requests.Session()
        r = clean.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 401

    def test_me_with_token(self, auth):
        r = auth.get(f"{API}/auth/me", timeout=20)
        assert r.status_code == 200
        u = r.json()
        assert u["email"] == ADMIN_EMAIL
        assert "password_hash" not in u  # must not leak


# ---------------------------------------------------------------------------
# Public endpoints
# ---------------------------------------------------------------------------
class TestPublic:
    def test_root(self, s):
        r = s.get(f"{API}/", timeout=20)
        assert r.status_code == 200
        assert r.json().get("status") == "ok"

    def test_plans(self, s):
        r = s.get(f"{API}/plans", timeout=20)
        assert r.status_code == 200
        d = r.json()
        ids = [p["id"] for p in d["plans"]]
        assert {"bronce", "plata", "oro"}.issubset(set(ids))
        for p in d["plans"]:
            for cycle in ("Semanal", "Mensual", "Bimestral", "Trimestral", "Anual"):
                assert cycle in p["prices"]
        on_ids = [o["id"] for o in d["onboarding"]]
        assert "instalacion" in on_ids and "token-pc" in on_ids

    def test_route(self, s):
        r = s.get(f"{API}/route", timeout=20)
        assert r.status_code == 200
        d = r.json()
        assert len(d["corridor"]) >= 2
        assert len(d["bridges"]) >= 1


# ---------------------------------------------------------------------------
# Units + Telemetry brain
# ---------------------------------------------------------------------------
class TestUnitsAndTelemetry:
    @pytest.fixture(scope="class")
    def seeded(self, auth):
        # ensure enough real linked units exist for telemetry scenarios
        units = auth.get(f"{API}/units", timeout=20).json()
        while len(units) < 6:
            idx = len(units) + 1
            r = auth.post(
                f"{API}/units",
                json={"name": f"TEST-LIVE-{idx}-{uuid.uuid4().hex[:4]}", "driver_name": "Test Driver", "plate": f"TST-{idx:02d}"},
                timeout=20,
            )
            assert r.status_code == 200
            units.append(r.json())
        return units

    def test_units_list_requires_auth(self, s):
        clean = requests.Session()
        r = clean.get(f"{API}/units", timeout=20)
        assert r.status_code == 401

    def test_create_and_delete_unit(self, auth):
        name = f"TEST-{uuid.uuid4().hex[:6]}"
        r = auth.post(f"{API}/units", json={"name": name, "driver_name": "Test Driver", "plate": "TST-00-00"}, timeout=20)
        assert r.status_code == 200
        u = r.json()
        uid = u["id"]
        # GET back
        g = auth.get(f"{API}/units/{uid}", timeout=20).json()
        assert g["name"] == name
        # DELETE
        d = auth.delete(f"{API}/units/{uid}", timeout=20)
        assert d.status_code == 200
        # confirm gone
        g2 = auth.get(f"{API}/units/{uid}", timeout=20)
        assert g2.status_code == 404

    def test_telemetry_panic_creates_critical_alert(self, auth, seeded):
        unit = seeded[0]
        payload = {"unit_id": unit["id"], "lat": 26.0, "lng": -100.18, "speed": 60, "panic": True}
        r = auth.post(f"{API}/telemetry", json=payload, timeout=20)
        assert r.status_code == 200
        out = r.json()
        assert out["status"] == "alerta"
        # check alert exists
        alerts = auth.get(f"{API}/alerts", params={"status": "active"}, timeout=20).json()
        assert any(a["unit_id"] == unit["id"] and a["type"] == "panico" and a["severity"] == "critical" for a in alerts)

    def test_telemetry_dropped_phone_no_critical(self, auth, seeded):
        unit = seeded[1] if len(seeded) > 1 else seeded[0]
        # short high-G spike → dropped phone, must NOT generate impact alert
        payload = {"unit_id": unit["id"], "lat": 26.0, "lng": -100.18, "speed": 50,
                   "g_force": 3.0, "g_duration_ms": 80}
        r = auth.post(f"{API}/telemetry", json=payload, timeout=20)
        assert r.status_code == 200
        # No impacto alert should be created in the last 5s for this unit
        time.sleep(0.5)
        alerts = auth.get(f"{API}/alerts", params={"status": "active"}, timeout=20).json()
        recent_impacts = [a for a in alerts if a["unit_id"] == unit["id"] and a["type"] == "impacto"]
        assert recent_impacts == [], f"Expected no impacto alert, got {recent_impacts}"

    def test_telemetry_impact_creates_critical_alert(self, auth, seeded):
        unit = seeded[2] if len(seeded) > 2 else seeded[0]
        payload = {"unit_id": unit["id"], "lat": 26.0, "lng": -100.18, "speed": 50,
                   "g_force": 3.5, "g_duration_ms": 500}
        r = auth.post(f"{API}/telemetry", json=payload, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "alerta"
        alerts = auth.get(f"{API}/alerts", params={"status": "active"}, timeout=20).json()
        assert any(a["unit_id"] == unit["id"] and a["type"] == "impacto" for a in alerts)

    def test_telemetry_jammer_outside_dead_zone(self, auth, seeded):
        unit = seeded[3] if len(seeded) > 3 else seeded[0]
        # lat/lng on Monterrey (NOT in any dead zone)
        payload = {"unit_id": unit["id"], "lat": 25.6866, "lng": -100.3161, "speed": 40, "signal_lost": True}
        r = auth.post(f"{API}/telemetry", json=payload, timeout=20)
        assert r.status_code == 200
        out = r.json()
        assert out["signal"] == "jammer"
        assert out["status"] == "alerta"

    def test_telemetry_signal_lost_in_dead_zone(self, auth, seeded):
        unit = seeded[4] if len(seeded) > 4 else seeded[0]
        # Sabinas Hidalgo is a dead zone
        payload = {"unit_id": unit["id"], "lat": 26.5059, "lng": -100.1828, "speed": 40, "signal_lost": True}
        r = auth.post(f"{API}/telemetry", json=payload, timeout=20)
        assert r.status_code == 200
        out = r.json()
        assert out["signal"] == "lost"
        assert out["status"] != "alerta"

    def test_telemetry_deviation_creates_warning_alert(self, auth, seeded):
        unit = seeded[5] if len(seeded) > 5 else seeded[0]
        # Way off the corridor → > 400m
        payload = {"unit_id": unit["id"], "lat": 26.2, "lng": -99.5, "speed": 60}
        r = auth.post(f"{API}/telemetry", json=payload, timeout=20)
        assert r.status_code == 200
        out = r.json()
        assert out["deviation_m"] > 400
        assert out["status"] == "alerta"
        alerts = auth.get(f"{API}/alerts", params={"status": "active"}, timeout=20).json()
        assert any(a["unit_id"] == unit["id"] and a["type"] == "desvio" for a in alerts)

    def test_telemetry_bridge_geofence(self, auth, seeded):
        unit = seeded[0]
        # Puente del Comercio Mundial
        payload = {"unit_id": unit["id"], "lat": 27.6336, "lng": -99.5847, "speed": 5}
        r = auth.post(f"{API}/telemetry", json=payload, timeout=20)
        assert r.status_code == 200
        out = r.json()
        # Either cruce_fiscal (if not in alert) or fiscal.active=True
        assert out.get("fiscal", {}).get("active") is True
        assert out.get("in_bridge")


# ---------------------------------------------------------------------------
# Alerts
# ---------------------------------------------------------------------------
class TestAlerts:
    def test_list_alerts(self, auth):
        r = auth.get(f"{API}/alerts", timeout=20)
        assert r.status_code == 200
        assert isinstance(r.json(), list)

    def test_resolve_alert(self, auth):
        alerts = auth.get(f"{API}/alerts", params={"status": "active"}, timeout=20).json()
        if not alerts:
            pytest.skip("No active alerts to resolve")
        aid = alerts[0]["id"]
        r = auth.post(f"{API}/alerts/{aid}", json={"status": "resolved"}, timeout=20)
        assert r.status_code == 200
        assert r.json()["status"] == "resolved"


# ---------------------------------------------------------------------------
# Chat
# ---------------------------------------------------------------------------
class TestChat:
    def test_post_and_get_chat(self, auth):
        units = auth.get(f"{API}/units", timeout=20).json()
        if not units:
            pytest.skip("No units to chat with")
        uid = units[0]["id"]
        msg = {"unit_id": uid, "sender": "base", "text": "TEST_msg_" + uuid.uuid4().hex[:6]}
        r = auth.post(f"{API}/chat", json=msg, timeout=20)
        assert r.status_code == 200
        assert r.json()["text"] == msg["text"]
        g = auth.get(f"{API}/chat/{uid}", timeout=20)
        assert g.status_code == 200
        assert any(m["text"] == msg["text"] for m in g.json())


# ---------------------------------------------------------------------------
# Stats
# ---------------------------------------------------------------------------
class TestStats:
    def test_stats(self, auth):
        r = auth.get(f"{API}/stats", timeout=20)
        assert r.status_code == 200
        d = r.json()
        for k in ("total_units", "en_ruta", "alerta", "critical_alerts", "warning_alerts",
                  "cruce_fiscal", "avg_crossing_min"):
            assert k in d
        assert isinstance(d["total_units"], int)
