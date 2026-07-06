import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  X, Key, Copy, Eye, EyeSlash, Plus, Monitor, Truck,
  CheckCircle, CurrencyCircleDollar, CalendarBlank, Clock,
  ArrowClockwise,
} from "@phosphor-icons/react";

const PLANS = [
  { id: "bronce", name: "Plan Bronce", devices: 10, prices: { Semanal: 650, Mensual: 2200, Bimestral: 4000, Trimestral: 5400, Anual: 18000 } },
  { id: "plata", name: "Plan Plata", devices: 25, prices: { Semanal: 1500, Mensual: 5000, Bimestral: 9000, Trimestral: 12000, Anual: 39600 } },
  { id: "oro", name: "Plan Oro", devices: 50, prices: { Semanal: 2750, Mensual: 9000, Bimestral: 16500, Trimestral: 22500, Anual: 72000 } },
];

const CYCLES = ["Semanal", "Mensual", "Bimestral", "Trimestral", "Anual"];
const mx = (n) => `$${n.toLocaleString("es-MX")} MXN`;

export default function TokenManager({ onClose }) {
  const [tokens, setTokens] = useState([]);
  const [monitorTokens, setMonitorTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMon, setShowMon] = useState(true);
  const [showDrv, setShowDrv] = useState(true);
  const [createMode, setCreateMode] = useState(null);
  const [form, setForm] = useState({ name: "", count: 1, max_uses: "", plan_id: "plata", cycle: "Mensual" });
  const [revealed, setRevealed] = useState({});

  useEffect(() => { loadTokens(); }, []);

  const loadTokens = async () => {
    try {
      const { data } = await api.get("/auth/site-tokens");
      setTokens(data);
      setMonitorTokens(data.filter((t) => t.role === "monitorista"));
    } catch {
      toast.error("No se pudieron cargar los tokens");
    } finally {
      setLoading(false);
    }
  };

  const toggleToken = async (tid) => {
    await api.patch(`/auth/site-tokens/${tid}`);
    setTokens((prev) => prev.map((t) => t.token === tid ? { ...t, active: !t.active } : t));
    toast.success("Token actualizado");
  };

  const renewToken = async (tid) => {
    try {
      const { data } = await api.post(`/auth/renew-token/${tid}`);
      setTokens((prev) => prev.map((t) => t.token === tid ? { ...t, expires_at: data.expires_at, expired: false, active: true } : t));
      toast.success(`Suscripción renovada hasta ${new Date(data.expires_at).toLocaleDateString("es-MX")}`);
    } catch {
      toast.error("Error al renovar");
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
          max_uses: form.max_uses ? Number(form.max_uses) : null,
        });
        setTokens((prev) => [
          { ...data, use_count: 0, active: true, drivers_used: 0, expired: false, created_at: new Date().toISOString() },
          ...prev,
        ]);
        toast.success(`Token monitorista ${form.plan_id.toUpperCase()} creado — ${selectedPlan?.name} (${selectedPlan?.devices} conductores)`);
      } else {
        const selectedMon = monitorTokens.find((m) => m.token === form.parent_token);
        const { data } = await api.post("/auth/driver-tokens", {
          count: Number(form.count) || 1,
          parent_token: form.parent_token || undefined,
          max_uses: form.max_uses ? Number(form.max_uses) : 1,
        });
        data.tokens.forEach((t) => {
          setTokens((prev) => [
            { ...t, active: true, use_count: 0, max_uses: 1, role: "conductor", parent_token: form.parent_token, created_at: new Date().toISOString() },
            ...prev,
          ]);
        });
        // Update parent driver count in state
        if (selectedMon) {
          setTokens((prev) => prev.map((t) =>
            t.token === form.parent_token
              ? { ...t, drivers_used: (t.drivers_used || 0) + Number(form.count) }
              : t
          ));
        }
        toast.success(`${data.tokens.length} token(s) de conductor creados`);
      }
      setCreateMode(null);
      setForm({ name: "", count: 1, max_uses: "", plan_id: "plata", cycle: "Mensual", parent_token: monitorTokens[0]?.token || "" });
    } catch (err) {
      const msg = err.response?.data?.detail || "Error al crear token";
      toast.error(msg);
    }
  };

  const selectedPlan = PLANS.find((p) => p.id === form.plan_id);
  const price = selectedPlan?.prices?.[form.cycle] || 0;

  // Refresh monitor tokens when tokens change
  useEffect(() => {
    setMonitorTokens(tokens.filter((t) => t.role === "monitorista" && t.active && !t.expired));
  }, [tokens]);

  const filtered = tokens.filter((t) => {
    if (t.role === "monitorista" && !showMon) return false;
    if (t.role === "conductor" && !showDrv) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
      <div className="card-tactical w-full max-w-5xl max-h-[90vh] flex flex-col rounded-xl fade-up" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
        <div className="flex items-center justify-between p-5 border-b border-white/10 shrink-0">
          <h2 className="font-heading font-bold text-lg flex items-center gap-2">
            <Key size={18} weight="fill" /> Gestión de Tokens
          </h2>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs font-tel">
              <button onClick={() => setShowMon(!showMon)}
                className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${showMon ? "border-white/20 bg-white/5 text-white" : "border-white/5 text-zinc-600"}`}>
                <Monitor size={13} /> Monitoristas
              </button>
              <button onClick={() => setShowDrv(!showDrv)}
                className={`px-2.5 py-1.5 rounded-lg border transition-all flex items-center gap-1.5 ${showDrv ? "border-white/20 bg-white/5 text-white" : "border-white/5 text-zinc-600"}`}>
                <Truck size={13} /> Conductores
              </button>
            </div>
            <button onClick={() => setCreateMode("monitorista")} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-white text-black font-bold flex items-center gap-1.5 hover:bg-zinc-200 transition-all">
              <Plus size={13} weight="bold" /> Nuevo Monitorista
            </button>
            {monitorTokens.length > 0 && (
              <button onClick={() => { setForm((f) => ({ ...f, parent_token: monitorTokens[0]?.token })); setCreateMode("conductor"); }}
                className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#007AFF] text-white font-bold flex items-center gap-1.5 hover:bg-[#3399FF] transition-all">
                <Plus size={13} weight="bold" /> Nuevo Conductor
              </button>
            )}
            <button onClick={onClose} className="w-8 h-8 rounded-lg border border-white/10 flex items-center justify-center text-zinc-400 hover:text-white hover:border-white/30 transition-all">
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-white/20 border-t-white rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-3 text-zinc-600">
              <Key size={32} className="text-zinc-700" />
              <p className="text-sm font-tel">No hay tokens que mostrar</p>
            </div>
          ) : (
            filtered.map((t) => {
              const isMon = t.role === "monitorista";
              const col = isMon ? "#FF2A2A" : "#007AFF";
              const roleLabel = isMon ? "Monitorista" : "Conductor";
              const expired = t.expired || false;
              const maxDrivers = t.max_drivers || 0;
              const driversUsed = t.drivers_used || 0;
              const driversPct = maxDrivers > 0 ? Math.round((driversUsed / maxDrivers) * 100) : 0;
              return (
                <div key={t.token} className={`p-3 rounded-xl border transition-all ${!t.active || expired ? "border-white/5 opacity-50" : "border-white/10 hover:border-white/20"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: expired ? "#52525B" : col }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-tel font-semibold text-sm">{t.name || "Sin nombre"}</span>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-tel font-bold" style={{ color: col, background: `${col}1a` }}>{roleLabel}</span>
                          {expired && (
                            <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-tel font-bold bg-zinc-800 text-zinc-400">
                              Expirado
                            </span>
                          )}
                          {t.plan_name && (
                            <span className="text-[10px] font-tel text-zinc-500 bg-white/5 px-1.5 py-0.5 rounded">{t.plan_name}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-2 mt-0.5">
                          <code className="font-tel text-[11px] text-zinc-400 bg-black/30 px-2 py-0.5 rounded">
                            {revealed[t.token] ? t.token : `${t.token.slice(0, 16)}...`}
                          </code>
                          <button onClick={() => setRevealed((r) => ({ ...r, [t.token]: !r[t.token] }))}
                            className="text-zinc-500 hover:text-white transition-colors">
                            {revealed[t.token] ? <EyeSlash size={13} /> : <Eye size={13} />}
                          </button>
                          <button onClick={() => copyToken(t.token)}
                            className="text-zinc-500 hover:text-white transition-colors">
                            <Copy size={13} />
                          </button>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 font-tel text-[11px] text-zinc-500 shrink-0">
                      {isMon && maxDrivers > 0 && (
                        <div className="flex flex-col items-end gap-0.5 min-w-[80px]">
                          <span className="flex items-center gap-1"><Truck size={11} /> {driversUsed}/{maxDrivers}</span>
                          <div className="w-full h-1 bg-white/5 rounded-full overflow-hidden">
                            <div className="h-full rounded-full transition-all" style={{ width: `${Math.min(100, driversPct)}%`, background: driversPct >= 90 ? "#FF2A2A" : driversPct >= 70 ? "#FFB800" : "#00E676" }} />
                          </div>
                        </div>
                      )}
                      {t.expires_at && (
                        <span className={`flex items-center gap-1 ${expired ? "text-[#FF2A2A]" : "text-zinc-400"}`}>
                          <CalendarBlank size={11} />
                          {new Date(t.expires_at).toLocaleDateString("es-MX")}
                        </span>
                      )}
                      <span>{t.use_count ?? 0}/{t.max_uses ?? "∞"}</span>
                      {t.unit_id && <span className="flex items-center gap-1"><Truck size={11} /> Vinculado</span>}
                      {t.device_id && <span className="flex items-center gap-1"><CheckCircle size={11} className="text-[#00E676]" /> Activo</span>}
                      {isMon && expired && (
                        <button onClick={() => renewToken(t.token)}
                          className="px-2 py-1 rounded-lg border border-[#FFB800]/30 text-[#FFB800] text-[10px] font-bold uppercase tracking-wider hover:bg-[#FFB800]/5 transition-all flex items-center gap-1">
                          <ArrowClockwise size={11} /> Renovar
                        </button>
                      )}
                      <button onClick={() => toggleToken(t.token)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${t.active && !expired ? "border-[#00E676]/30 text-[#00E676] hover:bg-[#00E676]/5" : "border-zinc-700 text-zinc-600 hover:border-zinc-500"}`}>
                        {t.active ? "Activo" : "Inactivo"}
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {createMode && (
          <div className="border-t border-white/10 p-4 shrink-0 bg-black/20">
            <form onSubmit={createToken} className="flex flex-wrap items-end gap-3">
              {createMode === "monitorista" ? (
                <>
                  <label className="text-xs text-zinc-400 font-medium min-w-[160px]">
                    Nombre (opcional)
                    <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                      placeholder="Ej: Cliente ABC"
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
                  <label className="text-xs text-zinc-400 font-medium w-20">
                    Máx usos
                    <input value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                      placeholder="∞"
                      className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/40 transition-all font-tel" />
                  </label>
                  <div className="text-xs text-zinc-400 pb-1">
                    <div className="font-bold text-sm text-white">{selectedPlan?.name}</div>
                    <div className="flex items-center gap-1"><Truck size={12} /> {selectedPlan?.devices} conductores</div>
                    <div className="flex items-center gap-1 text-[#00E676]">
                      <CurrencyCircleDollar size={12} /> ${price.toLocaleString("es-MX")} MXN / {form.cycle.toLowerCase()}
                    </div>
                    <div className="flex items-center gap-1 text-zinc-500">
                      <Clock size={12} /> Vence en {form.cycle === "Semanal" ? "7 días" : form.cycle === "Mensual" ? "30 días" : form.cycle === "Bimestral" ? "60 días" : form.cycle === "Trimestral" ? "90 días" : "365 días"}
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
                      {monitorTokens.map((m) => {
                        const used = m.drivers_used || 0;
                        const maxD = m.max_drivers || 0;
                        const remaining = maxD - used;
                        return (
                          <option key={m.token} value={m.token} disabled={remaining <= 0}>
                            {m.name} — {used}/{maxD} conductores {remaining > 0 ? `(${remaining} disponibles)` : "(completo)"}
                          </option>
                        );
                      })}
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
