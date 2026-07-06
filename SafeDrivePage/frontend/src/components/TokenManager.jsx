import { useEffect, useState } from "react";
import api from "@/lib/api";
import { toast } from "sonner";
import { X, Key, Copy, CheckCircle, Eye, EyeSlash, Plus, UserSwitch, Monitor, Truck } from "@phosphor-icons/react";

export default function TokenManager({ onClose }) {
  const [tokens, setTokens] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showMon, setShowMon] = useState(true);
  const [showDrv, setShowDrv] = useState(true);
  const [createMode, setCreateMode] = useState(null); // 'monitorista' | 'conductor'
  const [form, setForm] = useState({ name: "", count: 1, max_uses: "" });
  const [revealed, setRevealed] = useState({});

  const loadTokens = async () => {
    try {
      const { data } = await api.get("/auth/site-tokens");
      setTokens(data);
    } catch {
      toast.error("No se pudieron cargar los tokens");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTokens(); }, []);

  const toggleToken = async (tid) => {
    await api.patch(`/auth/site-tokens/${tid}`);
    setTokens((prev) => prev.map((t) => t.token === tid ? { ...t, active: !t.active } : t));
    toast.success("Token actualizado");
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
          name: form.name.trim(),
          max_uses: form.max_uses ? Number(form.max_uses) : null,
          role: "monitorista",
        });
        setTokens((prev) => [{ ...data, active: true, use_count: 0, max_uses: form.max_uses ? Number(form.max_uses) : null, role: "monitorista", created_at: new Date().toISOString() }, ...prev]);
        toast.success(`Token monitorista creado: ${data.token.slice(0, 12)}...`);
      } else {
        const { data } = await api.post("/auth/driver-tokens", {
          count: Number(form.count) || 1,
          max_uses: form.max_uses ? Number(form.max_uses) : null,
        });
        data.tokens.forEach((t) => {
          setTokens((prev) => [{ ...t, active: true, use_count: 0, max_uses: form.max_uses ? Number(form.max_uses) : 1, role: "conductor", created_at: new Date().toISOString() }, ...prev]);
        });
        toast.success(`${data.tokens.length} token(s) de conductor creados`);
      }
      setCreateMode(null);
      setForm({ name: "", count: 1, max_uses: "" });
    } catch {
      toast.error("Error al crear token");
    }
  };

  const filtered = tokens.filter((t) => {
    if (t.role === "monitorista" && !showMon) return false;
    if (t.role === "conductor" && !showDrv) return false;
    return true;
  });

  return (
    <div className="fixed inset-0 z-[2000] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 fade-in">
      <div className="card-tactical w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl fade-up" style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.5)" }}>
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
              <Plus size={13} weight="bold" /> Monitorista
            </button>
            <button onClick={() => setCreateMode("conductor")} className="text-[11px] px-2.5 py-1.5 rounded-lg bg-[#007AFF] text-white font-bold flex items-center gap-1.5 hover:bg-[#3399FF] transition-all">
              <Plus size={13} weight="bold" /> Conductor
            </button>
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
              return (
                <div key={t.token} className={`p-3 rounded-xl border transition-all ${t.active ? "border-white/10 hover:border-white/20" : "border-white/5 opacity-50"}`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0 flex-1">
                      <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: col }} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-tel font-semibold text-sm">{t.name || "Sin nombre"}</span>
                          <span className="text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded font-tel font-bold" style={{ color: col, background: `${col}1a` }}>{roleLabel}</span>
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
                      <span>{t.use_count ?? 0}/{t.max_uses ?? "∞"}</span>
                      {t.unit_id && <span className="flex items-center gap-1"><Truck size={11} /> Vinculado</span>}
                      {t.device_id && <span className="flex items-center gap-1"><CheckCircle size={11} className="text-[#00E676]" /> Activo</span>}
                      <button onClick={() => toggleToken(t.token)}
                        className={`px-2.5 py-1 rounded-lg border text-[10px] font-bold uppercase tracking-wider transition-all ${t.active ? "border-[#00E676]/30 text-[#00E676] hover:bg-[#00E676]/5" : "border-zinc-700 text-zinc-600 hover:border-zinc-500"}`}>
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
                <label className="text-xs text-zinc-400 font-medium flex-1 min-w-[200px]">
                  Nombre del token
                  <input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))} required
                    placeholder="Ej: Oficina NLD"
                    className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/40 transition-all font-tel" />
                </label>
              ) : (
                <label className="text-xs text-zinc-400 font-medium flex-1 min-w-[120px]">
                  Cantidad de tokens
                  <input type="number" min="1" max="100" value={form.count} onChange={(e) => setForm((f) => ({ ...f, count: e.target.value }))}
                    className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/40 transition-all font-tel" />
                </label>
              )}
              <label className="text-xs text-zinc-400 font-medium w-28">
                Máx. usos
                <input value={form.max_uses} onChange={(e) => setForm((f) => ({ ...f, max_uses: e.target.value }))}
                  placeholder="∞ si vacío"
                  className="mt-1 w-full bg-[#0d0d0d] border border-white/10 rounded-lg px-3 py-2 text-white text-sm outline-none focus:border-white/40 transition-all font-tel" />
              </label>
              <button type="submit"
                className="px-4 py-2.5 rounded-lg bg-white text-black font-bold flex items-center gap-2 hover:bg-zinc-200 transition-all text-sm">
                <CheckCircle size={16} weight="fill" /> Crear {createMode === "monitorista" ? "Monitorista" : "Conductor"}
              </button>
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
