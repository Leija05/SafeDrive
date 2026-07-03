import { MapContainer, TileLayer, Polyline, Circle, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import { useEffect } from "react";

const STATUS_COLOR = {
  en_ruta: "#00E676",
  detenido: "#FFB800",
  alerta: "#FF2A2A",
  offline: "#52525B",
  cruce_fiscal: "#007AFF",
};

function unitIcon(unit) {
  const color = STATUS_COLOR[unit.status] || "#A1A1AA";
  const critical = unit.status === "alerta";
  const ring = critical
    ? `<span class="radar-ping" style="position:absolute;inset:-8px;border-radius:50%;background:${color};opacity:.5"></span>`
    : "";
  return L.divIcon({
    className: "",
    html: `<div style="position:relative;">${ring}<div class="map-marker" style="background:${color};position:relative;">${unit.name.replace("NL-", "")}</div></div>`,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
  });
}

function FitBounds({ units }) {
  const map = useMap();
  useEffect(() => {
    if (units.length) {
      const pts = units.map((u) => [u.lat, u.lng]);
      try { map.fitBounds(L.latLngBounds(pts).pad(0.4)); } catch (e) {}
    }
  }, []); // eslint-disable-line
  return null;
}

export default function FleetMap({ units = [], route, selectedId, onSelect }) {
  const center = [26.7, -99.9];
  return (
    <MapContainer center={center} zoom={8} className="w-full h-full" style={{ background: "#0a0a0a" }} zoomControl={true}>
      <TileLayer className="dark-tiles" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        attribution="&copy; OpenStreetMap" />
      <FitBounds units={units} />
      {route?.corridor && (
        <Polyline positions={route.corridor} pathOptions={{ color: "#ffffff", weight: 2, opacity: 0.55, dashArray: "1 0" }} />
      )}
      {route?.bridges?.map((b, i) => (
        <Circle key={`b${i}`} center={[b.lat, b.lng]} radius={b.radius_m}
          pathOptions={{ color: "#007AFF", weight: 1, fillColor: "#007AFF", fillOpacity: 0.12 }} />
      ))}
      {route?.dead_zones?.map((d, i) => (
        <Circle key={`d${i}`} center={[d.lat, d.lng]} radius={d.radius_m}
          pathOptions={{ color: "#FFB800", weight: 1, dashArray: "6 6", fillColor: "#FFB800", fillOpacity: 0.06 }} />
      ))}
      {units.map((u) => (
        <Marker key={u.id} position={[u.lat, u.lng]} icon={unitIcon(u)}
          eventHandlers={{ click: () => onSelect && onSelect(u.id) }}>
          <Popup>
            <div style={{ fontFamily: "monospace", fontSize: 12 }}>
              <b>{u.name}</b> · {u.driver_name}<br />
              {u.speed?.toFixed(0)} km/h · {u.status}<br />
              {u.lat.toFixed(4)}, {u.lng.toFixed(4)}
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
