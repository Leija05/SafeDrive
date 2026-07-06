import { useState, useEffect } from "react";
import { Gauge } from "@phosphor-icons/react";

const DIM_LABELS = {
  velocidad: "Velocidad",
  eventos_criticos: "Críticos",
  desviaciones: "Ruta",
  senal: "Señal",
  bateria: "Batería",
};

function RadialGauge({ score, size = 100, strokeWidth = 7 }) {
  const r = (size - strokeWidth) / 2;
  const circ = 2 * Math.PI * r;
  const [offset, setOffset] = useState(circ);

  useEffect(() => {
    const timer = setTimeout(() => setOffset(circ * (1 - score / 100)), 100);
    return () => clearTimeout(timer);
  }, [score, circ]);

  const color = score >= 75 ? "#00E676" : score >= 50 ? "#FFB800" : "#FF2A2A";

  return (
    <svg width={size} height={size} className="drop-shadow-lg shrink-0">
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={strokeWidth} />
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={strokeWidth}
        strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={offset}
        style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(0.34, 1.56, 0.64, 1)" }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`} />
    </svg>
  );
}

export default function DriverScoreCard({ score, dimensions, alertsCount, history }) {
  const scoreColor = score >= 75 ? "#00E676" : score >= 50 ? "#FFB800" : "#FF2A2A";
  const maxDim = Math.max(...Object.values(dimensions || {}), 1);

  return (
    <div className="card-premium p-4" style={{ borderRadius: 16 }}>
      <div className="font-heading font-bold flex items-center gap-2 text-sm mb-3">
        <Gauge size={16} weight="fill" style={{ color: scoreColor }} /> Score de seguridad
      </div>

      <div className="flex items-center gap-5">
        <div className="relative shrink-0">
          <RadialGauge score={score} size={96} strokeWidth={8} />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold font-tel tracking-tight" style={{ color: scoreColor, textShadow: scoreColor ? `0 0 20px ${scoreColor}40` : undefined }}>{score}</div>
              <div className="text-[8px] uppercase tracking-widest text-zinc-500 font-tel">Score</div>
            </div>
          </div>
        </div>

        <div className="flex-1 min-w-0 space-y-1.5">
          {Object.entries(DIM_LABELS).map(([key, label]) => {
            const val = dimensions?.[key] ?? 0;
            const barColor = val >= 75 ? "#00E676" : val >= 50 ? "#FFB800" : "#FF2A2A";
            return (
              <div key={key} className="flex items-center gap-2">
                <span className="text-[10px] font-tel text-zinc-500 w-14 shrink-0">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-white/5 overflow-hidden">
                  <div className="h-full rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${Math.max(2, (val / maxDim) * 100)}%`, background: barColor }} />
                </div>
                <span className="text-[10px] font-tel font-medium w-6 text-right" style={{ color: barColor }}>{val}</span>
              </div>
            );
          })}
        </div>
      </div>

      {history && history.length > 1 && (
        <div className="mt-3 pt-3 border-t border-white/5">
          <div className="flex items-end gap-[2px] h-8">
            {history.map((h, i) => {
              const barColor = h.score >= 75 ? "#00E676" : h.score >= 50 ? "#FFB800" : "#FF2A2A";
              const barHeight = Math.max(4, (h.score / 100) * 28);
              const isLatest = i === history.length - 1;
              return (
                <div key={h.date} className="flex-1 flex flex-col items-center gap-0.5 group relative">
                  <div className="w-full rounded-t-sm transition-all duration-300 hover:opacity-80"
                    style={{ height: `${barHeight}px`, background: barColor, opacity: isLatest ? 1 : 0.5 }} />
                  <div className="absolute -top-6 left-1/2 -translate-x-1/2 bg-black/90 text-[9px] text-white px-1.5 py-0.5 rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap font-tel">
                    {h.date}: {h.score}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
