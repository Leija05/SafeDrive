import { MapContainer, TileLayer, Polyline, Circle, Marker, Popup, useMap, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useEffect, useRef, useState } from "react";
import { Crosshair } from "@phosphor-icons/react";

const STATUS_COLOR_MAP = {
  en_ruta: "#00E676", detenido: "#FFB800", alerta: "#FF2A2A", offline: "#52525B", cruce_fiscal: "#007AFF",
};

const DRIVER_PALETTE = ["#00E676", "#007AFF", "#FFB800", "#FF2A2A", "#A855F7", "#14B8A6", "#F97316", "#EC4899", "#22D3EE", "#F43F5E", "#84CC16", "#E879F9"];

function hashColor(seed = "") {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  return DRIVER_PALETTE[hash % DRIVER_PALETTE.length];
}

function driverColor(unit) {
  return /^#[0-9a-f]{6}$/i.test(unit?.color || "") ? unit.color : hashColor(`${unit?.id || ""}-${unit?.name || ""}`);
}

export function getDriverColor(unit) {
  return driverColor(unit);
}

function unitIcon(unit) {
  const color = driverColor(unit);
  const critical = unit.status === "alerta";
  const ring = critical
    ? `<span class="radar-ping" style="position:absolute;inset:-10px;border-radius:50%;background:${color};opacity:0.6"></span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;">${ring}<div class="map-marker" style="background:${color};position:relative;">${unit.name.replace("NL-", "")}</div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function pointIcon(label, color) {
  return L.divIcon({
    className: "",
    html: `<div style="background:${color};color:#000;border:2px solid #fff;border-radius:999px;width:26px;height:26px;display:flex;align-items:center;justify-content:center;font-weight:900;font-size:11px;box-shadow:0 0 20px ${color}99">${label}</div>`,
    iconSize: [26, 26],
    iconAnchor: [13, 13],
  });
}

function routeFor(unit, globalRoute) {
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

function MapCamera({ units, selectedId, focusRequest }) {
  const map = useMap();
  const didInitialFit = useRef(false);
  const lastSelectedId = useRef(null);
  const lastFocusRequest = useRef(0);

  useEffect(() => {
    if (didInitialFit.current || !units.length) return;
    const pts = units.map((u) => [u.lat, u.lng]).filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (pts.length) {
      try { map.fitBounds(L.latLngBounds(pts).pad(0.25)); didInitialFit.current = true; } catch (e) {}
    }
  }, [map, units]);

  useEffect(() => {
    if (!selectedId || selectedId === lastSelectedId.current) return;
    const unit = units.find((u) => u.id === selectedId);
    if (unit && Number.isFinite(unit.lat) && Number.isFinite(unit.lng)) {
      map.flyTo([unit.lat, unit.lng], Math.max(map.getZoom(), 13), { duration: 0.7 });
      lastSelectedId.current = selectedId;
    }
  }, [map, selectedId, units]);

  useEffect(() => {
    if (!focusRequest || focusRequest === lastFocusRequest.current || !selectedId) return;
    const unit = units.find((u) => u.id === selectedId);
    if (unit && Number.isFinite(unit.lat) && Number.isFinite(unit.lng)) {
      map.flyTo([unit.lat, unit.lng], 15, { duration: 0.6 });
      lastFocusRequest.current = focusRequest;
    }
  }, [focusRequest, map, selectedId, units]);

  return null;
}

function RouteEditorEvents({ points, onChange }) {
  useMapEvents({
    click(e) {
      if (points.length >= 2) return;
      onChange([...points, [e.latlng.lat, e.latlng.lng]]);
    },
  });
  return null;
}

export function RoutePickerMap({ points = [], color = "#00E676", onChange }) {
  const center = points[0] || [26.7, -99.9];
  return (
    <MapContainer center={center} zoom={7} className="w-full h-full" style={{ background: "#0a0a0a" }}>
      <TileLayer className="dark-tiles" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      <RouteEditorEvents points={points} onChange={onChange} />
      {points.map((p, i) => (
        <Marker key={`${p[0]}-${p[1]}-${i}`} position={p} icon={pointIcon(i === 0 ? "O" : "D", color)} />
      ))}
      {points.length === 2 && (
        <Polyline positions={points} pathOptions={{ color, weight: 5, opacity: 0.85, dashArray: "10 6" }} />
      )}
    </MapContainer>
  );
}

export default function FleetMap({ units = [], route, selectedId, onSelect }) {
  const center = [26.7, -99.9];
  const [focusRequest, setFocusRequest] = useState(0);
  const selectedUnit = units.find((u) => u.id === selectedId) || null;
  const selectedRoute = selectedUnit ? routeFor(selectedUnit, route) : null;
  const onlineCount = units.filter((u) => u.online).length;
  return (
    <div className="relative w-full h-full">
      <div className="absolute left-3 bottom-3 z-[600] flex gap-2">
        <div className="bg-black/60 backdrop-blur-md text-[10px] font-tel px-2.5 py-1.5 rounded-lg border border-white/10 text-zinc-400">
          {onlineCount}/{units.length} online
        </div>
      </div>
      {selectedId && (
        <button type="button" onClick={() => setFocusRequest((v) => v + 1)}
          className="absolute right-3 top-3 z-[600] bg-black/60 backdrop-blur-md hover:bg-black/80 text-white text-xs font-bold px-3 py-1.5 rounded-lg border border-white/10 shadow-lg transition-all flex items-center gap-1.5">
          <Crosshair size={14} /> Centrar
        </button>
      )}
      <MapContainer center={center} zoom={8} className="w-full h-full" style={{ background: "#0a0a0a" }} zoomControl={true}>
        <TileLayer className="dark-tiles" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
        <MapCamera units={units} selectedId={selectedId} focusRequest={focusRequest} />
        {units.map((u) => {
          const unitRoute = routeFor(u, route);
          if (!unitRoute?.corridor) return null;
          return (
            <Polyline
              key={`route-${u.id}`}
              positions={unitRoute.corridor}
              pathOptions={{ color: driverColor(u), weight: selectedId === u.id ? 6 : 3, opacity: selectedId && selectedId !== u.id ? 0.25 : 0.7 }}
            />
          );
        })}
        {selectedRoute?.corridor && selectedRoute?.tolerance_m && (
          <Polyline positions={selectedRoute.corridor} pathOptions={{ color: "#ffffff", weight: Math.max(8, selectedRoute.tolerance_m / 55), opacity: 0.08 }} />
        )}
        {selectedRoute?.bridges?.map((b, i) => (
          <Circle key={`b${i}`} center={[b.lat, b.lng]} radius={b.radius_m} pathOptions={{ color: "#007AFF", weight: 1, fillColor: "#007AFF", fillOpacity: 0.12 }} />
        ))}
        {selectedRoute?.dead_zones?.map((d, i) => (
          <Circle key={`d${i}`} center={[d.lat, d.lng]} radius={d.radius_m} pathOptions={{ color: "#FFB800", weight: 1, dashArray: "6 6", fillColor: "#FFB800", fillOpacity: 0.05 }} />
        ))}
        {units.map((u) => (
          <Marker key={u.id} position={[u.lat, u.lng]} icon={unitIcon(u)} eventHandlers={{ click: () => onSelect && onSelect(u.id) }}>
            <Popup>
              <div className="font-mono text-xs leading-relaxed" style={{ minWidth: 160 }}>
                <div className="font-bold text-sm mb-1" style={{ color: driverColor(u) }}>{u.name}</div>
                <div className="text-zinc-400">{u.driver_name || "—"}</div>
                <div className="border-t border-white/10 my-1.5" />
                <div className="grid grid-cols-2 gap-x-3 gap-y-1">
                  <span>{u.speed?.toFixed(0)} km/h</span>
                  <span style={{ color: STATUS_COLOR_MAP[u.status] || "#000" }}>{u.status}</span>
                  <span className="col-span-2">{u.lat?.toFixed(4)}, {u.lng?.toFixed(4)}</span>
                  <span className="col-span-2">tol. {routeFor(u, route)?.tolerance_m || 0}m</span>
                </div>
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
