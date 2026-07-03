import { useEffect, useState, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import api, { getWsUrl } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import FleetMap, { RoutePickerMap, getDriverColor } from "@/components/FleetMap";
import { toast } from "sonner";
import {
  ShieldCheck, Truck, Warning, MapPinLine, Bridge, WifiSlash, SignOut,
  Broadcast, ChatCircleDots, Siren, NavigationArrow, X, PaperPlaneRight, Gauge, UserPlus, PencilSimple, FloppyDisk, Crosshair, Pulse, ClockCounterClockwise,
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
  if (unit?.assigned_route?.length) {
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

function Metric({ label, value, icon: Icon, color, testid }) {
  return (
    <div data-testid={testid} className="card-tactical p-4 flex items-center justify-between transition-colors">
      <div>
        <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">{label}</div>
        <div className="font-tel text-3xl font-semibold mt-1" style={{ color: color || "#fff" }}>{value}</div>
      </div>
      <Icon size={26} weight="duotone" style={{ color: color || "#71717A" }} />
    </div>
  );
}

export default function Dashboard() {
  const { logout } = useAuth();
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
  const wsRef = useRef(null);
  const chatEndRef = useRef(null);

  const unitList = Object.values(units);
  const hasCritical = unitList.some((u) => u.status === "alerta");

  const loadAll = useCallback(async () => {
    const [u, a, s, r] = await Promise.all([
      api.get("/units"), api.get("/alerts", { params: { status: "active" } }),
      api.get("/stats"), api.get("/route"),
    ]);
    const map = {};
    u.data.forEach((x) => (map[x.id] = x));
    setUnits(map);
    setAlerts(a.data);
    setStats(s.data);
    setRoute(r.data);
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  // WebSocket
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

  // refresh stats periodically
  useEffect(() => {
    const id = setInterval(() => api.get("/stats").then((r) => setStats(r.data)).catch(() => {}), 5000);
    return () => clearInterval(id);
  }, []);

  // load chat when unit selected
  useEffect(() => {
    if (!selected) return;
    api.get(`/units/${selected}/chat`).then((r) => setChat(r.data)).catch(() => {});
  }, [selected]);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chat]);

  const resolveAlert = async (id) => {
    await api.post(`/alerts/${id}`, { status: "resolved" });
    setAlerts((prev) => prev.filter((a) => a.id !== id));
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

  // Help desk ordering: units with active alerts first
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

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      {/* Header */}
      <header className="sticky top-0 z-[1000] bg-black/80 backdrop-blur-xl border-b border-white/10">
        <div className="px-4 lg:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <ShieldCheck size={20} weight="fill" className="text-black" />
            </div>
            <div>
              <div className="font-heading font-black tracking-tight leading-none">SafeDrive<span className="text-[#FF2A2A]">GPS</span></div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-zinc-500 font-tel">Centro de Control · Nuevo Laredo</div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={`hidden sm:flex items-center gap-2 text-xs font-tel px-3 py-1.5 rounded-md border ${hasCritical ? "border-[#FF2A2A]/40 text-[#FF2A2A] pulse-critical" : "border-[#00E676]/30 text-[#00E676]"}`}>
              <span className="w-1.5 h-1.5 rounded-full" style={{ background: hasCritical ? "#FF2A2A" : "#00E676" }} />
              {hasCritical ? "ALERTA ACTIVA" : "SISTEMA NOMINAL"}
            </span>
            <button data-testid="logout-button" onClick={() => { logout(); navigate("/"); }}
              className="flex items-center gap-2 text-sm px-3 py-1.5 rounded-md text-zinc-400 hover:text-white transition-colors">
              <SignOut size={16} />
            </button>
          </div>
        </div>
      </header>

      <main className="p-3 lg:p-4 min-h-[calc(100vh-4rem)] lg:h-[calc(100vh-4rem)] overflow-y-auto lg:overflow-hidden flex flex-col gap-3">
        {/* Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 shrink-0">
          <Metric testid="metric-total" label="Unidades" value={stats?.total_units ?? 0} icon={Truck} color="#fff" />
          <Metric testid="metric-enruta" label="En ruta" value={stats?.en_ruta ?? 0} icon={NavigationArrow} color="#00E676" />
          <Metric testid="metric-critical" label="Criticas" value={stats?.critical_alerts ?? 0} icon={Siren} color="#FF2A2A" />
          <Metric testid="metric-warning" label="Avisos" value={stats?.warning_alerts ?? 0} icon={Warning} color="#FFB800" />
          <Metric testid="metric-cruce" label="Cruce fiscal" value={stats?.cruce_fiscal ?? 0} icon={Bridge} color="#007AFF" />
          <Metric testid="metric-avgcross" label="Espera prom." value={`${stats?.avg_crossing_min ?? 0}m`} icon={Gauge} color="#A1A1AA" />
        </div>

        <div className="min-h-0 flex-1 grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(380px,1fr)] gap-3 overflow-hidden">
          <section className="min-h-0 grid grid-rows-[minmax(280px,1fr)_minmax(260px,0.9fr)] gap-3 overflow-hidden">
            {/* Map */}
            <div data-testid="fleet-map-panel" className="card-tactical overflow-hidden transition-all duration-200 relative min-h-0">
              {hasCritical && (
                <div className="absolute top-0 left-0 right-0 z-[500] bg-[#FF2A2A] text-black text-xs font-bold uppercase tracking-[0.2em] px-4 py-1.5 text-center pulse-critical">
                  ⚠ Alerta critica activa — Mapa en modo prioridad
                </div>
              )}
              {unitList.length === 0 ? (
                <div className="w-full h-full flex flex-col items-center justify-center gap-4">
                  <Truck size={40} className="text-zinc-600" weight="duotone" />
                  <p className="text-zinc-500 text-sm text-center max-w-md">No hay unidades enlazadas todavía. Vincula dispositivos desde el backend o la app móvil para ver ubicaciones reales en tiempo real.</p>
                </div>
              ) : (
                <FleetMap units={unitList} route={route} selectedId={selected} onSelect={setSelected} />
              )}
            </div>

            <div className="min-h-0 grid grid-cols-1 lg:grid-cols-[minmax(300px,0.9fr)_minmax(0,1.4fr)] gap-3 overflow-hidden">
              {/* Help desk / fleet list */}
              <div data-testid="fleet-list" className="card-tactical flex flex-col min-h-0">
                <div className="px-4 py-3 border-b border-white/10 font-heading font-bold flex items-center justify-between gap-2 shrink-0">
                  <span className="flex items-center gap-2"><Truck size={18} weight="duotone" /> Conductores y rutas</span>
                  <button onClick={openCreateUser} className="text-[11px] px-2 py-1 rounded bg-white text-black flex items-center gap-1"><UserPlus size={13} /> Nuevo</button>
                </div>
                <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                  {helpdeskUnits.map((u) => (
                    <button key={u.id} data-testid={`unit-card-${u.name}`} onClick={() => setSelected(u.id)}
                      className={`w-full text-left p-3 rounded-md border transition-colors ${selected === u.id ? "border-white/40 bg-white/5" : "border-white/10 hover:border-white/25"} ${alertUnitIds.has(u.id) ? "ring-1 ring-[#FF2A2A]/40" : ""}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="w-2 h-2 rounded-full shrink-0" style={{ background: getDriverColor(u) }} />
                          <span className="font-tel font-semibold text-sm truncate">{u.name}</span>
                          <span className="text-xs text-zinc-500 truncate">{u.driver_name}</span>
                        </div>
                        <span className="font-tel text-xs shrink-0" style={{ color: STATUS_COLOR[u.status] }}>{STATUS_LABEL[u.status]}</span>
                      </div>
                      <div className="grid grid-cols-2 gap-x-3 gap-y-1 mt-1.5 font-tel text-[11px] text-zinc-500">
                        <span className="flex items-center gap-1"><Gauge size={12} /> {u.speed?.toFixed(0)} km/h</span>
                        <span className="flex items-center gap-1"><MapPinLine size={12} /> {u.deviation_m?.toFixed(0)}m desv.</span>
                        <span>🔋 {u.battery}%</span>
                        <span>tol. {routeConfigFor(u, route)?.tolerance_m || 0}m</span>
                      </div>
                      <div className="flex gap-2 mt-2">
                        <span onClick={(e) => { e.stopPropagation(); openRouteEditor(u); }} className="text-[11px] px-2 py-1 rounded border border-white/10 text-[#007AFF] hover:border-[#007AFF]/60 flex items-center gap-1"><NavigationArrow size={12} /> Modificar ruta</span>
                        <span onClick={(e) => { e.stopPropagation(); openEditUser(u); }} className="text-[11px] px-2 py-1 rounded border border-white/10 text-zinc-300 hover:border-white/40 flex items-center gap-1"><PencilSimple size={12} /> Datos</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* Ops panel */}
              <div className="grid grid-rows-[auto_auto_minmax(0,1fr)] gap-3 min-h-0 overflow-hidden">
                <div className="card-tactical p-3">
                  <div className="font-heading font-bold flex items-center gap-2 text-sm"><Pulse size={16} className="text-[#00E676]" /> Sincronizacion app móvil</div>
                  <div className="grid grid-cols-3 gap-2 mt-3 font-tel text-[11px] text-zinc-400">
                    <div className="rounded border border-white/10 p-2"><div className="text-white text-lg">{unitList.filter((u) => u.online).length}</div><div>online</div></div>
                    <div className="rounded border border-white/10 p-2"><div className="text-white text-lg">{unitList.length}</div><div>apps</div></div>
                    <div className="rounded border border-white/10 p-2"><div className="text-white text-lg">{alerts.length}</div><div>alertas</div></div>
                  </div>
                  <p className="text-[11px] text-zinc-500 mt-2">Cada telemetría recibida desde la app móvil actualiza este tablero por WebSocket y conserva la misma ruta/color del conductor.</p>
                </div>
                {selectedUnit && (
                  <div className="card-tactical p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0"><div className="font-heading font-bold truncate">{selectedUnit.name}</div><div className="text-xs text-zinc-500 truncate">{selectedUnit.driver_name} · {selectedUnit.plate}</div></div>
                      <span className="w-4 h-4 rounded-full border border-white/30 shrink-0" style={{ background: getDriverColor(selectedUnit) }} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mt-3 font-tel text-[11px] text-zinc-400">
                      <div className="flex items-center gap-1"><Crosshair size={12} /> {selectedUnit.lat?.toFixed(4)}, {selectedUnit.lng?.toFixed(4)}</div>
                      <div className="flex items-center gap-1"><ClockCounterClockwise size={12} /> {lastSyncText}</div>
                      <div>{selectedUnit.speed?.toFixed(0)} km/h</div>
                      <div>ruta {Math.round((selectedRouteInfo?.distance_m || 0) / 1000) || "--"} km</div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </section>

          <aside className="min-h-0 grid grid-rows-[minmax(280px,1fr)_minmax(220px,0.7fr)] gap-3 overflow-hidden">
            {/* Alert panel */}
            <div data-testid="alert-panel" className="card-tactical flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-white/10 flex items-center justify-between shrink-0">
                <span className="font-heading font-bold flex items-center gap-2"><Siren size={18} className="text-[#FF2A2A]" weight="fill" /> Alertas activas</span>
                <span className="font-tel text-sm text-zinc-500">{alerts.length}</span>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {alerts.length === 0 && <p className="text-zinc-600 text-sm text-center mt-8 font-tel">Sin alertas · Gestion por excepcion</p>}
                {alerts.map((a) => {
                  const Icon = ALERT_ICON[a.type] || Warning;
                  const col = a.severity === "critical" ? "#FF2A2A" : "#FFB800";
                  return (
                    <div key={a.id} data-testid={`alert-${a.id}`}
                      className={`p-3 rounded-md border bg-[#0d0d0d] ${a.severity === "critical" ? "border-[#FF2A2A]/40 pulse-critical" : "border-[#FFB800]/30"}`}>
                      <div className="flex items-start gap-2">
                        <Icon size={18} weight="fill" style={{ color: col }} className="mt-0.5 shrink-0" />
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-tel font-semibold text-sm">{a.unit_name}</span>
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded" style={{ color: col, background: `${col}1a` }}>{a.type}</span>
                          </div>
                          <p className="text-xs text-zinc-400 mt-1">{a.message}</p>
                          <div className="flex gap-2 mt-2">
                            <button data-testid={`broadcast-${a.id}`} onClick={() => broadcastAlert(a)} className="text-[11px] flex items-center gap-1 text-[#007AFF] hover:underline"><Broadcast size={13} /> Difundir</button>
                            <button data-testid={`chat-${a.id}`} onClick={() => { setSelected(a.unit_id); setChatOpen(true); }} className="text-[11px] flex items-center gap-1 text-zinc-400 hover:text-white"><ChatCircleDots size={13} /> Chat</button>
                            <button data-testid={`resolve-${a.id}`} onClick={() => resolveAlert(a.id)} className="text-[11px] flex items-center gap-1 text-zinc-400 hover:text-white ml-auto"><X size={13} /> Resolver</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Crossings */}
            <div data-testid="crossings-panel" className="card-tactical flex flex-col min-h-0">
              <div className="px-4 py-3 border-b border-white/10 font-heading font-bold flex items-center gap-2 shrink-0"><Bridge size={18} weight="duotone" className="text-[#007AFF]" /> Cruce transfronterizo</div>
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                <div className="text-xs text-zinc-500 mb-2 font-tel">Espera fiscal registrada (min)</div>
                {(!stats?.recent_crossings || stats.recent_crossings.length === 0) && <p className="text-zinc-600 text-sm font-tel">Sin cruces registrados aun.</p>}
                {stats?.recent_crossings?.map((c) => (
                  <div key={c.id} className="p-2.5 rounded-md border border-white/10 bg-[#0d0d0d]">
                    <div className="flex items-center justify-between">
                      <span className="font-tel font-semibold text-sm">{c.unit_name}</span>
                      <span className="font-tel text-lg font-semibold text-[#007AFF]">{c.minutes}m</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate">{c.bridge}</div>
                  </div>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </main>

      {/* Floating secure chat */}
      <div className="fixed right-4 bottom-4 z-[1800]">
        {chatOpen && (
          <div className="mb-3 w-[min(92vw,760px)] h-[min(76vh,560px)] card-tactical shadow-2xl grid grid-cols-[250px_minmax(0,1fr)] overflow-hidden">
            <div className="border-r border-white/10 flex flex-col min-w-0">
              <div className="px-3 py-3 border-b border-white/10 flex items-center justify-between">
                <span className="font-heading font-bold flex items-center gap-2"><ChatCircleDots size={18} /> Chats seguros</span>
                <button onClick={() => setChatOpen(false)} className="text-zinc-500 hover:text-white"><X size={16} /></button>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {helpdeskUnits.map((u) => (
                  <button key={u.id} onClick={() => setSelected(u.id)} className={`w-full text-left p-2.5 rounded-md border transition-colors ${selected === u.id ? "border-white/40 bg-white/5" : "border-white/10 hover:border-white/25"}`}>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-tel font-semibold text-sm truncate flex items-center gap-2"><span className="w-2 h-2 rounded-full" style={{ background: getDriverColor(u) }} />{u.name}</span>
                      <span className="text-[10px] font-tel" style={{ color: STATUS_COLOR[u.status] }}>{STATUS_LABEL[u.status]}</span>
                    </div>
                    <div className="text-[11px] text-zinc-500 truncate mt-1">{u.driver_name || "Conductor"}</div>
                  </button>
                ))}
              </div>
            </div>
            <div className="flex flex-col min-w-0">
              <div className="px-4 py-3 border-b border-white/10 font-heading font-bold flex items-center justify-between shrink-0">
                <span className="truncate">{selectedUnit ? `Chat seguro · ${selectedUnit.name}` : "Selecciona un chat"}</span>
                {selectedUnit && <span className="font-tel text-xs shrink-0" style={{ color: STATUS_COLOR[selectedUnit.status] }}>{STATUS_LABEL[selectedUnit.status]}</span>}
              </div>
              {!selected ? (
                <div className="flex-1 flex items-center justify-center text-zinc-600 text-sm">Selecciona una conversación para empezar</div>
              ) : (
                <>
                  <div className="flex-1 overflow-y-auto p-3 space-y-2">
                    {chat.map((m) => (
                      <div key={m.id} className={`flex ${m.sender === "base" ? "justify-end" : "justify-start"}`}>
                        <div className={`max-w-[75%] px-3 py-2 rounded-md text-sm ${m.sender === "base" ? "bg-white text-black" : "bg-[#1a1a1a] text-white border border-white/10"}`}>
                          {m.text}
                          {m.quick && <span className="block text-[9px] opacity-50 mt-0.5 font-tel">RESPUESTA RAPIDA</span>}
                        </div>
                      </div>
                    ))}
                    <div ref={chatEndRef} />
                  </div>
                  <div className="p-3 border-t border-white/10 shrink-0">
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {["Tráfico detenido", "Retén militar", "Todo en orden", "Llamar a base"].map((q) => (
                        <button key={q} data-testid={`quick-${q}`} onClick={() => sendChat(q, true)}
                          className="text-[11px] px-2 py-1 rounded border border-white/10 text-zinc-400 hover:border-white/40 hover:text-white transition-colors">{q}</button>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <input data-testid="chat-input" value={chatText} onChange={(e) => setChatText(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && sendChat(chatText)} placeholder="Mensaje desde base…"
                        className="flex-1 bg-[#0d0d0d] border border-white/10 focus:border-white/40 rounded-md px-3 py-2 text-sm outline-none min-w-0" />
                      <button data-testid="chat-send" onClick={() => sendChat(chatText)} className="bg-white text-black px-3 rounded-md hover:bg-zinc-200"><PaperPlaneRight size={16} weight="fill" /></button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
        <button data-testid="floating-chat" onClick={() => { if (!selected && helpdeskUnits[0]) setSelected(helpdeskUnits[0].id); setChatOpen((v) => !v); }} className="ml-auto flex items-center gap-2 rounded-full bg-white text-black px-4 py-3 font-bold shadow-2xl hover:bg-zinc-200">
          <ChatCircleDots size={22} weight="fill" /> Chat seguro
          {alerts.length > 0 && <span className="rounded-full bg-[#FF2A2A] text-white text-[10px] px-1.5 py-0.5">{alerts.length}</span>}
        </button>
      </div>

      {userModal && (
        <div className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-tactical w-full max-w-2xl p-4">
            <div className="flex justify-between items-center mb-4"><h2 className="font-heading font-bold">{userModal === "create" ? "Crear conductor" : "Modificar datos del conductor"}</h2><button onClick={() => setUserModal(null)}><X /></button></div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {[['name','Unidad'],['driver_name','Nombre'],['plate','Placas'],['imei','IMEI'],['email','Correo'],['password','Contraseña'],['phone','Numero']].map(([key,label]) => (
                <label key={key} className="text-xs text-zinc-400">{label}<input type={key === 'password' ? 'password' : 'text'} value={unitForm[key]} onChange={(e) => setUnitForm((f) => ({ ...f, [key]: e.target.value }))} className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded px-3 py-2 text-white outline-none focus:border-white/40" /></label>
              ))}
              <label className="text-xs text-zinc-400">Color asignado<input type="color" value={unitForm.color} onChange={(e) => setUnitForm((f) => ({ ...f, color: e.target.value }))} className="mt-1 w-full h-10 bg-[#0d0d0d] border border-white/10 rounded" /></label>
            </div>
            <button onClick={saveUser} className="mt-4 bg-white text-black px-4 py-2 rounded-md flex items-center gap-2"><FloppyDisk size={16} /> Guardar</button>
          </div>
        </div>
      )}

      {routeModal && (
        <div className="fixed inset-0 z-[2000] bg-black/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="card-tactical w-full max-w-4xl p-4">
            <div className="flex justify-between items-center mb-3"><h2 className="font-heading font-bold">Asignar ruta: {units[routeModal]?.name}</h2><button onClick={() => setRouteModal(null)}><X /></button></div>
            <p className="text-xs text-zinc-500 mb-2">Haz click en el mapa para seleccionar origen y destino. Al guardar, el servidor calcula la ruta real por calles y la comparte con la app móvil y la web en tiempo real.</p>
            <div className="h-[420px] rounded-md overflow-hidden border border-white/10"><RoutePickerMap points={routePoints} color={units[routeModal]?.color || '#00E676'} onChange={setRoutePoints} /></div>
            <div className="flex flex-wrap items-end gap-3 mt-3">
              <label className="text-xs text-zinc-400">Tolerancia (m)<input type="number" min="50" value={routeTolerance} onChange={(e) => setRouteTolerance(e.target.value)} className="mt-1 w-36 bg-[#0d0d0d] border border-white/10 rounded px-3 py-2 text-white" /></label>
              <button onClick={() => setRoutePoints([])} className="px-3 py-2 rounded border border-white/10 text-zinc-300">Limpiar puntos</button>
              <button onClick={saveRoute} className="bg-white text-black px-4 py-2 rounded-md flex items-center gap-2"><FloppyDisk size={16} /> Guardar ruta</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
