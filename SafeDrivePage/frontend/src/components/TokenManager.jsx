import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  X, Key, Copy, Eye, EyeSlash, Plus, Monitor, Truck,
  CheckCircle, CurrencyCircleDollar, CalendarBlank, Clock,
  ArrowClockwise, Trash, FunnelSimple, MagnifyingGlass,
  CaretDown, Warning,
} from "@phosphor-icons/react";

const PLANS = [
  { id: "bronce", name: "Plan Bronce", devices: 10, prices: { Semanal: 650, Mensual: 2200, Bimestral: 4000, Trimestral: 5400, Anual: 18000 } },
  { id: "plata", name: "Plan Plata", devices: 25, prices: { Semanal: 1500, Mensual: 5000, Bimestral: 9000, Trimestral: 12000, Anual: 39600 } },
  { id: "oro", name: "Plan Oro", devices: 50, prices: { Semanal: 2750, Mensual: 9000, Bimestral: 16500, Trimestral: 22500, Anual: 72000 } },
];

const CYCLES = ["Semanal", "Mensual", "Bimestral", "Trimestral", "Anual"];
const mx = (n) => `$${n.toLocaleString("es-MX")} MXN`;

export default function TokenManager({ onClose, userRole, readOnly }) {
  const [tokens, setTokens] = useState([]);
  const [monitorToken, setMonitorToken] = useState(null);
  const [conductorTokens, setConductorTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [createMode, setCreateMode] = useState(null);
  const [form, setForm] = useState({ name: "", count: 1, plan_id: "plata", cycle: "Mensual" });
  const [revealed, setRevealed] = useState({});
  const [confirmDelete, setConfirmDelete] = useState(null);
  const [deleting, setDeleting] = useState(false);
  const [filterRole, setFilterRole] = useState("all");
  const [filterActive, setFilterActive] = useState("all");
  const [search, setSearch] = useState("");

  const isSuperAdmin = userRole === "superadmin";
  const canCreate = isSuperAdmin && !readOnly;

  const loadTokens = async () => {
    try {
      if (isSuperAdmin) {
        const { data } = await api.get("/auth/site-tokens");
        setTokens(data);
        setMonitorToken(data.find((t) => t.role === "monitorista") || null);
        setConductorTokens(data.filter((t) => t.role === "conductor"));
      } else {
        const { data } = await api.get("/auth/company-token-overview");
        setMonitorToken(data.monitor_token || null);
        setConductorTokens(data.conductor_tokens || []);
      }
    } catch {
      toast.error("No se pudieron cargar los tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTokens(); }, []); // eslint-disable-line

  const toggleToken = async (tid) => {
    await api.patch(`/auth/site-tokens/${tid}`);
    if (monitorToken?.token === tid) {
      setMonitorToken((prev) => prev ? { ...prev, active: !prev.active } : prev);
    } else {
      setConductorTokens((prev) => prev.map((t) => t.token === tid ? { ...t, active: !t.active } : t));
    }
    toast.success("Token actualizado");
  };

  const renewToken = async (tid) => {
    try {
      const { data } = await api.post(`/auth/renew-token/${tid}`);
      setMonitorToken((prev) => prev ? { ...prev, expires_at: data.expires_at, expired: false, active: true } : prev);
      toast.success(`Suscripción renovada hasta ${new Date(data.expires_at).toLocaleDateString("es-MX")}`);
    } catch {
      toast.error("Error al renovar");
    }
  };

  const handleDelete = async (tid) => {
    setDeleting(true);
    try {
      await api.delete(`/auth/site-tokens/${tid}`);
      setConductorTokens((prev) => prev.filter((t) => t.token !== tid));
      toast.success("Token eliminado");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Error al eliminar token");
    } finally {
      setDeleting(false);
      setConfirmDelete(null);
    }
  };

  const copyToken = (tok) => {
    navigator.clipboard?.writeText(tok);
    toast.success("Token copiado");
  };

  const createToken = async (e) => {
    e.preventDefault();
    if (!createMode) return;
    try {
      if (createMode === "monitorista") {
        const { data } = await api.post("/auth/site-tokens", {
          name: form.name.trim() || `${form.plan_id.toUpperCase()} - ${form.cycle}`,
          role: "monitorista",
          plan_id: form.plan_id,
          cycle: form.cycle,
        });
        setMonitorToken({ ...data, active: true, drivers_used: 0, expired: false });
        toast.success(`Token monitorista creado — ${form.plan_id.toUpperCase()}`);
      } else {
        const { data } = await api.post("/auth/driver-tokens", {
          count: Number(form.count) || 1,
          parent_token: form.parent_token || undefined,
        });
        const newDrivers = data.tokens.map((t) => ({ ...t, active: true, role: "conductor", parent_token: form.parent_token }));
        setConductorTokens((prev) => [...newDrivers, ...prev]);
        if (monitorToken) {
          setMonitorToken((prev) => prev ? { ...prev, drivers_used: (prev.drivers_used || 0) + Number(form.count) } : prev);
        }
        toast.success(`${data.tokens.length} token(s) de conductor creados`);
      }
      setCreateMode(null);
      setForm({ name: "", count: 1, plan_id: "plata", cycle: "Mensual", parent_token: "" });
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al crear token";
      toast.error(msg);
    }
  };

  const selectedPlan = PLANS.find((p) => p.id === form.plan_id);
  const price = selectedPlan?.prices?.[form.cycle] || 0;

  // Filter conductor tokens
  const filteredConductors = conductorTokens.filter((t) => {
    if (filterActive === "active" && !t.active) return false;
    if (filterActive === "inactive" && t.active) return false;
    if (search && !t.name?.toLowerCase().includes(search.toLowerCase()) && !t.token?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const driversPct = monitorToken?.max_drivers > 0
    ? Math.round(((monitorToken.drivers_used || 0) / monitorToken.max_drivers) * 100)
    : 0;

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
      <div className="card-tactical w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl fade-up" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <Key size={18} weight="fill" /> Gestión de Tokens
          </h2>
          <div className="flex items-center gap-3">
            {canCreate && !monitorToken && (
              <button onClick={() => setCreateMode("monitorista")} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white text-black font-bold flex items-center gap-1.5 hover:bg-zinc-200 transition-all">
                <Plus size={13} weight="bold" /> Nuevo Monitorista
              </button>
            )}
            {canCreate && monitorToken && (
              <button onClick={() => { setForm((f) => ({ ...f, parent_token: monitorToken.token })); setCreateMode("conductor"); }}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#007AFF] text-white font-bold flex items-center gap-1.5 hover:bg-[#3399FF] transition-all">
                <Plus size={13} weight="bold" /> Nuevo Conductor
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* ── Highlighted Company Monitor Token ── */}
              {monitorToken && (
                <div className={`relative overflow-hidden rounded-xl border-2 transition-all ${
                  monitorToken.active && !monitorToken.expired
                    ? "border-amber-500/40 bg-gradient-to-br from-amber-500/10 via-transparent to-amber-600/5 shadow-lg shadow-amber-500/10"
                    : "border-zinc-700/50 bg-zinc-900/60 opacity-70"
                }`}>
                  {monitorToken.active && !monitorToken.expired && (
                    <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/10 rounded-full -translate-y-1/2 translate-x-1/2 blur-2xl" />
                  )}
                  <div className="p-4 relative z-10">
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          <Monitor size={20} weight="fill" className="text-amber-400" />
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-heading font-bold text-base">{monitorToken.name || "Token de empresa"}</span>
                            <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-amber-500/20 text-amber-400">Monitorista Único</span>
                            {monitorToken.expired && (
                              <span className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded font-bold bg-red-500/20 text-red-400">Expirado</span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-500 mt-0.5">Token único de la empresa — Compártelo con el monitorista</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        {monitorToken.expired && (
                          <button onClick={() => renewToken(monitorToken.token)}
                            className="px-3 py-1.5 rounded-lg border border-amber-500/30 text-amber-400 text-[10px] font-bold uppercase tracking-wider hover:bg-amber-500/10 transition-all flex items-center gap-1">
                            <ArrowClockwise size={11} /> Renovar
                          </button>
                        )}
                        <button onClick={() => toggleToken(monitorToken.token)}
                          className={`px-3 py-1.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                            monitorToken.active && !monitorToken.expired
                              ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                              : "border-zinc-700 text-zinc-500"
                          }`}>
                          {monitorToken.active ? "Activo" : "Inactivo"}
                        </button>
                      </div>
                    </div>

                    {/* Token code */}
                    <div className="flex items-center gap-2 mb-3">
                      <code className="font-mono text-sm bg-black/40 px-3 py-1.5 rounded-lg border border-white/10 select-all">
                        {revealed[monitorToken.token] ? monitorToken.token : `${monitorToken.token.slice(0, 24)}...`}
                      </code>
                      <button onClick={() => setRevealed((r) => ({ ...r, [monitorToken.token]: !r[monitorToken.token] }))}
                        className="text-zinc-500 hover:text-white transition-colors p-1">
                        {revealed[monitorToken.token] ? <EyeSlash size={14} /> : <Eye size={14} />}
                      </button>
                      <button onClick={() => copyToken(monitorToken.token)}
                        className="text-zinc-500 hover:text-white transition-colors p-1">
                        <Copy size={14} />
                      </button>
                    </div>

                    {/* Plan info grid */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Plan</span>
                        <p className="text-sm font-semibold mt-0.5">{monitorToken.plan_name || "Sin plan"}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Ciclo</span>
                        <p className="text-sm font-semibold mt-0.5">{monitorToken.cycle || "—"}</p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Vence</span>
                        <p className={`text-sm font-semibold mt-0.5 ${monitorToken.expired ? "text-red-400" : ""}`}>
                          {monitorToken.expires_at ? new Date(monitorToken.expires_at).toLocaleDateString("es-MX") : "—"}
                        </p>
                      </div>
                      <div className="bg-black/30 rounded-lg p-2.5 border border-white/5">
                        <span className="text-[10px] text-zinc-500 uppercase tracking-wider font-bold">Conductores</span>
                        <p className="text-sm font-semibold mt-0.5 flex items-center gap-1">
                          <Truck size={12} /> {monitorToken.drivers_used || 0}/{monitorToken.max_drivers || "∞"}
                        </p>
                      </div>
                    </div>

                    {/* Driver usage bar */}
                    {monitorToken.max_drivers > 0 && (
                      <div className="mt-3">
                        <div className="w-full h-2 bg-black/40 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-500"
                            style={{
                              width: `${Math.min(100, driversPct)}%`,
                              background: driversPct >= 90 ? "#FF2A2A" : driversPct >= 70 ? "#FFB800" : "#00E676",
                            }} />
                        </div>
                        <p className="text-[11px] text-zinc-500 mt-1">
                          {monitorToken.max_drivers - (monitorToken.drivers_used || 0)} lugares disponibles de {monitorToken.max_drivers}
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {!monitorToken && !isSuperAdmin && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-600">
                  <Warning size={32} className="text-zinc-700" />
                  <p className="text-sm font-tel">No hay token de monitorista asignado a esta empresa</p>
                  <p className="text-xs text-zinc-700">Contacta al administrador para configurar la suscripción</p>
                </div>
              )}

              {!monitorToken && isSuperAdmin && (
                <div className="flex flex-col items-center justify-center py-12 gap-3 text-zinc-600">
                  <Key size={32} className="text-zinc-700" />
                  <p className="text-sm font-tel">No hay token de monitorista para tu empresa</p>
                  <button onClick={() => setCreateMode("monitorista")}
                    className="mt-2 px-4 py-2 rounded-lg bg-white text-black font-bold text-sm hover:bg-zinc-200 transition-all flex items-center gap-2">
                    <Plus size={14} weight="bold" /> Crear primer token
                  </button>
                </div>
              )}

              {/* ── Conductor Tokens Section ── */}
              {monitorToken && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-heading font-bold text-sm flex items-center gap-2">
                      <Truck size={16} className="text-[#007AFF]" />
                      Tokens de conductores ({conductorTokens.length})
                    </h3>
                    <div className="flex items-center gap-2">
                      {/* Search */}
                      <div className="relative">
                        <MagnifyingGlass size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-zinc-500" />
                        <input type="text" value={search} onChange={(e) => setSearch(e.target.value)}
                          placeholder="Buscar..."
                          className="w-32 bg-[#0d0d0d] border border-white/10 rounded-lg pl-7 pr-2 py-1.5 text-[11px] text-white outline-none focus:border-white/30 transition-all placeholder-zinc-600 font-tel" />
                      </div>
                      {/* Filter active */}
                      <select value={filterActive} onChange={(e) => setFilterActive(e.target.value)}
                        className="bg-[#0d0d0d] border border-white/10 rounded-lg px-2 py-1.5 text-[11px] text-white outline-none focus:border-white/30 transition-all font-tel">
                        <option value="all">Todos</option>
                        <option value="active">Activos</option>
                        <option value="inactive">Inactivos</option>
                      </select>
                    </div>
                  </div>

                  {filteredConductors.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-8 gap-2 text-zinc-600">
                      <Truck size={24} className="text-zinc-700" />
                      <p className="text-sm font-tel">
                        {conductorTokens.length === 0
                          ? "No hay tokens de conductores generados"
                          : "Ningún token coincide con los filtros"}
                      </p>
                      {canCreate && conductorTokens.length === 0 && (
                        <button onClick={() => { setForm((f) => ({ ...f, parent_token: monitorToken.token })); setCreateMode("conductor"); }}
                          className="mt-2 px-3 py-1.5 rounded-lg bg-[#007AFF] text-white font-bold text-[11px] hover:bg-[#3399FF] transition-all flex items-center gap-1.5">
                          <Plus size={12} weight="bold" /> Generar tokens
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="space-y-1.5">
                      {filteredConductors.map((t) => {
                        const inUse = !!t.device_id || !!t.driver_id;
                        return (
                          <div key={t.token}
                            className={`p-3 rounded-xl border transition-all flex items-center justify-between gap-3 ${
                              t.active ? "border-white/10 hover:border-white/20" : "border-white/5 opacity-50"
                            }`}>
                            <div className="flex items-center gap-2.5 min-w-0 flex-1">
                              <span className={`w-2 h-2 rounded-full shrink-0 ${inUse ? "bg-emerald-400" : "bg-zinc-500"}`} />
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-tel font-semibold text-sm">{t.name || "Sin nombre"}</span>
                                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                                    inUse ? "bg-emerald-500/15 text-emerald-400" : "bg-zinc-700/50 text-zinc-400"
                                  }`}>
                                    {inUse ? "En uso" : "Disponible"}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <code className="font-tel text-[11px] text-zinc-400 bg-black/30 px-2 py-0.5 rounded">
                                    {revealed[t.token] ? t.token : `${t.token.slice(0, 16)}...`}
                                  </code>
                                  <button onClick={() => setRevealed((r) => ({ ...r, [t.token]: !r[t.token] }))}
                                    className="text-zinc-500 hover:text-white transition-colors">
                                    {revealed[t.token] ? <EyeSlash size={12} /> : <Eye size={12} />}
                                  </button>
                                  <button onClick={() => copyToken(t.token)}
                                    className="text-zinc-500 hover:text-white transition-colors">
                                    <Copy size={12} />
                                  </button>
                                </div>
                                {t.unit_info && (
                                  <p className="text-[10px] text-zinc-500 mt-0.5">
                                    {t.unit_info.name} · {t.unit_info.plate} {t.unit_info.driver_name ? `· ${t.unit_info.driver_name}` : ""}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex items-center gap-2 shrink-0">
                              <button onClick={() => toggleToken(t.token)}
                                className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${
                                  t.active
                                    ? "border-emerald-500/30 text-emerald-400 hover:bg-emerald-500/10"
                                    : "border-zinc-700 text-zinc-500"
                                }`}>
                                {t.active ? "Activo" : "Inactivo"}
                              </button>
                              {isSuperAdmin && confirmDelete !== t.token && (
                                <button onClick={() => setConfirmDelete(t.token)}
                                  className="px-2 py-1 rounded-lg border border-red-500/20 text-red-400 text-[10px] font-bold uppercase tracking-wider hover:bg-red-500/10 transition-all">
                                  <Trash size={10} /> 
                                </button>
                              )}
                              {confirmDelete === t.token && (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-[10px] text-red-400 font-bold">¿Eliminar?</span>
                                  <button onClick={() => handleDelete(t.token)} disabled={deleting}
                                    className="px-2 py-1 rounded-lg bg-red-500/20 text-red-400 text-[10px] font-bold hover:bg-red-500/30 transition-all">
                                    {deleting ? "..." : "Sí"}
                                  </button>
                                  <button onClick={() => setConfirmDelete(null)}
                                    className="px-2 py-1 rounded-lg border border-white/10 text-zinc-400 text-[10px] font-bold hover:border-white/30 transition-all">
                                    No
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </div>

        {/* ── Create Forms ── */}
        {createMode && canCreate && (
          <div className="border-t border-white/10 p-4 shrink-0 bg-black/20">
            <form onSubmit={createToken} className="flex flex-wrap items-end gap-3">
              {createMode === "monitorista" ? (
                <>
                  <label className="text-xs text-zinc-400 font-medium min-w-[160px]">
                    Nombre (opcional)
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Mi Empresa"
                      className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/40 transition-all font-tel" />
                  </label>
                  <label className="text-xs text-zinc-400 font-medium w-28">
                    Plan
                    <select value={form.plan_id} onChange={(e) => setForm((f) => ({ ...f, plan_id: e.target.value }))}
                      className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-white/40 transition-all font-tel">
                      {PLANS.map((p) => (
                        <option key={p.id} value={p.id}>{p.name} ({p.devices} conductores)</option>
                      ))}
                    </select>
                  </label>
                  <label className="text-xs text-zinc-400 font-medium w-24">
                    Ciclo
                    <select value={form.cycle} onChange={(e) => setForm((f) => ({ ...f, cycle: e.target.value }))}
                      className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-white/40 transition-all font-tel">
                      {CYCLES.map((c) => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </label>
                  <div className="text-xs text-zinc-400 pb-1">
                    <div className="font-bold text-sm text-white">{selectedPlan?.name}</div>
                    <div className="flex items-center gap-1"><Truck size={12} /> {selectedPlan?.devices} conductores</div>
                    <div className="flex items-center gap-1 text-[#00E676]">
                      <CurrencyCircleDollar size={12} /> ${price.toLocaleString("es-MX")} MXN / {form.cycle.toLowerCase()}
                    </div>
                  </div>
                  <button type="submit"
                    className="px-4 py-2.5 rounded-lg bg-white text-black font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all text-sm">
                    <CheckCircle size={16} weight="fill" /> Generar Token
                  </button>
                </>
              ) : (
                <>
                  <label className="text-xs text-zinc-400 font-medium min-w-[200px]">
                    Token monitorista (plan padre)
                    <select value={form.parent_token || ""} onChange={(e) => setForm((f) => ({ ...f, parent_token: e.target.value }))}
                      className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2.5 text-white text-sm outline-none focus:border-white/40 transition-all font-tel">
                      {monitorToken && (
                        <option value={monitorToken.token}>
                          {monitorToken.name} — {(monitorToken.drivers_used || 0)}/{monitorToken.max_drivers || "∞"} conductores
                        </option>
                      )}
                    </select>
                  </label>
                  <label className="text-xs text-zinc-400 font-medium w-28">
                    Cantidad
                    <input type="number" min="1" max="50" value={form.count}
                      onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                      className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/40 transition-all font-tel" />
                  </label>
                  <button type="submit"
                    className="px-4 py-2.5 rounded-lg bg-[#007AFF] text-white font-bold flex items-center gap-2 hover:bg-[#3399FF] transition-all text-sm">
                    <Truck size={16} weight="fill" /> Crear {form.count || 1} Conductor(es)
                  </button>
                </>
              )}
              <button type="button" onClick={() => setCreateMode(null)}
                className="px-4 py-2.5 rounded-lg border border-white/10 text-zinc-300 hover:border-white/30 transition-all text-sm">
                Cancelar
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}