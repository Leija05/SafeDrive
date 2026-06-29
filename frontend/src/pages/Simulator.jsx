import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "@/lib/api";
import { toast } from "sonner";
import {
  Truck, Siren, NavigationArrow, WifiSlash, Warning, ArrowLeft, Play, Pause, PaperPlaneRight, Lock,
} from "@phosphor-icons/react";

function interp(corridor, frac) {
  frac = Math.max(0, Math.min(1, frac));
  const n = corridor.length - 1;
  const pos = frac * n;
  const i = Math.min(Math.floor(pos), n - 1);
  const t = pos - i;
  const a = corridor[i], b = corridor[i + 1];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}

export default function Simulator() {
  const navigate = useNavigate();
  const [units, setUnits] = useState([]);
  const [unitId, setUnitId] = useState("");
  const [route, setRoute] = useState(null);
  const [driving, setDriving] = useState(false);
  const [progress, setProgress] = useState(0);
  const [speed, setSpeed] = useState(80);
  const [panic, setPanic] = useState(false);
  const [deviate, setDeviate] = useState(false);
  const [jammer, setJammer] = useState(false);
  const [chatText, setChatText] = useState("");
  const [pos, setPos] = useState([25.6866, -100.3161]);
  const tickRef = useRef(null);
  const stateRef = useRef({});

  stateRef.current = { unitId, route, progress, speed, panic, deviate, jammer };

  useEffect(() => {
    api.get("/units").then((r) => { setUnits(r.data); if (r.data[0]) setUnitId(r.data[0].id); });
    api.get("/route").then((r) => setRoute(r.data));
  }, []);

  const sendTelemetry = async (extra = {}) => {
    const s = stateRef.current;
    if (!s.unitId || !s.route) return;
    let [lat, lng] = interp(s.route.corridor, s.progress);
    if (s.deviate) { lat += 0.012; lng += 0.012; }
    setPos([lat, lng]);
    const payload = {
      unit_id: s.unitId, lat, lng, speed: s.speed, battery: 88,
      panic: s.panic, signal_lost: s.jammer, ...extra,
    };
    try { await api.post("/telemetry", payload); } catch (e) {}
  };

  // driving loop
  useEffect(() => {
    if (!driving) { clearInterval(tickRef.current); return; }
    tickRef.current = setInterval(() => {
      setProgress((p) => {
        const np = p + stateRef.current.speed / 3600 / 60; // fraction per 2s
        return np >= 1 ? 0 : np;
      });
    }, 2000);
    return () => clearInterval(tickRef.current);
  }, [driving]);

  useEffect(() => { if (driving) sendTelemetry(); }, [progress]); // eslint-disable-line

  const moving = driving && speed > 5;

  const trigger = async (type) => {
    if (type === "impact") { await sendTelemetry({ g_force: 3.6, g_duration_ms: 500 }); toast.error("Impacto enviado a central"); }
    if (type === "drop") { await sendTelemetry({ g_force: 4.0, g_duration_ms: 80 }); toast("Caida de celular (filtrada por el backend)"); }
    if (type === "panic") {
      setPanic(true);
      await sendTelemetry({ panic: true });
      toast.error("BOTON DE PANICO SILENCIOSO ACTIVADO");
      setTimeout(() => setPanic(false), 4000);
    }
  };

  const sendChat = async (text, quick) => {
    if (!unitId || !text.trim()) return;
    if (moving && !quick) { toast.error("Teclado bloqueado en movimiento — usa respuestas rapidas"); return; }
    await api.post("/chat", { unit_id: unitId, sender: "driver", text, quick: !!quick });
    setChatText("");
    toast.success("Mensaje enviado a base");
  };

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <header className="sticky top-0 z-10 bg-black/80 backdrop-blur-xl border-b border-white/10 h-16 flex items-center justify-between px-4">
        <button data-testid="sim-back-button" onClick={() => navigate("/dashboard")} className="flex items-center gap-2 text-zinc-400 hover:text-white text-sm"><ArrowLeft size={16} /> Dashboard</button>
        <span className="font-heading font-black tracking-tight">Simulador del Operador <span className="text-zinc-500 text-sm font-normal">(App movil)</span></span>
        <div className="w-20" />
      </header>

      <div className="max-w-xl mx-auto p-4 space-y-4">
        {/* unit select */}
        <div className="card-tactical p-4">
          <label className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500">Dispositivo enlazado (IMEI)</label>
          <select data-testid="sim-unit-select" value={unitId} onChange={(e) => setUnitId(e.target.value)}
            className="mt-2 w-full bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm font-tel outline-none focus:border-white/40">
            {units.length === 0 && <option value="">— Carga la flota demo desde el dashboard —</option>}
            {units.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.driver_name} · {u.plate}</option>)}
          </select>
        </div>

        {/* HUD */}
        <div className={`card-tactical p-6 text-center relative overflow-hidden ${panic ? "ring-2 ring-[#FF2A2A] pulse-critical" : ""}`} style={{ background: "#000" }}>
          {moving && (
            <div className="absolute top-2 right-3 flex items-center gap-1 text-[#FFB800] text-[11px] font-tel"><Lock size={12} weight="fill" /> TECLADO BLOQUEADO</div>
          )}
          <div className="text-xs font-bold uppercase tracking-[0.3em] text-zinc-500">HUD Nocturno</div>
          <div data-testid="hud-speed" className="font-tel font-bold text-7xl mt-2" style={{ color: speed > 95 ? "#FF2A2A" : "#00E676", textShadow: "0 0 24px rgba(0,230,118,.3)" }}>{speed}</div>
          <div className="text-zinc-500 text-sm font-tel">km/h</div>
          <div className="mt-4 flex items-center justify-center gap-2 text-zinc-300"><NavigationArrow size={18} weight="fill" /> Continuar por Carretera 85 — Nuevo Laredo</div>
          <div className="font-tel text-xs text-zinc-600 mt-2">{pos[0].toFixed(5)}, {pos[1].toFixed(5)} · ruta {(progress * 100).toFixed(0)}%</div>
        </div>

        {/* controls */}
        <div className="card-tactical p-4 space-y-4">
          <div className="flex items-center justify-between">
            <button data-testid="sim-drive-toggle" onClick={() => setDriving((d) => !d)} disabled={!unitId}
              className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-md font-bold transition-colors disabled:opacity-40 ${driving ? "bg-[#FFB800] text-black" : "bg-white text-black hover:bg-zinc-200"}`}>
              {driving ? <><Pause size={18} weight="fill" /> Detener marcha</> : <><Play size={18} weight="fill" /> Iniciar marcha</>}
            </button>
          </div>
          <div>
            <div className="flex justify-between text-xs text-zinc-500 mb-1"><span>Velocidad</span><span className="font-tel">{speed} km/h</span></div>
            <input data-testid="sim-speed-slider" type="range" min="0" max="120" value={speed} onChange={(e) => setSpeed(Number(e.target.value))} className="w-full accent-white" />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input data-testid="sim-deviate" type="checkbox" checked={deviate} onChange={(e) => setDeviate(e.target.checked)} className="accent-[#FFB800]" /> Salir del corredor
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input data-testid="sim-jammer" type="checkbox" checked={jammer} onChange={(e) => setJammer(e.target.checked)} className="accent-[#FF2A2A]" /> Perder senal (jammer)
            </label>
          </div>
        </div>

        {/* event buttons */}
        <div className="grid grid-cols-2 gap-3">
          <button data-testid="panic-button" onClick={() => trigger("panic")} disabled={!unitId}
            className="bg-[#FF2A2A] text-white font-bold py-4 rounded-md flex items-center justify-center gap-2 hover:bg-[#e02020] transition-colors disabled:opacity-40">
            <Siren size={20} weight="fill" /> Botón de Pánico
          </button>
          <button data-testid="impact-button" onClick={() => trigger("impact")} disabled={!unitId}
            className="border border-[#FF2A2A]/40 text-[#FF2A2A] font-bold py-4 rounded-md flex items-center justify-center gap-2 hover:bg-[#FF2A2A]/10 transition-colors disabled:opacity-40">
            <Warning size={20} weight="fill" /> Simular impacto
          </button>
          <button data-testid="drop-button" onClick={() => trigger("drop")} disabled={!unitId}
            className="border border-white/10 text-zinc-300 font-medium py-3 rounded-md flex items-center justify-center gap-2 hover:border-white/40 transition-colors disabled:opacity-40 col-span-2 text-sm">
            <Truck size={16} /> Tirar el celular (debe filtrarse, sin alarma)
          </button>
        </div>

        {/* chat */}
        <div className="card-tactical p-4">
          <div className="text-xs font-bold uppercase tracking-[0.18em] text-zinc-500 mb-2">Chat seguro con base</div>
          <div className="flex flex-wrap gap-1.5 mb-2">
            {["Tráfico detenido", "Retén militar", "Todo en orden"].map((q) => (
              <button key={q} data-testid={`sim-quick-${q}`} onClick={() => sendChat(q, true)}
                className="text-[11px] px-2 py-1 rounded border border-white/10 text-zinc-300 hover:border-white/40 transition-colors">{q}</button>
            ))}
          </div>
          <div className="flex gap-2">
            <input data-testid="sim-chat-input" value={chatText} onChange={(e) => setChatText(e.target.value)} disabled={moving}
              placeholder={moving ? "Bloqueado en movimiento (0 km/h para escribir)" : "Texto libre…"}
              className="flex-1 bg-[#0d0d0d] border border-white/10 rounded-md px-3 py-2 text-sm outline-none focus:border-white/40 disabled:opacity-50" />
            <button data-testid="sim-chat-send" onClick={() => sendChat(chatText)} disabled={moving} className="bg-white text-black px-3 rounded-md disabled:opacity-40"><PaperPlaneRight size={16} weight="fill" /></button>
          </div>
        </div>
      </div>
    </div>
  );
}
