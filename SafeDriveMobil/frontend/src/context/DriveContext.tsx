import React, { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { AppState, Platform, Alert } from "react-native";
import * as Haptics from "expo-haptics";
import * as Location from "expo-location";
import { Accelerometer } from "expo-sensors";
import { activateKeepAwakeAsync, deactivateKeepAwake } from "expo-keep-awake";
import { apiFetch, getWsUrl } from "@/src/lib/api";
import { storage } from "@/src/utils/storage";
import { useAuth } from "./AuthContext";

const QUEUE_KEY = "sd_blackbox_queue";

export type LatLng = { lat: number; lng: number };
import type { Telemetry } from "@/src/types/api";

type TelemetryPoint = Telemetry;

type DriveState = {
  tripActive: boolean;
  starting: boolean;
  permissionDenied: boolean;
  webUnsupported: boolean;
  speed: number; // km/h
  location: LatLng | null;
  heading: number;
  status: string;
  deviationM: number;
  route: number[][];
  routeName: string;
  routeTolerance: number;
  unitName: string;
  queueCount: number;
  reflection: boolean;
  panicActive: boolean;
  startTrip: () => Promise<void>;
  stopTrip: () => Promise<void>;
  triggerPanic: () => Promise<void>;
  reportDistraction: (reason?: string) => Promise<void>;
  cancelPanic: () => void;
  toggleReflection: () => void;
  refreshUnit: () => Promise<void>;
};

const DriveContext = createContext<DriveState>({} as DriveState);

export function DriveProvider({ children }: { children: React.ReactNode }) {
  const { token, unit, user } = useAuth();
  const isWeb = Platform.OS === "web";

  const [tripActive, setTripActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [permissionDenied, setPermissionDenied] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [location, setLocation] = useState<LatLng | null>(null);
  const [heading, setHeading] = useState(0);
  const [status, setStatus] = useState("detenido");
  const [deviationM, setDeviationM] = useState(0);
  const [route, setRoute] = useState<number[][]>([]);
  const [routeName, setRouteName] = useState("Ruta asignada por central");
  const [routeTolerance, setRouteTolerance] = useState<number>(400);
  const [unitName, setUnitName] = useState("UNIDAD");
  const [queueCount, setQueueCount] = useState(0);
  const [reflection, setReflection] = useState(false);
  const [panicActive, setPanicActive] = useState(false);

  const locSub = useRef<Location.LocationSubscription | null>(null);
  const accSub = useRef<any>(null);
  const peakG = useRef(0);
  const peakGStart = useRef(0);

  // Load assigned route + unit info
  const refreshUnit = useCallback(async () => {
    if (!token || user?.role !== "driver") return;
    try {
      const u = await apiFetch("/driver/unit");
      setRoute(u.assigned_route || []);
      setRouteName(u.route_name || "Ruta asignada por central");
      setUnitName(u.name || "UNIDAD");
      setStatus(u.status || "detenido");
      setTripActive(!!u.trip_active);
      if (u.lat && u.lng && !location) setLocation({ lat: u.lat, lng: u.lng });
    } catch {}
  }, [token, user]);

  useEffect(() => {
    if (unit) {
      setRoute(unit.assigned_route || []);
      setRouteName(unit.route_name || "Ruta asignada por central");
      setUnitName(unit.name || "UNIDAD");
      setStatus(unit.status || "detenido");
      setTripActive(!!unit.trip_active);
    }
    refreshUnit();
    (async () => {
      const q = await storage.getItem<TelemetryPoint[]>(QUEUE_KEY, []);
      setQueueCount(q ? q.length : 0);
    })();
  }, [token]);

  // Real-time updates: WebSocket connection to receive unit updates
  useEffect(() => {
    if (!token || !unit) return;
    let ws: WebSocket | null = null;
    try {
      ws = new WebSocket(getWsUrl());
    } catch (e) {
      return;
    }

    ws.onopen = () => {};
    ws.onmessage = (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === "unit_update" && msg.unit && msg.unit.id === unit.id) {
          const updatedUnit = msg.unit;
          // If assigned route changed, notify and update local route
          const oldCorridor = JSON.stringify(route || []);
          const newCorridor = JSON.stringify(updatedUnit.assigned_route || []);
          if (oldCorridor !== newCorridor) {
            // Haptic + alert
            try { Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success); } catch {}
            try { Alert.alert("Ruta actualizada", "La ruta fue modificada por central. Se actualizará en la app."); } catch {}
            setRoute(updatedUnit.assigned_route || []);
            setRouteName(updatedUnit.route_name || "Ruta asignada por central");
            setRouteTolerance(updatedUnit.route_tolerance_m || 400);
          }
          setStatus(updatedUnit.status || status);
          setTripActive(!!updatedUnit.trip_active);
          if (updatedUnit.lat && updatedUnit.lng) setLocation({ lat: updatedUnit.lat, lng: updatedUnit.lng });
        }
      } catch (e) {}
    };
    ws.onerror = () => {};
    ws.onclose = () => { ws = null; };

    return () => { try { ws?.close(); } catch {} };
  }, [token, unit, route, status]);

  const flushQueue = useCallback(async () => {
    const q = (await storage.getItem<TelemetryPoint[]>(QUEUE_KEY, [])) || [];
    if (q.length === 0) return;
    try {
      await apiFetch("/driver/telemetry/batch", {
        method: "POST",
        body: JSON.stringify({ points: q }),
      });
      await storage.setItem(QUEUE_KEY, []);
      setQueueCount(0);
    } catch {
      // still offline, keep queue
    }
  }, []);

  const enqueue = useCallback(async (p: TelemetryPoint) => {
    const q = (await storage.getItem<TelemetryPoint[]>(QUEUE_KEY, [])) || [];
    q.push(p);
    const trimmed = q.slice(-2000);
    await storage.setItem(QUEUE_KEY, trimmed);
    setQueueCount(trimmed.length);
  }, []);

  const sendTelemetry = useCallback(
    async (p: TelemetryPoint) => {
      try {
        const res = await apiFetch("/driver/telemetry", {
          method: "POST",
          body: JSON.stringify(p),
        });
        setStatus(res.status);
        setDeviationM(res.deviation_m || 0);
        flushQueue();
      } catch (e: any) {
        // Black box: store locally for burst sync on reconnect
        if (e?.status === 409) return; // session conflict handled by auth
        await enqueue(p);
      }
    },
    [enqueue, flushQueue]
  );

  const onLocation = useCallback(
    (loc: Location.LocationObject) => {
      const { latitude, longitude, speed: mps, heading: hd } = loc.coords;
      const kmh = mps != null && mps > 0 ? mps * 3.6 : 0;
      setLocation({ lat: latitude, lng: longitude });
      setSpeed(Math.round(kmh));
      if (hd != null && hd >= 0) setHeading(hd);

      let g: number | null = null;
      let gdur: number | null = null;
      if (peakG.current >= 2.5) {
        g = peakG.current;
        gdur = Date.now() - peakGStart.current;
        peakG.current = 0;
      }

      sendTelemetry({
        lat: latitude, lng: longitude, speed: kmh, heading: hd ?? heading,
        g_force: g, g_duration_ms: gdur, ts: new Date().toISOString(),
      });
    },
    [heading, sendTelemetry]
  );

  const startTrip = useCallback(async () => {
    setStarting(true);
    setPermissionDenied(false);
    try {
      if (isWeb) {
        // Web preview cannot access on-device GPS; mark trip active for UI.
        await apiFetch("/driver/trip/start", { method: "POST" }).catch(() => {});
        setTripActive(true);
        return;
      }
      const { status: perm } = await Location.requestForegroundPermissionsAsync();
      if (perm !== "granted") {
        setPermissionDenied(true);
        return;
      }
      await apiFetch("/driver/trip/start", { method: "POST" }).catch(() => {});
      await activateKeepAwakeAsync().catch(() => {});

      Accelerometer.setUpdateInterval(250);
      accSub.current = Accelerometer.addListener(({ x, y, z }) => {
        const mag = Math.sqrt(x * x + y * y + z * z);
        if (mag >= 2.5 && mag > peakG.current) {
          if (peakG.current === 0) peakGStart.current = Date.now();
          peakG.current = mag;
        }
      });

      locSub.current = await Location.watchPositionAsync(
        { accuracy: Location.Accuracy.High, timeInterval: 3000, distanceInterval: 8 },
        onLocation
      );
      setTripActive(true);
    } finally {
      setStarting(false);
    }
  }, [isWeb, onLocation]);

  const stopTrip = useCallback(async () => {
    locSub.current?.remove();
    locSub.current = null;
    accSub.current?.remove();
    accSub.current = null;
    if (!isWeb) deactivateKeepAwake();
    setSpeed(0);
    setTripActive(false);
    await apiFetch("/driver/trip/stop", { method: "POST" }).catch(() => {});
  }, [isWeb]);

  const triggerPanic = useCallback(async () => {
    setPanicActive(true);
    const loc = location || { lat: route[0]?.[0] ?? 25.6866, lng: route[0]?.[1] ?? -100.3161 };
    try {
      await apiFetch("/driver/panic", {
        method: "POST",
        body: JSON.stringify({ lat: loc.lat, lng: loc.lng, speed, panic: true, ts: new Date().toISOString() }),
      });
    } catch (e) {
      await enqueue({ lat: loc.lat, lng: loc.lng, speed, ts: new Date().toISOString() });
    }
  }, [location, speed, route, enqueue]);


  const reportDistraction = useCallback(async (reason = "La app fue minimizada o bloqueada durante un viaje activo") => {
    const loc = location || { lat: route[0]?.[0] ?? 25.6866, lng: route[0]?.[1] ?? -100.3161 };
    const payload = { lat: loc.lat, lng: loc.lng, speed, reason, ts: new Date().toISOString() };
    try {
      await apiFetch("/driver/distracted", { method: "POST", body: JSON.stringify(payload) });
    } catch {
      await enqueue({ lat: loc.lat, lng: loc.lng, speed, ts: payload.ts, event: "distractor", reason } as TelemetryPoint);
    }
  }, [enqueue, location, route, speed]);

  useEffect(() => {
    const sub = AppState.addEventListener("change", (nextState) => {
      if (tripActive && nextState !== "active") {
        reportDistraction(nextState === "background" ? "Intento de minimizar la app durante el viaje" : "Pantalla inactiva durante el viaje");
      }
    });
    return () => sub.remove();
  }, [reportDistraction, tripActive]);

  const cancelPanic = useCallback(() => setPanicActive(false), []);
  const toggleReflection = useCallback(() => setReflection((r) => !r), []);

  useEffect(() => {
    return () => {
      locSub.current?.remove();
      accSub.current?.remove();
    };
  }, []);

  return (
    <DriveContext.Provider
      value={{
        tripActive, starting, permissionDenied, webUnsupported: isWeb, speed, location, heading,
        status, deviationM, route, routeName, routeTolerance, unitName, queueCount, reflection, panicActive,
          startTrip, stopTrip, triggerPanic, reportDistraction, cancelPanic, toggleReflection, refreshUnit,
      }}
    >
      {children}
    </DriveContext.Provider>
  );
}

export const useDrive = () => useContext(DriveContext);
