import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { getWsUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import FleetMap, { RoutePickerMap, getDriverColor } from "@/components/FleetMap";
import DriverScoreCard from "@/components/DriverScoreCard";
import TokenManager from "@/components/TokenManager";
import { toast } from "sonner";
import {
  ShieldCheck, Truck, Warning, MapPinLine, Bridge, WifiSlash, SignOut,
  Broadcast, ChatCircleDots, Siren, NavigationArrow, X, PaperPlaneRight, Gauge, UserPlus, PencilSimple, FloppyDisk, Crosshair, Pulse, ClockCounterClockwise,
  ArrowsIn, CellSignalHigh, Eye, EyeSlash, CheckCircle, Article, Bell, BellRinging, Key,
  ListBullets, ArrowsLeftRight, CaretDown, CaretUp, Plus, IdentificationBadge, Envelope, Lock, Phone,
} from "@phosphor-icons/react";

const STATUS_LABEL = {
  en_ruta: "En ruta", detenido: "Detenido", alerta: "Alerta", offline: "Sin senal", cruce_fiscal: "Cruce fiscal",
};
const STATUS_COLOR = {
  en_ruta: "#00E676", detenido: "#FFB800", alerta: "#FF2A2A", offline: "#52525B", cruce_fiscal: "#007AFF",
};
const ALERT_ICON = {
  panico: Siren, desvio: NavigationArrow, jammer: WifiSlash, impacto: Warning,
  exceso_velocidad: Gauge, sin_senal: WifiSlash,
};

function routeConfigFor(unit, globalRoute) {
  if (unit?.route) return unit.route;
  if (Array.isArray(unit?.assigned_route) && Array.isArray(unit.assigned_route[0])) {
    return {
      origin: unit.assigned_route[0],
      destination: unit.assigned_route[unit.assigned_route.length - 1],
      corridor: unit.assigned_route,
      tolerance_m: unit.route_tolerance_m,
      name: unit.route_name,
    };
  }
  return globalRoute;
}

function AnimatedValue({ value, color, decimals = 0 }) {
  const [display, setDisplay] = useState(0);
  const prev = useRef(0);
  useEffect(() => {
    const start = prev.current;
    const end = Number(value) || 0;
    prev.current = end;
    if (start === end) { setDisplay(end); return; }
    const duration = 800;
    const startTime = performance.now();
    const tick = (now) => {
      const t = Math.min((now - startTime) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(start + (end - start) * eased);
      if (t < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [value]);
  return <span style={{ color }} className="font-tel text-3xl font-semibold tracking-tight metric-value">{display.toFixed(decimals)}</span>;
}

function Metric({ label, value, icon: Icon, color, testid, trend, suffix }) {
  return (
    <div data-testid={testid} className="card-premium p-4 flex items-center justify-between transition-all duration-300 group overflow-hidden">
      <div className="relative z-10">
        <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 font-tel">{label}</div>
        <div className="mt-1.5">
          {suffix ? (
            <span style={{ color: color || "#fff" }} className="font-tel text-3xl font-semibold tracking-tight metric-value">
              {value}{suffix}
            </span>
          ) : (
            <AnimatedValue value={value} color={color || "#fff"} />
          )}
        </div>
        {trend !== undefined && (
          <div className="flex items-center gap-1 mt-1">
            <span className={`text-[10px] font-bold font-tel ${trend >= 0 ? "text-[#00E676]" : "text-[#FF2A2A]"}`}>
              {trend >= 0 ? "+" : ""}{trend}
            </span>
            <span className="text-[9px] text-zinc-600">vs ayer</span>
          </div>
        )}
      </div>
      <div className="relative z-10 w-11 h-11 rounded-xl bg-white/[0.03] border border-white/[0.06] flex items-center justify-center group-hover:border-white/15 group-hover:scale-110 group-hover:bg-white/[0.06] transition-all duration-300">
        <Icon size={22} weight="duotone" style={{ color: color || "#71717A" }} />
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [units, setUnits] = useState({});
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState(null);
  const [route, setRoute] = useState(null);
  const [selected, setSelected] = useState(null);
  const [chat, setChat] = useState([]);
  const [chatText, setChatText] = useState("");
  const [chatOpen, setChatOpen] = useState(false);
  const [userModal, setUserModal] = useState(null);
  const [routeModal, setRouteModal] = useState(null);
  const [unitForm, setUnitForm] = useState({ name: "", driver_name: "", plate: "", imei: "", email: "", password: "", phone: "", color: "#00E676" });
  const [routePoints, setRoutePoints] = useState([]);
  const [routeTolerance, setRouteTolerance] = useState(400);
  const [scores, setScores] = useState([]);
  const [showNotif, setShowNotif] = useState(false);
  const [recentAlerts, setRecentAlerts] = useState([]);
  const [showTokenManager, setShowTokenManager] = useState(false);
  const [allUsers, setAllUsers] = useState([]);
  const [showUnitManager, setShowUnitManager] = useState(false);
  const [showCreateDriver, setShowCreateDriver] = useState(false);
  const [showCreateUnit, setShowCreateUnit] = useState(false);
  const [assignForm, setAssignForm] = useState({ user_id: "", unit_id: "" });
  const wsRef = useRef(null);
  const chatEndRef = useRef(null);
  const notifRef = useRef(null);

  const unitList = Object.values(units);
  const hasCritical = unitList.some((u) => u.status === "alerta");
  const safetyScore = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : null;

  const loadAll = useCallback(async () => {
    const [u, a, s, r, sc] = await Promise.all([
      api.get("/units"), api.get("/alerts", { params: { status: "active" } }),
      api.get("/stats"), api.get("/route"),
      api.get("/safety-scores").catch(() => ({ data: [] })),
    ]);
    const map = {};
    u.data.forEach((x) => (map[x.id] = x));
    setUnits(map);
    setAlerts(a.data);
    setStats(s.data);
    setRoute(r.data);
    setScores(sc.data || []);
  }, []);

  useEffect(() => {
    api.get("/alerts", { params: { status: "active" } }).then((r) => setRecentAlerts(r.data)).catch(() => {});
  }, []);

  useEffect(() => {
    const handler = (e) => { if (notifRef.current && !notifRef.current.contains(e.target)) setShowNotif(false); };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  useEffect(() => {
    const ws = new WebSocket(getWsUrl());
    wsRef.current = ws;
    ws.onmessage = (e) => {
      const msg = JSON.parse(e.data);
      if (msg.type === "unit_update") {
        const unit = msg.unit || (msg.unit_id ? { id: msg.unit_id, lat: msg.lat, lng: msg.lng, speed: msg.speed, heading: msg.heading, status: msg.status, signal: msg.signal, battery: msg.battery, panic: msg.panic, last_update: msg.last_update } : null);
        if (unit?.id) setUnits((prev) => ({ ...prev, [unit.id]: { ...(prev[unit.id] || {}), ...unit } }));
      } else if (msg.type === "unit_removed") {
        setUnits((prev) => { const n = { ...prev }; delete n[msg.unit_id]; return n; });
      } else if (msg.type === "alert") {
        setAlerts((prev) => [msg.alert, ...prev.filter((a) => a.id !== msg.alert.id)]);
        setRecentAlerts((prev) => [msg.alert, ...prev].slice(0, 20));
        if (msg.alert.severity === "critical")
          toast.error(`${msg.alert.unit_name}: ${msg.alert.message}`, { duration: 6000 });
      } else if (msg.type === "alert_update") {
        setAlerts((prev) => prev.map((a) => (a.id === msg.alert.id ? msg.alert : a)).filter((a) => a.status === "active"));
      } else if (msg.type === "route_update") {
        setUnits((prev) => ({ ...prev, [msg.unit.id]: msg.unit }));
      } else if (msg.type === "chat") {
        setChat((prev) => (selected && msg.message.unit_id === selected ? [...prev, msg.message] : prev));
      }
    };
    return () => ws.close();
  }, [selected]);

  useEffect(() => {
    const id = setInterval(() => api.get("/stats").then((r) => setStats(r.data)).catch(() => {}), 5000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (!selected) return;
    api.get(`/units/${selected}/chat`).then((r) => setChat(r.data)).catch(() => {});
  }, [selected]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const resolveAlert = async (id) => {
    await api.post(`/alerts/${id}`, { status: "resolved" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
    toast.success("Alerta resuelta");
  };

  const broadcastAlert = (a) => {
    const link = `https://maps.google.com/?q=${a.lat},${a.lng}`;
    const text = `ALERTA SafeDrive GPS\nUnidad: ${a.unit_name} (${a.driver_name || ""})\n${a.message}\nUbicacion: ${link}`;
    navigator.clipboard?.writeText(text);
    toast.success("Coordenadas copiadas (formato Google Maps) listas para Guardia Nacional");
  };

  const sendChat = async (text, quick = false) => {
    if (!selected || !text.trim()) return;
    await api.post(`/units/${selected}/chat`, { sender: "base", text, quick });
    setChatText("");
  };

  function timeAgo(dateStr) {
    if (!dateStr) return "";
    const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
    if (diff < 60) return "ahora";
    if (diff < 3600) return `hace ${Math.floor(diff / 60)}m`;
    if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`;
    return new Date(dateStr).toLocaleDateString("es-MX", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  }

  const alertUnitIds = new Set(alerts.map((a) => a.unit_id));
  const helpdeskUnits = [...unitList].sort((a, b) => {
    const av = alertUnitIds.has(a.id) ? 1 : 0;
    const bv = alertUnitIds.has(b.id) ? 1 : 0;
    if (av !== bv) return bv - av;
    return a.name.localeCompare(b.name);
  });

  const selectedUnit = selected ? units[selected] : null;
  const selectedRouteInfo = routeConfigFor(selectedUnit, route);
  const lastSyncText = selectedUnit?.last_update ? new Date(selectedUnit.last_update).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" }) : "sin datos";

  const openCreateUser = () => {
    setUserModal("create");
    setUnitForm({ name: "", driver_name: "", plate: "", imei: "", email: "", password: "", phone: "", color: "#00E676" });
  };

  const openEditUser = (unit) => {
    setUserModal(unit.id);
    setUnitForm({ name: unit.name || "", driver_name: unit.driver_name || "", plate: unit.plate || "", imei: unit.imei || "", email: unit.email || "", password: "", phone: unit.phone || "", color: unit.color || "#00E676" });
  };

  const saveUser = async () => {
    const payload = { ...unitForm };
    if (!payload.password) delete payload.password;
    const res = userModal === "create" ? await api.post("/units", payload) : await api.put(`/units/${userModal}`, payload);
    setUnits((prev) => ({ ...prev, [res.data.id]: res.data }));
    setSelected(res.data.id);
    setUserModal(null);
    toast.success(userModal === "create" ? "Conductor creado" : "Datos del conductor actualizados");
  };

  const openRouteEditor = (unit) => {
    const r = routeConfigFor(unit, route);
    setRouteModal(unit.id);
    setRoutePoints(r?.origin && r?.destination ? [r.origin, r.destination] : []);
    setRouteTolerance(r?.tolerance_m || 400);
  };

  const saveRoute = async () => {
    if (!routeModal || routePoints.length !== 2) return toast.error("Selecciona origen y destino en el mapa");
    const res = await api.put(`/units/${routeModal}/route`, { origin: routePoints[0], destination: routePoints[1], tolerance_m: Number(routeTolerance) });
    setUnits((prev) => ({ ...prev, [res.data.id]: res.data }));
    setRouteModal(null);
    toast.success("Ruta asignada en tiempo real");
  };

  const loadUsersForAssignment = async () => {
    try {
      const { data } = await api.get("/users");
      setAllUsers(data.filter((u) => u.role === "conductor" || u.role === "driver"));
    } catch {}
  };

  const assignUnitToUser = async () => {
    if (!assignForm.user_id || !assignForm.unit_id) {
      toast.error("Selecciona un conductor y una unidad");
      return;
    }
    try {
      await api.put(`/users/${assignForm.user_id}/assign-unit`, { unit_id: assignForm.unit_id });
      toast.success("Unidad asignada correctamente");
      setAssignForm({ user_id: "", unit_id: "" });
      loadAll();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al asignar unidad");
    }
  };

  const availableUnits = Object.values(units).filter((u) => !u.driver_id);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-[1000] bg-black/70 backdrop-blur-2xl border-b border-white/[0.04]">
        <div className="px-4 lg:px-6 h-14 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-white rounded-xl flex items-center justify-center shadow-lg shadow-white/5">
              <ShieldCheck size={20} weight="fill" className="text-black" />
            </div>
            <div>
              <div className="font-heading font-black tracking-tight leading-none text-sm">SafeDrive<span className="text-[#FF2A2A]">GPS</span></div>
              <div className="text-[9px] uppercase tracking-[0.2em] text-zinc-600 font-tel">Centro de Control · NLD</div>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            {safetyScore !== null && (
              <div className="hidden sm:flex items-center gap-1.5 text-[11px] font-tel px-2.5 py-1.5 rounded-xl border card-glass"
                style={{
                  borderColor: safetyScore >= 75 ? "rgba(0,230,118,0.2)" : safetyScore >= 50 ? "rgba(255,184,0,0.2)" : "rgba(255,42,42,0.2)",
                  color: safetyScore >= 75 ? "#00E676" : safetyScore >= 50 ? "#FFB800" : "#FF2A2A",
                }}>
                <Gauge size={13} weight="fill" /> {safetyScore}
              </div>
            )}
            <div className={`hidden sm:flex items-center gap-2 text-[11px] font-tel px-3 py-1.5 rounded-xl border transition-all ${hasCritical ? "border-[#FF2A2A]/30 text-[#FF2A2A] pulse-critical bg-[#FF2A2A]/[0.04]" : "border-[#00E676]/20 text-[#00E676] bg-[#00E676]/[0.04]"}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: hasCritical ? "#FF2A2A" : "#00E676" }} />
              {hasCritical ? "ALERTA ACTIVA" : "SISTEMA NOMINAL"}
            </div>
            {user?.role === "superadmin" && (
              <button onClick={() => navigate("/admin")}
                className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl text-amber-400/80 hover:text-amber-300 hover:bg-amber-500/10 transition-all border border-transparent hover:border-amber-500/20">
                <ShieldCheck size={14} />
                <span className="hidden sm:inline">Admin</span>
              </button>
            )}
            <button onClick={() => { setShowUnitManager(true); loadUsersForAssignment(); }}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
              <ArrowsLeftRight size={14} />
              <span className="hidden sm:inline">Unidades</span>
            </button>
            <button onClick={() => setShowTokenManager(true)}
              className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
              <Key size={14} />
              <span className="hidden sm:inline">Tokens</span>
            </button>
            <div className="relative" ref={notifRef}>
              <button onClick={() => setShowNotif((v) => !v)}
                className="relative flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
                {recentAlerts.length > 0 ? <BellRinging size={15} weight="fill" className="text-[#FF2A2A]" /> : <Bell size={15} />}
                {recentAlerts.length > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 w-4 h-4 rounded-full bg-[#FF2A2A] text-white text-[9px] font-bold flex items-center justify-center font-tel">
                    {recentAlerts.length > 9 ? "9+" : recentAlerts.length}
                  </span>
                )}
              </button>
              {showNotif && (
                <div className="absolute right-0 top-full mt-2 w-72 max-h-96 overflow-y-auto card-glass-strong shadow-2xl rounded-xl z-[2000] fade-up">
                  <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between">
                    <span className="font-heading font-bold text-sm flex items-center gap-2">
                      <Bell size={14} weight="fill" /> Notificaciones
                    </span>
                    <span className="text-[11px] text-zinc-500 font-tel">{recentAlerts.length}</span>
                  </div>
                  {recentAlerts.length === 0 ? (
                    <div className="flex flex-col items-center gap-2 py-8 text-zinc-600">
                      <CheckCircle size={20} weight="fill" className="text-[#00E676]/50" />
                      <span className="text-sm font-tel">Sin notificaciones</span>
                    </div>
                  ) : (
                    <div className="p-2 space-y-1">
                      {recentAlerts.slice(0, 15).map((a) => {
                        const col = a.severity === "critical" ? "#FF2A2A" : "#FFB800";
                        return (
                          <div key={a.id} className="p-2.5 rounded-xl hover:bg-white/[0.03] transition-all cursor-pointer" onClick={() => { setSelected(a.unit_id); setShowNotif(false); }}>
                            <div className="flex items-center gap-2.5">
                              <span className="w-2 h-2 rounded-full shrink-0" style={{ background: col }} />
                              <div className="min-w-0 flex-1">
                                <div className="text-xs font-semibold truncate font-tel">{a.unit_name}</div>
                                <div className="text-[10px] text-zinc-500 truncate">{a.message}</div>
                              </div>
                              <span className="text-[9px] text-zinc-600 font-tel">{a.type}</span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                  <div className="border-t border-white/[0.04] p-2">
                    <button onClick={() => setShowNotif(false)}
                      className="w-full text-center text-[11px] text-zinc-500 hover:text-white py-1.5 transition-colors font-tel">
                      Cerrar
                    </button>
                  </div>
                </div>
              )}
            </div>
            <button data-testid="logout-button" onClick={() => { logout(); navigate("/"); }}
              className="flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-xl text-zinc-500 hover:text-zinc-300 hover:bg-white/5 transition-all border border-transparent hover:border-white/10">
              <SignOut size={15} />
              <span className="hidden sm:inline">Salir</span>
            </button>
          </div>
        </div>
      </header>

      <main className="page-enter p-3 lg:p-4 min-h-[calc(100vh-3.5rem)] lg:h-[calc(100vh-3.5rem)] overflow-y-auto lg:overflow-hidden flex flex-col gap-3">
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-2.5 shrink-0">
          <Metric testid="metric-total" label="Unidades" value={stats?.total_units ?? 0} icon={Truck} color="#fff" />
          <Metric testid="metric-enruta" label="En ruta" value={stats?.en_ruta ?? 0} icon={NavigationArrow} color="#00E676" />
          <Metric testid="metric-critical" label="Criticas" value={stats?.critical_alerts ?? 0} icon={Siren} color="#FF2A2A" />
          <Metric testid="metric-warning" label="Avisos" value={stats?.warning_alerts ?? 0} icon={Warning} color="#FFB800" />
          <Metric testid="metric-cruce" label="Cruce fiscal" value={stats?.cruce_fiscal ?? 0} icon={Bridge} color="#007AFF" />
          <Metric testid="metric-avgcross" label="Espera prom." value={stats?.avg_crossing_min ?? 0} suffix="m" icon={Gauge} color="#A1A1AA" />
        </div>

        <div className="min-h-0 flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)] gap-3 overflow-hidden">
          <section className="min-h-0 grid grid-rows-[minmax(280px,1fr)_minmax(260px,0.9fr)] gap-3 overflow-hidden">
            <div data-testid="fleet-map-panel" className="card-premium overflow-hidden transition-all duration-200 relative min-h-0" style={{ borderRadius: 16 }}>
              {hasCritical && (
                <div className="absolute top-0 left-0 right-0 z-[500] bg-[#FF2A2A] text-black text-[11px] font-bold uppercase tracking-[0.2em] px-4 py-1.5 text-center pulse-critical flex items-center justify-center gap-2">
                  <Siren size={14} weight="fill" /> Alerta critica activa
                </div>
              )}
              {unitList.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Truck size={32} className="text-zinc-600" weight="duotone" />
                  </div>
                  <p className="text-zinc-500 text-sm text-center max-w-md leading-relaxed">
                    No hay unidades enlazadas todavía. Vincula dispositivos desde el backend o la app móvil para ver ubicaciones en tiempo real.
                  </p>
                </div>
              ) : (
                <FleetMap units={unitList} route={route} selectedId={selected} onSelect={setSelected} />
              )}
            </div>

            <div className="min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.4fr)] gap-3 overflow-hidden">
              <div data-testid="fleet-list" className="card-premium flex flex-col min-h-0" style={{ borderRadius: 16 }}>
                <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between gap-2 shrink-0">
                  <span className="font-heading font-bold flex items-center gap-2 text-sm">
                    <Truck size={16} weight="duotone" /> Conductores
                  </span>
                  <div className="flex gap-1.5">
                    <button onClick={() => setShowCreateDriver(true)}
                      className="text-[11px] px-2.5 py-1.5 rounded-xl bg-blue-500/10 text-blue-400 font-bold flex items-center gap-1.5 hover:bg-blue-500/20 transition-all border border-blue-500/20">
                      <UserPlus size={13} weight="bold" /> Conductor
                    </button>
                    <button onClick={() => setShowCreateUnit(true)}
                      className="text-[11px] px-2.5 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 font-bold flex items-center gap-1.5 hover:bg-emerald-500/20 transition-all border border-emerald-500/20">
                      <Plus size={13} weight="bold" /> Unidad
                    </button>
                  </div>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {helpdeskUnits.map((u) => {
                    const unitScore = scores.find((s) => s.unit_id === u.id);
                    const isSelected = selected === u.id;
                    return (
                    <button key={u.id} data-testid={`unit-card-${u.name}`} onClick={() => setSelected(u.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all duration-200 ${isSelected ? "border-white/30 bg-white/[0.06] shadow-lg" : "border-white/[0.06] hover:border-white/15 hover:bg-white/[0.02]"} ${alertUnitIds.has(u.id) ? "ring-1 ring-[#FF2A2A]/30" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <span className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-black/30 status-dot" style={{ background: getDriverColor(u) }} />
                          <span className="font-tel font-semibold text-sm truncate">{u.name}</span>
                          <span className="text-xs text-zinc-500 truncate hidden sm:inline">{u.driver_name}</span>
                        </div>
                        <span className="font-tel text-[11px] shrink-0 font-medium" style={{ color: STATUS_COLOR[u.status] }}>{STATUS_LABEL[u.status]}</span>
                      </div>
                      <div className="flex items-center gap-3 mt-2 font-tel text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1"><Gauge size={12} /> {u.speed?.toFixed(0)} km/h</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span className="flex items-center gap-1"><MapPinLine size={12} /> {u.deviation_m?.toFixed(0)}m</span>
                        <span className="w-1 h-1 rounded-full bg-zinc-700" />
                        <span style={{ color: u.battery < 20 ? "#FF2A2A" : u.battery < 50 ? "#FFB800" : "#00E676" }}>{u.battery ?? "--"}%</span>
                        {unitScore && (
                          <>
                            <span className="w-1 h-1 rounded-full bg-zinc-700" />
                            <span className="flex items-center gap-1" style={{ color: unitScore.score >= 75 ? "#00E676" : unitScore.score >= 50 ? "#FFB800" : "#FF2A2A" }}>
                              <ShieldCheck size={11} weight="fill" /> {unitScore.score}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="flex gap-2 mt-2.5">
                        <span onClick={(e) => { e.stopPropagation(); openRouteEditor(u); }} className="text-[11px] px-2 py-1 rounded-xl border border-white/[0.08] text-[#007AFF] hover:border-[#007AFF]/50 hover:bg-[#007AFF]/5 flex items-center gap-1 transition-all cursor-pointer">
                          <NavigationArrow size={12} /> Ruta
                        </span>
                        <span onClick={(e) => { e.stopPropagation(); openEditUser(u); }} className="text-[11px] px-2 py-1 rounded-xl border border-white/[0.08] text-zinc-400 hover:border-white/30 hover:bg-white/5 flex items-center gap-1 transition-all cursor-pointer">
                          <PencilSimple size={12} /> Editar
                        </span>
                      </div>
                    </button>
                  )})}
                  {helpdeskUnits.length === 0 && (
                    <div className="flex flex-col items-center justify-center py-10 gap-2">
                      <Truck size={24} className="text-zinc-700" />
                      <p className="text-zinc-600 text-sm">Ninguna unidad registrada</p>
                    </div>
                  )}
                </div>
              </div>

              <div className="grid grid-rows-[auto_auto_minmax(0,0.9fr)] gap-3 min-h-0 overflow-hidden">
                {scores.length > 0 && (() => {
                  const selScore = selected ? scores.find((s) => s.unit_id === selected) : null;
                  const avgScore = scores.length > 0 ? Math.round(scores.reduce((a, s) => a + s.score, 0) / scores.length) : null;
                  const dims = selScore ? selScore.dimensions : null;
                  const cnt = selScore ? selScore.alerts_count : null;
                  const unitHistory = null;
                  return (
                    <DriverScoreCard score={selScore ? selScore.score : avgScore}
                      dimensions={dims} alertsCount={cnt}
                      history={unitHistory} />
                  );
                })()}
                {scores.length === 0 && (
                  <div className="card-premium p-4" style={{ borderRadius: 16 }}>
                    <div className="font-heading font-bold flex items-center gap-2 text-sm">
                      <Gauge size={16} className="text-zinc-500" /> Score de seguridad
                    </div>
                    <div className="flex items-center justify-center py-4 text-zinc-600 text-sm font-tel">
                      Cargando datos de telemetría…
                    </div>
                  </div>
                )}
                {selectedUnit && (
                  <div className="card-premium p-4 relative overflow-hidden" style={{ borderRadius: 16 }}>
                    <div className="absolute left-0 top-2 bottom-2 w-[3px] rounded-full" style={{ background: getDriverColor(selectedUnit), boxShadow: `0 0 12px ${getDriverColor(selectedUnit)}` }} />
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-heading font-bold truncate text-sm">{selectedUnit.name}</div>
                        <div className="text-xs text-zinc-500 truncate">{selectedUnit.driver_name} · {selectedUnit.plate}</div>
                      </div>
                      <span className="w-4 h-4 rounded-full border-2 border-black/30 shrink-0" style={{ background: getDriverColor(selectedUnit) }} />
                    </div>
                    <div className="grid grid-cols-2 gap-x-3 gap-y-1.5 mt-3 font-tel text-[11px] text-zinc-400">
                      <div className="flex items-center gap-1.5">
                        <Crosshair size={12} /> {selectedUnit.lat?.toFixed(4)}, {selectedUnit.lng?.toFixed(4)}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <ClockCounterClockwise size={12} /> {lastSyncText}
                      </div>
                      <div className="flex items-center gap-1.5">
                        <Gauge size={12} /> {selectedUnit.speed?.toFixed(0)} km/h
                      </div>
                      <div className="flex items-center gap-1.5">
                        <MapPinLine size={12} /> ruta {Math.round((selectedRouteInfo?.distance_m || 0) / 1000) || "--"} km
                      </div>
                    </div>
                  </div>
                )}
                {!selectedUnit && (
                  <div className="card-premium p-4 flex items-center justify-center" style={{ borderRadius: 16 }}>
                    <p className="text-zinc-600 text-sm font-tel">Selecciona una unidad del mapa o la lista</p>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="min-h-0 grid grid-rows-[minmax(280px,1fr)_minmax(220px,0.7fr)] gap-3 overflow-hidden">
            <div data-testid="alert-panel" className="card-premium flex flex-col min-h-0" style={{ borderRadius: 16 }}>
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <span className="font-heading font-bold flex items-center gap-2 text-sm">
                  <Siren size={16} className="text-[#FF2A2A]" weight="fill" /> Alertas activas
                </span>
                <span className="font-tel text-sm text-zinc-500 bg-white/5 px-2 py-0.5 rounded-lg">{alerts.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {alerts.length === 0 && (
                  <div className="flex flex-col items-center justify-center h-full gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-[#00E676]/8 border border-[#00E676]/15 flex items-center justify-center">
                      <CheckCircle size={24} className="text-[#00E676]" weight="fill" />
                    </div>
                    <p className="text-zinc-600 text-sm font-tel">Sin alertas activas</p>
                    <p className="text-zinc-700 text-xs">Gestión por excepción</p>
                  </div>
                )}
                {alerts.map((a) => {
                  const Icon = ALERT_ICON[a.type] || Warning;
                  const col = a.severity === "critical" ? "#FF2A2A" : "#FFB800";
                  return (
                    <div key={a.id} data-testid={`alert-${a.id}`}
                      className={`p-3 rounded-xl border transition-all ${a.severity === "critical" ? "border-[#FF2A2A]/25 bg-[#FF2A2A]/[0.04] pulse-critical" : "border-[#FFB800]/15 bg-[#FFB800]/[0.03]"}`}>
                      <div className="flex items-start gap-2.5">
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: `${col}12` }}>
                          <Icon size={16} weight="fill" style={{ color: col }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-tel font-semibold text-sm">{a.unit_name}</span>
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-tel font-bold" style={{ color: col, background: `${col}14` }}>{a.type}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1 leading-relaxed">{a.message}</p>
                          <div className="flex gap-3 mt-2.5">
                            <button data-testid={`broadcast-${a.id}`} onClick={() => broadcastAlert(a)} className="text-[11px] flex items-center gap-1 text-[#007AFF] hover:text-[#3399FF] transition-colors font-medium">
                              <Broadcast size={13} weight="fill" /> Difundir
                            </button>
                            <button data-testid={`chat-${a.id}`} onClick={() => { setSelected(a.unit_id); setChatOpen(true); }} className="text-[11px] flex items-center gap-1 text-zinc-400 hover:text-white transition-colors font-medium">
                              <ChatCircleDots size={13} /> Chat
                            </button>
                            <button data-testid={`resolve-${a.id}`} onClick={() => resolveAlert(a.id)} className="text-[11px] flex items-center gap-1 text-zinc-400 hover:text-white transition-colors font-medium ml-auto">
                              <X size={13} /> Resolver
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div data-testid="crossings-panel" className="card-premium flex flex-col min-h-0" style={{ borderRadius: 16 }}>
              <div className="px-4 py-3 border-b border-white/[0.06] font-heading font-bold flex items-center gap-2 shrink-0 text-sm">
                <Bridge size={16} weight="duotone" className="text-[#007AFF]" /> Cruce transfronterizo
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {(!stats?.recent_crossings || stats.recent_crossings.length === 0) && (
                  <div className="flex flex-col items-center justify-center h-full gap-2">
                    <Bridge size={24} className="text-zinc-700" />
                    <p className="text-zinc-600 text-sm font-tel">Sin cruces registrados</p>
                  </div>
                )}
                {stats?.recent_crossings?.map((c) => (
                  <div key={c.id} className="p-3 rounded-xl border border-white/[0.06] bg-white/[0.01] hover:bg-white/[0.03] transition-all">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <span className="w-2 h-2 rounded-full bg-[#007AFF]" />
                        <span className="font-tel font-semibold text-sm">{c.unit_name}</span>
                      </div>
                      <span className="font-tel text-lg font-semibold text-[#007AFF]">{c.minutes}m</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 mt-1 ml-[18px] font-tel">{c.bridge}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      <div className="fixed right-4 bottom-4 z-[1800] flex flex-col items-end gap-3">
        {chatOpen && (
          <div className="w-[min(92vw,760px)] h-[min(76vh,560px)] card-glass-strong shadow-2xl grid grid-cols-[220px_minmax(0,1fr)] overflow-hidden rounded-2xl fade-up" style={{ boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
            <div className="border-r border-white/[0.06] flex flex-col min-w-0 min-h-0 bg-black/20">
              <div className="px-3 py-3.5 border-b border-white/[0.06] flex items-center justify-between shrink-0">
                <span className="font-heading font-bold flex items-center gap-2 text-sm tracking-tight">
                  <ChatCircleDots size={15} weight="fill" /> Conversaciones
                </span>
                <button onClick={() => setChatOpen(false)} className="w-7 h-7 rounded-lg border border-white/[0.08] flex items-center justify-center text-zinc-500 hover:text-white hover:border-white/30 transition-all">
                  <X size={14} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto p-1.5 space-y-0.5">
                {helpdeskUnits.map((u) => {
                  const isAlert = alertUnitIds.has(u.id);
                  return (
                    <button key={u.id} onClick={() => setSelected(u.id)}
                      className={`w-full text-left p-2.5 rounded-xl border transition-all ${selected === u.id ? "border-white/20 bg-white/[0.06]" : "border-transparent hover:border-white/10 hover:bg-white/[0.02]"} ${isAlert ? "ring-1 ring-[#FF2A2A]/30" : ""}`}>
                      <div className="flex items-center gap-2.5">
                        <span className="relative shrink-0">
                          <span className="block w-2.5 h-2.5 rounded-full ring-2 ring-black/30" style={{ background: getDriverColor(u) }} />
                          {u.online && <span className="absolute -bottom-0.5 -right-0.5 w-1.5 h-1.5 rounded-full bg-[#00E676] ring-1 ring-black" />}
                        </span>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center justify-between gap-1">
                            <span className="font-tel font-semibold text-sm truncate">{u.name}</span>
                            <span className="text-[10px] font-tel font-medium shrink-0" style={{ color: STATUS_COLOR[u.status] }}>{STATUS_LABEL[u.status]}</span>
                          </div>
                          <div className="text-[11px] text-zinc-500 truncate mt-0.5">{u.driver_name || "Conductor"}</div>
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col min-w-0 min-h-0">
              <div className="px-4 py-3 border-b border-white/[0.06] flex items-center justify-between shrink-0 bg-black/20">
                <span className="font-heading font-bold text-sm truncate flex items-center gap-2">
                  {selectedUnit ? (
                    <span className="w-2.5 h-2.5 rounded-full ring-2 ring-black/30 shrink-0" style={{ background: getDriverColor(selectedUnit) }} />
                  ) : (
                    <ChatCircleDots size={15} weight="fill" />
                  )}
                  {selectedUnit ? selectedUnit.name : "Centro de monitoreo"}
                  {selectedUnit && (
                    <span className="text-[10px] font-medium px-2 py-0.5 rounded-lg border ml-1 font-tel" style={{ color: STATUS_COLOR[selectedUnit.status], borderColor: `${STATUS_COLOR[selectedUnit.status]}40`, background: `${STATUS_COLOR[selectedUnit.status]}12` }}>
                      {STATUS_LABEL[selectedUnit.status]}
                    </span>
                  )}
                </span>
                {selectedUnit && (
                  <span className="text-[11px] text-zinc-500 font-tel truncate hidden sm:block max-w-[140px]">{selectedUnit.driver_name || ""}</span>
                )}
              </div>
              {!selected ? (
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-zinc-600">
                  <ChatCircleDots size={32} className="text-zinc-700" />
                  <p className="text-sm font-tel">Selecciona una unidad del panel izquierdo</p>
                </div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ scrollBehavior: "smooth" }}>
                    {chat.length === 0 && (
                      <div className="flex flex-col items-center justify-center h-full gap-2 text-zinc-600">
                        <ChatCircleDots size={24} className="text-zinc-700" />
                        <p className="text-sm font-tel">Sin mensajes aún con {selectedUnit?.name}</p>
                        <p className="text-[11px]">Usa las respuestas rápidas para iniciar</p>
                      </div>
                    )}
                    {chat.map((m, i) => {
                      const isBase = m.sender === "base";
                      const prev = chat[i - 1];
                      const showAvatar = !prev || prev.sender !== m.sender;
                      return (
                        <div key={m.id} className={`flex ${isBase ? "justify-end" : "justify-start"} items-end gap-2 ${showAvatar ? "mt-1" : "mt-0.5"}`}>
                          {!isBase && showAvatar && (
                            <span className="w-5 h-5 rounded-full shrink-0 ring-1 ring-white/10 mb-1" style={{ background: getDriverColor(selectedUnit) }} />
                          )}
                          {!isBase && !showAvatar && <span className="w-5 shrink-0" />}
                          <div className={`group relative max-w-[72%] ${showAvatar ? "mt-0" : ""}`}>
                            <div className={`px-3.5 py-2.5 text-sm leading-relaxed break-words ${isBase ? "bg-white text-black rounded-2xl rounded-br-md shadow-lg" : "bg-[#1a1a1a] text-white border border-white/[0.06] rounded-2xl rounded-bl-md"}`}>
                              {m.text}
                              <div className={`flex items-center gap-1.5 mt-1.5 ${isBase ? "justify-end" : "justify-start"}`}>
                                {m.quick && (
                                  <span className="text-[9px] opacity-40 font-tel uppercase tracking-wider flex items-center gap-1">
                                    <Pulse size={9} /> Rápida
                                  </span>
                                )}
                                <span className="text-[9px] opacity-30 font-tel">{timeAgo(m.created_at)}</span>
                              </div>
                            </div>
                          </div>
                          {isBase && (
                            <span className="w-5 h-5 rounded-full shrink-0 flex items-center justify-center bg-white/10 text-[9px] font-bold text-zinc-400 mb-1 ring-1 ring-white/10">B</span>
                          )}
                        </div>
                      );
                    })}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 border-t border-white/[0.06] shrink-0 bg-black/20">
                    <div className="flex flex-wrap gap-1.5 mb-3">
                      {[
                        { label: "Tráfico detenido", icon: Warning },
                        { label: "Retén militar", icon: ShieldCheck },
                        { label: "Todo en orden", icon: CheckCircle },
                        { label: "Llamar a base", icon: CellSignalHigh },
                      ].map(({ label, icon: Icon }) => (
                        <button key={label} data-testid={`quick-${label}`} onClick={() => sendChat(label, true)}
                          className="text-[11px] px-2.5 py-1 rounded-lg border border-white/[0.08] text-zinc-400 hover:border-white/30 hover:text-white hover:bg-white/5 transition-all flex items-center gap-1">
                          <Icon size={11} /> {label}
                        </button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input data-testid="chat-input" value={chatText} onChange={(e) => setChatText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChat(chatText)}
                        placeholder="Mensaje desde base…"
                        className="flex-1 bg-[#0d0d0d] border border-white/10 focus:border-white/30 rounded-xl px-4 py-2.5 text-sm outline-none min-w-0 transition-all placeholder:text-zinc-600" />
                      <button data-testid="chat-send" onClick={() => sendChat(chatText)}
                        className="bg-white text-black px-4 rounded-xl hover:bg-zinc-200 transition-all flex items-center justify-center font-bold text-sm gap-1.5">
                        <PaperPlaneRight size={15} weight="fill" /> Enviar
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <button data-testid="floating-chat" onClick={() => { if (!selected && helpdeskUnits[0]) setSelected(helpdeskUnits[0].id); setChatOpen((v) => !v); }}
          className={`flex items-center gap-2.5 rounded-full px-5 py-3 font-bold transition-all duration-300 shadow-2xl hover-lift ${chatOpen ? "bg-zinc-800/90 text-white border border-white/10 backdrop-blur-xl" : "bg-white text-black hover:bg-zinc-200"}`}>
          <ChatCircleDots size={22} weight={chatOpen ? "regular" : "fill"} /> Chat seguro
          {!chatOpen && alerts.length > 0 && (
            <span className="rounded-full bg-[#FF2A2A] text-white text-[10px] font-bold px-1.5 py-0.5 min-w-[20px] text-center animate-pulse">{alerts.length}</span>
          )}
        </button>
      </div>

      {userModal && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
          <div className="card-glass-strong w-full max-w-3xl p-6 rounded-2xl fade-up max-h-[90vh] overflow-y-auto" style={{ boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                {userModal === "create" ? <UserPlus size={18} weight="fill" /> : <PencilSimple size={18} weight="fill" />}
                {userModal === "create" ? "Crear conductor" : "Modificar datos del conductor"}
              </h2>
              <button onClick={() => setUserModal(null)} className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* Unit availability list */}
            <div className="mb-6 bg-zinc-900/50 rounded-xl border border-white/10 p-4">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 mb-3 flex items-center gap-2">
                <Truck size={14} /> Unidades disponibles ({availableUnits.length} de {unitList.length})
              </h3>
              <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 gap-2">
                {unitList.map((u) => {
                  const libre = !u.driver_id;
                  return (
                    <div key={u.id} className={`text-[11px] font-tel p-2 rounded-lg border text-center transition-all ${
                      libre
                        ? "border-emerald-500/30 bg-emerald-500/5 text-emerald-400"
                        : "border-zinc-800 bg-zinc-900/50 text-zinc-600"
                    }`}>
                      <div className="font-semibold">{u.name}</div>
                      <div className={libre ? "text-emerald-400/70" : "text-zinc-600"}>{u.plate}</div>
                      <div className="text-[9px] mt-0.5">{libre ? "Disponible" : (u.driver_name || "Ocupado")}</div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[['name','Unidad'],['driver_name','Nombre conductor'],['plate','Placas'],['imei','IMEI'],['email','Correo'],['password','Contraseña'],['phone','Teléfono']].map(([key,label]) => (
                <label key={key} className="text-xs text-zinc-400 font-medium">
                  {label}
                  <input
                    type={key === 'password' ? 'password' : 'text'}
                    value={unitForm[key]}
                    onChange={(e) => setUnitForm((f) => ({ ...f, [key]: e.target.value }))}
                    className="mt-1.5 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel"
                  />
                </label>
              ))}
              <label className="text-xs text-zinc-400 font-medium">
                Color asignado
                <input type="color" value={unitForm.color} onChange={(e) => setUnitForm((f) => ({ ...f, color: e.target.value }))}
                  className="mt-1.5 w-full h-10 bg-[#0d0d0d] border border-white/10 rounded-xl cursor-pointer" />
              </label>
            </div>
            <div className="flex justify-end gap-3 mt-6">
              <button onClick={() => setUserModal(null)} className="px-4 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:border-white/30 transition-all text-sm">Cancelar</button>
              <button onClick={saveUser} className="px-5 py-2.5 rounded-xl bg-white text-black font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all text-sm">
                <FloppyDisk size={16} weight="fill" /> Guardar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Unit Manager Modal ── */}
      {showUnitManager && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
          <div className="card-glass-strong w-full max-w-2xl p-6 rounded-2xl fade-up max-h-[90vh] overflow-y-auto" style={{ boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                <ArrowsLeftRight size={18} weight="fill" /> Gestión de Unidades
              </h2>
              <button onClick={() => setShowUnitManager(false)} className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
                <X size={16} />
              </button>
            </div>

            {/* All units with status */}
            <div className="mb-6">
              <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
                <ListBullets size={16} /> Todas las unidades ({unitList.length})
              </h3>
              <div className="space-y-1.5 max-h-60 overflow-y-auto pr-1">
                {unitList.map((u) => {
                  const libre = !u.driver_id;
                  return (
                    <div key={u.id} className="flex items-center justify-between bg-zinc-800/30 hover:bg-zinc-800/50 rounded-xl px-3.5 py-2.5 transition-colors border border-zinc-800/40">
                      <div className="flex items-center gap-3 min-w-0">
                        <span className={`w-7 h-7 rounded-lg flex items-center justify-center text-[11px] font-bold shrink-0 border ${
                          libre
                            ? "bg-emerald-700/30 text-emerald-400 border-emerald-500/20"
                            : "bg-zinc-700/30 text-zinc-500 border-zinc-700/40"
                        }`}>
                          {u.name?.slice(0, 2) || "UN"}
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{u.name} <span className="text-zinc-500 font-normal">{u.plate}</span></p>
                          {u.driver_name ? (
                            <p className="text-xs text-zinc-500 truncate">{u.driver_name}</p>
                          ) : (
                            <p className="text-xs text-emerald-500/70 italic truncate">Disponible</p>
                          )}
                        </div>
                      </div>
                      <span className={`text-[10px] font-semibold px-2 py-1 rounded-full border shrink-0 ${
                        libre
                          ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/20"
                          : "bg-zinc-700/30 text-zinc-400 border-zinc-700/40"
                      }`}>
                        {libre ? "Libre" : "En uso"}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Quick assign unit to driver */}
            <div className="bg-zinc-900/50 rounded-xl border border-white/10 p-4">
              <h3 className="text-sm font-bold text-zinc-300 mb-3 flex items-center gap-2">
                <ArrowsLeftRight size={16} className="text-[#007AFF]" /> Asignar unidad a conductor existente
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <label className="text-xs text-zinc-400 font-medium">
                  Conductor
                  <select value={assignForm.user_id} onChange={(e) => setAssignForm((f) => ({ ...f, user_id: e.target.value }))}
                    className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel">
                    <option value="">Seleccionar conductor...</option>
                    {allUsers.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.email} {u.unit ? `(${u.unit.name})` : "(sin unidad)"}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="text-xs text-zinc-400 font-medium">
                  Unidad
                  <select value={assignForm.unit_id} onChange={(e) => setAssignForm((f) => ({ ...f, unit_id: e.target.value }))}
                    className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel">
                    <option value="">Seleccionar unidad...</option>
                    {unitList.map((u) => (
                      <option key={u.id} value={u.id}>
                        {u.name} · {u.plate} {u.driver_name ? `(${u.driver_name})` : "(disponible)"}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <button onClick={assignUnitToUser}
                className="mt-3 px-4 py-2.5 rounded-xl bg-[#007AFF] text-white font-bold text-sm hover:bg-[#3399FF] transition-all flex items-center gap-2">
                <ArrowsLeftRight size={15} weight="bold" /> Asignar unidad
              </button>
            </div>
          </div>
        </div>
      )}

      {routeModal && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
          <div className="card-glass-strong w-full max-w-4xl p-6 rounded-2xl fade-up" style={{ boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
            <div className="flex justify-between items-center mb-3">
              <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                <NavigationArrow size={18} weight="fill" />
                Asignar ruta: {units[routeModal]?.name}
              </h2>
              <button onClick={() => setRouteModal(null)} className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-zinc-500 mb-3 leading-relaxed">
              Haz click en el mapa para seleccionar origen y destino. Al guardar, el servidor calcula la ruta real por calles y la comparte con la app móvil y la web en tiempo real.
            </p>
            <div className="h-[420px] rounded-xl overflow-hidden border border-white/[0.06]">
              <RoutePickerMap points={routePoints} color={units[routeModal]?.color || '#00E676'} onChange={setRoutePoints} />
            </div>
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <label className="text-xs text-zinc-400 font-medium flex items-center gap-2">
                Tolerancia
                <input type="number" min="50" value={routeTolerance} onChange={(e) => setRouteTolerance(e.target.value)}
                  className="w-28 bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2 text-white text-sm font-tel focus:border-white/30 transition-all" />
                m
              </label>
              <div className="flex gap-2 ml-auto">
                <button onClick={() => setRoutePoints([])} className="px-3 py-2 rounded-xl border border-white/10 text-zinc-300 hover:border-white/30 transition-all text-sm">Limpiar</button>
                <button onClick={saveRoute} className="px-4 py-2 rounded-xl bg-white text-black font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all text-sm">
                  <FloppyDisk size={16} weight="fill" /> Guardar ruta
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Driver Modal ── */}
      {showCreateDriver && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
          <div className="card-glass-strong w-full max-w-md p-6 rounded-2xl fade-up" style={{ boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                <UserPlus size={18} weight="fill" /> Registrar conductor
              </h2>
              <button onClick={() => setShowCreateDriver(false)} className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
                <X size={16} />
              </button>
            </div>
            <CreateDriverFormInline
              onSaved={() => { setShowCreateDriver(false); loadAll(); }}
              onCancel={() => setShowCreateDriver(false)}
            />
          </div>
        </div>
      )}

      {/* ── Create Unit Modal ── */}
      {showCreateUnit && (
        <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
          <div className="card-glass-strong w-full max-w-lg p-6 rounded-2xl fade-up max-h-[90vh] overflow-y-auto" style={{ boxShadow: "0 25px 80px rgba(0,0,0,0.6)" }}>
            <div className="flex justify-between items-center mb-6">
              <h2 className="font-heading font-bold text-lg flex items-center gap-2">
                <Plus size={18} weight="fill" /> Nueva unidad
              </h2>
              <button onClick={() => setShowCreateUnit(false)} className="w-8 h-8 rounded-lg border border-white/[0.08] flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
                <X size={16} />
              </button>
            </div>
            <CreateUnitFormInline
              onSaved={() => { setShowCreateUnit(false); loadAll(); }}
              onCancel={() => setShowCreateUnit(false)}
            />
          </div>
        </div>
      )}

      {showTokenManager && <TokenManager onClose={() => setShowTokenManager(false)} userRole={user?.role} />}
    </div>
  );
}

/* ── Inline Create Driver Form ── */
function CreateDriverFormInline({ onSaved, onCancel }) {
  const [form, setForm] = useState({ name: "", email: "", password: "", phone: "" });
  const [busy, setBusy] = useState(false);
  const [showPw, setShowPw] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.email.trim() || !form.password.trim()) {
      toast.error("Nombre, correo y contrasena son obligatorios");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/register", { ...form, role: "conductor" });
      toast.success(`Conductor ${form.name} creado correctamente`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear conductor");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
        <IdentificationBadge size={13} /> Nombre completo *
        <input name="name" value={form.name} onChange={handleChange} placeholder="Juan Perez"
          className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
      </label>
      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
        <Envelope size={13} /> Correo electronico *
        <input name="email" type="email" value={form.email} onChange={handleChange} placeholder="conductor@empresa.com"
          className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
      </label>
      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
        <Lock size={13} /> Contrasena *
        <div className="relative w-full mt-1">
          <input name="password" type={showPw ? "text" : "password"} value={form.password} onChange={handleChange} placeholder="••••••••"
            className="w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
          <button type="button" onClick={() => setShowPw(!showPw)}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300">
            {showPw ? <EyeSlash size={15} /> : <Eye size={15} />}
          </button>
        </div>
      </label>
      <label className="text-xs text-zinc-400 font-medium flex items-center gap-1.5">
        <Phone size={13} /> Telefono (opcional)
        <input name="phone" value={form.phone} onChange={handleChange} placeholder="+52 867 000 0000"
          className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
      </label>
      <div className="bg-zinc-900/50 border border-white/10 rounded-xl p-3 text-xs text-zinc-500">
        Solo datos del conductor. Despues puedes asignarle una unidad desde Gestion de Unidades.
      </div>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:border-white/30 transition-all text-sm">Cancelar</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-blue-500 text-white font-bold text-sm hover:bg-blue-600 transition-all flex items-center gap-2 disabled:opacity-50">
          {busy ? "Creando..." : "Crear conductor"}
        </button>
      </div>
    </form>
  );
}

/* ── Inline Create Unit Form ── */
const MARCA_OPTIONS = ["Kenworth", "Freightliner", "International", "Dina", "Volvo", "Mercedes-Benz", "Scania", "Peterbilt", "Otro"];
const TIPO_OPTIONS = ["Tractocamion", "Caja seca", "Refrigerado", "Plataforma", "Tanque", "Volteo", "Grua", "Pickup", "SUV", "Otro"];

function CreateUnitFormInline({ onSaved, onCancel }) {
  const [form, setForm] = useState({ name: "", plate: "", marca: "", modelo: "", anio: "", tipo: "", imei: "", color: "#00E676" });
  const [busy, setBusy] = useState(false);

  const handleChange = (e) => setForm((p) => ({ ...p, [e.target.name]: e.target.value }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.plate.trim()) {
      toast.error("Nombre y placas son obligatorios");
      return;
    }
    setBusy(true);
    try {
      const payload = { ...form, anio: form.anio ? Number(form.anio) : undefined };
      await api.post("/units", payload);
      toast.success("Unidad creada correctamente");
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al crear unidad");
    } finally { setBusy(false); }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-400 font-medium">
          Nombre *
          <input name="name" value={form.name} onChange={handleChange} placeholder="NL-01"
            className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
        </label>
        <label className="text-xs text-zinc-400 font-medium">
          Placas *
          <input name="plate" value={form.plate} onChange={handleChange} placeholder="XXX-00-00"
            className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-400 font-medium">
          Marca
          <select name="marca" value={form.marca} onChange={handleChange}
            className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel">
            <option value="">Seleccionar</option>
            {MARCA_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </label>
        <label className="text-xs text-zinc-400 font-medium">
          Modelo
          <input name="modelo" value={form.modelo} onChange={handleChange} placeholder="T680"
            className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
        </label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="text-xs text-zinc-400 font-medium">
          Anio
          <input name="anio" type="number" min="1990" max="2026" value={form.anio} onChange={handleChange} placeholder="2024"
            className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
        </label>
        <label className="text-xs text-zinc-400 font-medium">
          Tipo
          <select name="tipo" value={form.tipo} onChange={handleChange}
            className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel">
            <option value="">Seleccionar</option>
            {TIPO_OPTIONS.map((o) => (<option key={o} value={o}>{o}</option>))}
          </select>
        </label>
      </div>
      <label className="text-xs text-zinc-400 font-medium">
        IMEI / Dispositivo GPS (opcional)
        <input name="imei" value={form.imei} onChange={handleChange} placeholder="Identificador del dispositivo GPS"
          className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm outline-none focus:border-white/30 transition-all font-tel" />
      </label>
      <label className="text-xs text-zinc-400 font-medium">
        Color en mapa
        <input type="color" name="color" value={form.color} onChange={handleChange}
          className="mt-1 w-full h-10 bg-[#0d0d0d] border border-white/10 rounded-xl cursor-pointer" />
      </label>
      <div className="flex justify-end gap-3 pt-2">
        <button type="button" onClick={onCancel} className="px-4 py-2.5 rounded-xl border border-white/10 text-zinc-300 hover:border-white/30 transition-all text-sm">Cancelar</button>
        <button type="submit" disabled={busy} className="px-5 py-2.5 rounded-xl bg-emerald-500 text-white font-bold text-sm hover:bg-emerald-600 transition-all flex items-center gap-2 disabled:opacity-50">
          {busy ? "Creando..." : "Crear unidad"}
        </button>
      </div>
    </form>
  );
}
